import express, { Router } from 'express';
import { heronAuthMiddleware } from '../middlewares/heronAuth.middleware.js';
import { ChatMessageController } from '../controllers/chatMessage.controller.js';
import { asyncHandler } from '../utils/asyncHandler.util.js';
import { ChatMessageRepository } from '../repository/chatMessage.repository.js';
import { ChatSessionRepository } from '../repository/chatSession.repository.js';
import { ChatMessageService } from '../services/chatMessage.service.js';
import { ChatSessionService } from '../services/chatSession.service.js';

const router: Router = express.Router();
const chatMessageRepository = new ChatMessageRepository();
const chatSessionRepository = new ChatSessionRepository();
const chatSessionService = new ChatSessionService(chatSessionRepository);
const chatMessageService = new ChatMessageService(chatMessageRepository, chatSessionService);
const chatMessageController = new ChatMessageController(chatMessageService);

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
 * /message/:
 *   post:
 *     summary: Create a new chat message
 *     description: Allows an authenticated student to send a chat message in an active session. The message content is encrypted before storage.
 *     tags:
 *       - Chat Message
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - sessionId
 *               - message
 *             properties:
 *               sessionId:
 *                 type: string
 *                 format: uuid
 *                 example: "54a2a768-8e62-41ac-8b6e-e5092881000e"
 *               message:
 *                 type: string
 *                 minLength: 2
 *                 example: "I'm feeling anxious about my upcoming exams"
 *     responses:
 *       '201':
 *         description: Chat message created successfully
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
 *                   example: CHAT_MESSAGE_CREATED
 *                 message:
 *                   type: string
 *                   example: Chat message created successfully
 *       "400":
 *         description: Bad request - validation failed
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *             examples:
 *               missingFields:
 *                 value:
 *                   success: false
 *                   code: BAD_REQUEST
 *                   message: "Bad Request: Session ID is required"
 *               invalidFormat:
 *                 value:
 *                   success: false
 *                   code: BAD_REQUEST
 *                   message: "Bad Request: Invalid session ID format"
 *               messageValidation:
 *                 value:
 *                   success: false
 *                   code: BAD_REQUEST
 *                   message: "Bad Request: Message must be at least 2 characters"
 *               sessionEnded:
 *                 value:
 *                   success: false
 *                   code: SESSION_ENDED
 *                   message: "Cannot send message: session has ended"
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
 *         description: Chat session not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *             examples:
 *               notFound:
 *                 value:
 *                   success: false
 *                   code: SESSION_NOT_FOUND
 *                   message: "Chat session not found for user"
 *       "409":
 *         description: Conflict - concurrent message or waiting for bot
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *             examples:
 *               waitingForBot:
 *                 value:
 *                   success: false
 *                   code: SESSION_WAITING_FOR_BOT
 *                   message: "Cannot send message: waiting for bot response"
 *               concurrentMessage:
 *                 value:
 *                   success: false
 *                   code: MESSAGE_SEQUENCE_CONFLICT
 *                   message: "Please wait for the bot to respond before sending another message"
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
router.post('/', heronAuthMiddleware, asyncHandler(chatMessageController.handleChatMessageCreation.bind(chatMessageController)));

/**
 * @openapi
 * /message/:
 *   get:
 *     summary: Retrieve chat messages for a session
 *     description: Retrieves all chat messages for the authenticated student in a specific session, with decrypted content. Supports pagination via `limit` and `lastMessageId` query parameters.
 *     tags:
 *       - Chat Message
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: sessionId
 *         in: path
 *         required: true
 *         description: UUID of the chat session
 *         schema:
 *           type: string
 *           format: uuid
 *       - name: limit
 *         in: query
 *         description: Maximum number of messages to retrieve (default 10, max 50)
 *         required: false
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 50
 *           default: 10
 *       - name: lastMessageId
 *         in: query
 *         description: The ID of the last message from the previous page (for pagination)
 *         required: false
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       "200":
 *         description: Chat messages retrieved successfully
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
 *                   example: CHAT_MESSAGES_RETRIEVED
 *                 message:
 *                   type: string
 *                   example: Chat messages retrieved successfully
 *                 data:
 *                   type: object
 *                   properties:
 *                     messages:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           message_id:
 *                             type: string
 *                             format: uuid
 *                           session_id:
 *                             type: string
 *                             format: uuid
 *                           user_id:
 *                             type: string
 *                             format: uuid
 *                           sender_type:
 *                             type: string
 *                             enum: [student, bot]
 *                           content:
 *                             type: string
 *                           sequence_number:
 *                             type: integer
 *                           created_at:
 *                             type: string
 *                             format: date-time
 *                     hasMore:
 *                       type: boolean
 *                     nextCursor:
 *                       type: string
 *                       format: uuid
 *                       nullable: true
 *       "400":
 *         description: Bad request - invalid session ID format
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *             examples:
 *               invalidId:
 *                 value:
 *                   success: false
 *                   code: BAD_REQUEST
 *                   message: "Bad Request: Invalid session ID format"
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
router.get('/:sessionId/', heronAuthMiddleware, asyncHandler(chatMessageController.handleChatMessagesRetrieval.bind(chatMessageController)));

/**
 * @openapi
 * /message/{sessionId}/bot-response:
 *   get:
 *     summary: Retrieve the latest bot response
 *     description: Retrieves the latest bot response message for the authenticated student in a specific session. Returns null if no bot response is available or if the session is not in an appropriate state.
 *     tags:
 *       - Chat Message
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: sessionId
 *         in: path
 *         required: true
 *         description: UUID of the chat session
 *         schema:
 *           type: string
 *           format: uuid
 *       - name: latestUserMessageId
 *         in: query
 *         description: The ID of the user's latest message to validate the bot's response against
 *         required: false
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       "200":
 *         description: Bot response retrieved successfully
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
 *                   example: BOT_RESPONSE_RETRIEVED
 *                 message:
 *                   type: string
 *                   example: Bot response retrieved successfully
 *                 data:
 *                   oneOf:
 *                     - type: object
 *                       properties:
 *                         message_id:
 *                           type: string
 *                           format: uuid
 *                         session_id:
 *                           type: string
 *                           format: uuid
 *                         user_id:
 *                           type: string
 *                           format: uuid
 *                         sender_type:
 *                           type: string
 *                           enum: [bot]
 *                           example: bot
 *                         content:
 *                           type: string
 *                           example: "I understand you're feeling anxious. Let's talk about what's bothering you."
 *                         sequence_number:
 *                           type: integer
 *                         created_at:
 *                           type: string
 *                           format: date-time
 *                     - type: "null"
 *       "400":
 *         description: Bad request - invalid session ID format
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *             examples:
 *               invalidId:
 *                 value:
 *                   success: false
 *                   code: BAD_REQUEST
 *                   message: "Bad Request: Invalid session ID format"
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
router.get('/:sessionId/bot-response', heronAuthMiddleware, asyncHandler(chatMessageController.handleBotResponseRetrieval.bind(chatMessageController)));

export default router;