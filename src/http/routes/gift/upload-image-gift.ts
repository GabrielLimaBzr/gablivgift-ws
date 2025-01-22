import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import cloudinary from 'cloudinary';
import fs from 'fs';
import path from 'path';

// Configura o Cloudinary
cloudinary.v2.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

export default async function uploadRoutes(server: FastifyInstance) {
  server.post(
    '/upload',
    async (request: FastifyRequest, reply: FastifyReply) => {
      const data = await request.file();

      if (!data) {
        return reply.status(400).send({ error: 'No file uploaded' });
      }

      try {
        const tempPath = path.join(__dirname, `temp-${data.filename}`);
        const fileStream = fs.createWriteStream(tempPath);
        await data.file.pipe(fileStream);

        const folderName = 'gifts-upload';
        const result = await cloudinary.v2.uploader.upload(tempPath, {
          folder: folderName,
          transformation: [
            {
              width: 1200,
              height: 800,
              crop: 'fill', // Ajusta a imagem para preencher o tamanho
              gravity: 'auto', // Foca no conteúdo principal
            },
            {
              quality: 'auto',
              fetch_format: 'webp',
            },
          ],
        });

        fs.unlinkSync(tempPath);

        return reply.send({ url: result.secure_url });
      } catch (error) {
        console.error(error);
        return reply.status(500).send({ error: 'Upload failed' });
      }
    }
  );
}
