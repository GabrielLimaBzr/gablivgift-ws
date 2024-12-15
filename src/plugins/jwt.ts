import fastifyPlugin from 'fastify-plugin';
import fastifyJwt from 'fastify-jwt';
import dotenv from 'dotenv';

// Carrega as variáveis de ambiente do arquivo .env
dotenv.config();

export async function jwtPlugin(fastify: any) {
  fastify.register(fastifyJwt, {
    secret: process.env.JWT_SECRET,
    sign: {
      expiresIn: process.env.JWT_EXPIRATION,
  });
}

export default fastifyPlugin(jwtPlugin);
