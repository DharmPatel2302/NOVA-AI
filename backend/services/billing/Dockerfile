FROM node:20-alpine

WORKDIR /app

# -------------------------------
# Install root dependencies
# (Used by shared/)
# -------------------------------
COPY package*.json ./
RUN npm ci --omit=dev

# -------------------------------
# Install billing service dependencies
# -------------------------------
COPY services/billing/package*.json ./services/billing/
WORKDIR /app/services/billing
RUN npm ci --omit=dev

# -------------------------------
# Copy project files
# -------------------------------
WORKDIR /app
COPY services/billing/ ./services/billing/
COPY shared/ ./shared/

# -------------------------------
# Run Billing Service
# -------------------------------
WORKDIR /app/services/billing

EXPOSE 8004

CMD ["node", "index.js"]
