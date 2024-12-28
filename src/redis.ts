import Redis from 'ioredis';

const redis = new Redis({
  host: 'localhost', 
  port: 6379,        // Porta padrão do Redis
});

export default redis;
