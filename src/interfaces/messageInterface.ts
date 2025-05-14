export interface IMessage {
  id?: number;
  content: string;
  senderId: number;
  receiverId: number;
  createdAt?: Date;
  updatedAt?: Date;
}
