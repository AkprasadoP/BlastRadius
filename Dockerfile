FROM node:22-alpine

# Install Git (required for ephemeral AST clones)
RUN apk add --no-cache git

WORKDIR /app

# Copy package files and install dependencies
COPY package*.json ./
RUN npm ci

# Copy the rest of the application files
COPY . .

EXPOSE 3000

CMD ["npm", "start"]
