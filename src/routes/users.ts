import { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { IUserPublic } from "../interfaces/userInterface";
import User from "../models/user";

export default async function userRoutes(fastify: FastifyInstance) {
  fastify.post(
    "/users/register",
    async (
      request: FastifyRequest<{
        Body: {
          username: string;
          email: string;
          password: string;
        };
      }>,
      reply: FastifyReply
    ) => {
      try {
        const { username, email, password } = request.body;
        const user = await User.create({ username, email, password });

        const response: IUserPublic = {
          id: user.id,
          username: user.username,
          email: user.email,
        };

        return response;
      } catch (error: any) {
        reply.code(400).send({ error: error.message });
      }
    }
  );

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
  fastify.get("/users", async (request: FastifyRequest) => {
    const users = await User.findAll({
      attributes: ["id", "username", "email"],
    });
    return users as IUserPublic[];
  });
}
