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

  function generateHtmlEmail(user: { fullName: string }, verificationLink: string): string {
    return `
      <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #ddd; border-radius: 8px;">
        <h2 style="text-align: center; color: #4CAF50;">Confirme seu endereço de e-mail</h2>
        <p>Olá ${user.fullName}!</p>
        <p>Confirme o seu e-mail para criar uma conta no Jusbrasil.</p>
        <div style="text-align: center; margin: 20px 0;">
          <a href="${verificationLink}" 
             style="display: inline-block; padding: 12px 24px; background-color: #4CAF50; color: #fff; text-decoration: none; font-size: 16px; font-weight: bold; border-radius: 5px;">
             Confirmar e-mail
          </a>
        </div>
        <p>Caso não consiga clicar no botão acima, copie e cole este endereço no seu navegador:</p>
        <p style="word-wrap: break-word; color: #555;">${verificationLink}</p>
        <p>Atenciosamente,<br>GabLiv Gifts</p>
        <hr style="border: none; border-top: 1px solid #eee; margin: 20px 20px;">
        <p style="font-size: 12px; color: #666;">Este link expira em 24 horas.<br>Se não foi você quem fez essa solicitação, por favor, desconsidere este e-mail.</p>
        <p style="font-size: 12px; color: #999; text-align: center;">© 2024, Gabliv Gifts </p>
      </div>
    `;
  }

  // Função para criar o texto puro do e-mail
  function generatePlainTextEmail(user: { fullName: string }, verificationLink: string): string {
    return `
        Confirme seu endereço de e-mail
        Olá ${user.fullName}!
        Confirme o seu e-mail para criar uma conta no GabLiv Gifts.
        Confirme seu e-mail no link abaixo:
        ${verificationLink}
        Caso não consiga clicar no botão acima, copie e cole este endereço no seu navegador:
        ${verificationLink}
        
        Atenciosamente,
        GabLiv Gifts
        
        Este link expira em 24 horas.
        Se não foi você quem fez essa solicitação, por favor, desconsidere este e-mail.
          `
      ;
  }


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
      const verificationLink = `https://gablivgift.vercel.app/verify-email?token=${token}`;

      await transporter.sendMail({
        from: `"GabLiv Gifts" <${process.env.EMAIL_SENDER}>`, // Remetente
        to: user.email, // Destinatário
        subject: 'Verifique seu e-mail',
        text: generatePlainTextEmail(user, verificationLink),
        html: generateHtmlEmail(user, verificationLink),
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
      const decoded = fastify.jwt.verify(token) as { userId: number };
    
      const user = await prisma.user.findUnique({
        where: { id: decoded.userId },
      });
    
      if (!user) {
        return reply.status(400).send({ error: 'Token inválido.' });
      }
    
      if (user.isActive) {
        return reply.status(400).send({ error: 'Token inválido.' });
      }
    
      await prisma.user.update({
        where: { id: decoded.userId },
        data: { isActive: true },
      });
    
      reply.send({ message: 'E-mail verificado com sucesso! Você já pode fazer login.' });
    } catch (err: any) {
      if (err.name === 'TokenExpiredError') {
        return reply.status(400).send({ error: 'Token expirado. Solicite um novo link de verificação.' });
      }
    
      return reply.status(400).send({ error: 'Token inválido.' });
    }
    
  });
}
