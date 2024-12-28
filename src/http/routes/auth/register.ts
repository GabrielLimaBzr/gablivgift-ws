import { FastifyInstance } from 'fastify';
import bcrypt from 'bcryptjs';
import { PrismaClient } from '@prisma/client';
import nodemailer from 'nodemailer';
import { z } from 'zod'

const prisma = new PrismaClient();

const transporter = nodemailer.createTransport({
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

  async function sendEmail(user: { id: number; email: string; fullName: string }) {
    try {
      // Gera um token de verificação de e-mail
      const token = fastify.jwt.sign(
        { userId: user.id, email: user.email },
        { expiresIn: '24h' }
      );
      fastify.log.info('Token Gerado Com Sucesso para verificação de EMAIL');
      fastify.log.info(`Email: ${process.env.EMAIL_SENDER}`);

      // Envia o e-mail de verificação
      const verificationLink = `http://localhost:433/gabliv/api/v1/auth/verify-email?token=${token}`;

      await transporter.sendMail({
        from: `"GabLiv Gifts" <${process.env.EMAIL_SENDER}>`, // Remetente
        to: user.email, // Destinatário
        subject: 'Verifique seu e-mail',
        text: `Olá ${user.fullName}, clique no link abaixo para verificar seu e-mail: ${verificationLink}`,
        html: `<p>Olá ${user.fullName},</p>
              <p>Clique no link abaixo para verificar seu e-mail:</p>
              <a href="${verificationLink}">${verificationLink}</a>`,
      });

      fastify.log.info('E-mail para validação enviado com sucesso');
    } catch (error) {
      fastify.log.error(`Erro ao enviar e-mail para validação: ${error}`);
      throw new Error('Falha ao enviar e-mail de verificação.');
    }
  }

  fastify.post('/register', async (request, reply) => {
    const { fullName, email, password } = dto.parse(request.body);

    try {
      // Usando transação do Prisma
      const user = await prisma.$transaction(async (tx) => {
        // Verifica se o usuário já existe
        const existingUser = await tx.user.findUnique({
          where: { email },
        });

        if (existingUser) {
          throw new Error('Usuário já existe!');
        }

        // Criptografa a senha
        const hashedPassword = await bcrypt.hash(password, 10);

        // Cria o novo usuário no banco de dados
        const createdUser = await tx.user.create({
          data: {
            fullName,
            email,
            password: hashedPassword,
            isActive: false, // Define como inativo até verificar o e-mail
          },
          select: {
            id: true,
            fullName: true,
            isActive: true,
            email: true,
            createdAt: true,
          },
        });

        // Tenta enviar o e-mail (se falhar, transação será revertida)
        await sendEmail(createdUser);

        return createdUser;
      });

      fastify.log.info(`Usuário criado: ${user.createdAt}`);
      reply.status(201).send({
        message: 'Usuário criado com sucesso! Verifique seu e-mail para ativar sua conta.',
        user,
      });
    } catch (err: any) {
      if (err.message === 'Usuário já existe!') {
        return reply.status(400).send({ message: err.message });
      }
      fastify.log.error(`Erro durante o registro: ${err}`);
      reply.status(500).send({ message: 'Erro interno do servidor.' });
    }
  })


  fastify.get('/verify-email', async (request, reply) => {
    const { token } = request.query as { token: string };

    try {
      // Verifica e decodifica o token usando o Fastify JWT
      const decoded = fastify.jwt.verify(token) as { userId: number };

      // Ativa o usuário
      await prisma.user.update({
        where: { id: decoded.userId },
        data: { isActive: true },
      });

      reply.send({ message: 'E-mail verificado com sucesso! Você já pode fazer login.' });
    } catch (err) {
      return reply.status(400).send({ error: 'Token inválido ou expirado.' });
    }
  });
}
