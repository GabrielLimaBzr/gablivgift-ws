import { FastifyInstance } from 'fastify';
import bcrypt from 'bcryptjs';
import { PrismaClient } from '@prisma/client';
import redis from '../../../redis';

const prisma = new PrismaClient();

export async function login(fastify: FastifyInstance) {
  fastify.post('/login', async (request, reply) => {
    const { email, password } = request.body as { email: string; password: string };

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

    // Verifica se já existe um token válido no Redis
    const cachedToken = await redis.get(`user:${user.id}:token`);
    if (cachedToken) {
      return reply.send({ message: 'Login bem-sucedido!', token: cachedToken });
    }

    // Gera o token JWT com validade de 7 dias
    // @ts-ignore    
    const token = fastify.jwt.sign({ userId: user.id });

    // Armazena o token no Redis com expiração automática
    await redis.set(`user:${user.id}:token`, token, 'EX', 7 * 24 * 60 * 60); // Expira em 7 dias

    return reply.send({ message: 'Login bem-sucedido!', token });
  });
}
