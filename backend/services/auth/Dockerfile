FROM node:20-alpine

WORKDIR /app

# -------------------------------
# Install root dependencies
# (Used by shared/)
# -------------------------------
COPY package*.json ./
RUN npm ci --omit=dev

# -------------------------------
# Install auth service dependencies
# -------------------------------
COPY services/auth/package*.json ./services/auth/
WORKDIR /app/services/auth
RUN npm ci --omit=dev

# -------------------------------
# Copy project files
# -------------------------------
WORKDIR /app
COPY services/auth/ ./services/auth/
COPY shared/ ./shared/

# -------------------------------
# Run Auth Service
# -------------------------------
WORKDIR /app/services/auth

EXPOSE 8001

CMD ["node", "index.js"]
