import fastify from "fastify";
import { createGift } from "./routes/gift/create-gift";
import fastifyMultipart from '@fastify/multipart';

const app = fastify();

app.register(fastifyMultipart, {
  limits: {
    fileSize: 5 * 1024 * 1024, // Limite de 5MB para arquivos
  },
});

app.get('/', () => {
    return 'Servidor OK...'
})

app.register(createGift);

app.listen({ port: 8080}).then(() => {
    console.log('Server is running...')
})
