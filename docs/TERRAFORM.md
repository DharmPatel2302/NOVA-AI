# Technology 3 — Infrastructure as Code (Terraform)
# Marks: 2/20

---

## What Is Infrastructure as Code?

Traditionally, setting up a cloud server means logging into AWS Console and clicking through forms:
1. Click "Launch Instance"
2. Select AMI (Ubuntu)
3. Choose instance type (t3.micro)
4. Configure networking
5. Set up security groups
6. Assign an Elastic IP
7. SSH in and install software manually

This takes 30+ minutes, is error-prone, and cannot be reproduced exactly. If the server crashes, you start over from scratch.

**Infrastructure as Code (IaC)** means writing files that *describe* the infrastructure you want. A tool reads those files and creates the infrastructure automatically — same result every time, in under 3 minutes.

**Terraform** is the most popular IaC tool. It works with AWS, Azure, GCP, and 1000+ other providers.

---

## What NOVA AI Provisions with Terraform

Running `terraform apply` creates **14 AWS resources** in Mumbai (ap-south-1):

```
AWS ap-south-1 (Mumbai)
│
├── Core Infrastructure (ec2.tf)
│   ├── aws_security_group       → Firewall (ports 22, 80, 8000-8004)
│   ├── aws_instance             → t3.micro EC2 server (Ubuntu 22.04)
│   └── aws_eip                  → Elastic IP (65.2.232.188 — fixed forever)
│
├── Frontend Hosting (s3.tf)
│   ├── aws_s3_bucket            → Storage bucket for React dist/ files
│   ├── aws_s3_bucket_public_access_block  → Makes bucket publicly readable
│   ├── aws_s3_bucket_website_configuration → Static website hosting
│   ├── aws_s3_bucket_policy     → Public GET access policy
│   └── random_id                → Unique suffix for globally unique bucket name
│
└── Auto Scaling (asg.tf)
    ├── aws_launch_template      → Blueprint for new EC2s (same AMI + user_data.sh)
    ├── aws_autoscaling_group    → Min: 1, Max: 2 instances
    ├── aws_autoscaling_policy scale_out  → Add 1 EC2 when CPU > 70%
    ├── aws_autoscaling_policy scale_in   → Remove 1 EC2 when CPU < 30%
    ├── aws_cloudwatch_metric_alarm cpu_high → Monitors CPU, triggers scale-out
    └── aws_cloudwatch_metric_alarm cpu_low  → Monitors CPU, triggers scale-in
```

**Live infrastructure created:**
- EC2 Instance ID: `i-062dea98040e78dde`
- Public IP: `65.2.232.188` (fixed Elastic IP)
- S3 Bucket: `nova-ai-frontend-19d45e08`
- ASG Name: `nova-ai-asg`
- CloudWatch Alarms: `nova-ai-cpu-high` / `nova-ai-cpu-low`
- Region: `ap-south-1` (Mumbai — closest to India, lowest latency)

---

## File Structure

```
terraform/
├── main.tf           → AWS + random providers declaration
├── variables.tf      → All configurable inputs (region, AMI, instance type, etc.)
├── outputs.tf        → What to print after apply (IP, URLs, SSH command, ASG info)
├── ec2.tf            → Security group, EC2 instance, Elastic IP
├── s3.tf             → S3 bucket + website hosting configuration
├── asg.tf            → Auto Scaling Group + CloudWatch alarms (instance scaling)
└── user_data.sh      → Shell script that runs on EC2 first boot
```

`terraform.tfvars` — actual values for variables (gitignored, never committed)
`.terraform/` — downloaded provider plugins (gitignored)
`terraform.tfstate` — Terraform's record of what it created (gitignored)

---

## File-by-File Explanation

### main.tf — Provider Configuration

```hcl
terraform {
  required_version = ">= 1.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"        # AWS provider v5.x
    }
    random = {
      source  = "hashicorp/random"
      version = "~> 3.0"        # For generating unique S3 bucket suffix
    }
  }
}

provider "aws" {
  region = var.aws_region       # ap-south-1 (Mumbai)
}
```

This tells Terraform: "Use AWS in Mumbai. Lock the provider to version 5.x so future upgrades don't break things."

---

### variables.tf — Configurable Inputs

```hcl
variable "aws_region" {
  default = "ap-south-1"        # Mumbai — closest to India
}

variable "instance_type" {
  default = "t3.micro"          # Free tier: 750 hrs/month for 12 months
}

variable "key_name" {
  default = "nova-ai-key"       # EC2 key pair for SSH access
}

variable "ami_id" {
  default = "ami-0644c826df601fd4f"  # Ubuntu 22.04 LTS (latest, ap-south-1)
}
```

Variables make the infrastructure reusable. Want to deploy a bigger server for production? Change `instance_type = "t3.large"` in `terraform.tfvars`. No code changes needed.

---

### ec2.tf — Server Infrastructure

#### Security Group (Firewall)

```hcl
resource "aws_security_group" "nova_ai_sg" {
  name   = "nova-ai-sg"
  vpc_id = data.aws_vpc.default.id

  # Allow SSH from anywhere (for manual access and CI/CD deploy)
  ingress { from_port = 22,   to_port = 22,   protocol = "tcp", cidr_blocks = ["0.0.0.0/0"] }

  # Allow HTTP (Nginx serves frontend on port 80)
  ingress { from_port = 80,   to_port = 80,   protocol = "tcp", cidr_blocks = ["0.0.0.0/0"] }

  # Allow API Gateway
  ingress { from_port = 8000, to_port = 8000, protocol = "tcp", cidr_blocks = ["0.0.0.0/0"] }

  # Allow individual services (for debugging)
  ingress { from_port = 8001, to_port = 8001, ... }  # Auth
  ingress { from_port = 8002, to_port = 8002, ... }  # Chat
  ingress { from_port = 8003, to_port = 8003, ... }  # Agent
  ingress { from_port = 8004, to_port = 8004, ... }  # Billing

  # Allow all outbound (download packages, call external APIs)
  egress { from_port = 0, to_port = 0, protocol = "-1", cidr_blocks = ["0.0.0.0/0"] }
}
```

Think of the security group as AWS's firewall. Every port not listed here is blocked by default.

#### EC2 Instance

```hcl
resource "aws_instance" "nova_ai" {
  ami           = var.ami_id         # Ubuntu 22.04 LTS
  instance_type = var.instance_type  # t3.micro (free tier)
  key_name      = var.key_name       # nova-ai-key (for SSH)

  vpc_security_group_ids = [aws_security_group.nova_ai_sg.id]

  # Run user_data.sh on first boot — sets up Docker and the app automatically
  user_data = file("${path.module}/user_data.sh")

  root_block_device {
    volume_size = 20        # 20GB SSD storage
    volume_type = "gp3"     # Latest gen SSD, better performance than gp2
  }
}
```

#### Elastic IP

```hcl
resource "aws_eip" "nova_ai_eip" {
  instance = aws_instance.nova_ai.id
  domain   = "vpc"
}
```

Without an Elastic IP, EC2 assigns a random public IP every time you stop/start the server. Elastic IP (`65.2.232.188`) is fixed permanently — your URLs never change.

---

### s3.tf — Frontend Static Hosting

```hcl
resource "aws_s3_bucket" "frontend" {
  bucket        = "nova-ai-frontend-${random_id.bucket_suffix.hex}"
  force_destroy = true
}

resource "aws_s3_bucket_website_configuration" "frontend" {
  bucket = aws_s3_bucket.frontend.id

  index_document { suffix = "index.html" }
  error_document { key = "index.html" }   # SPA fallback — React Router works correctly
}

resource "aws_s3_bucket_policy" "frontend" {
  policy = jsonencode({
    Statement = [{
      Effect    = "Allow"
      Principal = "*"
      Action    = "s3:GetObject"
      Resource  = "${aws_s3_bucket.frontend.arn}/*"
    }]
  })
}
```

S3 can serve HTML/CSS/JS files as a static website. The React `dist/` folder gets uploaded here. S3 handles scaling, availability, and CDN automatically — no Nginx needed for the frontend.

---

### outputs.tf — What Gets Printed After Apply

```hcl
output "ec2_public_ip"   { value = aws_eip.nova_ai_eip.public_ip }
output "ssh_command"     { value = "ssh -i nova-ai-key.pem ubuntu@${aws_eip.nova_ai_eip.public_ip}" }
output "gateway_url"     { value = "http://${aws_eip.nova_ai_eip.public_ip}:8000" }
output "frontend_url"    { value = "http://${aws_eip.nova_ai_eip.public_ip}" }
output "s3_website_url"  { value = "http://${aws_s3_bucket_website_configuration.frontend.website_endpoint}" }
```

After `terraform apply`, these values are printed automatically:
```
ec2_public_ip   = "65.2.232.188"
ssh_command     = "ssh -i nova-ai-key.pem ubuntu@65.2.232.188"
gateway_url     = "http://65.2.232.188:8000"
frontend_url    = "http://65.2.232.188"
s3_bucket_name  = "nova-ai-frontend-19d45e08"
```

---

### user_data.sh — Server Self-Configuration Boot Script

This script runs automatically on the EC2 server the first time it boots. Zero manual SSH required.

```bash
#!/bin/bash
# Step 1: Update Ubuntu packages
apt-get update -y && apt-get upgrade -y

# Step 2: Install Docker (from official Docker apt repo)
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | ...
apt-get install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin
systemctl enable docker && systemctl start docker

# Step 3: Clone the NOVA AI GitHub repo
git clone https://github.com/DharmPatel2302/NOVA-AI.git /home/ubuntu/nova-ai

# Step 4: Create .env files for all services (placeholder values)

# Step 5: Configure Nginx to serve frontend on port 80

# Step 6: Start all 6 Docker containers
cd /home/ubuntu/nova-ai/backend
docker compose up -d --build
```

The entire application configures itself automatically. The server goes from a fresh Ubuntu install to running 6 Docker containers in about 5 minutes — without anyone touching it.

---

### asg.tf — Auto Scaling Group (Instance-Level Scaling)

This is the most advanced piece of the Terraform setup. While Kubernetes HPA scales pods **inside** one EC2, the ASG scales the EC2 **instances** themselves.

```
Normal traffic → 1 EC2 running all 6 Docker containers
Load spikes, EC2 CPU > 70% for 2 minutes
      ↓
CloudWatch alarm fires
      ↓
ASG launches a NEW EC2 instance from the Launch Template
New EC2 boots → runs user_data.sh → Docker → clones repo → starts all services
      ↓
Now 2 EC2s running (load split between them)

Traffic drops, CPU < 30% for 10 minutes
      ↓
CloudWatch alarm fires
      ↓
ASG terminates the extra EC2
Back to 1 EC2
```

#### Launch Template — Blueprint for New EC2s
```hcl
resource "aws_launch_template" "nova_ai_lt" {
  name_prefix   = "nova-ai-lt-"
  image_id      = var.ami_id           # Same Ubuntu 22.04 AMI
  instance_type = var.instance_type    # Same t3.micro
  key_name      = var.key_name         # Same SSH key

  # Same security group — new instances have identical firewall rules
  vpc_security_group_ids = [aws_security_group.nova_ai_sg.id]

  # Same boot script — new instances self-configure automatically
  user_data = base64encode(file("${path.module}/user_data.sh"))

  block_device_mappings {
    device_name = "/dev/sda1"
    ebs {
      volume_size = 20       # 20GB SSD
      volume_type = "gp3"
    }
  }
}
```

The Launch Template is the blueprint. Every new EC2 the ASG creates uses this exact configuration — same OS, same startup script, same firewall. The new server self-configures identically to the original.

#### Auto Scaling Group
```hcl
resource "aws_autoscaling_group" "nova_ai_asg" {
  name             = "nova-ai-asg"
  min_size         = 1    # Always keep at least 1 EC2 running
  max_size         = 2    # Never create more than 2 (free tier safe)
  desired_capacity = 1    # Start with 1 EC2

  # Spread instances across all available subnets (high availability)
  vpc_zone_identifier = tolist(data.aws_subnets.default.ids)

  launch_template {
    id      = aws_launch_template.nova_ai_lt.id
    version = "$Latest"
  }

  health_check_type         = "EC2"
  health_check_grace_period = 120   # Wait 2 min before checking (EC2 boot time)
}
```

#### Scale-Out and Scale-In Policies
```hcl
# Add 1 EC2 when triggered
resource "aws_autoscaling_policy" "scale_out" {
  scaling_adjustment = 1    # +1 instance
  cooldown           = 300  # Wait 5 min before scaling again (prevents flapping)
}

# Remove 1 EC2 when triggered
resource "aws_autoscaling_policy" "scale_in" {
  scaling_adjustment = -1   # -1 instance
  cooldown           = 300
}
```

#### CloudWatch Alarms — The Triggers
```hcl
# CPU > 70% for 2 consecutive minutes → launch new EC2
resource "aws_cloudwatch_metric_alarm" "cpu_high" {
  metric_name         = "CPUUtilization"
  namespace           = "AWS/EC2"
  period              = 60          # Check every 60 seconds
  evaluation_periods  = 2           # Must be above threshold for 2 periods (2 min)
  threshold           = 70          # 70% CPU
  comparison_operator = "GreaterThanThreshold"
  alarm_actions       = [aws_autoscaling_policy.scale_out.arn]
}

# CPU < 30% for 10 consecutive minutes → terminate extra EC2
resource "aws_cloudwatch_metric_alarm" "cpu_low" {
  period              = 60
  evaluation_periods  = 10          # Must be below for 10 periods (10 min)
  threshold           = 30          # 30% CPU
  comparison_operator = "LessThanThreshold"
  alarm_actions       = [aws_autoscaling_policy.scale_in.arn]
}
```

**Why 2 minutes for scale-out but 10 minutes for scale-in?**
Scale-out is aggressive — if CPU spikes, add capacity immediately (2 min threshold).
Scale-in is conservative — wait 10 minutes to confirm traffic really dropped before terminating. Prevents launching and terminating instances in rapid cycles.

#### Two Levels of Scaling in NOVA AI

```
Level 1 — K8s HPA (Pod Scaling, FAST):
  Pod CPU > 70% → add more pods inside same EC2
  agent: 1 pod → 5 pods
  Speed: ~20 seconds | Cost: free

Level 2 — AWS ASG (Instance Scaling, SLOW):
  EC2 overall CPU > 70% for 2 min → launch new EC2
  EC2 #1 + EC2 #2 both running full Docker stack
  Speed: 3-5 minutes | Cost: extra EC2 charges
```

HPA triggers first and handles most traffic spikes. ASG is the fallback for sustained extreme load that even max pods can't handle.

---

## Terraform Commands

```bash
terraform init      # Download AWS + random providers (~50MB, one-time)
terraform fmt       # Auto-format .tf files (consistent style)
terraform validate  # Check syntax errors before touching AWS
terraform plan      # Preview: show exactly what will be created/changed/destroyed
terraform apply     # Create everything on AWS (prompts for confirmation)
terraform destroy   # Tear everything down (removes all created resources)
terraform output    # Print the output values (IP, URLs) again
```

**The golden rule:** Always run `terraform plan` before `terraform apply`. It shows exactly what will change with zero risk.

---

## Terraform State

Terraform keeps a `terraform.tfstate` file that records everything it has created. This is how it knows:
- What already exists (skip creating it again)
- What changed (update only what's different)
- What was removed from `.tf` files (destroy those resources)

This file is gitignored because it contains sensitive data (resource IDs, IPs). In production, state is stored in an S3 bucket so teams can share it.

---

## Security — What Is NOT Committed to Git

`.gitignore` protects:
```
terraform.tfvars      # Actual variable values (could contain sensitive data)
*.pem                 # SSH private key (nova-ai-key.pem)
terraform.tfstate     # State file (contains resource IDs and IPs)
terraform.tfstate.*   # State backups
.terraform/           # Downloaded provider binaries
.terraform.lock.hcl   # NOT gitignored — this IS committed (locks provider versions)
```

---

## Terraform vs Manual AWS Console

| Manual Console | Terraform |
|---|---|
| 15+ click steps | 1 command: `terraform apply` |
| 30+ minutes | ~3 minutes |
| Might make mistakes | Exactly the same every time |
| Not documented anywhere | Version controlled in Git |
| Can't recreate if server dies | `terraform apply` recreates everything |
| Different across team members | Identical for everyone |

---

## What to Demonstrate to Faculty

### Demo 1 — Show terraform plan output
```bash
cd terraform
terraform plan
```
Show the plan listing 8 resources with their properties. Emphasize: "Nothing has been created yet — this is just a preview."

### Demo 2 — Show ec2.tf security group
Open `terraform/ec2.tf`. Walk through each ingress rule:
- Port 22: "This allows me to SSH in for debugging"
- Port 80: "Nginx serves the frontend here"
- Port 8000: "The API Gateway — single entry point for all API requests"
- Ports 8001-8004: "Individual microservices"

### Demo 3 — Show variables.tf
Point out: "If I want to change the instance type to handle more traffic, I change one line here — `instance_type = "t3.large"` — and run `terraform apply`. The server gets replaced automatically with the new type."

### Demo 4 — Show outputs
```bash
terraform output
```
Shows the live IP, SSH command, and URLs. "After running apply, I immediately know how to connect to my server — I don't need to go looking in the AWS Console."

### Demo 5 — Show user_data.sh
Open `terraform/user_data.sh`. Walk through:
- "This script runs automatically on the server when it boots for the first time"
- "It installs Docker, clones our GitHub repository, creates .env files, and runs docker compose up"
- "The server configures itself completely — I never need to SSH in manually to set it up"

### Demo 6 — Show the live AWS resources
If connected to AWS Console:
- EC2 → Instances → `nova-ai-server` → show it's running, show the public IP matches `65.2.232.188`
- EC2 → Elastic IPs → show `65.2.232.188` assigned to the instance
- EC2 → Security Groups → `nova-ai-sg` → show the ingress rules

### Demo 7 — Show .gitignore protecting secrets
```bash
git status
# terraform.tfvars is not shown — it's gitignored

git log --all -- terraform/terraform.tfvars
# No commits — it was never committed
```

### Demo 8 — Show ASG in AWS Console
AWS Console → EC2 → Auto Scaling Groups → `nova-ai-asg`
Point out:
- Desired: 1, Min: 1, Max: 2
- Activity tab → shows scaling history
- Instances tab → shows which EC2s are currently in the group

### Demo 9 — Show CloudWatch Alarms
AWS Console → CloudWatch → Alarms
Show `nova-ai-cpu-high` and `nova-ai-cpu-low`:
- State: OK (currently not triggered)
- Threshold: 70% / 30%
- Actions: linked to scale-out / scale-in policies

### Demo 10 — Show asg.tf file
Open `terraform/asg.tf`. Walk through:
- Launch Template: "This is the blueprint — every new EC2 launched by ASG uses the exact same AMI, security group, and boot script"
- ASG min/max: "Always 1 running, never more than 2 — keeps us on free tier"
- CloudWatch alarm: "When CPU crosses 70% for 2 consecutive minutes, this alarm fires and triggers a new EC2"

### What to Say at Viva
*"Infrastructure as Code means our entire cloud setup — the server, firewall, storage, networking, and auto scaling — is defined in `.tf` files and committed to Git. If our EC2 server crashes at 3am, we don't spend an hour clicking through the AWS Console. We run `terraform apply` and in 3 minutes we have an identical server with identical configuration. We also have two levels of scaling: Kubernetes HPA scales pods inside one EC2 in 20 seconds, and the AWS Auto Scaling Group launches a completely new EC2 instance if the whole server is maxed out. CloudWatch monitors CPU and triggers both levels automatically — no human involvement needed."*
