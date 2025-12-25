import { env } from "../config/env.config.js";
import { JournalEntry } from "../models/chatEntry.model.js";
import type { JournalEntryRepository } from "../repository/journalEntry.repository.js";
import type { EncryptedField } from "../types/encryptedField.type.js";
import type { PaginatedJournalEntries } from "../types/paginatedJournalEtntries.type.js";
import type { SafeJournalEntry } from "../types/safeJournalEntry.type.js";
import { decrypt, encrypt } from "../utils/crypto.util.js";
import { toSafeJournalEntries, toSafeJournalEntry } from "../utils/journal.util.js";
import { publishMessage } from "../utils/pubsub.util.js";

/**
 * Service class for managing Journal entries.
 *
 * @description Provides methods to create, retrieve, update, and delete journal entries.
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
 * const service = new JournalService(journalRepo);
 * await service.createEntry(userId, "My private journal entry");
 * const entries = await service.getEntriesByUser(userId, 10);
 * ```
 *
 * @file journal.service.ts
 * 
 * @author Arthur M. Artugue
 * @created 2025-09-21
 * @updated 2025-09-25
 */
export class ChatService {
  private journalRepo : JournalEntryRepository;
  private secret: string;
  private readonly decryptField = (field: EncryptedField): string => decrypt(field, this.secret);


  /**
   * Creates an instance of the JournalService.
   * 
   * @param journalRepo - The repository used for accessing and managing journal entries.
   * 
   * Initializes the journal repository and sets the encryption key from environment variables.
   */
  constructor(journalRepo : JournalEntryRepository) {
    this.journalRepo = journalRepo;
    this.secret = env.CONTENT_ENCRYPTION_KEY;
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
  public async createEntry(userId: string, title: string, content: string): Promise<SafeJournalEntry> {

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