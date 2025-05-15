import { WebSocket } from "ws";

declare module "fastify" {
  interface FastifyInstance {
    websocketConnections: Map<number, WebSocket>;
  }
}
