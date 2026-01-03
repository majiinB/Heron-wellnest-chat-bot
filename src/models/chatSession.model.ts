import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn, UpdateDateColumn, VersionColumn } from "typeorm";

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
 * @updated 2026-01-03
 */
@Entity("chat_sessions")
@Index("idx_one_active_session_per_user", ["user_id"], { 
  where: "status IN ('active', 'waiting_for_bot', 'failed')",
  unique: true 
})
export class ChatSession {
  @PrimaryGeneratedColumn("uuid")
  session_id!: string;

  @Column({ type: "uuid" })
  user_id!: string;

  @Column({ 
    type: "enum",
    enum: ["active", "ended", "waiting_for_bot", "escalated", "failed"],
    default: "active"
   })
  status!: "active" | "ended" | "waiting_for_bot" | "escalated" | "failed";

  @Column({type: "uuid", nullable: true, default: null})
  insight_id!: string | null;

  @CreateDateColumn({ type: "timestamptz" })
  created_at!: Date;

  @UpdateDateColumn({ type: "timestamptz" })
  updated_at!: Date;

  @VersionColumn()
  version!: number;
}