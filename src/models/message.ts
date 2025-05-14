import { DataTypes, Model } from "sequelize";
import sequelize from "../db";
import { IMessage } from "../interfaces/messageInterface";

class Message extends Model<IMessage> implements IMessage {
  public id!: number;
  public content!: string;
  public senderId!: number;
  public receiverId!: number;
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
  },
  {
    sequelize,
    modelName: "Message",
    timestamps: true,
  }
);

export default Message;
