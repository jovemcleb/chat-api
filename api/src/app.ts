import fastifyCors from "@fastify/cors";
import fastifyHelmet from "@fastify/helmet";
import fastifyJwt from "@fastify/jwt";
import fastifyWebsocket from "@fastify/websocket";
import dotenv from "dotenv";
import fastify, {
  FastifyInstance,
  FastifyReply,
  FastifyRequest,
} from "fastify";
import path from "path";
import sequelize from "./db";
import Message from "./models/message";
import User from "./models/user";

dotenv.config({
  path: path.resolve(__dirname, "../.env"),
});

const app: FastifyInstance = fastify({ logger: true });
app.decorate("websocketConnections", new Map<number, WebSocket>());

// Registrar plugins
app.register(fastifyWebsocket);
app.register(fastifyCors, {
  origin: true, // Ou especifique seu frontend (ex: "http://localhost:5500")
  credentials: true,
  allowedHeaders: ["Sec-WebSocket-Protocol", "Content-Type", "Authorization"],
});
app.register(fastifyHelmet);
app.register(fastifyJwt, {
  secret: process.env.JWT_SECRET!,
  sign: {
    expiresIn: "1d", // Token expira em 1 dia
  },
});

// Adicione o tipo de usuário ao FastifyInstance
declare module "fastify" {
  interface FastifyInstance {
    authenticate: (
      request: FastifyRequest,
      reply: FastifyReply
    ) => Promise<void>;
  }
}

app.decorate(
  "authenticate",
  async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      await request.jwtVerify();
    } catch (err) {
      reply.send(err);
    }
  }
);

// Registrar rotas
app.register(import("./routes/auth"), { prefix: "/api/auth" });
app.register(import("./routes/users"), { prefix: "/api/users" });
app.register(import("./routes/messages"), { prefix: "/api/messages" });

// Relacionamentos
User.hasMany(Message, { foreignKey: "senderId", as: "sentMessages" });
User.hasMany(Message, { foreignKey: "receiverId", as: "receivedMessages" });
Message.belongsTo(User, { foreignKey: "senderId", as: "sender" });
Message.belongsTo(User, { foreignKey: "receiverId", as: "receiver" });

// Sincronizar banco de dados
const initialize = async () => {
  try {
    await sequelize.authenticate();
    await sequelize.sync(); // { force: true } para recriar tabelas em dev
    app.log.info("Database connected and synced");
  } catch (error) {
    app.log.error(error);
    process.exit(1);
  }
};

export { app, initialize };
