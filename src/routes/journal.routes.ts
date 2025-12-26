import express, { Router } from 'express';
import { heronAuthMiddleware } from '../middlewares/heronAuth.middleware.js';
import { JournalController } from '../controllers/journal.controller.js';
import { asyncHandler } from '../utils/asyncHandler.util.js';
import { JournalEntryRepository } from '../repository/chatSession.repository.js';
import { JournalService } from '../services/chat.service.js';

const router: Router = express.Router();
const journalRepository = new JournalEntryRepository();
const journalService = new JournalService(journalRepository);
const journalController = new JournalController(journalService);

/**
 * @openapi
 * components:
 *   schemas:
 *     ErrorResponse:
 *       type: object
 *       properties:
 *         success:
 *           type: boolean
 *           example: false
 *         code:
 *           type: string
 *           example: BAD_REQUEST
 *         message:
 *           type: string
 *           example: Invalid input data
 */

/**
 * @openapi
 * /mind-mirror/:
 *   post:
 *     summary: Create a new journal entry
 *     description: Allows a student to create a journal entry with an encrypted title and content.
 *     tags:
 *       - Journal / Mind Mirror
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - title
 *               - content
 *             properties:
 *               title:
 *                 type: string
 *                 minLength: 5
 *                 maxLength: 100
 *                 example: "Test journal 2"
 *               content:
 *                 type: string
 *                 minLength: 20
 *                 maxLength: 2000
 *                 example: "Once upon a time ako ay nagawa ng api para sa thesis namin"
 *     responses:
 *       '201':
 *         description: Journal entry created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 code:
 *                   type: string
 *                   example: JOURNAL_ENTRY_CREATED
 *                 message:
 *                   type: string
 *                   example: Journal entry created successfully
 *                 data:
 *                   type: object
 *                   properties:
 *                     journal_id:
 *                       type: string
 *                       format: uuid
 *                       example: 54a2a768-8e62-41ac-8b6e-e5092881000e
 *                     user_id:
 *                       type: string
 *                       format: uuid
 *                       example: 6bf00386-77e5-4a02-9ed9-5f4f294ceb8b
 *                     created_at:
 *                       type: string
 *                       format: date-time
 *                       example: 2025-09-25T12:08:11.190Z
 *                     updated_at:
 *                       type: string
 *                       format: date-time
 *                       example: 2025-09-25T12:08:11.190Z
 *                     is_deleted:
 *                       type: boolean
 *                       example: false
 *                     title:
 *                       type: string
 *                       example: Test journal 3
 *                     content:
 *                       type: string
 *                       example: Once upon a time ako ay nagawa ng api para sa thesis namin
 *       "400":
 *         description: Bad request - validation failed
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *             examples:
 *               badRequest:
 *                 value:
 *                   success: false
 *                   code: BAD_REQUEST
 *                   message: "Bad Request: Title and content are required"
 *       "401":
 *         description: Unauthorized - missing or invalid token
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *             examples:
 *               unauthorized:
 *                 value:
 *                   success: false
 *                   code: "UNAUTHORIZED / AUTH_NO_TOKEN"
 *                   message: "Unauthorized: User ID missing / no token provided"
 *       "403":
 *         description: Forbidden - insufficient permissions
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *             examples:
 *               forbidden:
 *                 value:
 *                   success: false
 *                   code: FORBIDDEN
 *                   message: "Forbidden: Insufficient permissions / Forbidden: <role_needed> role required"
 *       "500":
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *             examples:
 *               serverError:
 *                 value:
 *                   success: false
 *                   code: INTERNAL_SERVER_ERROR
 *                   message: Internal server error
 */
router.post('/', heronAuthMiddleware, asyncHandler(journalController.handleJournalEntryCreation.bind(journalController)));

/**
 * @openapi
 * /mind-mirror/:
 *   get:
 *     summary: Retrieve journal entries for a student
 *     description: Retrieves all journal entries for the authenticated student, including decrypted title, content, and optional mood. Supports pagination via `limit` and `lastEntryId` query parameters.
 *     tags:
 *       - Journal / Mind Mirror
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: limit
 *         in: query
 *         description: Maximum number of entries to retrieve (default 10, max 50)
 *         required: false
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 50
 *           default: 10
 *       - name: lastEntryId
 *         in: query
 *         description: The ID of the last journal entry from the previous page (for pagination)
 *         required: false
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       "200":
 *         description: Journal entries retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 code:
 *                   type: string
 *                   example: JOURNAL_ENTRIES_RETRIEVED
 *                 message:
 *                   type: string
 *                   example: Journal entries retrieved successfully
 *                 data:
 *                   type: object
 *                   properties:
 *                     entries:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           journal_id:
 *                             type: string
 *                             format: uuid
 *                           user_id:
 *                             type: string
 *                             format: uuid
 *                           created_at:
 *                             type: string
 *                             format: date-time
 *                           updated_at:
 *                             type: string
 *                             format: date-time
 *                           is_deleted:
 *                             type: boolean
 *                           title:
 *                             type: string
 *                           content:
 *                             type: string
 *                     hasMore:
 *                       type: boolean
 *                     nextCursor:
 *                       type: string
 *                       format: uuid
 *                       nullable: true
 *       "401":
 *         description: Unauthorized - missing or invalid token
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *             examples:
 *               unauthorized:
 *                 value:
 *                   success: false
 *                   code: "UNAUTHORIZED / AUTH_NO_TOKEN"
 *                   message: "Unauthorized: User ID missing / no token provided"
 *       "403":
 *         description: Forbidden - insufficient permissions
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *             examples:
 *               forbidden:
 *                 value:
 *                   success: false
 *                   code: FORBIDDEN
 *                   message: "Forbidden: Insufficient permissions / Forbidden: <role_needed> role required"
 *       "500":
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *             examples:
 *               serverError:
 *                 value:
 *                   success: false
 *                   code: INTERNAL_SERVER_ERROR
 *                   message: Internal server error
 */
router.get('/', heronAuthMiddleware, asyncHandler(journalController.handleJournalEntryRetrieval.bind(journalController)));

/**
 * @openapi
 * /mind-mirror/{id}:
 *   get:
 *     summary: Retrieve a specific journal entry
 *     description: Retrieves a single journal entry for the authenticated student by its ID, including decrypted title, content, and optional mood.
 *     tags:
 *       - Journal / Mind Mirror
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         description: UUID of the journal entry to retrieve
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       "200":
 *         description: Journal entry retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 code:
 *                   type: string
 *                   example: JOURNAL_ENTRY_RETRIEVED
 *                 message:
 *                   type: string
 *                   example: Journal entry retrieved successfully
 *                 data:
 *                   type: object
 *                   properties:
 *                     journal_id:
 *                       type: string
 *                       format: uuid
 *                     user_id:
 *                       type: string
 *                       format: uuid
 *                     created_at:
 *                       type: string
 *                       format: date-time
 *                     updated_at:
 *                       type: string
 *                       format: date-time
 *                     is_deleted:
 *                       type: boolean
 *                     title:
 *                       type: string
 *                     content:
 *                       type: string
 *       "400":
 *         description: Bad request - invalid journal entry ID format
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *             examples:
 *               invalidId:
 *                 value:
 *                   success: false
 *                   code: BAD_REQUEST
 *                   message: "Bad Request: Invalid journal entry ID format"
 *       "401":
 *         description: Unauthorized - missing or invalid token
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *             examples:
 *               unauthorized:
 *                 value:
 *                   success: false
 *                   code: "UNAUTHORIZED / AUTH_NO_TOKEN"
 *                   message: "Unauthorized: User ID missing / no token provided"
 *       "403":
 *         description: Forbidden - insufficient permissions
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *             examples:
 *               forbidden:
 *                 value:
 *                   success: false
 *                   code: FORBIDDEN
 *                   message: "Forbidden: Insufficient permissions / Forbidden: student role required"
 *       "404":
 *         description: Journal entry not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *             examples:
 *               notFound:
 *                 value:
 *                   success: false
 *                   code: NOT_FOUND
 *                   message: "Journal entry not found"
 *       "500":
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *             examples:
 *               serverError:
 *                 value:
 *                   success: false
 *                   code: INTERNAL_SERVER_ERROR
 *                   message: Internal server error
 */
router.get('/:id', heronAuthMiddleware, asyncHandler(journalController.handleSpecificJournalEntryRetrieval.bind(journalController)));

/**
 * @openapi
 * /mind-mirror/{id}:
 *   put:
 *     summary: Update a journal entry
 *     description: Updates the title and/or content of a journal entry for the authenticated student. At least one field (title or content) must be provided.
 *     tags:
 *       - Journal / Mind Mirror
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         description: UUID of the journal entry to update
 *         schema:
 *           type: string
 *           format: uuid
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               title:
 *                 type: string
 *                 minLength: 5
 *                 maxLength: 100
 *                 description: Optional new title for the journal entry (must be meaningful, not nonsense or numbers only)
 *                 example: "Reflections after counseling session"
 *               content:
 *                 type: string
 *                 minLength: 20
 *                 maxLength: 2000
 *                 description: Optional new content for the journal entry (must be meaningful, not nonsense or numbers only)
 *                 example: "Today I realized the importance of taking things one step at a time..."
 *     responses:
 *       "200":
 *         description: Journal entry updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 code:
 *                   type: string
 *                   example: JOURNAL_ENTRY_UPDATED
 *                 message:
 *                   type: string
 *                   example: Journal entry updated successfully
 *                 data:
 *                   type: object
 *                   properties:
 *                     journal_id:
 *                       type: string
 *                       format: uuid
 *                     user_id:
 *                       type: string
 *                       format: uuid
 *                     created_at:
 *                       type: string
 *                       format: date-time
 *                     updated_at:
 *                       type: string
 *                       format: date-time
 *                     is_deleted:
 *                       type: boolean
 *                     title:
 *                       type: string
 *                     content:
 *                       type: string
 *       "400":
 *         description: Bad request - invalid input
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *             examples:
 *               invalidId:
 *                 value:
 *                   success: false
 *                   code: BAD_REQUEST
 *                   message: "Bad Request: Invalid journal entry ID format"
 *               missingFields:
 *                 value:
 *                   success: false
 *                   code: BAD_REQUEST
 *                   message: "Bad Request: At least one of title or content must be provided"
 *               invalidTitle:
 *                 value:
 *                   success: false
 *                   code: BAD_REQUEST
 *                   message: "Bad Request: Title must be between 5 and 100 characters"
 *       "401":
 *         description: Unauthorized - missing or invalid token
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *             examples:
 *               unauthorized:
 *                 value:
 *                   success: false
 *                   code: "UNAUTHORIZED / AUTH_NO_TOKEN"
 *                   message: "Unauthorized: User ID missing / no token provided"
 *       "403":
 *         description: Forbidden - insufficient permissions
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *             examples:
 *               forbidden:
 *                 value:
 *                   success: false
 *                   code: FORBIDDEN
 *                   message: "Forbidden: Insufficient permissions / Forbidden: student role required"
 *       "404":
 *         description: Journal entry not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *             examples:
 *               notFound:
 *                 value:
 *                   success: false
 *                   code: NOT_FOUND
 *                   message: "Journal entry not found"
 *       "500":
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *             examples:
 *               serverError:
 *                 value:
 *                   success: false
 *                   code: INTERNAL_SERVER_ERROR
 *                   message: Internal server error
 */
router.put('/:id', heronAuthMiddleware, asyncHandler(journalController.handleJournalEntryUpdate.bind(journalController)));

/**
 * @openapi
 * /mind-mirror/{id}:
 *   delete:
 *     summary: Soft delete a journal entry
 *     description: >
 *       Marks a journal entry as deleted (soft delete).  
 *       Only the owner of the entry (student role) can perform this action.  
 *       If the entry does not exist or is already deleted, a 404 error is returned.
 *     tags:
 *       - Journal / Mind Mirror
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         description: UUID of the journal entry to delete
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       "200":
 *         description: Journal entry deleted successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 code:
 *                   type: string
 *                   example: JOURNAL_ENTRY_DELETED
 *                 message:
 *                   type: string
 *                   example: Journal entry deleted successfully
 *       "400":
 *         description: Bad request - invalid input
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *             examples:
 *               invalidId:
 *                 value:
 *                   success: false
 *                   code: BAD_REQUEST
 *                   message: "Bad Request: Invalid journal entry ID format"
 *       "401":
 *         description: Unauthorized - missing or invalid token
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *             examples:
 *               unauthorized:
 *                 value:
 *                   success: false
 *                   code: "UNAUTHORIZED / AUTH_NO_TOKEN"
 *                   message: "Unauthorized: User ID missing / no token provided"
 *       "403":
 *         description: Forbidden - insufficient permissions
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *             examples:
 *               forbidden:
 *                 value:
 *                   success: false
 *                   code: FORBIDDEN
 *                   message: "Forbidden: Insufficient permissions / Forbidden: student role required"
 *       "404":
 *         description: Journal entry not found or already deleted
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *             examples:
 *               notFound:
 *                 value:
 *                   success: false
 *                   code: NOT_FOUND
 *                   message: "Journal entry not found"
 *       "500":
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *             examples:
 *               serverError:
 *                 value:
 *                   success: false
 *                   code: INTERNAL_SERVER_ERROR
 *                   message: Internal server error
 */
router.delete('/:id', heronAuthMiddleware, asyncHandler(journalController.handleJournalEntryDelete.bind(journalController)));

export default router;