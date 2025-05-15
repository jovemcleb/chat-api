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
  fastify.get('/ws', { websocket: true }, (connection, req) => {
    // Verificar autenticação
    const token = req.headers['sec-websocket-protocol']?.split(', ')[1];
    
    if (!token) {
        console.error('WebSocket: Token não fornecido');
        connection.socket.close(1008, 'Token não fornecido');
        return;
    }

    // Verificar token JWT
    fastify.jwt.verify(token, (err, decoded) => {
        if (err) {
            console.error('WebSocket: Token inválido', err);
            connection.socket.close(1008, 'Token inválido');
            return;
        }

        const userId = (decoded as { id: number }).id;
        console.log(`Usuário ${userId} conectado via WebSocket`);

        // Envie uma mensagem de confirmação de conexão bem-sucedida
        try {
            connection.socket.send(JSON.stringify({
                type: 'auth_success',
                message: 'Conexão estabelecida com sucesso'
            }));
        } catch (e) {
            console.error('Erro ao enviar mensagem de confirmação:', e);
        }

        // Mantenha a conexão ativa com mensagens ping-pong periódicas
        const pingInterval = setInterval(() => {
            try {
                if (connection.socket.readyState === 1) { // OPEN
                    connection.socket.send(JSON.stringify({ type: 'ping' }));
                } else {
                    clearInterval(pingInterval);
                }
            } catch (e) {
                console.error('Erro no ping:', e);
                clearInterval(pingInterval);
            }
        }, 30000); // Ping a cada 30 segundos

        connection.socket.on('message', async (rawMessage: Buffer) => {
            try {
                const messageData = JSON.parse(rawMessage.toString());
                console.log('Mensagem recebida:', JSON.stringify(messageData));
                
                // Processamento normal de mensagem com conteúdo e destinatário
                if (messageData.receiverId !== undefined && messageData.content !== undefined) {
                    const { receiverId, content } = messageData;

                    // Verifica se os campos obrigatórios existem
                    if (!receiverId || !content) {
                        connection.socket.send(JSON.stringify({
                            type: 'error',
                            error: 'Campos obrigatórios ausentes'
                        }));
                        return;
                    }

                    // Salvar mensagem no banco de dados
                    const message = await Message.create({ 
                        senderId: userId, 
                        receiverId, 
                        content 
                    });
                    
                    // Envia a confirmação para o remetente
                    connection.socket.send(JSON.stringify({
                        type: 'message',
                        message: {
                            ...message.get(),
                            sender: await User.findByPk(userId, {
                                attributes: ['id', 'username']
                            }),
                            receiver: await User.findByPk(receiverId, {
                                attributes: ['id', 'username']
                            })
                        }
                    }));
                } 
                // Responder a pings com pongs
                else if (messageData.type === 'ping') {
                    connection.socket.send(JSON.stringify({
                        type: 'pong',
                        timestamp: new Date().toISOString()
                    }));
                }
                // Responder a mensagens iniciais (handshake)
                else if (messageData.type === 'init') {
                    connection.socket.send(JSON.stringify({
                        type: 'init_ack',
                        userId: userId,
                        timestamp: new Date().toISOString()
                    }));
                }
                // Responder a mensagens pong (que são respostas a pings)
                else if (messageData.type === 'pong') {
                    console.log(`Pong recebido do usuário ${userId}`);
                }
                // Mensagem mal formatada
                else {
                    console.log('WebSocket: Formato de mensagem não reconhecido', messageData);
                    connection.socket.send(JSON.stringify({
                        type: 'error',
                        error: 'Formato de mensagem não reconhecido'
                    }));
                }
                
            } catch (error) {
                console.error('Erro no WebSocket:', error);
                connection.socket.send(JSON.stringify({
                    type: 'error',
                    error: 'Erro ao processar mensagem'
                }));
            }
        });

        connection.socket.on('close', (code:number, reason:string) => {
            console.log(`Usuário ${userId} desconectado. Código: ${code}, Razão: ${reason || 'Não especificada'}`);
            clearInterval(pingInterval);
        });

        connection.socket.on('error', (error:Error) => {
            console.error(`Erro na conexão WebSocket do usuário ${userId}:`, error);
            clearInterval(pingInterval);
        });
    });
  });
}