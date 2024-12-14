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

            // Processar o arquivo de imagem
            const image = await request.file();

            if (!image) {
                return reply.status(500).send({ error: 'Imagem não fornecida' });
            }

            // Armazenar a imagem como Buffer
            const imageBuffer = await image.toBuffer();

            // Criação dinâmica dos dados para evitar erro de compatibilidade
            const giftData: any = {
                title,
                description,
                estimatedPrice,
                category,
                priority: priority ?? false,
                image: imageBuffer,  // Armazenando a imagem como Buffer
            };

            const gift = await prisma.gifts.create({
                data: giftData,
            });

            return reply.status(201).send({ giftId: gift.id });
        } catch (err) {
            if (err instanceof z.ZodError) {
                return reply.status(400).send({ error: err.errors });
            }
            return reply.status(500).send({ error: 'Erro interno do servidor' });
        }
    });
}