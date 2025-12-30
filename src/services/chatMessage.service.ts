import { env } from "../config/env.config.js";
import { ChatSession } from "../models/chatSession.model.js";
import type { ChatSessionRepository } from "../repository/chatSession.repository.js";
import { AppError } from "../types/appError.type.js";
import type { EncryptedField } from "../types/encryptedField.type.js";
import type { PaginatedJournalEntries } from "../types/paginatedJournalEtntries.type.js";
import type { SafeJournalEntry } from "../types/safeJournalEntry.type.js";
import { decrypt, encrypt } from "../utils/crypto.util.js";
import { toSafeJournalEntries, toSafeJournalEntry } from "../utils/journal.util.js";
import { publishMessage } from "../utils/pubsub.util.js";

// Define allowed status transitions for chat sessions
const ALLOWED_TRANSITIONS: Record<ChatSession["status"], ChatSession["status"][]> = {
  "active": ["ended", "waiting_for_bot", "escalated"],
  "waiting_for_bot": ["active", "ended", "escalated"],
  "escalated": [],
  "ended": [],
};

/**
 * Service class for managing chat session entries.
 *
 * @description Provides methods to create, retrieve, update, and delete chat session entries.
 * Handles content encryption/decryption before interacting with the repository layer.
 *
 * @remarks
 * - Content is encrypted before storage and decrypted when retrieved.
 * - Soft delete marks an entry as deleted without removing it from the database.
 * - Hard delete permanently removes the entry.
 * - Supports pagination-like retrieval using `lastEntryId`.
 * - Encryption key is loaded from environment variables via `env.CONTENT_ENCRYPTION_KEY`.
 *
 * @example
 * ```typescript
 * const service = new ChatSessionService(chatSessionRepo);
 * await service.createNewSession(userId, botId);
 * const sessions = await service.getSessionsByUser(userId, 10);
 * ```
 *
 * @file chatSession.service.ts
 * 
 * @author Arthur M. Artugue
 * @created 2025-12-30
 * @updated 2025-12-30
 */
export class ChatSessionService {
  private chatSessionRepo : ChatSessionRepository;
  private secret: string;
  private readonly decryptField = (field: EncryptedField): string => decrypt(field, this.secret);


  /**
   * Creates an instance of the JournalService.
   * 
   * @param journalRepo - The repository used for accessing and managing journal entries.
   * 
   * Initializes the journal repository and sets the encryption key from environment variables.
   */
  constructor(chatSessionRepo : ChatSessionRepository) {
    this.chatSessionRepo = chatSessionRepo;
    this.secret = env.CONTENT_ENCRYPTION_KEY;
  }

  /**
   * Creates a new chat session for the specified user.
   *
   * If an open session already exists for the user, it returns that session instead.
   * 
   * @param userId - The unique identifier of the user for whom the session is created.
   * @returns A promise that resolves to the newly created `ChatSession`.
   */
  public async createNewSession(userId: string): Promise<ChatSession> {
    // Check if an open session already exists for the user. If so, return it.
    const existingSession = await this.chatSessionRepo.findLatestUserSession(userId);
    if (existingSession) return existingSession;
    
    // Create a new session
    const session : ChatSession = await this.chatSessionRepo.createSession(userId);
    return session;
  }

  /**
   * Retrieves a chat session by its ID for the specified user.
   *
   * @param sessionId - The unique identifier of the chat session to retrieve.
   * @param userId - The unique identifier of the user who owns the chat session.
   * @returns A promise that resolves to the `ChatSession` if found, otherwise `null`.
   */
  public async getSessionById(sessionId: string, userId: string): Promise<ChatSession | null> {
    const session = await this.chatSessionRepo.findSessionById(sessionId, userId);
    return session;
  }

  /**
   * Closes an active chat session by updating its status to 'ended'.
   *
   * @param sessionId - The unique identifier of the chat session to close.
   * @param userId - The unique identifier of the user who owns the chat session.
   * @returns A promise that resolves to the updated `ChatSession` if found and closed, otherwise `null`.
   */
  public async closeSession(sessionId: string, userId: string): Promise<ChatSession | null> {
    const session = await this.chatSessionRepo.findSessionById(sessionId, userId);
    if (!session) return null;

    if(!ALLOWED_TRANSITIONS[session.status].includes('ended')) {
      throw new AppError(
        400,
        "INVALID_STATUS_TRANSITION",
        `Cannot transition status from '${session.status}' to 'ended'.`,
        true
      );
    }
    session.status = "ended";

    return await this.chatSessionRepo.updateSession(session);
  }


  /**
   * Creates a new journal entry for the specified user.
   *
   * Encrypts the provided content using the service's secret before storing it.
   * Returns the created `JournalEntry` object.
   *
   * @param userId - The unique identifier of the user creating the entry.
   * @param content - The plain text content of the journal entry.
   * @returns A promise that resolves to the newly created `JournalEntry`.
   */
  public async createNew(userId: string, title: string, content: string): Promise<SafeJournalEntry> {

    const encryptedContent = encrypt(content, this.secret);
    const encryptedTitle = encrypt(title, this.secret);

    const entry : JournalEntry = await this.journalRepo.createEntry(userId, encryptedTitle, encryptedContent);

    await publishMessage(env.PUBSUB_JOURNAL_TOPIC, {
      eventType: 'JOURNAL_ENTRY_CREATED',
      userId,
      journalId: entry.journal_id,
      timestamp: new Date().toISOString(),
    });

    return toSafeJournalEntry(entry, this.decryptField);

  }

  /**
 * Retrieves a list of journal entries for a specific user, optionally paginated by the last entry ID.
 * Decrypts the content of each entry before returning.
 *
 * @param userId - The unique identifier of the user whose journal entries are to be retrieved.
 * @param limit - The maximum number of entries to return. Defaults to 10.
 * @param lastEntryId - (Optional) The ID of the last entry from the previous page, used for pagination.
 * @param timeFilter - (Optional) Filter entries by time period: 'today', 'yesterday', 'this_week', 'last_week'. Defaults to 'all'.
 * @returns A promise that resolves to an array of decrypted journal entries for the user.
 */
  public async getEntriesByUser(
    userId: string,
    limit: number = 10,
    lastEntryId?: string,
    timeFilter: 'today' | 'yesterday' | 'this_week' | 'last_week' | 'all' = 'all'
  ) : Promise<PaginatedJournalEntries> {
    const fetchLimit: number = limit + 1; // Fetch one extra to check if there's more

    const entries : JournalEntry[] = await this.journalRepo.findByUserAfterId(userId, lastEntryId, fetchLimit, timeFilter);

    const hasMore = entries.length > limit;

    // If more, remove the extra entry
    const slicedEntries = hasMore ? entries.slice(0, limit) : entries;

    return {
      entries: toSafeJournalEntries(slicedEntries, this.decryptField),
      hasMore,
      nextCursor: hasMore ? slicedEntries[slicedEntries.length - 1].journal_id : undefined,
    };
  }

  /**
   * Retrieves a journal entry by its ID, decrypting its content before returning.
   *
   * @param journalId - The unique identifier of the journal entry to retrieve.
   * @param userId - The unique identifier of the user who owns the journal entry.
   * @returns A promise that resolves to the journal entry with decrypted content, or `null` if not found.
   */
  public async getEntryById(journalId: string, userId: string): Promise<SafeJournalEntry | null> {
    const entry = await this.journalRepo.findById(journalId, userId);
    if (!entry) return null;

    return toSafeJournalEntry(entry, this.decryptField);
  }

  /**
   * Updates a journal entry with new content and/or mood.
   *
   * If `content` is provided, it will be encrypted before updating the entry.
   * The method returns the updated journal entry with decrypted content.
   * If no entry is found for the given `journalId`, it returns `null`.
   *
   * @param journalId - The unique identifier of the journal entry to update.
   * @param userId - The unique identifier of the user who owns the journal entry.
   * @param title - (Optional) The new title for the journal entry.
   * @param content - (Optional) The new content for the journal entry.
   * @returns A promise that resolves to the updated journal entry with decrypted content, or `null` if not found.
   */
  public async updateEntry(journalId: string, userId: string, title?: string, content?: string) : Promise<SafeJournalEntry | null> {
    let encryptedTitle : EncryptedField | undefined;
    let encryptedContent : EncryptedField | undefined;

    if (title) {
      encryptedTitle = encrypt(title, this.secret);
    }
    if (content) {
      encryptedContent = encrypt(content, this.secret);
    }

    const updatedEntry = await this.journalRepo.updateEntry(journalId, userId, encryptedTitle, encryptedContent);

    if (!updatedEntry) return null;

    await publishMessage(env.PUBSUB_JOURNAL_TOPIC, {
      eventType: 'JOURNAL_ENTRY_UPDATED',
      userId,
      journalId: updatedEntry.journal_id,
      timestamp: new Date().toISOString(),
    });

    return toSafeJournalEntry(updatedEntry, this.decryptField);
  }

  /**
   * Soft deletes a journal entry by its ID.
   * 
   * Marks the specified journal entry as deleted without permanently removing it from the database.
   *
   * @param journalId - The unique identifier of the journal entry to be soft deleted.
   * @param userId - The unique identifier of the user who owns the journal entry.
   * @returns A promise that resolves when the operation is complete.
   */
  public async softDeleteEntry(journalId: string, userId: string): Promise<boolean> {

    const entry = await this.journalRepo.softDelete(journalId, userId);

    return entry !== null;
  }

  /**
   * Permanently deletes a journal entry by its ID.
   * This operation removes the entry from the database and cannot be undone.
   *
   * @param journalId - The unique identifier of the journal entry to delete.
   * @returns A promise that resolves when the deletion is complete.
   */
  public async hardDeleteEntry(journalId: string, userId: string): Promise<void> {
    this.journalRepo.hardDelete(journalId, userId);
  }
}