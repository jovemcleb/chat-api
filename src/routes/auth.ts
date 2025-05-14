import { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { IAuthResponse, ILoginRequest } from "../interfaces/authInterface";
import User from "../models/user";

export default async function authRoutes(fastify: FastifyInstance) {
  fastify.post(
    "/register",
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

        if (!username || !email || !password) {
          return reply
            .code(400)
            .send({ error: "Todos os campos são obrigatórios" });
        }

        const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/;
        if (!passwordRegex.test(password)) {
          return reply.code(400).send({
            error:
              "A senha deve conter pelo menos 8 caracteres, incluindo uma letra maiúscula, uma minúscula e um número",
          });
        }

        const existingUser = await User.findOne({
          where: { email },
        });

        if (existingUser) {
          return reply.code(409).send({ error: "Email já cadastrado" });
        }

        const user = await User.create({ username, email, password });

        const token = fastify.jwt.sign({
          id: user.id,
          email: user.email,
        });

        return reply.code(201).send({ token, user: user.getPublicData() });
      } catch (error: any) {
        reply.code(400).send({ error: error.message });
      }
    }
  );

  fastify.post(
    "/login",
    async (
      request: FastifyRequest<{
        Body: ILoginRequest;
      }>,
      reply: FastifyReply
    ) => {
      const { email, password } = request.body;

      const user = await User.authenticate(email, password);

      if (!user) {
        return reply.code(401).send({
          error: "Email ou senha inválidos",
        });
      }

      const token = fastify.jwt.sign({
        id: user.id,
        email: user.email,
      });

      const response: IAuthResponse = {
        token,
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
        },
      };

      return response;
    }
  );

  // Rota protegida de exemplo
  fastify.get(
    "/me",
    {
      onRequest: [fastify.authenticate],
    },
    async (request: FastifyRequest) => {
      // O usuário autenticado está disponível em request.user
      const userId = (request.user as { id: number }).id;
      const user = await User.findByPk(userId, {
        attributes: ["id", "username", "email"],
      });

      return user;
    }
  );
}
