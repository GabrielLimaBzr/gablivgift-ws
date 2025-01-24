import fastify from "fastify";
import { createGift } from "./routes/gift/create-gift";
import { register } from "./routes/auth/register";
import { login } from "./routes/auth/login";
import { jwtPlugin } from "../plugins/jwt";
import dotenv from 'dotenv';
import cors from '@fastify/cors';
import multipart from '@fastify/multipart';

dotenv.config();

const app = fastify({
  logger: {
    level: "info",
    timestamp: () => `,"time":"${new Date().toLocaleString('pt-BR')}"`,
  },
});

app.register(multipart);


const prefix = "/gabliv/api/v1";

app.register(import('@fastify/rate-limit'), {
  max: 200,
  timeWindow: '1 minute'
})

// Configuração de CORS
app.register(cors, {
  origin: true,
  methods: ['GET', 'POST', 'PUT'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
});

// Registro do plugin JWT
app.register(jwtPlugin);

// Middleware global para proteger rotas
app.addHook("onRequest", async (request, reply) => {
  app.log.info(request.url)
  if (request.url !== '/checkl7' && !request.url.startsWith(prefix + '/auth')) {
    // Ignorar autenticação para rotas públicas como '/', '/auth/register', '/auth/login'
    try {
      await request.jwtVerify();
    } catch (err) {
      app.log.error("Unauthorized access attempt"); // Log de tentativa não autorizada
      reply.code(401).send({ error: "Unauthorized" });
    }
  }
});

// Rota principal para verificar se o servidor está online
app.get('/checkl7', async () => {
  return { status: 'Servidor OK...' };
});


// Registro de rotas
app.register(createGift, { prefix: prefix + "/gift" });
app.register(register, { prefix: prefix + "/auth" });
app.register(login, { prefix: prefix + "/auth" });
app.register(import('./routes/gift/upload-image-gift'), { prefix: prefix + "/gift" });

// Inicialização do servidor
const start = async () => {
  try {
    await app.listen({host: '0.0.0.0', port: Number(process.env.PORT) });
    app.log.info('rodando...');
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
};

start();