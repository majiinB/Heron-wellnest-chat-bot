import { env } from "../config/env.config.js";
import { ChatSession } from "../models/chatSession.model.js";
import { ChatMessage } from "../models/chatMessage.model.js";
import { ChatMessageRepository } from "../repository/chatMessage.repository.js";
import { ChatSessionService } from "./chatSession.service.js";
import { AppError } from "../types/appError.type.js";
import type { EncryptedField } from "../types/encryptedField.type.js";
import type { PaginatedSessionMessages } from "../types/paginatedSessionMessages.type.js";
import { decrypt, encrypt } from "../utils/crypto.util.js";
import { toSafeChatMessage, toSafeChatMessages } from "../utils/message.util.js";
import { publishMessage } from "../utils/pubsub.util.js";
import type { SafeChatMessage } from "../types/safeChatMessage.type.js";
import { logger } from "../utils/logger.util.js";
import { log } from "console";

const BLOCKED_STATUSES: ChatSession["status"][] = [
  "waiting_for_bot",
  "ended",
  "escalated",
  "failed",
];

/**
 * Service class for managing chat session entries.
 *
 * @description Provides methods to create, retrieve, update, and delete chat session entries.
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
 * const service = new ChatSessionService(chatSessionRepo);
 * await service.createNewSession(userId, botId);
 * const sessions = await service.getSessionsByUser(userId, 10);
 * ```
 *
 * @file chatSession.service.ts
 * 
 * @author Arthur M. Artugue
 * @created 2025-12-30
 * @updated 2026-01-06
 */
export class ChatMessageService {
  private chatMessageRepo : ChatMessageRepository;
  private chatSessionService: ChatSessionService;
  private secret: string;
  private readonly decryptField = (field: EncryptedField): string => decrypt(field, this.secret);


  /**
   * Creates an instance of the ChatMessageService.
   * 
   * @param chatMessageRepo - The repository used for accessing and managing chat messages.
   * @param chatSessionService - The service used for managing chat sessions.
   * 
   * Initializes the chat message repository and sets the encryption key from environment variables.
   */
  constructor(chatMessageRepo : ChatMessageRepository, chatSessionService: ChatSessionService) {
    this.chatMessageRepo = chatMessageRepo;
    this.chatSessionService = chatSessionService;
    this.secret = env.MESSAGE_CONTENT_ENCRYPTION_KEY;
  }


  /**
   * Creates a new chat message for the specified user in a session.
   *
   * Encrypts the provided content using the service's secret before storing it.
   * Enforces strict message ordering: rejects concurrent user messages as the bot
   * must reply first before the user can send another message.
   *
   * @param userId - The unique identifier of the user creating the message.
   * @param sessionId - The unique identifier of the chat session.
   * @param content - The plain text content of the chat message.
   * @returns A promise that resolves to the newly created `SafeChatMessage`.
   * @throws {AppError} If session is not found, unauthorized, not active, or if concurrent messages are detected.
   */
  public async createNewMessage(userId: string, sessionId: string, content: string): Promise<SafeChatMessage> {
    const session: ChatSession | null = await this.chatSessionService.getSessionById(sessionId, userId);
    if (!session) {
      throw new AppError(
        404,
        "SESSION_NOT_FOUND",
        "Chat session not found for user",
        true
      );
    }

    if(BLOCKED_STATUSES.includes(session.status)) {
      let statusCode: number;
      let errorCode: string;
      let errorMessage: string;

      switch (session.status) {
        case "waiting_for_bot":
          statusCode = 409;
          errorCode = "SESSION_WAITING_FOR_BOT";
          errorMessage = "Cannot send message: waiting for bot response";
          break;
        case "ended":
          statusCode = 400;
          errorCode = "SESSION_ENDED";
          errorMessage = "Cannot send message: session has ended";
          break;
        case "escalated":
          statusCode = 400;
          errorCode = "SESSION_ESCALATED";
          errorMessage = "Cannot send message: session has been escalated to human support";
          break;
        case "failed":
          statusCode = 400;
          errorCode = "SESSION_FAILED";
          errorMessage = "Cannot send message: session is in a failed state, please try again";
          break;
        default:
          statusCode = 400;
          errorCode = "SESSION_NOT_ACTIVE";
          errorMessage = "Cannot send message: session is not active";
          break;
      }

      throw new AppError(
        statusCode,
        errorCode,
        errorMessage,
        true
      );
    }

    const mostRecentMessage: ChatMessage | null = await this.chatMessageRepo.findLatestMessageBySession(userId, sessionId);
    const nextSequenceNumber: number = mostRecentMessage ? mostRecentMessage.sequence_number + 1 : 0;

    const encryptedContent: EncryptedField = encrypt(content, this.secret);

    try {
      const entry: ChatMessage = await this.chatMessageRepo.createMessage(userId, sessionId, "student", encryptedContent, nextSequenceNumber);

      await publishMessage(env.PUBSUB_CHAT_BOT_TOPIC, {
        eventType: 'CHAT_MESSAGE_CREATED',
        userId,
        sessionId,
        messageId: entry.message_id,
        timestamp: new Date().toISOString(),
      });

      await this.chatSessionService.markWaitingForBot(sessionId, userId);

      return toSafeChatMessage(entry, this.decryptField);
    } catch (error: any) {
      // Check if it's a unique constraint violation (PostgreSQL error code 23505)
      if (error.code === '23505' && error.constraint === 'unique_session_sequence') {
        throw new AppError(
          409,
          "MESSAGE_SEQUENCE_CONFLICT",
          "Please wait for the bot to respond before sending another message",
          true,
          "CONCURRENT_MESSAGE_DETECTED"
        );
      }
      
      throw error;
    }
  }

  /**
   * Retrieves the bot's response message for a specific user and session.
   *
   * If the session is not found or not in a state to receive bot responses, returns `null`.
   * 
   * Ensures that the bot's latest message is indeed a response to the user's latest message
   * by comparing sequence numbers.
   *
   * @param userId - The unique identifier of the user whose bot response is to be retrieved.
   * @param sessionId - The unique identifier of the chat session.
   * @param latestUserMessageId - (Optional) The ID of the user's latest message to validate the bot's response against.
   * @returns A promise that resolves to the `SafeChatMessage` containing the bot's response, or `null` if not found or invalid.
   */
  public async getBotResponse(userId: string, sessionId: string, latestUserMessageId?: string): Promise<SafeChatMessage | null> {
    const session = await this.chatSessionService.getSessionById(sessionId, userId);
    if (!session) {
      logger.warn(`Session not found for user ${userId} and session ${sessionId} when fetching bot response.`);
      return null;
    }

    if (!["waiting_for_bot", "active"].includes(session.status)) {
      return null;
    }

    // Ensure the latest user message ID is provided. If not, fetch the latest user message.
    let userMessage: ChatMessage | null = null;

    if (latestUserMessageId) {
      userMessage = await this.chatMessageRepo.findMessageById(sessionId, latestUserMessageId, userId);
    }

    if (!userMessage) {
      userMessage = await this.chatMessageRepo.findLatestUserMessageBySession(userId, sessionId);
    }

    if (!userMessage) return null; 

    const botMessage: ChatMessage | null = await this.chatMessageRepo.findLatestBotMessageBySession(userId, sessionId);
    
    if (!botMessage) {
      logger.info(`Bot message not found for user ${userId} and session ${sessionId} when fetching bot response.`);
      return null;
    }
    if (botMessage.sequence_number <= userMessage.sequence_number) return null;

    await this.chatSessionService.markActive(sessionId, userId);
    return toSafeChatMessage(botMessage, this.decryptField);
  }

  /**
 * Retrieves a list of journal entries for a specific user, optionally paginated by the last entry ID.
 * Decrypts the content of each entry before returning.
 *
 * @param userId - The unique identifier of the user whose journal entries are to be retrieved.
 * @param limit - The maximum number of entries to return. Defaults to 10.
 * @param lastEntryId - (Optional) The ID of the last entry from the previous page, used for pagination.
 * @returns A promise that resolves to an array of decrypted journal entries for the user.
 */
  public async getSessionMessagesByUser(
    userId: string,
    sessionId: string,
    limit: number = 10,
    lastMessageId?: string,
  ) : Promise<PaginatedSessionMessages> {
    const fetchLimit: number = limit + 1; // Fetch one extra to check if there's more

    const messages: ChatMessage[] = await this.chatMessageRepo.findByMessageAfterId(sessionId, userId, lastMessageId, fetchLimit);

    const hasMore = messages.length > limit;

    // If more, remove the extra entry
    const slicedEntries = hasMore ? messages.slice(0, limit) : messages;

    return {
      messages: toSafeChatMessages(slicedEntries, this.decryptField),
      hasMore,
      nextCursor: hasMore ? slicedEntries[slicedEntries.length - 1].message_id : undefined,
    };
  }

  /**
   * Retries sending a message from a failed session by reactivating it.
   * 
   * This method allows users to recover from a failed session state by:
   * 1. Verifying the session exists and is owned by the user
   * 2. Checking that the session is in "failed" status
   * 3. Transitioning the session back to "active" status
   * 4. Creating the new message
   *
   * @param userId - The unique identifier of the user retrying the message.
   * @param sessionId - The unique identifier of the failed chat session.
   * @param content - The plain text content of the chat message to send.
   * @returns A promise that resolves to the newly created `SafeChatMessage`.
   * @throws {AppError} If session is not found, not in failed state, or if message creation fails.
   */
  public async retryFailedSession(userId: string, sessionId: string, content: string): Promise<SafeChatMessage> {
    const session: ChatSession | null = await this.chatSessionService.getSessionById(sessionId, userId);
    
    if (!session) {
      throw new AppError(
        404,
        "SESSION_NOT_FOUND",
        "Chat session not found for user",
        true
      );
    }

    if (session.status !== "failed") {
      throw new AppError(
        400,
        "SESSION_NOT_FAILED",
        "Session is not in a failed state and cannot be retried",
        true
      );
    }

    // Reactivate the session
    await this.chatSessionService.markActive(sessionId, userId);

    // Create the message using the standard flow
    return await this.createNewMessage(userId, sessionId, content);
  }

}