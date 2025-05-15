export interface IMessage {
  id?: number;
  content: string;
  senderId: number;
  receiverId: number;
  status?: "sent" | "delivered" | "read";
  createdAt?: Date;
  updatedAt?: Date;
}

export interface WebSocketMessage {
  type?: string;
  senderId?: number;
  receiverId: number;
  content: string;
}

export interface ChatMessage extends WebSocketMessage {
  type: "chat";
  id: number;
  createdAt: Date;
  status: "sent" | "delivered" | "read";
}

export interface DeliveryStatusMessage {
  type: "delivery_status";
  messageId: number;
  status: "sent" | "delivered" | "read";
}

export interface SystemMessage {
  type: "system";
  content: string;
}

export interface ErrorMessage {
  type: "error";
  content: string;
}

export type WSMessage =
  | ChatMessage
  | DeliveryStatusMessage
  | SystemMessage
  | ErrorMessage;
