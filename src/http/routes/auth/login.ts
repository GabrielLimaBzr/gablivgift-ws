import fastify, { FastifyInstance } from 'fastify';
import bcrypt from 'bcryptjs';
import { PrismaClient } from '@prisma/client';

import { CoupleRepository } from '../../repository/coupleRepository'; 

const coupleRepository = new CoupleRepository();

const prisma = new PrismaClient();

export async function login(fastify: FastifyInstance) {
  fastify.post('/login', async (request, reply) => {
    try {
      const { email, password } = request.body as { email: string; password: string };

      if (!email || !password) {
        return reply.status(400).send({ message: 'Email e senha são obrigatórios!' });
      }

      const user = await prisma.user.findUnique({ where: { email } });

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

      const coupleActive = await findActiveCouple(user.id);

      let requestSent = null;
      let requestReceived: any = [];

      if (!coupleActive) {
        const pendingCouples = await coupleRepository.findPendingCouplesByUser(user.id);
        requestSent = pendingCouples.requestSent;
        requestReceived = pendingCouples.requestReceived;
      }

      const userResponse = buildUserResponse(user, coupleActive);

      const token = fastify.jwt.sign({ userId: user.id });

      return reply.send({ message: 'Login bem-sucedido!', token, user: userResponse, requestSent, requestReceived});

    } catch (error) {
      fastify.log.error(error);
      return reply.status(500).send({ message: 'Ocorreu um erro inesperado. Tente novamente mais tarde.' });
    }
  });
}

async function findActiveCouple(userId: number) {
  const activeCouple = await prisma.couple.findFirst({
    where: {
      OR: [{ senderId: userId }, { reciverId: userId }],
      status: 1,
    },
    include: {
      sender: { select: { id: true, fullName: true, codeUser: true } },
      reciver: { select: { id: true, fullName: true, codeUser: true } },
    },
  });

  return activeCouple;
}



function buildUserResponse(user: any, coupleActive: any) {
  const coupleResponse = coupleActive
    ? {
      id: coupleActive.id,
      status: coupleActive.status,
      user: user.id === coupleActive.senderId ? coupleActive.reciver : coupleActive.sender,
    }
    : null;

  return {
    id: user.id,
    fullName: user.fullName,
    codeUser: user.codeUser,
    couple: coupleResponse,
  };
}


