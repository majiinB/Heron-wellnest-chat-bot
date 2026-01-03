import type { SafeChatMessage } from "./safeChatMessage.type.js";

export type PaginatedSessionMessages = {
  messages: SafeChatMessage[];
  hasMore: boolean;
  nextCursor?: string; // message_id of the last entry for the next page
}