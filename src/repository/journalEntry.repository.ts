import { And, LessThan, MoreThanOrEqual, type Repository } from "typeorm";
import { AppDataSource } from "../config/datasource.config.js";
import { JournalEntry } from "../models/chatEntry.model.js";
import type { EncryptedField } from "../types/encryptedField.type.js";

/**
 * Repository class for managing journal entry entities in the database.
 *
 * @description Provides methods for creating, retrieving, updating, soft deleting, and hard deleting journal entries.
 * All operations are performed using TypeORM's Repository API.
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
export class JournalEntryRepository {
  private repo: Repository<JournalEntry>;

  constructor() {
    this.repo = AppDataSource.getRepository(JournalEntry);
  }

  /**
   * Creates a new journal entry for a user.
   *
   * @param user_id - The unique identifier of the user creating the entry.
   * @param content_encrypted - The encrypted content of the journal entry.
   * @param mood - (Optional) An object representing the user's mood, where keys are mood types and values are their respective scores.
   * @returns A promise that resolves to the saved journal entry entity.
   */
  async createEntry(
    user_id: string, 
    title_encrypted: EncryptedField,
    content_encrypted: EncryptedField,
    wellness_state?: Record<string, number>
  ): Promise<JournalEntry> {
    const entry = this.repo.create({
      user_id,
      title_encrypted,
      content_encrypted,
      wellness_state
    });
    return await this.repo.save(entry);
  }

  /**
   * Retrieves a journal entry by its unique identifier, excluding entries marked as deleted.
   *
   * @param journal_id - The unique identifier of the journal entry to retrieve.
   * @param user_id - The unique identifier of the user who owns the journal entry.
   * @returns A promise that resolves to the journal entry if found and not deleted, otherwise `null`.
   */
  async findById(journal_id: string, user_id: string): Promise<JournalEntry | null> {
    return await this.repo.findOne({
      where: { journal_id, user_id, is_deleted: false },
    });
  }

  /**
 * Retrieves all journal entries for a specific user that have not been deleted.
 *
 * @param user_id - The unique identifier of the user whose journal entries are to be fetched.
 * @param lastEntryId - (Optional) The ID of the last journal entry from the previous page, used for pagination.
 * @param limit - (Optional) The maximum number of entries to retrieve. Defaults to 10.
 * @param timeFilter - (Optional) Filter entries by time period: 'today', 'yesterday', 'this_week', 'last_week'. Defaults to 'all'.
 * @returns A promise that resolves to an array of journal entries, ordered by creation date in descending order.
 */
async findByUserAfterId(
  user_id: string, 
  lastEntryId?: string, 
  limit: number = 10,
  timeFilter: 'today' | 'yesterday' | 'this_week' | 'last_week' | 'all' = 'all'
): Promise<JournalEntry[]> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const baseWhere: any = { user_id, is_deleted: false };

  // Add date filtering
  if (timeFilter !== 'all') {
    const { startDate, endDate } = this.getDateRange(timeFilter);
    baseWhere.created_at = And(MoreThanOrEqual(startDate), LessThan(endDate));
  }

  let where = baseWhere;

  if (lastEntryId) {
    const lastEntry = await this.repo.findOne({ where: { journal_id: lastEntryId } });
    if (lastEntry) {
      if (timeFilter !== 'all') {
        const { startDate, endDate } = this.getDateRange(timeFilter);
        where = [
          { 
            ...baseWhere, 
            created_at: And(
              MoreThanOrEqual(startDate), 
              LessThan(endDate), 
              LessThan(lastEntry.created_at)
            ) 
          },
          { 
            ...baseWhere, 
            created_at: And(
              MoreThanOrEqual(startDate), 
              LessThan(endDate), 
              LessThan(lastEntry.created_at)
            ), 
            journal_id: LessThan(lastEntry.journal_id) 
          }
        ];
      } else {
        where = [
          { user_id, is_deleted: false, created_at: LessThan(lastEntry.created_at) },
          { user_id, is_deleted: false, created_at: lastEntry.created_at, journal_id: LessThan(lastEntry.journal_id) }
        ];
      }
    }
  }

  return this.repo.find({
    where,
    order: { created_at: "DESC", journal_id: "DESC" },
    take: limit,
  });
}

  /**
   * Updates a journal entry with new encrypted content and/or mood values.
   *
   * @param journal_id - The unique identifier of the journal entry to update.
   * @param user_id - The unique identifier of the user who owns the journal entry.
   * @param title_encrypted - (Optional) The new encrypted title for the journal entry.
   * @param content_encrypted - (Optional) The new encrypted content for the journal entry.
   * @returns The updated journal entry if found, otherwise `null`.
   */
  async updateEntry(
    journal_id: string, 
    user_id: string,
    title_encrypted?: EncryptedField,
    content_encrypted?: EncryptedField, 
  ): Promise <JournalEntry | null> {
    const entry = await this.findById(journal_id, user_id);
    if (!entry) return null;

    if (title_encrypted) entry.title_encrypted = title_encrypted;
    if (content_encrypted) entry.content_encrypted = content_encrypted;

    return await this.repo.save(entry);
  }

  /**
   * Marks a journal entry as deleted by setting its `is_deleted` flag to `true`.
   * Performs a soft delete, preserving the entry in the database.
   *
   * @param journal_id - The unique identifier of the journal entry to be soft deleted.
   * @param user_id - The unique identifier of the user who owns the journal entry.
   * @returns The updated journal entry with `is_deleted` set to `true`, or `null` if the entry does not exist.
   */
  async softDelete(journal_id: string, user_id: string): Promise<JournalEntry | null> {
    const entry = await this.findById(journal_id, user_id);
    if (!entry) return null;

    entry.is_deleted = true;
    return await this.repo.save(entry);
  }

  /**
   * Permanently deletes a journal entry from the repository by its ID.
   *
   * @param journal_id - The unique identifier of the journal entry to delete.
   * @param user_id - The unique identifier of the user who owns the journal entry.
   * @returns A promise that resolves with the result of the delete operation.
   */
  async hardDelete(journal_id: string, user_id: string): Promise<void> {
    await this.repo.delete({journal_id, user_id});
  }

  /**
   * Retrieves the latest journal entry for a specific user that has not been deleted.
   *
   * @param user_id - The unique identifier of the user whose latest journal entry is to be fetched.
   * @returns A promise that resolves to the most recent journal entry for the user, or `null` if none exists.
   */
  async findLatestByUser(user_id: string): Promise<JournalEntry | null> {
    return await this.repo.findOne({
      where: { user_id, is_deleted: false },
      order: { created_at: "DESC" },
    });
  }

  /**
   * Counts the number of journal entries for a specific user that are not marked as deleted.
   *
   * @param user_id - The unique identifier of the user whose journal entries are to be counted.
   * @returns A promise that resolves to the count of non-deleted journal entries for the specified user.
   */
  async countByUser(user_id: string): Promise<number> {
    return await this.repo.count({
      where: { user_id, is_deleted: false },
    });
  }

  /**
 * Helper method to get date range based on time filter.
 * 
 * @param timeFilter - The time period filter.
 * @returns Object containing start and end dates.
 */
  private getDateRange(timeFilter: 'today' | 'yesterday' | 'this_week' | 'last_week'): { startDate: Date; endDate: Date } {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    
    switch (timeFilter) {
      case 'today':
        return {
          startDate: today,
          endDate: new Date(today.getTime() + 24 * 60 * 60 * 1000)
        };
        
      case 'yesterday':
        const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000);
        return {
          startDate: yesterday,
          endDate: today
        };
        
      case 'this_week':
        const startOfWeek = new Date(today);
        startOfWeek.setDate(today.getDate() - today.getDay()); // Start of week (Sunday)
        return {
          startDate: startOfWeek,
          endDate: new Date(now.getTime() + 24 * 60 * 60 * 1000)
        };
        
      case 'last_week':
        const startOfLastWeek = new Date(today);
        startOfLastWeek.setDate(today.getDate() - today.getDay() - 7);
        const endOfLastWeek = new Date(today);
        endOfLastWeek.setDate(today.getDate() - today.getDay());
        return {
          startDate: startOfLastWeek,
          endDate: endOfLastWeek
        };
        
      default:
        throw new Error('Invalid time filter');
    }
  }
}