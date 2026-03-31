export type ChatRole = "user" | "assistant";

export interface AiChatMessage {
  role: ChatRole;
  content: string;
}

export interface ChatRequestBody {
  message: string;
  messages?: AiChatMessage[];
  orgId?: string;
}

export interface ChatResponseBody {
  text: string;
}

export interface DateRange {
  startDate: string; // yyyy-mm-dd
  endDate: string; // yyyy-mm-dd
}

export interface ForecastRequest {
  orgId: string;
}

