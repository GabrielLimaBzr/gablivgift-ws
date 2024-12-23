import { FastifyInstance } from 'fastify';
import bcrypt from 'bcryptjs';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function register(fastify: FastifyInstance) {
  fastify.post('/register', async (request, reply) => {
    const { fullName, email, password } = request.body as { fullName: string; email: string; password: string };

    // Verifica se o usuário já existe
    const existingUser = await prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      return reply.status(400).send({ message: 'Usuário já existe!' });
    }

    // Criptografa a senha
    const hashedPassword = await bcrypt.hash(password, 10);

    // Cria o novo usuário no banco de dados
    const user = await prisma.user.create({
      data: {
        fullName,
        email,
        password: hashedPassword,
      },
      select: {
        id: true,
        fullName: true,
      },
    });

    reply.status(201).send({ message: 'Usuário criado com sucesso!', user });
  });
}
