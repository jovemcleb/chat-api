import { DataTypes, Model } from "sequelize";
import sequelize from "../db";
import { IMessage } from "../interfaces/messageInterface";

export interface IMessageWithStatus extends IMessage {
  status?: "sent" | "delivered" | "read";
}

class Message extends Model<IMessageWithStatus> implements IMessageWithStatus {
  public id!: number;
  public content!: string;
  public senderId!: number;
  public receiverId!: number;
  public status?: "sent" | "delivered" | "read";
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

Message.init(
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    content: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    senderId: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    receiverId: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    status: {
      type: DataTypes.ENUM("sent", "delivered", "read"),
      defaultValue: "sent",
      allowNull: false,
    },
  },
  {
    sequelize,
    modelName: "Message",
    timestamps: true,
  }
);

export default Message;
