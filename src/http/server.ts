import fastify from "fastify";
import { createGift } from "./routes/gift/create-gift";
import { register } from "./routes/auth/register";
import { login } from "./routes/auth/login";
import { jwtPlugin } from "../plugins/jwt";

const app = fastify();
app.register(jwtPlugin);

app.get('/', () => {
    return 'Servidor OK...'
})

app.register(createGift);
app.register(register);
app.register(login);

app.listen({ port: 8080}).then(() => {
    console.log('Server is running...')
})

app.decorate('authenticate', async (request: any) => {
    try {
      await request.jwtVerify();
    } catch (err) {
      throw new Error('Unauthorized');
    }
  });
