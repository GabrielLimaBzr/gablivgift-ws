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
      fastify.log.info('Token Gerado Com Sucesso para verificacao de EMAIL');

      // Envia o e-mail de verificação
      const verificationLink = `https://gabliv.bzrdev.icu/verify-email?token=${token}`;

      await transporter.sendMail({
        from: `"GabLiv Gifts" <${process.env.EMAIL_SENDER}>`, // Remetente
        to: user.email, // Destinatário
        subject: 'GabLiv: Verifique seu e-mail',
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

        let codeUser = generateUserCode();

        // Verifica se o código já existe no banco de dados, e gera um novo se necessário
        while (await tx.user.findUnique({ where: { codeUser: codeUser } })) {
          codeUser = generateUserCode();
        }

        // Criptografa a senha
        const hashedPassword = await bcrypt.hash(password, 10);

        // Cria o novo usuário no banco de dados
        const createdUser = await tx.user.create({
          data: {
            fullName,
            email,
            password: hashedPassword,
            codeUser: codeUser,
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


  const dtoRec = z.object({
    email: z.string().email('E-mail inválido!').min(3, 'E-mail inválido!'),
  });

  async function sendRecoveryEmail(user: { id: number; email: string; fullName: string }) {
    try {
      // Gerar token JWT para redefinição de senha com validade de 24 horas
      const token = fastify.jwt.sign(
        { userId: user.id, email: user.email },
        { expiresIn: '24h' }
      );

      fastify.log.info('Token gerado para redefinição de senha');

      const resetLink = `https://gabliv.bzrdev.icu/reset-password?token=${token}`;

      await transporter.sendMail({
        from: `"GabLiv Gifts" <${process.env.EMAIL_SENDER}>`,
        to: user.email,
        subject: 'GabLiv: Redefinição de senha',
        text: generateResetPasswordPlainTextEmail(user, resetLink),
        html: generateResetPasswordHtmlEmail(user, resetLink),
      });

      fastify.log.info('E-mail de recuperação enviado com sucesso');
    } catch (error) {
      fastify.log.error(`Erro ao enviar e-mail de recuperação: ${error}`);
      throw new Error('Falha ao enviar e-mail de recuperação.');
    }
  }

  // Endpoint para solicitar recuperação de senha
  fastify.post('/recover-password', async (request, reply) => {
    const { email } = dtoRec.parse(request.body);

    try {
      const user = await prisma.user.findUnique({ where: { email } });

      if (!user) {
        return reply.status(404).send({ message: 'Usuário não encontrado.' });
      }

      await sendRecoveryEmail(user);
      reply.status(200).send({ message: 'E-mail de recuperação enviado.' });
    } catch (error) {
      fastify.log.error(`Erro ao solicitar recuperação de senha: ${error}`);
      reply.status(500).send({ message: 'Erro interno do servidor.' });
    }
  });

  // Endpoint para redefinir a senha
  fastify.post('/reset-password', async (request, reply) => {
    const schema = z.object({
      token: z.string(),
      newPassword: z.string().min(8, 'A senha deve ter no mínimo 8 caracteres'),
    });

    const { token, newPassword } = schema.parse(request.body);

    try {
      const payload = fastify.jwt.verify(token) as { userId: number; email: string };

      const hashedPassword = await bcrypt.hash(newPassword, 10);

      await prisma.user.update({
        where: { id: payload.userId },
        data: { password: hashedPassword },
      });

      fastify.log.info('Senha redefinida com sucesso');
      reply.status(200).send({ message: 'Senha redefinida com sucesso.' });
    } catch (error) {
      fastify.log.error(`Erro ao redefinir senha: ${error}`);
      reply.status(400).send({ message: 'Token inválido ou expirado.' });
    }
  });
}


function generateResetPasswordHtmlEmail(user: { fullName: string }, resetLink: string): string {
  return `
    <div style="font-family: 'Arial', sans-serif; color: #333; max-width: 600px; margin: 0 auto; padding: 40px; border: 1px solid #ddd; border-radius: 12px; text-align: center;">
      <h1 style="color: #4CAF50; font-size: 28px;">Redefinição de Senha</h1>
      <p style="font-size: 16px;">Olá, <strong>${user.fullName}</strong>!</p>
      <p style="font-size: 16px; color: #666;">Recebemos uma solicitação para redefinir a sua senha no GabLiv Gifts. Se você não fez essa solicitação, por favor, ignore este e-mail.</p>
      
      <div style="margin: 30px 0;">
        <a href="${resetLink}" 
           style="background-color: #4CAF50; color: white; padding: 12px 24px; text-decoration: none; font-size: 16px; font-weight: bold; border-radius: 8px;">
           Redefinir Senha
        </a>
      </div>

      <p style="font-size: 14px; color: #666;">Se você não conseguir clicar no botão acima, copie e cole este endereço no seu navegador:</p>
      <p style="word-wrap: break-word; color: #555;">${resetLink}</p>
      
      <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
      
      <p style="font-size: 12px; color: #999;">
        Este link expira em 24 horas.<br>
        Caso tenha dúvidas, entre em contato com o nosso suporte.<br>
        © 2024 GabLiv Gifts
      </p>
    </div>
  `;
}

function generateResetPasswordPlainTextEmail(user: { fullName: string }, resetLink: string): string {
  return `
    Redefinição de Senha
    Olá ${user.fullName}!

    Recebemos uma solicitação para redefinir a sua senha no GabLiv Gifts.
    Se não foi você quem fez essa solicitação, por favor, ignore este e-mail.

    Para redefinir sua senha, acesse o link abaixo:
    ${resetLink}

    Este link expira em 24 horas.

    Atenciosamente,
    GabLiv Gifts
  `;
}


const generateUserCode = () => {
  const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let code = '#';

  for (let i = 0; i < 5; i++) {
    const randomIndex = Math.floor(Math.random() * characters.length);
    code += characters[randomIndex];
  }

  return code;
};

function generateHtmlEmail(user: { fullName: string }, verificationLink: string): string {
  return `
    <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #ddd; border-radius: 8px;">
      <h2 style="text-align: center; color: #4CAF50;">Confirme seu endereço de e-mail</h2>
      <p>Olá ${user.fullName}!</p>
      <p>Confirme o seu e-mail para criar uma conta no GabLivGifts.</p>
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