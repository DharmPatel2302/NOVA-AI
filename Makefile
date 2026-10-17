# ============================================================
#  NOVA AI — Makefile
#  Usage: make <command>
# ============================================================

# ── Variables ────────────────────────────────────────────────
COMPOSE_FILE = backend/docker-compose.yml
FRONTEND_DIR = frontend

# ── Colors for output ────────────────────────────────────────
GREEN  = \033[0;32m
YELLOW = \033[0;33m
RESET  = \033[0m

.PHONY: help up down restart build logs ps clean frontend install

# ── Default: show help ───────────────────────────────────────
help:
	@echo ""
	@echo "  NOVA AI — Available Commands"
	@echo "  ─────────────────────────────────────────────"
	@echo "  make up          Start all backend services"
	@echo "  make down        Stop all backend services"
	@echo "  make restart     Stop, rebuild and start again"
	@echo "  make build       Rebuild all Docker images"
	@echo "  make logs        View live logs from all services"
	@echo "  make ps          Show running containers"
	@echo "  make clean       Remove containers, images & volumes"
	@echo "  make frontend    Install and start the frontend"
	@echo "  make install     Install all npm dependencies locally"
	@echo "  ─────────────────────────────────────────────"
	@echo ""

# ── Start all backend services ───────────────────────────────
up:
	@echo "Starting NOVA AI backend services..."
	docker compose -f $(COMPOSE_FILE) up -d
	@echo "All services are up!"
	@echo "Gateway   → http://localhost:8000"
	@echo "Auth      → http://localhost:8001"
	@echo "Chat      → http://localhost:8002"
	@echo "Agent     → http://localhost:8003"
	@echo "Billing   → http://localhost:8004"

# ── Stop all services ────────────────────────────────────────
down:
	@echo "Stopping all services..."
	docker compose -f $(COMPOSE_FILE) down
	@echo "All services stopped."

# ── Rebuild and restart ──────────────────────────────────────
restart:
	@echo "Restarting all services..."
	docker compose -f $(COMPOSE_FILE) down
	docker compose -f $(COMPOSE_FILE) up -d --build
	@echo "All services restarted!"

# ── Build images without starting ────────────────────────────
build:
	@echo "Building all Docker images..."
	docker compose -f $(COMPOSE_FILE) build
	@echo "Build complete."

# ── Live logs from all services ──────────────────────────────
logs:
	docker compose -f $(COMPOSE_FILE) logs -f

# ── Logs for a specific service: make logs-auth ──────────────
logs-gateway:
	docker compose -f $(COMPOSE_FILE) logs -f gateway

logs-auth:
	docker compose -f $(COMPOSE_FILE) logs -f auth-service

logs-chat:
	docker compose -f $(COMPOSE_FILE) logs -f chat-service

logs-agent:
	docker compose -f $(COMPOSE_FILE) logs -f agent-service

logs-billing:
	docker compose -f $(COMPOSE_FILE) logs -f billing-service

# ── Show running containers ──────────────────────────────────
ps:
	docker compose -f $(COMPOSE_FILE) ps

# ── Remove everything (containers + volumes + images) ────────
clean:
	@echo "WARNING: This will remove all containers, volumes and built images."
	docker compose -f $(COMPOSE_FILE) down -v --rmi local
	@echo "Clean complete."

# ── Start frontend dev server ────────────────────────────────
frontend:
	@echo "Starting frontend..."
	cd $(FRONTEND_DIR) && npm install && npm run dev

# ── Install all dependencies locally (without Docker) ────────
install:
	@echo "Installing all service dependencies..."
	cd backend/gateway && npm install
	cd backend/services/auth && npm install
	cd backend/services/chat && npm install
	cd backend/services/agent && npm install
	cd backend/services/billing && npm install
	cd frontend && npm install
	@echo "All dependencies installed!"
