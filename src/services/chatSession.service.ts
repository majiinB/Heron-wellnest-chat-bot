import { env } from "../config/env.config.js";
import { ChatSession } from "../models/chatSession.model.js";
import type { ChatSessionRepository } from "../repository/chatSession.repository.js";
import { AppError } from "../types/appError.type.js";
// import { publishMessage } from "../utils/pubsub.util.js"; will use later when closing session

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
   * Retrieves the active chat session for the specified user.
   * 
   * @param userId - The unique identifier of the user whose active session is to be retrieved.
   * @returns A promise that resolves to the active `ChatSession` if found, otherwise `null`.
   */
  public async getActiveSessionByUserId(userId: string): Promise<ChatSession | null> {
    const session = await this.chatSessionRepo.findLatestUserSession(userId);
    return session;
  }

  /**
   * Marks a chat session as 'waiting_for_bot'.
   *
   * @param sessionId - The unique identifier of the chat session to mark as waiting for bot.
   * @param userId - The unique identifier of the user who owns the chat session.
   * @returns A promise that resolves to the updated `ChatSession` if found and marked, otherwise `null`.
   */
  public async markWaitingForBot(sessionId: string, userId: string): Promise<ChatSession | null> {
    const session = await this.chatSessionRepo.findSessionById(sessionId, userId);
    if (!session) return null;

    if(!ALLOWED_TRANSITIONS[session.status].includes('waiting_for_bot')) {
      throw new AppError(
        400,
        "INVALID_STATUS_TRANSITION",
        `Cannot transition status from '${session.status}' to 'waiting_for_bot'.`,
        true
      );
    }
    session.status = "waiting_for_bot";

    return await this.chatSessionRepo.updateSession(session);
  }

  /**
   * Marks a chat session as 'active'.
   *
   * @param sessionId - The unique identifier of the chat session to mark as active.
   * @param userId - The unique identifier of the user who owns the chat session.
   * @returns A promise that resolves to the updated `ChatSession` if found and marked active, otherwise `null`.
   */
  public async markActive(sessionId: string, userId: string): Promise<ChatSession | null> {
    const session = await this.chatSessionRepo.findSessionById(sessionId, userId);
    if (!session) return null;

    if(!ALLOWED_TRANSITIONS[session.status].includes('active')) {
      throw new AppError(
        400,
        "INVALID_STATUS_TRANSITION",
        `Cannot transition status from '${session.status}' to 'active'.`,
        true
      );
    }

    session.status = "active";
    return await this.chatSessionRepo.updateSession(session);
  }

  /**
   * Marks a chat session as 'escalated'.
   * 
   * @param sessionId - The unique identifier of the chat session to escalate.
   * @param userId - The unique identifier of the user who owns the chat session.
   * @returns A promise that resolves to the updated `ChatSession` if found and escalated, otherwise `null`.
   */
  public async markEscalated(sessionId: string, userId: string): Promise<ChatSession | null> {
    const session = await this.chatSessionRepo.findSessionById(sessionId, userId);
    if (!session) return null;

    if(!ALLOWED_TRANSITIONS[session.status].includes('escalated')) {
      throw new AppError(
        400,
        "INVALID_STATUS_TRANSITION",
        `Cannot transition status from '${session.status}' to 'escalated'.`,
        true
      );
    }

    session.status = "escalated";
    return await this.chatSessionRepo.updateSession(session);
  }

  /**
   * Closes an active chat session by updating its status to 'ended'.
   *
   * @param sessionId - The unique identifier of the chat session to close.
   * @param userId - The unique identifier of the user who owns the chat session.
   * @returns A promise that resolves to the updated `ChatSession` if found and closed, otherwise `null`.
   */
  public async markCloseSession(sessionId: string, userId: string): Promise<ChatSession | null> {
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

    const updatedSession = await this.chatSessionRepo.updateSession(session);

    // TODO: Publish a message to notify other services about the closed session (do analysis, insights, etc.)

    return updatedSession;
  }
}