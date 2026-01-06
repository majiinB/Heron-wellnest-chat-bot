import type { AuthenticatedRequest } from "../interface/authRequest.interface.js";
import { type NextFunction, type Response} from "express";
import type { ChatMessageService } from "../services/chatMessage.service.js";
import type { ApiResponse } from "../types/apiResponse.type.js";
import { AppError } from "../types/appError.type.js";
import { validateUser } from "../utils/authorization.util.js";
import { validate as isUuid } from "uuid";
import { isNumbersOnly, looksLikeNonsense } from "../utils/message.util.js";
import type { PaginatedSessionMessages } from "../types/paginatedSessionMessages.type.js";

/**
 * Controller class for handling Chat message-related HTTP requests.
 * 
 * @description This class provides methods to handle creating, retrieving, updating, and deleting chat messages.
 * It interacts with the `ChatMessageService` to perform business logic and data manipulation.
 * Each method corresponds to an endpoint and is responsible for validating input, invoking service methods, and formatting responses.
 * 
 * @remarks
 * - Input validation is performed to ensure required fields are present and meet length constraints.
 * - User authentication and role validation are enforced to restrict access to authorized users only.
 * - Responses are standardized using the `ApiResponse` type.
 * 
 * @example
 * ```typescript
 * const controller = new ChatMessageController(chatMessageService);
 * app.post('/chatMessage', controller.handleChatMessageCreation.bind(controller));
 * ```
 * @file chatMessage.controller.ts
 * 
 * @author Arthur M. Artugue
 * @created 2026-01-03
 * @updated 2026-01-06
 */
export class ChatMessageController {
  private chatMessageService: ChatMessageService;

  constructor(chatMessageService  : ChatMessageService){
    this.chatMessageService = chatMessageService
  }

  /**
   * Handles the creation of a chat session for an authenticated student user.
   * 
   * Validates the user's identity and role.
    * On successful validation, creates a new chat session and responds with a success message and the created session.
   * 
   * @param req - The authenticated request containing user information and chat session data.
   * @param res - The response object used to send the result back to the client.
   * @param _next - The next middleware function (unused).
   * @throws {AppError} If validation fails for user, title, or content.
   */
  public async handleChatMessageCreation(req: AuthenticatedRequest, res: Response, _next: NextFunction): Promise<void> {
    const userId = req.user?.sub;
    const userRole = req.user?.role;
    const { sessionId, message } = req.body || {};

    validateUser(userId, userRole, "student");

    if(sessionId === undefined || sessionId === null || sessionId.toString().trim() === ""){
      throw new AppError(
        400,
        'BAD_REQUEST',
        "Bad Request: Session ID is required",
        true
      );
    }

    if (!isUuid(sessionId.toString())) {
      throw new AppError(
        400,
        'BAD_REQUEST',
        "Bad Request: Invalid session ID format",
        true
      );
    }

    const messageTrimed = message?.toString().trim();

    // Validate title and content
    if (!messageTrimed) {
      throw new AppError(
        400,
        'BAD_REQUEST',
        "Bad Request: Message is required",
        true
      );
    }

    const messageNum = messageTrimed.length;

    if (messageNum < 2 ) {
      throw new AppError(
        400,
        'BAD_REQUEST',
        "Bad Request: Message must be at least 2 characters",
        true
      );
    }

    if(isNumbersOnly(messageTrimed) || looksLikeNonsense(messageTrimed)){
      throw new AppError(
        400,
        'BAD_REQUEST',
        "Bad Request: We encourage meaningful messages. Please provide a valid message.",
        true
      );
    }

    await this.chatMessageService.createNewMessage(userId!, sessionId, messageTrimed);
    
    const response: ApiResponse = {
      success: true,
      code: "CHAT_MESSAGE_CREATED",
      message: "Chat message created successfully",
    };

    res.status(201).json(response);

    return; 
  }

  /**
 * Handles the retrieval of chat messages for an authenticated student user.
 * 
 * Validates the user's identity and role. Supports pagination using `limit` and `lastMessageId`
 * query parameters.
 * The default limit is 10, and the maximum allowed is 50.
 * On successful validation, retrieves the requested chat messages and responds 
 * with a success message and the paginated messages.
 * 
 * @param req - The authenticated request containing user information and optional query parameters (`limit`, `lastEntryId`, `timeFilter`).
 * @param res - The response object used to send the result back to the client.
 * @param _next - The next middleware function (unused).
 * @throws {AppError} If validation fails for the user or permissions.
 */
  public async handleChatMessagesRetrieval(req: AuthenticatedRequest, res: Response, _next: NextFunction): Promise<void> {
    const userId = req.user?.sub;
    const userRole = req.user?.role;

    validateUser(userId, userRole, "student");

    const sessionId = req.params.sessionId as string;

    if (!sessionId) {
      throw new AppError(
        400,
        'BAD_REQUEST',
        "Bad Request: Session ID is required",
        true
      );
    }

    if (!isUuid(sessionId)) {
      throw new AppError(
        400,
        'BAD_REQUEST',
        "Bad Request: Invalid session ID format",
        true
      );
    }

    const limitParam = req.query.limit as string | undefined;
    const lastMessageId = req.query.lastMessageId as string | undefined;

    let limit = 10; // Default limit
    if (limitParam) {
      const parsedLimit = parseInt(limitParam, 10);
      if (!isNaN(parsedLimit) && parsedLimit > 0 && parsedLimit <= 50) {
        limit = parsedLimit;
      }
    }

    const messages: PaginatedSessionMessages = await this.chatMessageService.getSessionMessagesByUser(userId!, sessionId, limit, lastMessageId);

    const response: ApiResponse = {
      success: true,
      code: "CHAT_MESSAGES_RETRIEVED",
      message: "Chat messages retrieved successfully",
      data: messages
    };

    res.status(200).json(response);

    return; 
  }

  /**
   * Handles the retrieval of the latest bot response message for an authenticated student user.
   * 
   * Validates the user's identity and role.
   * On successful validation, retrieves the latest bot response message for the specified session
   * and responds with a success message and the bot message.
   *
   * @param req - The authenticated request containing user information, session ID, and optional latest user message ID.
   * @param res - The response object used to send the result back to the client.
   * @param _next - The next middleware function (unused).
   * @throws {AppError} If validation fails for user or session ID.
   */
  public async handleBotResponseRetrieval(req: AuthenticatedRequest, res: Response, _next: NextFunction): Promise<void> {
    const userId = req.user?.sub;
    const userRole = req.user?.role;

    validateUser(userId, userRole, "student");

    const sessionId = req.params.sessionId as string;
    const latestUserMessageId = req.query.latestUserMessageId as string | undefined;

    if (!sessionId) {
      throw new AppError(
        400,
        'BAD_REQUEST',
        "Bad Request: Session ID is required",
        true
      );
    }

    if (!isUuid(sessionId)) {
      throw new AppError(
        400,
        'BAD_REQUEST',
        "Bad Request: Invalid session ID format",
        true
      );
    }

    const botMessage = await this.chatMessageService.getBotResponse(userId!, sessionId, latestUserMessageId);

    const response: ApiResponse = {
      success: true,
      code: botMessage ? "BOT_RESPONSE_RETRIEVED" : "BOT_RESPONSE_PENDING",
      message: botMessage ? "Bot response retrieved successfully" : "Bot is still processing your message. Please try again in a moment.",
      data: botMessage
    };

    res.status(200).json(response);

    return; 
  }
}