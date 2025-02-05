# Etapa de construção
FROM node:20-alpine AS builder

# Definir diretório de trabalho
WORKDIR /ws

# Copiar package.json e package-lock.json
COPY package*.json ./

# Instalar dependências de desenvolvimento e produção
RUN npm install

# Copiar o restante do código da aplicação
COPY . .

# Instalar OpenSSL na versão mais recente
RUN apk add --no-cache openssl

# Configurar o timezone para America/Sao_Paulo
ENV TZ=America/Sao_Paulo
RUN ln -sf /usr/share/zoneinfo/America/Sao_Paulo /etc/localtime && echo "America/Sao_Paulo" > /etc/timezone


# Gerar o Prisma Client
RUN npm run prisma

# Construir a aplicação
RUN npm run build

# Etapa de execução
FROM node:20-alpine

# Definir diretório de trabalho
WORKDIR /ws

# Instalar OpenSSL na versão mais recente também na imagem final
RUN apk add --no-cache openssl

# Copiar apenas os arquivos necessários da etapa de construção
COPY --from=builder /ws /ws

# Expor a porta da aplicação
EXPOSE ${PORT}

# Comando para iniciar a aplicação
CMD ["npm", "run", "prod"]
