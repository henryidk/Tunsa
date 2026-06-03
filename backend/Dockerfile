FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm install

RUN apk add --no-cache postgresql-client

COPY . .

COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

EXPOSE 4000

ENTRYPOINT ["/entrypoint.sh"]
