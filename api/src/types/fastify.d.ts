import { WebSocket } from "ws";
import { JwtPayload } from "../routes/messages";

declare module "fastify" {
  interface FastifyInstance {
    activeConnections: Map<number, WebSocket>;
    jwt: {
      verify(token: string): JwtPayload;
    };
  }
}
