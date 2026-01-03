import type { ChatSession } from "../models/chatSession.model.js";

export type GetOrCreateSessionResult = {
  session: ChatSession;
  created: boolean;
};
