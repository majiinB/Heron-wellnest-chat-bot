import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from "typeorm";

/**
 * @file chatSession.model.ts
 *
 * @description Chat session model for Kamustahan conversations.
 *
 * A session represents a single conversational interaction between
 * a student and the wellbeing chatbot.
 *
 * @author Arthur M. Artugue
 * @created 2025-12-25
 * @updated 2025-12-25
 */
@Entity("chat_sessions")
export class ChatSession {
  @PrimaryGeneratedColumn("uuid")
  session_id!: string;

  @Column({ type: "uuid" })
  user_id!: string;

  @Column({ 
    type: "enum",
    enum: ["open", "closed", "waiting_for_bot", "escalated"],
    default: "open"
   })
  status!: "open" | "closed" | "waiting_for_bot" | "escalated";

  @Column({type: "uuid", nullable: true, default: null})
  insight_id!: string | null;

  @CreateDateColumn({ type: "timestamptz" })
  created_at!: Date;

  @UpdateDateColumn({ type: "timestamptz" })
  updated_at!: Date;
}