import fastifyCors from "@fastify/cors";
import fastifyHelmet from "@fastify/helmet";
import fastify, { FastifyInstance } from "fastify";
import sequelize from "./db";
import Message from "./models/message";
import User from "./models/user";

const app: FastifyInstance = fastify({ logger: true });

// Registrar plugins
app.register(fastifyCors);
app.register(fastifyHelmet);

// Registrar rotas
app.register(import("./routes/users"), { prefix: "/api" });
app.register(import("./routes/messages"), { prefix: "/api" });

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
