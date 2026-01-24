import express, { Router } from 'express';
import { heronAuthMiddleware } from '../middlewares/heronAuth.middleware.js';
import { ChatSessionController } from '../controllers/chatSession.controller.js';
import { asyncHandler } from '../utils/asyncHandler.util.js';
import { ChatSessionRepository } from '../repository/chatSession.repository.js';
import { ChatSessionService } from '../services/chatSession.service.js';

const router: Router = express.Router();
const chatSessionRepository = new ChatSessionRepository();
const chatSessionService = new ChatSessionService(chatSessionRepository);
const chatSessionController = new ChatSessionController(chatSessionService);

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
 * /session/:
 *   post:
 *     summary: Get or create an active chat session
 *     description: Retrieves the active chat session for the authenticated student user, or creates a new one if none exists.
 *     tags:
 *       - Chat Session
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       '201':
 *         description: Chat session retrieved or created successfully
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
 *                   enum: [CHAT_SESSION_CREATED, CHAT_SESSION_RETRIEVED]
 *                   example: CHAT_SESSION_CREATED
 *                 message:
 *                   type: string
 *                   example: Chat session created successfully
 *                 data:
 *                   type: object
 *                   properties:
 *                     session_id:
 *                       type: string
 *                       format: uuid
 *                       example: 54a2a768-8e62-41ac-8b6e-e5092881000e
 *                     status:
 *                       type: string
 *                       enum: [active, waiting_for_bot, failed, escalated, ended]
 *                       example: active
 *                     created_at:
 *                       type: string
 *                       format: date-time
 *                       example: 2026-01-06T12:08:11.190Z
 *             examples:
 *               created:
 *                 summary: New session created
 *                 value:
 *                   success: true
 *                   code: CHAT_SESSION_CREATED
 *                   message: Chat session created successfully
 *                   data:
 *                     session_id: 54a2a768-8e62-41ac-8b6e-e5092881000e
 *                     status: active
 *                     created_at: 2026-01-06T12:08:11.190Z
 *               retrieved:
 *                 summary: Existing session retrieved
 *                 value:
 *                   success: true
 *                   code: CHAT_SESSION_RETRIEVED
 *                   message: Chat session retrieved successfully
 *                   data:
 *                     session_id: 54a2a768-8e62-41ac-8b6e-e5092881000e
 *                     status: active
 *                     created_at: 2026-01-05T10:30:00.000Z
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
router.post('/', heronAuthMiddleware, asyncHandler(chatSessionController.handleChatSessionRetrievalAndCreation.bind(chatSessionController)));

/**
 * @openapi
 * /session/{sessionId}/close:
 *   patch:
 *     summary: Close an active chat session
 *     description: Marks the specified chat session as ended for the authenticated student user. The session must belong to the authenticated user and must be in a valid state to transition to 'ended'.
 *     tags:
 *       - Chat Session
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: sessionId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: The unique identifier of the chat session to close
 *         example: 54a2a768-8e62-41ac-8b6e-e5092881000e
 *     responses:
 *       '200':
 *         description: Chat session closed successfully
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
 *                   example: CHAT_SESSION_CLOSED
 *                 message:
 *                   type: string
 *                   example: Chat session closed successfully
 *                 data:
 *                   type: object
 *                   properties:
 *                     session_id:
 *                       type: string
 *                       format: uuid
 *                       example: 54a2a768-8e62-41ac-8b6e-e5092881000e
 *                     status:
 *                       type: string
 *                       enum: [ended]
 *                       example: ended
 *                     updated_at:
 *                       type: string
 *                       format: date-time
 *                       example: 2026-01-06T14:30:45.123Z
 *             examples:
 *               success:
 *                 summary: Session closed successfully
 *                 value:
 *                   success: true
 *                   code: CHAT_SESSION_CLOSED
 *                   message: Chat session closed successfully
 *                   data:
 *                     session_id: 54a2a768-8e62-41ac-8b6e-e5092881000e
 *                     status: ended
 *                     updated_at: 2026-01-06T14:30:45.123Z
 *       '400':
 *         description: Bad request - invalid status transition
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *             examples:
 *               invalidTransition:
 *                 value:
 *                   success: false
 *                   code: INVALID_STATUS_TRANSITION
 *                   message: "Cannot transition status from 'escalated' to 'ended'."
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
 *       '404':
 *         description: Chat session not found
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
 *                   example: CHAT_SESSION_NOT_FOUND
 *                 message:
 *                   type: string
 *                   example: Chat session not found
 *                 data:
 *                   type: null
 *                   example: null
 *             examples:
 *               notFound:
 *                 value:
 *                   success: true
 *                   code: CHAT_SESSION_NOT_FOUND
 *                   message: Chat session not found
 *                   data: null
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
router.patch('/:sessionId/close', heronAuthMiddleware, asyncHandler(chatSessionController.handleChatSessionClosure.bind(chatSessionController)));

export default router;