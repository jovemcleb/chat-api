import { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { IUserPublic } from "../interfaces/userInterface";
import User from "../models/user";

export default async function userRoutes(fastify: FastifyInstance) {
  // Buscar usuário
  fastify.get(
    "/users/:id",
    async (
      request: FastifyRequest<{
        Params: { id: string };
      }>,
      reply: FastifyReply
    ) => {
      const user = await User.findByPk(parseInt(request.params.id), {
        attributes: ["id", "username", "email"],
      });

      if (!user) {
        reply.code(404).send({ error: "User not found" });
        return;
      }

      return user as IUserPublic;
    }
  );

  // Listar usuários
  fastify.get("/all", async (request: FastifyRequest) => {
    const users = await User.findAll({
      attributes: ["id", "username", "email"],
    });
    return users as IUserPublic[];
  });
}
