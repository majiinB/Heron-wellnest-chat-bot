import type { ChatMessage } from "../models/chatMessage.model.js";

/**
 * Safe Chat Message Type
 * 
 * @description Defines the structure for Chat Message with its content already decrypted.
 * 
 * @file safeChatMessage.type.ts
 * 
 * @author Arthur M. Artugue
 * @created 2025-12-31
 * @updated 2025-12-31
 */
export type SafeChatMessage = Omit<ChatMessage, "content_encrypted"> & {
  message: string;
};