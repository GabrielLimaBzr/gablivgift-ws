import { FastifyInstance } from 'fastify'
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
      .positive('O preço estimado deve ser um número positivo')
      .max(100000, 'O preço estimado não pode exceder 100.000'),
    category: z
      .number()
      .int('A categoria deve ser um número inteiro')
      .optional(),
    priority: z.boolean().optional(),
    imageUrl: z.string().url().optional(),
  });

  fastify.post('/create-gift', async (request, reply) => {
    try {
       // Pegar o token da requisição
       const authHeader = request.headers['authorization'];
       if (!authHeader) {
         return reply.status(401).send({ message: 'Token de autenticação necessário' });
       }
 
       const token = authHeader.replace('Bearer ', '');
 
       // Decodificar o token e pegar o ID do usuário
       let userId: string | null = null;
       try {
         const decoded = fastify.jwt.verify(token, { complete: false });
         fastify.log.info(`Decoded token: ${JSON.stringify(decoded)}`);
         userId = (decoded as any).userId; // Pegar o ID do usuário decodificado
       } catch (err) {
         return reply.status(401).send({ message: 'Token inválido ou expirado' });
       }
 
       if (!userId) {
         return reply.status(401).send({ message: 'Usuário não autenticado' });
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
}