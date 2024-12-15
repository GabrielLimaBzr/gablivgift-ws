import Redis from 'ioredis';

const redis = new Redis({
  host: '127.0.0.1', // Altere para o host do Redis
  port: 6379,        // Porta padrão do Redis
});

export default redis;
