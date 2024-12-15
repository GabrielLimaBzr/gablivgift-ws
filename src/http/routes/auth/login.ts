import { FastifyInstance } from 'fastify';
import bcrypt from 'bcryptjs';
import { PrismaClient } from '@prisma/client';

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

    // Gera o token JWT
    const token = fastify.jwt.sign({ userId: user.id });

    reply.send({ message: 'Login bem-sucedido!', token });
  });
}
