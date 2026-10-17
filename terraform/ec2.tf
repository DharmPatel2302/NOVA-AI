# ============================================================
#  NOVA AI — EC2 Infrastructure
#  Security Group + EC2 Instance + Elastic IP
# ============================================================

# ── Data: use default VPC (no extra cost) ───────────────────
data "aws_vpc" "default" {
  default = true
}

data "aws_subnets" "default" {
  filter {
    name   = "vpc-id"
    values = [data.aws_vpc.default.id]
  }
}

# ── Security Group ───────────────────────────────────────────
# Firewall rules: what traffic is allowed in/out
resource "aws_security_group" "nova_ai_sg" {
  name        = "${var.project_name}-sg"
  description = "NOVA AI security group - allows SSH, HTTP, and all service ports"
  vpc_id      = data.aws_vpc.default.id

  # SSH — for manual access and CI/CD deploy
  ingress {
    description = "SSH"
    from_port   = 22
    to_port     = 22
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  # HTTP — Nginx serves the frontend on port 80
  ingress {
    description = "HTTP"
    from_port   = 80
    to_port     = 80
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  # API Gateway — single entry point for all API calls
  ingress {
    description = "API Gateway"
    from_port   = 8000
    to_port     = 8000
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  # Auth Service
  ingress {
    description = "Auth Service"
    from_port   = 8001
    to_port     = 8001
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  # Chat Service
  ingress {
    description = "Chat Service"
    from_port   = 8002
    to_port     = 8002
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  # Agent Service
  ingress {
    description = "Agent Service"
    from_port   = 8003
    to_port     = 8003
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  # Billing Service
  ingress {
    description = "Billing Service"
    from_port   = 8004
    to_port     = 8004
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  # Allow all outbound traffic (download packages, call APIs, etc.)
  egress {
    description = "All outbound"
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Name    = "${var.project_name}-sg"
    Project = var.project_name
  }
}

# ── EC2 Instance ─────────────────────────────────────────────
# t3.micro = free tier (750 hrs/month for 12 months)
resource "aws_instance" "nova_ai" {
  ami                    = var.ami_id
  instance_type          = var.instance_type
  key_name               = var.key_name
  subnet_id              = tolist(data.aws_subnets.default.ids)[0]
  vpc_security_group_ids = [aws_security_group.nova_ai_sg.id]

  # Run user_data.sh on first boot — installs Docker + starts app
  user_data = file("${path.module}/user_data.sh")

  # 20GB storage — enough for Docker images + logs
  root_block_device {
    volume_size           = 20
    volume_type           = "gp3"
    delete_on_termination = true
  }

  tags = {
    Name    = "${var.project_name}-server"
    Project = var.project_name
  }
}

# ── Elastic IP ───────────────────────────────────────────────
# Fixed public IP — doesn't change when EC2 restarts
resource "aws_eip" "nova_ai_eip" {
  instance = aws_instance.nova_ai.id
  domain   = "vpc"

  tags = {
    Name    = "${var.project_name}-eip"
    Project = var.project_name
  }

  # Wait for EC2 to be fully created before attaching EIP
  depends_on = [aws_instance.nova_ai]
}
