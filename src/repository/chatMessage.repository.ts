import { And, LessThan, MoreThanOrEqual, type Repository } from "typeorm";
import { AppDataSource } from "../config/datasource.config.js";
import { ChatMessage } from "../models/chatMessage.model.js";
import type { EncryptedField } from "../types/encryptedField.type.js";

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
 * @created 2025-12-29
 * @updated 2026-01-01
 */
export class ChatMessageRepository {
  private repo: Repository<ChatMessage>;

  constructor() {
    this.repo = AppDataSource.getRepository(ChatMessage);
  }

  /**
   * Creates a new chat session for a user.
   *
   * @param user_id - The unique identifier of the user creating the session.
   * @returns A promise that resolves to the saved chat session entity.
   */
  async createMessage(
    user_id: string,
    session_id: string,
    role: "student" | "bot",
    content_encrypted: EncryptedField,
    sequence_number: number, 
  ): Promise<ChatMessage> {
    const entry = this.repo.create({
      user_id,
      session_id,
      role,
      content_encrypted,
      sequence_number,
    });
    return await this.repo.save(entry);
  }

  /**
   * Retrieves a chat message by its ID for a specific user.
   *
   * @param session_id - The unique identifier of the chat session to retrieve.
   * @param message_id - The unique identifier of the chat message to retrieve.
   * @param user_id - The unique identifier of the user who owns the chat session.
   * @returns A promise that resolves to the chat session if found and not deleted, otherwise `null`.
   */
  async findMessageById(session_id: string, message_id: string, user_id: string): Promise<ChatMessage | null> {
    return await this.repo.findOne({
      where: { session_id, message_id, user_id },
    });
  }
  
  /**
   * Retrieves the latest chat message for a specific user.
   *
   * @param user_id - The unique identifier of the user whose latest chat session is to be fetched.
   * @param session_id - The unique identifier of the chat session.
   * @returns A promise that resolves to the most recent chat session for the user, or `null` if none exists.
   */
  async findLatestUserMessageBySession(user_id: string, session_id: string): Promise<ChatMessage | null> {
    return await this.repo.findOne({
      where: { user_id, session_id, role: "student", is_deleted: false },
      order: { created_at: "DESC" },
    });
  }

  /**
   * Retrieves the latest bot message for a specific user.
   * 
   * @param user_id - The unique identifier of the user whose latest bot message is to be fetched.
   * @param session_id - The unique identifier of the chat session.
   * @returns A promise that resolves to the most recent bot message for the user, or `null` if none exists.
   */
  async findLatestBotMessageBySession(user_id: string, session_id: string): Promise<ChatMessage | null> {
    return await this.repo.findOne({
      where: { user_id, session_id, role: "bot", is_deleted: false },
      order: { created_at: "DESC" },
    });
  }

  /**
   * Retrieves the latest chat message for a specific session.
   *
   * @param user_id - The unique identifier of the user whose latest chat message is to be fetched.
   * @param session_id - The unique identifier of the chat session.
   * @returns A promise that resolves to the most recent chat message for the user, or `null` if none exists.
   */
  async findLatestMessageBySession(user_id: string, session_id: string): Promise<ChatMessage | null> {
    return await this.repo.findOne({
      where: { user_id, session_id, is_deleted: false },
      order: { created_at: "DESC" },
    });
  }

  /**
   * Permanently deletes a chat message entry from the repository by its ID.
   *
   * @param session_id - The unique identifier of the chat session to delete.
   * @param user_id - The unique identifier of the user who owns the chat session.
   * @returns A promise that resolves with the result of the delete operation.
   */
  async hardDelete(session_id: string, message_id: string, user_id: string): Promise<void> {
    await this.repo.delete({session_id, message_id, user_id});
  }

  /**
   * Soft deletes a chat message entry by setting its `is_deleted` flag to `true`.
   *
   * @param session_id - The unique identifier of the chat session to soft delete.
   * @param user_id - The unique identifier of the user who owns the chat session.
   * @returns A promise that resolves when the soft delete operation is complete.
   */
  async softDelete(session_id: string, message_id: string, user_id: string): Promise<void> {
    await this.repo.update({session_id, message_id, user_id}, { is_deleted: true });
  }

  /**
   * Counts the number of chat sessions for a specific user.
   *
   * @param user_id - The unique identifier of the user whose chat sessions are to be counted.
   * @returns A promise that resolves to the count of chat sessions for the specified user.
   */
  async countUserMessages(user_id: string, session_id: string): Promise<number> {
    return await this.repo.count({
      where: { user_id, session_id },
    });
  }

    /**
   * Retrieves chat messages for a specific session and user with cursor-based pagination.
   *
   * @param session_id - The unique identifier of the chat session.
   * @param user_id - The unique identifier of the user whose chat messages are to be fetched.
   * @param lastMessageId - (Optional) The ID of the last chat message from the previous page, used for pagination.
   * @param limit - (Optional) The maximum number of messages to retrieve. Defaults to 10.
   * @returns A promise that resolves to an array of chat messages, ordered by creation date in descending order.
   */
  async findByMessageAfterId(
    session_id: string,
    user_id: string, 
    lastMessageId?: string, 
    limit: number = 10,
  ): Promise<ChatMessage[]> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const baseWhere: any = { session_id, user_id, is_deleted: false };

    let where = baseWhere;

    if (lastMessageId) {
      const lastEntry = await this.repo.findOne({ where: { message_id: lastMessageId } });
      if (lastEntry) {
        where = [
          { session_id, user_id, is_deleted: false, created_at: LessThan(lastEntry.created_at) },
          { session_id, user_id, is_deleted: false, created_at: lastEntry.created_at, message_id: LessThan(lastEntry.message_id) }
        ];
      }
    }

    return this.repo.find({
      where,
      order: { created_at: "DESC", message_id: "DESC" },
      take: limit,
    });
  }

  // findForAnalysis(
  //   sessionId: string,
  //   maxMessages: number
  // ): Promise<ChatMessage[]>
}