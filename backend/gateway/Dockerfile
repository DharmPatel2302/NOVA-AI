FROM node:20-alpine

WORKDIR /app

# -------------------------------
# Install root dependencies
# (Used by shared/)
# -------------------------------
COPY package*.json ./
RUN npm ci --omit=dev

# -------------------------------
# Install gateway dependencies
# -------------------------------
COPY gateway/package*.json ./gateway/
WORKDIR /app/gateway
RUN npm ci --omit=dev

# -------------------------------
# Copy project files
# -------------------------------
WORKDIR /app
COPY gateway ./gateway
COPY shared ./shared

# -------------------------------
# Run Gateway
# -------------------------------
WORKDIR /app/gateway

EXPOSE 8000

CMD ["node", "index.js"]