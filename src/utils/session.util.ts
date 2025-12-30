import type { ChatSession } from "../models/chatSession.model.js";
import { AppError } from "../types/appError.type.js";

/**
 * Asserts that a chat session is active.
 * 
 * @param session - The chat session to check.
 * @throws {AppError} If the session is not active.
 */
export function assertSessionIsActive(session: ChatSession): void {
  if (session.status !== 'active') {
    throw new AppError(
      400,
      'SESSION_NOT_ACTIVE',
      `Chat session with ID '${session.session_id}' is not active.`,
      true
    );
  }
}