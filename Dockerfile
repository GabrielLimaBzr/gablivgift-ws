# Etapa de construção
FROM node:20-alpine AS builder

# Definir diretório de trabalho
WORKDIR /app

# Copiar package.json e package-lock.json
COPY package*.json ./

# Instalar dependências de desenvolvimento e produção
RUN npm install

# Copiar o restante do código da aplicação
COPY . .

# Instalar OpenSSL na versão mais recente
RUN apk add --no-cache openssl

# Gerar o Prisma Client
RUN npm run prisma

# Construir a aplicação
RUN npm run build

# Etapa de execução
FROM node:20-alpine

# Definir diretório de trabalho
WORKDIR /app

# Instalar OpenSSL na versão mais recente também na imagem final
RUN apk add --no-cache openssl

# Copiar apenas os arquivos necessários da etapa de construção
COPY --from=builder /app /app

RUN npm run migra

# Expor a porta da aplicação
EXPOSE 8888

# Comando para iniciar a aplicação
CMD ["npm", "run", "prod"]
