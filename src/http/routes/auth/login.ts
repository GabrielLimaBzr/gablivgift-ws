import { FastifyInstance } from 'fastify';
import bcrypt from 'bcryptjs';
import { PrismaClient } from '@prisma/client';


const prisma = new PrismaClient();

export async function login(fastify: FastifyInstance) {
  fastify.post('/login', async (request, reply) => {
    try {
      const { email, password } = request.body as { email: string; password: string };

      // Validações simples de entrada
      if (!email || !password) {
        return reply.status(400).send({ message: 'Email e senha são obrigatórios!' });
      }

      const user = await prisma.user.findUnique({
        where: { email },
      });

      if (!user) {
        return reply.status(400).send({ message: 'Usuário ou senha incorretos!' });
      }

      if (!user.isActive) {
        return reply.status(403).send({ message: 'Usuário inativo ou não verificado!' });
      }

      const isPasswordValid = await bcrypt.compare(password, user.password);

      if (!isPasswordValid) {
        return reply.status(400).send({ message: 'Usuário ou senha incorretos!' });
      }



      // Recupera o casal associado ao usuário (se existir)
      const couple = await prisma.couple.findFirst({
        where: {
          OR: [
            { user1Id: user.id },
            { user2Id: user.id },
          ],
        },
        include: {
          user1: {
            select: {
              id: true,
              fullName: true,
            },
          },
          user2: {
            select: {
              id: true,
              fullName: true,
            },
          },
        },
      });

      const userResponse = {
        id: user.id,
        fullName: user.fullName,
        email: user.email,
        codeUser: user.codeUser,
      };

      // Gera o token JWT com validade de 7 dias
      const token = fastify.jwt.sign({
        userId: user.id,

      });

      const coupleResponse = couple ? {
        id: couple.id,
        user: user.id === couple.user1Id ? couple.user2 : couple.user1,
      } : null;

      return reply.send({
        message: 'Login bem-sucedido!',
        token,
        user: userResponse,
        couple: coupleResponse,
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


