import type { SafeJournalEntry } from "./safeChatMessage.type.js";

export type PaginatedJournalEntries = {
  entries: SafeJournalEntry[];
  hasMore: boolean;
  nextCursor?: string; // journal_id of the last entry for the next page
}