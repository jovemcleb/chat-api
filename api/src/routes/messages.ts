import { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { Op } from "sequelize";
import { IMessage } from "../interfaces/messageInterface";
import Message from "../models/message";
import User from "../models/user";

export default async function messageRoutes(fastify: FastifyInstance) {
  // Enviar mensagem
  fastify.post(
    "/send",
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
    "/:user1Id/:user2Id",
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

  // WebSocket para chat em tempo real - versão corrigida e robusta
  fastify.get("/ws", { websocket: true }, (connection, req) => {
    console.log("Nova conexão WebSocket estabelecida");

    // Envia mensagem de boas-vindas
    connection.socket.send("Conexão estabelecida com sucesso!");

    // Recebe mensagens do cliente
    connection.socket.on("message", (message: string) => {
      console.log("Mensagem recebida:", message.toString());
      connection.socket.send(`Você disse: ${message}`);
    });

    // Trata fechamento
    connection.socket.on("close", () => {
      console.log("Conexão fechada pelo cliente");
    });
  });
}
