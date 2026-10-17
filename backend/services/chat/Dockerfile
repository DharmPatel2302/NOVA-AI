FROM node:20-alpine

WORKDIR /app

# -------------------------------
# Install root dependencies
# (Used by shared/)
# -------------------------------
COPY package*.json ./
RUN npm ci --omit=dev

# -------------------------------
# Install chat service dependencies
# -------------------------------
COPY services/chat/package*.json ./services/chat/
WORKDIR /app/services/chat
RUN npm ci --omit=dev

# -------------------------------
# Copy project files
# -------------------------------
WORKDIR /app
COPY services/chat/ ./services/chat/
COPY shared/ ./shared/

# -------------------------------
# Run Chat Service
# -------------------------------
WORKDIR /app/services/chat

EXPOSE 8002

CMD ["node", "index.js"]
