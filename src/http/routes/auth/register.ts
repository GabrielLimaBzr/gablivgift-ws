import { FastifyInstance } from 'fastify';
import bcrypt from 'bcryptjs';
import { PrismaClient } from '@prisma/client';
import nodemailer from 'nodemailer';
import { z } from 'zod'

const prisma = new PrismaClient();

const email = nodemailer.createTransport({
  host: 'smtp.gmail.com',
  secure: true,
  port: 465,
  auth: {
    user: process.env.EMAIL_SENDER,
    pass: process.env.EMAIL_PASS
  }
});

export async function register(fastify: FastifyInstance) {
  //Validação
  const dto = z.object({
    fullName: z
      .string()
      .min(3, 'O  nome deve ter pelo menos 3 caracteres')
      .max(100, 'O nome não pode exceder 100 caracteres'),

    email: z
      .string().email('Email invalido!').min(3, 'Email invalido!'),

    password: z
      .string().min(8, "A senha deve ter no mínimo 8 caracteres")
  });


  //Rota
  fastify.post('/register', async (request, reply) => {

    try {

      const {
        fullName,
        email,
        password
      } = dto.parse(request.body);


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
          isActive: true,
        },
      });

      reply.status(201).send({ message: 'Usuário criado com sucesso!', user });


    } catch (err) {
      if (err instanceof z.ZodError) {
        return reply.status(400).send({ error: err.errors });
      }
      return reply.status(500).send({ error: 'Erro interno do servidor' });

    }


  });
}
