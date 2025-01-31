import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import { z } from 'zod'
import { PrismaClient } from '@prisma/client';
import dotenv from 'dotenv';
import { CoupleRepository } from '../../repository/coupleRepository';

// Carrega as variáveis de ambiente do arquivo .env
dotenv.config();

const coupleRepository = new CoupleRepository();


const prisma = new PrismaClient();

export async function createGift(fastify: FastifyInstance) {

  const createGiftSchema = z.object({
    title: z
      .string()
      .min(3, 'O título deve ter pelo menos 3 caracteres')
      .max(100, 'O título não pode exceder 100 caracteres'),
    description: z
      .string()
      .min(3, 'A descrição deve ter pelo menos 3 caracteres')
      .max(500, 'A descrição não pode exceder 500 caracteres'),
    estimatedPrice: z
      .number()
      .min(0, 'O preço estimado não pode ser negativo')
      .max(100000, 'O preço estimado não pode exceder 100.000'),
    category: z
      .number()
      .int('A categoria deve ser um número inteiro')
      .optional(),
    priority: z.boolean().optional(),
    imageUrl: z.string().url().nullable().optional(),
  });


  async function getUserIdFromToken(request: FastifyRequest, reply: FastifyReply): Promise<number | null> {
    // Pegar o token da requisição
    const authHeader = request.headers['authorization'];
    if (!authHeader) {
      reply.status(401).send({ message: 'Token de autenticação necessário' });
      return null; // Retorna null se o token não for encontrado
    }

    const token = authHeader.replace('Bearer ', '');

    // Decodificar o token e pegar o ID do usuário
    try {
      const decoded = fastify.jwt.verify(token, { complete: false });
      fastify.log.info(`Decoded token: ${JSON.stringify(decoded)}`);

      const userId = (decoded as any).userId; // Pegar o ID do usuário decodificado

      if (!userId) {
        reply.status(401).send({ message: 'Usuário não autenticado' });
        return null; // Retorna null se o userId não for encontrado
      }

      return parseInt(userId); // Retorna o ID do usuário se tudo estiver certo
    } catch (err) {
      reply.status(401).send({ message: 'Token inválido ou expirado' });
      return null; // Retorna null em caso de erro na verificação do token
    }
  }

  async function getUserIdsFromCouple(coupleId: string) {
    const couple = await prisma.couple.findUnique({
      where: { id: parseInt(coupleId), status: 1 },
      select: { senderId: true, reciverId: true },
    });

    return couple ? [couple.senderId, couple.reciverId] : [];
  }


  fastify.post('/create-gift', async (request, reply) => {
    try {
      const userId = await getUserIdFromToken(request, reply);

      if (!userId) {
        return;
      }

      const {
        title,
        description,
        estimatedPrice,
        category = 9,
        priority = false,
        imageUrl,
      } = createGiftSchema.parse(request.body);



      const gift = await prisma.gift.create({
        data: {
          title,
          description,
          estimatedPrice,
          category,
          priority,
          imageUrl,
          userId: userId,
        },
      });

      // Retornando a resposta com o gift criado
      return reply.status(201).send({ gift });
    } catch (err) {
      if (err instanceof z.ZodError) {
        // Erro de validação
        return reply.status(400).send({ error: err.errors });
      }
      // Erro interno do servidor
      return reply.status(500).send({ error: 'Erro interno do servidor' });
    }
  });


  fastify.get('/filter', async (request, reply) => {
    const { page = 1, orderBy = 'createdAt', userId, estimatedPrice, coupleId, orderDirection = 'desc', title } = request.query as {
      page?: number,
      orderBy?: string,
      userId?: string,
      estimatedPrice?: string,
      coupleId?: string,
      orderDirection?: string,
      title?: string
    };

    const limit = 9;
    const skip = (page - 1) * limit;

    const filters: any = {};

    // Filtro para o "userId" ou "coupleId"

    if (coupleId) {
      filters.userId = { in: await getUserIdsFromCouple(coupleId) };
    } else {
      if (userId) {
        filters.userId = parseInt(userId);
      } else {
        return reply.status(400).send({ error: 'userId ou coupleId é obrigatório' });
      }
    }

    // Filtro para "estimatedPrice"
    if (estimatedPrice) {
      filters.estimatedPrice = Number(estimatedPrice);
    }

    // Filtro para ordenar por data ou categoria
    const orderByOptions = {
      createdAt: 'createdAt',
      category: 'category',
      priority: 'priority',
    };

    // Filtro para "title" (busca parcial)
    if (title) {
      filters.title = {
        contains: title,  // Busca com "like"
        mode: 'insensitive' // Faz a busca case-insensitive
      };
    }

    // Realiza a consulta no banco de dados com os filtros
    try {
      const gifts = await prisma.gift.findMany({
        where: filters,
        orderBy: {
          [orderByOptions[orderBy as keyof typeof orderByOptions] || 'createdAt']: orderDirection === 'desc' ? 'desc' : 'asc',
        },
        take: limit,
        skip: skip,
      });


      // Contar o número total de gifts para cálculo de totalPages
      const totalGifts = await prisma.gift.count({
        where: filters,
      });

      return reply.send({
        gifts,
        total: totalGifts,
        totalPages: Math.ceil(totalGifts / limit), // Total de páginas
      });

    } catch (error) {
      reply.status(500).send({ error: 'Failed to fetch gifts' });
    }
  });


  fastify.post('/solicitar-vinculo', async (request, reply) => {
    try {
      const senderId = await getUserIdFromToken(request, reply);

      if (!senderId) {
        return;
      }

      const { reciverId } = request.body as { reciverId: number };

      const reciver = await prisma.user.findUnique({
        where: {
          id: reciverId
        }
      })


      if (!reciver || !senderId || reciverId === senderId) {
        return reply.status(400).send({ error: 'ID do par inválido.' });
      }


      const casalExistente = await prisma.couple.findFirst({
        where: {
          OR: [
            { reciverId: reciverId, senderId: senderId },
            { reciverId: senderId, senderId: reciverId }
          ],
        }
      });

      if (casalExistente) {
        return reply.status(409).send({ error: 'Este Par ja tem um casal já está registrado.' });
      }

      const novoCasal = await prisma.couple.create({
        data: { senderId: senderId, reciverId: reciverId }
      });

      return reply.status(201).send({ message: 'Casal registrado com sucesso.', casal: novoCasal });

    } catch (error) {
      console.error(error);
      return reply.status(500).send({ error: 'Erro ao vincular casal.' });
    }
  });


  fastify.post('/responder-vinculo/:id', async (request, reply) => {
    try {
      const userId = await getUserIdFromToken(request, reply);
      if (!userId) return;

      const { id } = request.params as { id: string };
      const { status } = request.body as { status: number };

      // Validação do status
      if (![1, 2].includes(status)) {
        return reply.status(400).send({ error: 'Status inválido. Deve ser 1 (aceitar) ou 2 (recusar).' });
      }

      // Verificar se o registro do casal existe
      const casal = await prisma.couple.findUnique({
        where: { id: parseInt(id) },
      });

      if (!casal) {
        return reply.status(404).send({ error: 'Casal não encontrado.' });
      }

      // Verifica se o usuário tem permissão para alterar (deve ser o sender ou o reciver)
      if (casal.senderId !== userId && casal.reciverId !== userId) {
        return reply.status(403).send({ error: 'Usuário não autorizado a alterar este registro.' });
      }

      // Verifica se algum dos membros já tem um relacionamento com status 1
      const relacionamentoExistente = await prisma.couple.findFirst({
        where: {
          status: 1,
          OR: [
            { senderId: casal.senderId },
            { senderId: casal.reciverId },
            { reciverId: casal.senderId },
            { reciverId: casal.reciverId },
          ],
        },
      });

      if (relacionamentoExistente) {
        return reply.status(409).send({ error: 'Um dos membros já possui um relacionamento ativo.' });
      }

      // Atualizar o status conforme o valor recebido
      const casalAtualizado = await prisma.couple.update({
        where: { id: parseInt(id) },
        data: { status },
        include: {
          sender: { select: { id: true, fullName: true, codeUser: true } },
        }
      });

      const coupleResponse = casalAtualizado
        ? {
          id: casalAtualizado.id,
          status: casalAtualizado.status,
          user: casalAtualizado.sender,
        }
        : null;

      const mensagemStatus = status === 1 ? 'Solicitação aceita com sucesso.' : 'Solicitação recusada com sucesso.';
      return reply.status(200).send({ message: mensagemStatus, couple: coupleResponse });

    } catch (error) {
      console.error(error);
      return reply.status(500).send({ error: 'Erro ao atualizar o status do casal.' });
    }
  });

  fastify.get('/getCoupleReciver', async (request, reply) => {
    try {

      const userId = await getUserIdFromToken(request, reply);

      if (!userId) {
        return;
      }
  
      const requestReceived = (await coupleRepository.findPendingCouplesByUser(userId)).requestReceived;
  
      return reply.send({ requestReceived });
  
    } catch (error) {
      fastify.log.error(error);
      return reply.status(500).send({ message: 'Erro ao buscar usuário.' });
    }
  });

}