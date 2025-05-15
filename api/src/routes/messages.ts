import { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { Op } from "sequelize";
import WebSocket from "ws";
import { IMessage } from "../interfaces/messageInterface";
import Message from "../models/message";
import User from "../models/user";

// Interface para o payload do JWT
export interface JwtPayload {
  id: number;
  email: string;
  iat: number;
  exp: number;
}

// Interface para as mensagens enviadas via WebSocket
interface WebSocketMessage {
  senderId?: number;
  receiverId: number;
  content: string;
  type?: string;
}

// Interface para mensagens de status de entrega
interface DeliveryStatusMessage {
  type: "delivery_status";
  messageId: number;
  status: string;
}

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
  fastify.get(
    "/ws",
    {
      websocket: true,
    },
    async (
      connection: WebSocket,
      req: FastifyRequest<{ Querystring: { token: string } }>
    ) => {
      const socket = connection;

      try {
        // Extrair o token da query param
        const token = req.query.token;
        if (!token) {
          if (socket.readyState === WebSocket.OPEN) {
            socket.send(
              JSON.stringify({
                type: "error",
                content: "Token missing",
              })
            );
            socket.close(1008, "Token missing");
          }
          return;
        }

        try {
          // Verificar o token
          const decoded = fastify.jwt.verify(token) as JwtPayload;
          const userId = decoded.id;

          // Armazenar conexão
          fastify.activeConnections.set(userId, socket);
          console.log(`User ${userId} connected via WebSocket`);

          // Verificar e entregar mensagens pendentes quando o usuário conecta
          await deliverPendingMessages(userId, socket);

          // Notificar cliente que está conectado
          socket.send(
            JSON.stringify({
              type: "system",
              content: "Authenticated and connected",
            })
          );

          // Manipular mensagens recebidas
          socket.on("message", async (rawMessage: WebSocket.Data) => {
            try {
              const message = JSON.parse(
                rawMessage.toString()
              ) as WebSocketMessage;

              // Validar a mensagem
              if (!message.receiverId || !message.content) {
                connection.send(
                  JSON.stringify({
                    type: "error",
                    content: "Invalid message format",
                  })
                );
                return;
              }

              // Criar uma nova mensagem no banco com Sequelize
              const dbMessage = await Message.create({
                senderId: userId,
                receiverId: message.receiverId,
                content: message.content,
                status: "sent", // Adicionando campo de status (você precisará adicionar ao modelo)
              });

              const messageToSend = {
                type: "chat",
                id: dbMessage.id,
                senderId: dbMessage.senderId,
                receiverId: dbMessage.receiverId,
                content: dbMessage.content,
                createdAt: dbMessage.createdAt,
                status: dbMessage.status,
              };

              // Enviar confirmação de volta para o remetente
              connection.send(JSON.stringify(messageToSend));

              // Tentar entregar para o destinatário, se online
              const receiverSocket = fastify.activeConnections.get(
                message.receiverId
              );
              if (
                receiverSocket &&
                receiverSocket.readyState === WebSocket.OPEN
              ) {
                try {
                  receiverSocket.send(JSON.stringify(messageToSend));

                  // Atualizar status da mensagem para "delivered"
                  await dbMessage.update({ status: "delivered" });

                  // Notificar remetente que a mensagem foi entregue
                  connection.send(
                    JSON.stringify({
                      type: "delivery_status",
                      messageId: dbMessage.id,
                      status: "delivered",
                    } as DeliveryStatusMessage)
                  );
                } catch (sendError) {
                  console.error("Error sending to receiver:", sendError);
                }
              } else {
                console.log(
                  `Receiver ${message.receiverId} is offline. Message stored for later delivery.`
                );
              }
            } catch (error) {
              console.error("Error processing message:", error);
              if (connection.readyState === WebSocket.OPEN) {
                connection.send(
                  JSON.stringify({
                    type: "error",
                    content: "Error processing message",
                  })
                );
              }
            }
          });

          // Lidar com desconexão
          connection.on("close", () => {
            console.log(`User ${userId} disconnected`);
            fastify.activeConnections.delete(userId);
          });
        } catch (jwtError) {
          console.error("JWT verification failed:", jwtError);
          if (connection.readyState === WebSocket.OPEN) {
            connection.send(
              JSON.stringify({
                type: "error",
                content: "Authentication failed",
              })
            );
            connection.close(1008, "Authentication failed");
          }
        }
      } catch (error) {
        console.error("WebSocket error:", error);
        // Verificar se o socket ainda existe antes de tentar fechá-lo
        if (connection.readyState === WebSocket.OPEN) {
          connection.close(1011, "Internal server error");
        }
      }
    }
  );

  // Função para entregar mensagens pendentes quando um usuário se conecta
  async function deliverPendingMessages(
    userId: number,
    socket: WebSocket
  ): Promise<void> {
    try {
      // Buscar mensagens não entregues onde o usuário é o destinatário
      const pendingMessages = await Message.findAll({
        where: {
          receiverId: userId,
          status: "sent", // apenas mensagens ainda não entregues
        },
        order: [["createdAt", "ASC"]], // ordenar por data de criação
      });

      if (pendingMessages.length > 0) {
        console.log(
          `Delivering ${pendingMessages.length} pending messages to user ${userId}`
        );

        // Entregar cada mensagem pendente
        for (const message of pendingMessages) {
          if (socket.readyState === WebSocket.OPEN) {
            socket.send(
              JSON.stringify({
                type: "chat",
                id: message.id,
                senderId: message.senderId,
                receiverId: message.receiverId,
                content: message.content,
                createdAt: message.createdAt,
                status: message.status,
              })
            );

            // Atualizar status da mensagem para "delivered"
            await message.update({ status: "delivered" });

            // Notificar o remetente se estiver online
            const senderSocket = fastify.activeConnections.get(
              message.senderId
            );
            if (senderSocket && senderSocket.readyState === WebSocket.OPEN) {
              senderSocket.send(
                JSON.stringify({
                  type: "delivery_status",
                  messageId: message.id,
                  status: "delivered",
                } as DeliveryStatusMessage)
              );
            }
          }
        }
      }
    } catch (error) {
      console.error(
        `Error delivering pending messages to user ${userId}:`,
        error
      );
    }
  }
}
