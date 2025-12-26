import { Repository } from "typeorm";
import { AppDataSource } from "../config/datasource.config.js";
import { ChatSession } from "../models/chatSession.model.js";

/**
 * Repository class for managing ChatSession entities in the database.
 *
 * @description Provides methods to create, retrieve, update, and delete chat sessions.
 *
 * @remarks
 * - Soft deletes are performed by setting the `is_deleted` flag to `true`, preserving the entry in the database.
 * - Hard deletes permanently remove the entry from the database.
 * - Entries marked as deleted (`is_deleted: true`) are excluded from most retrieval operations.
 *
 * @example
 * ```typescript
 * const repo = new JournalEntryRepository();
 * const entry = await repo.createEntry(userId, encryptedContent, { happy: 5 });
 * const allEntries = await repo.findByUser(userId);
 * ```
 * 
 * @file journalEntry.repository.ts
 * 
 * @author Arthur M. Artugue
 * @created 2025-09-21
 * @updated 2025-09-25
 */
export class ChatSessionRepository {
  private repo: Repository<ChatSession>;

  constructor() {
    this.repo = AppDataSource.getRepository(ChatSession);
  }

  /**
   * Creates a new chat session for a user.
   *
   * @param user_id - The unique identifier of the user creating the session.
   * @returns A promise that resolves to the saved chat session entity.
   */
  async createSession(
    user_id: string, 
  ): Promise<ChatSession> {
    const entry = this.repo.create({
      user_id,
    });
    return await this.repo.save(entry);
  }

  /**
   * Retrieves a chat session by its unique identifier, excluding entries marked as deleted.
   *
   * @param session_id - The unique identifier of the chat session to retrieve.
   * @param user_id - The unique identifier of the user who owns the chat session.
   * @returns A promise that resolves to the chat session if found and not deleted, otherwise `null`.
   */
  async findSessionById(session_id: string, user_id: string): Promise<ChatSession | null> {
    return await this.repo.findOne({
      where: { session_id, user_id },
    });
  }

  /**
   * Updates a chat session entry with new status and/or insight ID values.
   *
   * @param session_id - The unique identifier of the chat session to update.
   * @param user_id - The unique identifier of the user who owns the chat session.
   * @param status - (Optional) The new status for the chat session.
   * @param insight_id - (Optional) The new insight ID for the chat session.
   * @returns The updated chat session if found, otherwise `null`.
   */
  async updateSession(
    session_id: string, 
    user_id: string,
    status?: "open" | "closed" | "waiting_for_bot" | "escalated",
    insight_id?: string,
  ): Promise <ChatSession | null> {
    const entry = await this.findSessionById(session_id, user_id);
    if (!entry) return null;

    if (status) entry.status = status;
    if (insight_id) entry.insight_id = insight_id;

    return await this.repo.save(entry);
  }


  /**
   * Permanently deletes a journal entry from the repository by its ID.
   *
   * @param journal_id - The unique identifier of the journal entry to delete.
   * @param user_id - The unique identifier of the user who owns the journal entry.
   * @returns A promise that resolves with the result of the delete operation.
   */
  async hardDelete(session_id: string, user_id: string): Promise<void> {
    await this.repo.delete({session_id, user_id});
  }

  /**
   * Retrieves the latest chat session for a specific user.
   *
   * @param user_id - The unique identifier of the user whose latest chat session is to be fetched.
   * @returns A promise that resolves to the most recent chat session for the user, or `null` if none exists.
   */
  async findLatestUserSession(user_id: string): Promise<ChatSession | null> {
    return await this.repo.findOne({
      where: { user_id },
      order: { created_at: "DESC" },
    });
  }

  /**
   * Counts the number of chat sessions for a specific user.
   *
   * @param user_id - The unique identifier of the user whose chat sessions are to be counted.
   * @returns A promise that resolves to the count of chat sessions for the specified user.
   */
  async countUserSession(user_id: string): Promise<number> {
    return await this.repo.count({
      where: { user_id },
    });
  }

}