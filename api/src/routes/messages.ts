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
    // Verificar autenticação
    const protocols = req.headers["sec-websocket-protocol"]?.split(", ") || [];
    const token = protocols[1] || protocols[0];
    // Log detalhado para depuração
    console.log("Nova conexão WebSocket recebida");
    console.log("Cabeçalhos:", req.headers);
    console.log("Token recebido:", token);

    if (!token) {
      console.error("WebSocket: Token não fornecido");
      connection.socket.close(1008, "Token não fornecido");
      return;
    }

    // Verificar token JWT
    fastify.jwt.verify(token, (err, decoded) => {
      if (err) {
        console.log("Fechando conexão - Token inválido", err);
        return connection.socket.close(1008, "Token inválido");
      }

      const userId = (decoded as { id: number }).id;
      console.log(`Usuário ${userId} conectado via WebSocket`);

      // Heartbeat
      const heartbeatInterval = setInterval(() => {
        if (connection.socket.readyState === 1) {
          connection.socket.ping();
        } else {
          clearInterval(heartbeatInterval);
        }
      }, 25000);

      // Armazenar conexões ativas (simplificado)
      if (!fastify.websocketConnections) {
        fastify.websocketConnections = new Map();
      }
      fastify.websocketConnections.set(userId, connection.socket);

      connection.socket.on("message", async (message: string) => {
        try {
          const data = JSON.parse(message.toString());

          // Mensagem de chat
          if (data.receiverId && data.content) {
            const message = await Message.create({
              senderId: userId,
              receiverId: data.receiverId,
              content: data.content,
            });

            // Enviar confirmação para o remetente
            connection.socket.send(
              JSON.stringify({
                type: "message",
                message: {
                  ...message.get(),
                  sender: await User.findByPk(userId, {
                    attributes: ["id", "username"],
                  }),
                },
              })
            );

            // Enviar para o destinatário se estiver online
            const recipientSocket = fastify.websocketConnections.get(
              data.receiverId
            );
            if (recipientSocket && recipientSocket.readyState === 1) {
              recipientSocket.send(
                JSON.stringify({
                  type: "message",
                  message: {
                    ...message.get(),
                    sender: await User.findByPk(userId, {
                      attributes: ["id", "username"],
                    }),
                  },
                })
              );
            }
          }
        } catch (error) {
          console.error("Erro ao processar mensagem:", error);
        }
      });

      connection.socket.on("close", () => {
        clearInterval(heartbeatInterval);
        fastify.websocketConnections.delete(userId);
      });
    });
  });
}
