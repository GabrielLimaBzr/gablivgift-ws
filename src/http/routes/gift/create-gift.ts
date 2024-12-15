import { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { prisma } from '../../lib/prisma'

export async function createGift(app: FastifyInstance) {
    app.post('/gift', async (request, reply) => {
        const createGiftSchema = z.object({
            title: z.string().min(3, 'O título deve ter pelo menos 3 caracteres').max(100, 'O título não pode exceder 100 caracteres'),
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
                .int('A categoria deve ser um número inteiro').optional(),
            priority: z.boolean().optional(),
        });

        try {
            // Extrair os campos do corpo da requisição que não envolvem arquivos
            const { title, description, estimatedPrice, category, priority } = createGiftSchema.parse(request.body);

        } catch (err) {
            if (err instanceof z.ZodError) {
                return reply.status(400).send({ error: err.errors });
            }
            return reply.status(500).send({ error: 'Erro interno do servidor' });
        }
    });
}