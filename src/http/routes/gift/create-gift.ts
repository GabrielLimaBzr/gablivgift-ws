import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import { z } from 'zod'
import { PrismaClient } from '@prisma/client';
import dotenv from 'dotenv';

// Carrega as variáveis de ambiente do arquivo .env
dotenv.config();

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


  async function getUserIdFromToken(request: FastifyRequest, reply: FastifyReply): Promise<string | null> {
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

      return userId; // Retorna o ID do usuário se tudo estiver certo
    } catch (err) {
      reply.status(401).send({ message: 'Token inválido ou expirado' });
      return null; // Retorna null em caso de erro na verificação do token
    }
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
          userId: parseInt(userId),
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

  fastify.get('/gifts', async (request, reply) => {
    const userId = await getUserIdFromToken(request, reply);

    if (!userId) {
      return; // Se o usuário não estiver autenticado, a função já enviou o erro
    }

    try {
      // Busca os gifts relacionados ao userId
      const gifts = await prisma.gift.findMany({
        where: {
          userId: parseInt(userId),
        },
      });

      return reply.send({ gifts }); // Retorna os gifts encontrados
    } catch (err) {
      // Em caso de erro ao buscar os gifts
      return reply.status(500).send({ error: 'Erro interno do servidor' });
    }
  });

  async function getUserIdsFromCouple(coupleId: string) {
    const couple = await prisma.couple.findUnique({
      where: { id: parseInt(coupleId) },
      select: { user1Id: true, user2Id: true },
    });

    return couple ? [couple.user1Id, couple.user2Id] : [];
  }

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

}