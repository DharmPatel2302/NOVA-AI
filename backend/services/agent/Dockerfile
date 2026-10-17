FROM node:20-alpine

WORKDIR /app

# -------------------------------
# Install root dependencies
# (Used by shared/)
# -------------------------------
COPY package*.json ./
RUN npm ci --omit=dev

# -------------------------------
# Install agent service dependencies
# -------------------------------
COPY services/agent/package*.json ./services/agent/
WORKDIR /app/services/agent
RUN npm ci --omit=dev --legacy-peer-deps

# -------------------------------
# Copy project files
# -------------------------------
WORKDIR /app
COPY services/agent/ ./services/agent/
COPY shared/ ./shared/
RUN mkdir -p /app/services/agent/temp/uploads

# -------------------------------
# Run Agent Service
# -------------------------------
WORKDIR /app/services/agent

EXPOSE 8003

CMD ["node", "index.js"]
