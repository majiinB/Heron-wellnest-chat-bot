import type { AuthenticatedRequest } from "../interface/authRequest.interface.js";
import { type NextFunction, type Response} from "express";
import type { ChatSessionService } from "../services/chatSession.service.js";
import type { ApiResponse } from "../types/apiResponse.type.js";
import { validateUser } from "../utils/authorization.util.js";
import type { GetOrCreateSessionResult } from "../types/getOrCreateSessionResult.type.js";
import type { ChatSession } from "../models/chatSession.model.js";

/**
 * Controller class for handling Chat session-related HTTP requests.
 * 
 * @description This class provides methods to handle creating, retrieving, updating, and deleting chat sessions.
 * It interacts with the `ChatSessionService` to perform business logic and data manipulation.
 * Each method corresponds to an endpoint and is responsible for validating input, invoking service methods, and formatting responses.
 * 
 * @remarks
 * - Input validation is performed to ensure required fields are present and meet length constraints.
 * - User authentication and role validation are enforced to restrict access to authorized users only.
 * - Responses are standardized using the `ApiResponse` type.
 * 
 * @example
 * ```typescript
 * const controller = new JournalController(journalService);
 * app.post('/journal', controller.handleJournalEntryCreation.bind(controller));
 * ```
 * @file journal.controller.ts
 * 
 * @author Arthur M. Artugue
 * @created 2026-01-03
 * @updated 2026-01-03
 */
export class ChatSessionController {
  private chatSessionService: ChatSessionService;

  constructor(chatSessionService: ChatSessionService){
    this.chatSessionService = chatSessionService
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
  public async handleChatSessionRetrievalAndCreation(req: AuthenticatedRequest, res: Response, _next: NextFunction): Promise<void> {
    const userId = req.user?.sub;
    const userRole = req.user?.role;

    validateUser(userId, userRole, "student");

    const result : GetOrCreateSessionResult = await this.chatSessionService.getOrCreateActiveSession(userId!);
    
    const response: ApiResponse = {
      success: true,
      code: result.created ? "CHAT_SESSION_CREATED" : "CHAT_SESSION_RETRIEVED",
      message: result.created ? "Chat session created successfully" : "Chat session retrieved successfully",
      data: {
        session_id: result.session.session_id,
        status: result.session.status,
        created_at: result.session.created_at
      }
    };

    res.status(201).json(response);

    return;
  } 

  public async handleChatSessionClosure(req: AuthenticatedRequest, res: Response, _next: NextFunction): Promise<void> {
    const userId = req.user?.sub;
    const userRole = req.user?.role;

    validateUser(userId, userRole, "student");

    const sessionId = req.params.sessionId;

    const session: ChatSession | null = await this.chatSessionService.markCloseSession(sessionId, userId!);

    const response: ApiResponse = {
      success: true,
      code: session ? "CHAT_SESSION_CLOSED" : "CHAT_SESSION_NOT_FOUND",
      message: session ? "Chat session closed successfully" : "Chat session not found",
      data: session ? {
        session_id: session?.session_id,
        status: session?.status,
        updated_at: session?.updated_at
      } : null
    };

    res.status(session ? 200 : 404).json(response);

    return;
  
  }
}