import fastify, { FastifyInstance } from "fastify";
import { v2 as cloudinary } from "cloudinary";
import multer from "fastify-multer";
import * as dotenv from "dotenv";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// Carregar as variáveis de ambiente do arquivo .env
dotenv.config();

// Configuração do Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Configuração do multer para lidar com uploads
const upload = multer({ storage: multer.memoryStorage() });

export default async function uploadRoutes(server: FastifyInstance) {
  server.register(multer.contentParser);

  server.post(
    "/upload",
    { preHandler: upload.single("file") },
    async (request, reply) => {
      try {
        const file = (request as any).file;

        if (!file) {
          return reply.status(400).send({ message: "No file provided" });
        }

        // Faz o upload para o Cloudinary
        const result = await new Promise((resolve, reject) => {
          const stream = cloudinary.uploader.upload_stream(
            {
              folder: "gifts-upload",
              transformation: [
                {
                  width: 800,
                  crop: 'fill', // Ajusta a imagem para preencher o tamanho
                  gravity: 'auto', // Foca no conteúdo principal
                },
                {
                  quality: 'auto:eco',
                  fetch_format: 'webp',
                },
              ],
            },

            (error, response) => {
              if (error) {
                reject(new Error(`Cloudinary upload error: ${error.message}`));
              } else {
                resolve(response);
              }
            }
          );
          stream.end(file.buffer);
        });

        // Retorna a URL da imagem
        return reply.status(200).send({ url: (result as any).secure_url });
      } catch (error: any) {
        return reply.status(500).send({ error: error.message });
      }
    }
  );


  server.get('/getUser/:codeUser', async (request, reply) => {
    try {
      const { codeUser } = request.params as { codeUser: string };
  
      const user = await prisma.user.findUnique({
        where: { codeUser: `#${codeUser}` },
        select: { id: true, fullName: true, codeUser: true },
      });
  
      if (!user) {
        return reply.status(404).send({ message: 'Usuário não encontrado.' });
      }
  
      return reply.send({ message: 'Usuário encontrado.', profile: user });
  
    } catch (error) {
      server.log.error(error);
      return reply.status(500).send({ message: 'Erro ao buscar usuário.' });
    }
  });
}
