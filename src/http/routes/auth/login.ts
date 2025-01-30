import { FastifyInstance } from 'fastify';
import bcrypt from 'bcryptjs';
import { PrismaClient } from '@prisma/client';


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
      const { requestSent, requestReceived } = await findPendingCouples(user.id);

      const userResponse = buildUserResponse(user, coupleActive, {
        requestSent,
        requestReceived,
      });

      const token = fastify.jwt.sign({ userId: user.id });

      return reply.send({ message: 'Login bem-sucedido!', token, user: userResponse });

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

async function findPendingCouples(userId: number) {
  const listCouple = await prisma.couple.findMany({
    where: {
      OR: [{ senderId: userId }, { reciverId: userId }],
      status: 0,
    },
    include: {
      sender: { select: { id: true, fullName: true, codeUser: true } },
      reciver: { select: { id: true, fullName: true, codeUser: true } },
    },
  });

  const filterRequestSent = listCouple.find(couple => couple.senderId === userId);
  const requestSent = filterRequestSent
    ? {
      id: filterRequestSent.id,
      status: filterRequestSent.status,
      reciver: {
        id: filterRequestSent.reciver?.id,
        fullName: filterRequestSent.reciver?.fullName,
        codeUser: filterRequestSent.reciver?.codeUser,
      },
    }
    : null;


    const requestReceived = listCouple
    .filter(couple => couple.reciverId === userId)
    .map(couple => ({
      id: couple.id,
      status: couple.status,
      sender: {
        id: couple.sender?.id,
        fullName: couple.sender?.fullName,
        codeUser: couple.sender?.codeUser,
      },
    }));

  return { requestSent, requestReceived };
}


function buildUserResponse(user: any, coupleActive: any, requests: any) {
  const coupleResponse = coupleActive
    ? {
      id: coupleActive.id,
      status: coupleActive.status,
      user: user.id === coupleActive.senderId ? coupleActive.reciverId : coupleActive.senderId,
    }
    : null;

  return {
    id: user.id,
    fullName: user.fullName,
    codeUser: user.codeUser,
    couple: coupleResponse,
    listRequests: requests,
  };
}
