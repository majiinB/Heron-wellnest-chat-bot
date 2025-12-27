import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from "typeorm";
import type { EncryptedField } from "../types/encryptedField.type.js";

/**
 * @file chatMessage.model.ts
 *
 * @description Chat message model for Kamustahan conversations.
 *
 * A message represents a single message exchanged within a chat session
 * between a student and the wellbeing chatbot.
 *
 * @author Arthur M. Artugue
 * @created 2025-12-25
 * @updated 2025-12-25
 */
@Entity("chat_messages")
export class ChatMessage {
  @PrimaryGeneratedColumn("uuid")
  message_id!: string;

  @Column({ type: "uuid" })
  session_id!: string;

  @Column({ type: "uuid" })
  user_id!: string;

  @Column({ 
    type: "enum",
    enum: ["student", "bot"], 
  })
  role!: "student" | "bot";

  @Column({ type: "jsonb"})
  content_encrypted!: EncryptedField;

  @Column({ 
    type: "enum",
    enum: ["pending", "completed", "failed"],
    default: "pending"
  })
  status!: "pending" | "completed" | "failed";

  @Column({ type: "integer", nullable: false, default: 0 })
  sequence_number!: number;

  @Column({ type: "boolean", default: false })
  is_deleted!: boolean;

  @CreateDateColumn({ type: "timestamptz" })
  created_at!: Date;
}