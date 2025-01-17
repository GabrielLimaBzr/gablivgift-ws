import { FastifyInstance } from 'fastify';
import bcrypt from 'bcryptjs';
import { PrismaClient } from '@prisma/client';
import redis from '../../../redis';

const prisma = new PrismaClient();

export async function login(fastify: FastifyInstance) {
  fastify.post('/login', async (request, reply) => {
    try {
      const { email, password } = request.body as { email: string; password: string };

      // Validações simples de entrada
      if (!email || !password) {
        return reply.status(400).send({ message: 'Email e senha são obrigatórios!' });
      }

      // Verifica se o usuário existe
      const user = await prisma.user.findUnique({
        where: { email },
      });

      if (!user) {
        return reply.status(400).send({ message: 'Usuário ou senha incorretos!' });
      }

      // Verifica se a senha está correta
      const isPasswordValid = await bcrypt.compare(password, user.password);

      if (!isPasswordValid) {
        return reply.status(400).send({ message: 'Usuário ou senha incorretos!' });
      }

      if (!user.isActive) {
        return reply.status(403).send({ message: 'Usuário inativo ou não verificado!' });
      }

      // Recupera o casal associado ao usuário (se existir)
      const couple = await prisma.couple.findFirst({
        where: {
          OR: [
            { user1Id: user.id },
            { user2Id: user.id },
          ],
        },
      });

      const userResponse = {
        id: user.id,
        fullName: user.fullName,
        email: user.email,
      };

      // Verifica se já existe um token válido no Redis
      const cachedToken = await redis.get(`user:${user.id}:token`);
      if (cachedToken) {
        return reply.send({
          message: 'Login bem-sucedido!',
          token: cachedToken,
          user: userResponse,
          couple,
        });
      }

      // Gera o token JWT com validade de 7 dias
      const token = fastify.jwt.sign({
        userId: user.id,
        coupleId: couple?.id || null,
      });

      // Armazena o token no Redis com expiração automática
      await redis.set(`user:${user.id}:token`, token, 'EX', 7 * 24 * 60 * 60); // Expira em 7 dias

      return reply.send({
        message: 'Login bem-sucedido!',
        token,
        user: userResponse,
        couple,
      });

    } catch (error) {
      // Registro do erro para auditoria ou debugging
      fastify.log.error(error);

      // Resposta genérica para erros não tratados
      return reply.status(500).send({
        message: 'Ocorreu um erro inesperado. Tente novamente mais tarde.',
      });
    }
  });
}


