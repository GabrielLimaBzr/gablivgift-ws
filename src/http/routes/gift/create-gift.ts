import { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function createGift(app: FastifyInstance) {
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
      .positive('O preço estimado deve ser um número positivo')
      .max(100000, 'O preço estimado não pode exceder 100.000'),
    category: z
      .number()
      .int('A categoria deve ser um número inteiro')
      .optional(),
    priority: z.boolean().optional(),
    addedByUserId: z.number(),
    imageUrl: z.string().url().optional(),
    coupleId: z.number().optional(),
  });

  app.post('/create-gift', async (request, reply) => {
    try {
      const {
        title,
        description,
        estimatedPrice,
        category = 9,
        priority = false,
        addedByUserId,
        imageUrl,
        coupleId,
      } = createGiftSchema.parse(request.body);

      const gift = await prisma.gift.create({
        data: {
          title,
          description,
          estimatedPrice,
          category,
          priority,
          addedByUserId,
          imageUrl,
          coupleId,
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
}