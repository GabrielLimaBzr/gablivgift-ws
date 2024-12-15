import fastifyPlugin from 'fastify-plugin';
import fastifyJwt from 'fastify-jwt'; // Corrigido para importar o fastifyJwt
import dotenv from 'dotenv';

// Carrega as variáveis de ambiente do arquivo .env
dotenv.config();

export async function jwtPlugin(fastify: any) {
  fastify.register(fastifyJwt, {
    secret: process.env.JWT_SECRET,  // Utiliza a variável de ambiente JWT_SECRET
    sign: {
      expiresIn: process.env.JWT_EXPIRATION,  // Tempo de expiração do token a partir do .env
    },
  });
}

export default fastifyPlugin(jwtPlugin);
