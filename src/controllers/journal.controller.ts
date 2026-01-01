import type { AuthenticatedRequest } from "../interface/authRequest.interface.js";
import { type NextFunction, type Response} from "express";
import type { JournalService } from "../services/chatSession.service.js";
import type { ApiResponse } from "../types/apiResponse.type.js";
import { AppError } from "../types/appError.type.js";
import { validateUser } from "../utils/authorization.util.js";
import type { SafeJournalEntry } from "../types/safeChatMessage.type.js";
import type { PaginatedJournalEntries } from "../types/paginatedJournalEtntries.type.js";
import { validate as isUuid } from "uuid";
import { isNumbersOnly, looksLikeNonsense } from "../utils/message.util.js";

/**
 * Controller class for handling Journal entry-related HTTP requests.
 * 
 * @description This class provides methods to handle creating, retrieving, updating, and deleting journal entries.
 * It interacts with the `JournalService` to perform business logic and data manipulation.
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
 * @created 2025-09-22
 * @updated 2025-11-11
 */
export class JournalController {
  private journalService: JournalService;

  constructor(journalService: JournalService){
    this.journalService = journalService
  }

  /**
   * Handles the creation of a journal entry for an authenticated student user.
   * 
   * Validates the user's identity and role, as well as the request body fields (`title` and `content`).
   * Ensures the title is between 5 and 100 characters, and the content is between 20 and 2000 characters.
   * On successful validation, creates a new journal entry and responds with a success message and the created entry.
   * 
   * @param req - The authenticated request containing user information and journal entry data.
   * @param res - The response object used to send the result back to the client.
   * @param _next - The next middleware function (unused).
   * @throws {AppError} If validation fails for user, title, or content.
   */
  public async handleJournalEntryCreation(req: AuthenticatedRequest, res: Response, _next: NextFunction): Promise<void> {
    const userId = req.user?.sub;
    const userRole = req.user?.role;
    const { title, content } = req.body || {};

    validateUser(userId, userRole, "student");

    const titleTrimmed = title?.toString().trim();
    const contentTrimmed = content?.toString().trim();

    // Validate title and content
    if (!titleTrimmed || !contentTrimmed) {
      throw new AppError(
        400,
        'BAD_REQUEST',
        "Bad Request: Title and content are required",
        true
      );
    }

    const titleNum = titleTrimmed.length;
    const contentNum = contentTrimmed.length;

    if (titleNum < 5 || titleNum > 100) {
      throw new AppError(
        400,
        'BAD_REQUEST',
        "Bad Request: Title must be between 5 and 100 characters",
        true
      );
    }

    if(isNumbersOnly(titleTrimmed) || looksLikeNonsense(contentTrimmed)){
      throw new AppError(
        400,
        'BAD_REQUEST',
        "Bad Request: We encourage meaningful titles. Please provide a valid title.",
        true
      );
    }

    if (contentNum < 20 || contentNum > 2000) {
      throw new AppError(
        400,
        'BAD_REQUEST',
        "Bad Request: Content must be between 20 and 2000 characters",
        true
      );
    }

    if(isNumbersOnly(contentTrimmed) || looksLikeNonsense(contentTrimmed)){
      throw new AppError(
        400,
        'BAD_REQUEST',
        "Bad Request: We encourage meaningful content. Please provide a valid content.",
        true
      );
    }

    // Create journal entry
    const journalEntry: SafeJournalEntry = await this.journalService.createEntry(userId!, title.trim(), content.trim());

    const response: ApiResponse = {
      success: true,
      code: "JOURNAL_ENTRY_CREATED",
      message: "Journal entry created successfully",
      data: journalEntry
    };

    res.status(201).json(response);

    return; 
  }

  /**
 * Handles the retrieval of journal entries for an authenticated student user.
 * 
 * Validates the user's identity and role. Supports pagination using `limit` and `lastEntryId`
 * query parameters, and filtering by time period using `timeFilter`.
 * The default limit is 10, and the maximum allowed is 50.
 * On successful validation, retrieves the requested journal entries and responds 
 * with a success message and the paginated entries.
 * 
 * @param req - The authenticated request containing user information and optional query parameters (`limit`, `lastEntryId`, `timeFilter`).
 * @param res - The response object used to send the result back to the client.
 * @param _next - The next middleware function (unused).
 * @throws {AppError} If validation fails for the user or permissions.
 */
  public async handleJournalEntryRetrieval(req: AuthenticatedRequest, res: Response, _next: NextFunction): Promise<void> {
    const userId = req.user?.sub;
    const userRole = req.user?.role;

    validateUser(userId, userRole, "student");

    const limitParam = req.query.limit as string | undefined;
    const lastEntryId = req.query.lastEntryId as string | undefined;
    const timeFilter = req.query.timeFilter as 'today' | 'yesterday' | 'this_week' | 'last_week' | 'all' | undefined;

    let limit = 10; // Default limit
    if (limitParam) {
      const parsedLimit = parseInt(limitParam, 10);
      if (!isNaN(parsedLimit) && parsedLimit > 0 && parsedLimit <= 50) {
        limit = parsedLimit;
      }
    }

    // Validate timeFilter parameter
    const validTimeFilters = ['today', 'yesterday', 'this_week', 'last_week', 'all'];
    const finalTimeFilter = timeFilter && validTimeFilters.includes(timeFilter) ? timeFilter : 'all';

    const entries: PaginatedJournalEntries = await this.journalService.getEntriesByUser(userId!, limit, lastEntryId, finalTimeFilter);

    const response: ApiResponse = {
      success: true,
      code: "JOURNAL_ENTRIES_RETRIEVED",
      message: "Journal entries retrieved successfully",
      data: entries
    };

    res.status(200).json(response);

    return; 
  }

  public async handleSpecificJournalEntryRetrieval(req: AuthenticatedRequest, res: Response, _next: NextFunction): Promise<void> {
    const userId = req.user?.sub;
    const userRole = req.user?.role;
    const journalId = req.params.id;

    validateUser(userId, userRole, "student");

    if (!isUuid(journalId)) {
      throw new AppError(
        400,
        'BAD_REQUEST',
        "Bad Request: Invalid journal entry ID format",
        true
      );
    }

    const journal: SafeJournalEntry | null = await this.journalService.getEntryById(journalId, userId!);

    if(!journal){
      throw new AppError(
        404,
        'NOT_FOUND',
        "Journal entry not found",
        true
      );
    }

    const response: ApiResponse = {
      success: true,
      code: "JOURNAL_ENTRY_RETRIEVED",
      message: "Journal entry retrieved successfully",
      data: journal
    };

    res.status(200).json(response);

    return; 
  }

  public async handleJournalEntryUpdate(req: AuthenticatedRequest, res: Response, _next: NextFunction): Promise<void> {
    const userId = req.user?.sub;
    const userRole = req.user?.role;
    const journalId = req.params.id;
    const { title, content } = req.body || {};

    validateUser(userId, userRole, "student");

    if (!isUuid(journalId)) {
      throw new AppError(
        400,
        'BAD_REQUEST',
        "Bad Request: Invalid journal entry ID format",
        true
      );
    }

    const titleTrimmed = title?.toString().trim();
    const contentTrimmed = content?.toString().trim();

    // Validate at least one field
    if (!titleTrimmed && !contentTrimmed) {
      throw new AppError(
        400,
        'BAD_REQUEST',
        "Bad Request: At least one of title or content must be provided",
        true
      );
    }

    if (titleTrimmed && (titleTrimmed.length < 5 || titleTrimmed.length > 100)) {
      throw new AppError(
        400,
        'BAD_REQUEST',
        "Bad Request: Title must be between 5 and 100 characters",
        true
      );
    }

    if(titleTrimmed && (isNumbersOnly(titleTrimmed) || looksLikeNonsense(titleTrimmed))){
      throw new AppError(
        400,
        'BAD_REQUEST',
        "Bad Request: We encourage meaningful titles. Please provide a valid title.",
        true
      );
    }
    
    if (contentTrimmed && (contentTrimmed.length < 20 || contentTrimmed.length > 2000)) {
      throw new AppError(
        400,
        'BAD_REQUEST',
        "Bad Request: Content must be between 20 and 2000 characters",
        true
      );
    }

    if(contentTrimmed && (isNumbersOnly(contentTrimmed) || looksLikeNonsense(contentTrimmed))){
      throw new AppError(
        400,
        'BAD_REQUEST',
        "Bad Request: We encourage meaningful content. Please provide a valid content.",
        true
      );
    }

    const journal: SafeJournalEntry | null = await this.journalService.updateEntry(journalId, userId!, titleTrimmed, contentTrimmed);

    if(!journal){
      throw new AppError(
        404,
        'NOT_FOUND',
        "Journal entry not found",
        true
      );
    }

    const response: ApiResponse = {
      success: true,
      code: "JOURNAL_ENTRY_UPDATED",
      message: "Journal entry updated successfully",
      data: journal
    };

    res.status(200).json(response);
    return; 
  }

  public async handleJournalEntryDelete(req: AuthenticatedRequest, res: Response, _next: NextFunction): Promise<void> {
    const userId = req.user?.sub;
    const userRole = req.user?.role;
    const journalId = req.params.id;

    validateUser(userId, userRole, "student");

    if (!isUuid(journalId)) {
      throw new AppError(
        400,
        'BAD_REQUEST',
        "Bad Request: Invalid journal entry ID format",
        true
      );
    }

    const deleted = await this.journalService.softDeleteEntry(journalId, userId!);

    if(!deleted){
      throw new AppError(
        404,
        'NOT_FOUND',
        "Journal entry not found",
        true
      );
    }

    const response: ApiResponse = {
      success: true,
      code: "JOURNAL_ENTRY_DELETED",
      message: "Journal entry deleted successfully",
    };

    res.status(200).json(response);
    return; 
  }
}