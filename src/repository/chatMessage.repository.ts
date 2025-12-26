import { And, LessThan, MoreThanOrEqual, type Repository } from "typeorm";
import { AppDataSource } from "../config/datasource.config.js";
import { ChatSession } from "../models/chatSession.model.js";
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

//   /**
//  * Helper method to get date range based on time filter.
//  * 
//  * @param timeFilter - The time period filter.
//  * @returns Object containing start and end dates.
//  */
//   private getDateRange(timeFilter: 'today' | 'yesterday' | 'this_week' | 'last_week'): { startDate: Date; endDate: Date } {
//     const now = new Date();
//     const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    
//     switch (timeFilter) {
//       case 'today':
//         return {
//           startDate: today,
//           endDate: new Date(today.getTime() + 24 * 60 * 60 * 1000)
//         };
        
//       case 'yesterday':
//         const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000);
//         return {
//           startDate: yesterday,
//           endDate: today
//         };
        
//       case 'this_week':
//         const startOfWeek = new Date(today);
//         startOfWeek.setDate(today.getDate() - today.getDay()); // Start of week (Sunday)
//         return {
//           startDate: startOfWeek,
//           endDate: new Date(now.getTime() + 24 * 60 * 60 * 1000)
//         };
        
//       case 'last_week':
//         const startOfLastWeek = new Date(today);
//         startOfLastWeek.setDate(today.getDate() - today.getDay() - 7);
//         const endOfLastWeek = new Date(today);
//         endOfLastWeek.setDate(today.getDate() - today.getDay());
//         return {
//           startDate: startOfLastWeek,
//           endDate: endOfLastWeek
//         };
        
//       default:
//         throw new Error('Invalid time filter');
//     }
//   }

//   /**
//  * Retrieves all journal entries for a specific user that have not been deleted.
//  *
//  * @param user_id - The unique identifier of the user whose journal entries are to be fetched.
//  * @param lastEntryId - (Optional) The ID of the last journal entry from the previous page, used for pagination.
//  * @param limit - (Optional) The maximum number of entries to retrieve. Defaults to 10.
//  * @param timeFilter - (Optional) Filter entries by time period: 'today', 'yesterday', 'this_week', 'last_week'. Defaults to 'all'.
//  * @returns A promise that resolves to an array of journal entries, ordered by creation date in descending order.
//  */
// async findByUserAfterId(
//   user_id: string, 
//   lastEntryId?: string, 
//   limit: number = 10,
//   timeFilter: 'today' | 'yesterday' | 'this_week' | 'last_week' | 'all' = 'all'
// ): Promise<JournalEntry[]> {
//   // eslint-disable-next-line @typescript-eslint/no-explicit-any
//   const baseWhere: any = { user_id, is_deleted: false };

//   // Add date filtering
//   if (timeFilter !== 'all') {
//     const { startDate, endDate } = this.getDateRange(timeFilter);
//     baseWhere.created_at = And(MoreThanOrEqual(startDate), LessThan(endDate));
//   }

//   let where = baseWhere;

//   if (lastEntryId) {
//     const lastEntry = await this.repo.findOne({ where: { journal_id: lastEntryId } });
//     if (lastEntry) {
//       if (timeFilter !== 'all') {
//         const { startDate, endDate } = this.getDateRange(timeFilter);
//         where = [
//           { 
//             ...baseWhere, 
//             created_at: And(
//               MoreThanOrEqual(startDate), 
//               LessThan(endDate), 
//               LessThan(lastEntry.created_at)
//             ) 
//           },
//           { 
//             ...baseWhere, 
//             created_at: And(
//               MoreThanOrEqual(startDate), 
//               LessThan(endDate), 
//               LessThan(lastEntry.created_at)
//             ), 
//             journal_id: LessThan(lastEntry.journal_id) 
//           }
//         ];
//       } else {
//         where = [
//           { user_id, is_deleted: false, created_at: LessThan(lastEntry.created_at) },
//           { user_id, is_deleted: false, created_at: lastEntry.created_at, journal_id: LessThan(lastEntry.journal_id) }
//         ];
//       }
//     }
//   }

//   return this.repo.find({
//     where,
//     order: { created_at: "DESC", journal_id: "DESC" },
//     take: limit,
//   });
// }
}