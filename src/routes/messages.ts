import { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { Op } from "sequelize";
import { IMessage } from "../interfaces/messageInterface";
import Message from "../models/message";
import User from "../models/user";

export default async function messageRoutes(fastify: FastifyInstance) {
  // Enviar mensagem
  fastify.post(
    "/messages",
    async (
      request: FastifyRequest<{
        Body: {
          senderId: number;
          receiverId: number;
          content: string;
        };
      }>,
      reply: FastifyReply
    ) => {
      const { senderId, receiverId, content } = request.body;

      const [sender, receiver] = await Promise.all([
        User.findByPk(senderId),
        User.findByPk(receiverId),
      ]);

      if (!sender || !receiver) {
        reply.code(404).send({ error: "User not found" });
        return;
      }

      const message = await Message.create({ senderId, receiverId, content });
      return message as IMessage;
    }
  );

  // Obter conversa
  fastify.get(
    "/messages/:user1Id/:user2Id",
    async (
      request: FastifyRequest<{
        Params: {
          user1Id: string;
          user2Id: string;
        };
      }>
    ) => {
      const user1Id = parseInt(request.params.user1Id);
      const user2Id = parseInt(request.params.user2Id);

      const messages = await Message.findAll({
        where: {
          [Op.or]: [
            { senderId: user1Id, receiverId: user2Id },
            { senderId: user2Id, receiverId: user1Id },
          ],
        },
        order: [["createdAt", "ASC"]],
        include: [
          { model: User, as: "sender", attributes: ["id", "username"] },
          { model: User, as: "receiver", attributes: ["id", "username"] },
        ],
      });

      return messages;
    }
  );

  // WebSocket para chat em tempo real
  fastify.get("/messages/ws", { websocket: true }, (connection, req) => {
  const socket = connection.socket;

    // Adicionando tipo explícito para rawMessage
    socket.on("message", async (rawMessage: Buffer) => {
      try {
        const message = rawMessage.toString();
        const { senderId, receiverId, content } = JSON.parse(message) as {
          senderId: number;
          receiverId: number;
          content: string;
        };

        // Salvar no banco de dados
        const msg = await Message.create({ senderId, receiverId, content });
        
        // Enviar confirmação
        socket.send(JSON.stringify({
          status: "delivered",
          message: msg
        }));
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        socket.send(JSON.stringify({
          status: "error",
          error: errorMessage
        }));
      }
    });

    socket.on("close", () => {
      console.log("Connection closed");
    });
  });
}