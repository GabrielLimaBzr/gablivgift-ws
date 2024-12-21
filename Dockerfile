# Etapa de construção
FROM node:20-alpine AS builder

# Definir diretório de trabalho
WORKDIR /app

# Copiar package.json e package-lock.json
COPY package*.json ./

# Instalar dependências de produção
RUN npm install --only=production

# Copiar o restante do código da aplicação
COPY . .

# Instalar OpenSSL na versão mais recente
RUN apk add --no-cache openssl

# Construir a aplicação
RUN npm run build

# Gerar o Prisma Client
RUN npm run prisma:generate

# Etapa de execução
FROM node:20-alpine

# Definir diretório de trabalho
WORKDIR /app

# Instalar OpenSSL na versão mais recente também na imagem final
RUN apk add --no-cache openssl

# Copiar apenas os arquivos necessários da etapa de construção
COPY --from=builder /app /app

# Expor a porta da aplicação
EXPOSE 3000

# Comando para iniciar a aplicação
CMD ["npm", "run", "prod"]
