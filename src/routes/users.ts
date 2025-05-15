import { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { IUserPublic } from "../interfaces/userInterface";
import User from "../models/user";

export default async function userRoutes(fastify: FastifyInstance) {
  // Buscar usuário
  fastify.get(
    "/users/search/",
    async (
      request: FastifyRequest<{
        Querystring: { email?: string; username?: string };
      }>,
      reply: FastifyReply
    ) => {
      const { email, username } = request.query;

      if (!email && !username) {
        return reply.code(400).send({ error: "Provide email or username" });
      }

      const user = await User.findOne({
        where: { ...(email && { email }), ...(username && { username }) },
        attributes: ["id", "username", "email"],
      });

      if (!user) {
        reply.code(404).send({ error: "User not found" });
        return;
      }

      return user as IUserPublic;
    }
  );

  // users.ts - adicione esta rota
  fastify.get(
      "/:id",
      async (
          request: FastifyRequest<{
              Params: { id: string };
          }>,
          reply: FastifyReply
      ) => {
          const user = await User.findByPk(request.params.id, {
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
