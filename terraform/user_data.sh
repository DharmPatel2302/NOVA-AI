#!/bin/bash
# ============================================================
#  NOVA AI — EC2 Boot Script (user_data.sh)
#  Runs automatically on first EC2 start via cloud-init
#  Installs Docker, clones repo, starts all services
# ============================================================

set -e
exec > /var/log/nova-ai-setup.log 2>&1
echo "=== NOVA AI Setup Started: $(date) ==="

# ── 1. Update system packages ────────────────────────────────
echo "--- Updating system packages..."
apt-get update -y
apt-get upgrade -y

# ── 2. Install Docker ────────────────────────────────────────
echo "--- Installing Docker..."
apt-get install -y \
  ca-certificates \
  curl \
  gnupg \
  lsb-release \
  git \
  nginx

# Add Docker's official GPG key
install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
chmod a+r /etc/apt/keyrings/docker.asc

# Add Docker repository
echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] \
  https://download.docker.com/linux/ubuntu \
  $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | \
  tee /etc/apt/sources.list.d/docker.list > /dev/null

apt-get update -y
apt-get install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin

# Enable Docker to start on boot
systemctl enable docker
systemctl start docker

# Allow ubuntu user to run docker without sudo
usermod -aG docker ubuntu

echo "--- Docker installed: $(docker --version)"

# ── 3. Clone the NOVA AI repository ─────────────────────────
echo "--- Cloning NOVA AI repository..."
cd /home/ubuntu
git clone https://github.com/DharmPatel2302/NOVA-AI.git nova-ai
cd /home/ubuntu/nova-ai

# ── 4. Create .env files ─────────────────────────────────────
# NOTE: In production, inject real secrets via AWS Secrets Manager
# or CI/CD pipeline environment variables.
# These are placeholder stubs — replace before running docker compose.
echo "--- Creating placeholder .env files..."

cat > /home/ubuntu/nova-ai/backend/gateway/.env << 'EOF'
PORT=8000
INTERNAL_SECRET=nova-ai-internal-secret-change-me
AUTH_SERVICE=http://auth-service:8001
CHAT_SERVICE=http://chat-service:8002
AGENT_SERVICE=http://agent-service:8003
BILLING_SERVICE=http://billing-service:8004
REDIS_URL=redis://redis:6379
EOF

cat > /home/ubuntu/nova-ai/backend/services/auth/.env << 'EOF'
PORT=8001
MONGO_URI=REPLACE_WITH_MONGODB_ATLAS_URI
REDIS_URL=redis://redis:6379
INTERNAL_SECRET=nova-ai-internal-secret-change-me
FIREBASE_PROJECT_ID=REPLACE_WITH_FIREBASE_PROJECT_ID
FIREBASE_CLIENT_EMAIL=REPLACE_WITH_FIREBASE_CLIENT_EMAIL
FIREBASE_PRIVATE_KEY=REPLACE_WITH_FIREBASE_PRIVATE_KEY
EOF

cat > /home/ubuntu/nova-ai/backend/services/chat/.env << 'EOF'
PORT=8002
MONGO_URI=REPLACE_WITH_MONGODB_ATLAS_URI
REDIS_URL=redis://redis:6379
INTERNAL_SECRET=nova-ai-internal-secret-change-me
EOF

cat > /home/ubuntu/nova-ai/backend/services/agent/.env << 'EOF'
PORT=8003
MONGO_URI=REPLACE_WITH_MONGODB_ATLAS_URI
REDIS_URL=redis://redis:6379
INTERNAL_SECRET=nova-ai-internal-secret-change-me
GROQ_API_KEY=REPLACE_WITH_GROQ_API_KEY
GEMINI_API_KEY=REPLACE_WITH_GEMINI_API_KEY
TAVILY_API_KEY=REPLACE_WITH_TAVILY_API_KEY
QDRANT_URL=REPLACE_WITH_QDRANT_URL
QDRANT_API_KEY=REPLACE_WITH_QDRANT_API_KEY
CLOUDINARY_CLOUD_NAME=REPLACE_WITH_CLOUDINARY_NAME
CLOUDINARY_API_KEY=REPLACE_WITH_CLOUDINARY_API_KEY
CLOUDINARY_API_SECRET=REPLACE_WITH_CLOUDINARY_API_SECRET
CHAT_SERVICE_URL=http://chat-service:8002
AUTH_SERVICE_URL=http://auth-service:8001
EOF

cat > /home/ubuntu/nova-ai/backend/services/billing/.env << 'EOF'
PORT=8004
MONGO_URI=REPLACE_WITH_MONGODB_ATLAS_URI
INTERNAL_SECRET=nova-ai-internal-secret-change-me
RAZORPAY_KEY_ID=REPLACE_WITH_RAZORPAY_KEY_ID
RAZORPAY_KEY_SECRET=REPLACE_WITH_RAZORPAY_KEY_SECRET
AUTH_SERVICE_URL=http://auth-service:8001
EOF

# ── 5. Set permissions ───────────────────────────────────────
chown -R ubuntu:ubuntu /home/ubuntu/nova-ai

# ── 6. Configure Nginx to serve frontend on port 80 ─────────
echo "--- Configuring Nginx..."
cat > /etc/nginx/sites-available/default << 'NGINXEOF'
server {
    listen 80 default_server;
    listen [::]:80 default_server;

    root /var/www/nova-ai;
    index index.html;

    # React SPA — all routes fall back to index.html
    location / {
        try_files $uri $uri/ /index.html;
    }

    # Proxy API calls to the gateway
    location /api/ {
        proxy_pass http://localhost:8000/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
NGINXEOF

mkdir -p /var/www/nova-ai
nginx -t && systemctl enable nginx && systemctl restart nginx

# ── 7. Start all backend services ───────────────────────────
echo "--- Starting NOVA AI backend services..."
cd /home/ubuntu/nova-ai/backend
docker compose up -d --build

echo "=== NOVA AI Setup Complete: $(date) ==="
echo "Gateway:  http://$(curl -s http://169.254.169.254/latest/meta-data/public-ipv4):8000"
echo "Frontend: http://$(curl -s http://169.254.169.254/latest/meta-data/public-ipv4)"
