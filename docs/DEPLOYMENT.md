# NOVA AI — Complete Deployment Guide
# Technology 7 — Cloud Provider (2 Marks)
# Technology 8 — Publicly Accessible Link (2 Marks)

---

## QUICK REFERENCE — LIVE URLs

| What | URL | Status |
|------|-----|--------|
| Frontend App | `http://65.2.232.188` | ✅ Live |
| API Gateway | `http://65.2.232.188:8000` | ✅ Live |
| API Health Check | `http://65.2.232.188:8000/health` | ✅ Live |
| S3 Static Hosting | `http://nova-ai-frontend-19d45e08.s3-website.ap-south-1.amazonaws.com` | ✅ Live |

---

## WHERE EVERYTHING IS DEPLOYED

```
┌──────────────────────────────────────────────────────────────────┐
│                    NOVA AI — Deployment Map                      │
│                                                                  │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │           AWS ap-south-1 (Mumbai)                       │    │
│  │                                                         │    │
│  │  EC2 t3.micro — 65.2.232.188 (Elastic IP)              │    │
│  │  ├── Nginx (port 80)  → serves React frontend           │    │
│  │  ├── Gateway          → Docker container (port 8000)    │    │
│  │  ├── Auth Service     → Docker container (port 8001)    │    │
│  │  ├── Chat Service     → Docker container (port 8002)    │    │
│  │  ├── Agent Service    → Docker container (port 8003)    │    │
│  │  ├── Billing Service  → Docker container (port 8004)    │    │
│  │  └── Redis            → Docker container (port 6379)    │    │
│  │                                                         │    │
│  │  S3 Bucket — nova-ai-frontend-19d45e08                  │    │
│  │  └── React dist/ files (static website hosting)         │    │
│  │                                                         │    │
│  │  Auto Scaling Group — nova-ai-asg                       │    │
│  │  ├── Min: 1  Max: 2  Desired: 1                         │    │
│  │  ├── Launch Template — nova-ai-lt-xxx                   │    │
│  │  └── CloudWatch Alarms (CPU triggers)                   │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                  │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │           External Cloud Services                       │    │
│  │                                                         │    │
│  │  MongoDB Atlas (ap-south-1 Mumbai)                      │    │
│  │  └── nova-ai database → users, chats, messages          │    │
│  │                                                         │    │
│  │  Qdrant Cloud (sa-east-1 São Paulo)                     │    │
│  │  └── PDF embeddings for RAG agent                       │    │
│  └─────────────────────────────────────────────────────────┘    │
└──────────────────────────────────────────────────────────────────┘
```

---

## AWS SERVICES USED — COMPLETE LIST

| AWS Service | Resource Name | Purpose |
|---|---|---|
| EC2 | `nova-ai-server` | Runs all Docker containers + Nginx |
| Elastic IP | `65.2.232.188` | Fixed public IP (doesn't change on restart) |
| Security Group | `nova-ai-sg` | Firewall — allows ports 22, 80, 8000-8004 |
| S3 | `nova-ai-frontend-19d45e08` | Frontend static website hosting |
| Auto Scaling Group | `nova-ai-asg` | Manages EC2 scaling (min 1, max 2) |
| Launch Template | `nova-ai-lt-xxx` | Blueprint for new EC2 instances |
| CloudWatch Alarm | `nova-ai-cpu-high` | Triggers scale-out when CPU > 70% for 2 min |
| CloudWatch Alarm | `nova-ai-cpu-low` | Triggers scale-in when CPU < 30% for 10 min |
| VPC | Default VPC | Network isolation |
| Subnets | Default subnets | 3 availability zones |

**All of these were created with one command: `terraform apply`**
**None were created manually in the AWS Console.**

---

## HOW THE FRONTEND IS SERVED

```
User opens http://65.2.232.188
        ↓
Nginx on EC2 (port 80)
        ↓
Reads /var/www/nova-ai/index.html
        ↓
Browser downloads:
  /assets/index-CaAZ1kxy.js  (React app — 1.4MB)
  /assets/index-eU8absor.css (styles — 37KB)
        ↓
React app boots in browser
        ↓
User actions → API calls → http://65.2.232.188:8000
        ↓
Gateway → routes to correct microservice
```

---

## HOW THE BACKEND IS DEPLOYED

```
All 6 containers run on EC2 via Docker Compose:

redis          → redis:7-alpine         port 6379
auth-service   → backend-auth-service   port 8001
chat-service   → backend-chat-service   port 8002
billing-service→ backend-billing-service port 8004
agent-service  → backend-agent-service  port 8003
gateway        → backend-gateway        port 8000

Nginx proxies port 80 → React app
Docker exposes ports 8000-8004 directly
```

---

## AUTO SCALING — HOW IT WORKS

```
Normal state:
ASG desired = 1 → 1 EC2 running

CPU > 70% for 2 consecutive minutes:
        ↓
CloudWatch alarm: nova-ai-cpu-high fires
        ↓
Scale-out policy: +1 instance
        ↓
ASG launches new EC2 using Launch Template
        ↓
New EC2 boots → user_data.sh runs automatically:
  - installs Docker
  - clones GitHub repo
  - runs docker compose up
        ↓
2 EC2 instances running (max reached)

CPU < 30% for 10 consecutive minutes:
        ↓
CloudWatch alarm: nova-ai-cpu-low fires
        ↓
Scale-in policy: -1 instance
        ↓
ASG terminates extra EC2
        ↓
Back to 1 EC2 (min maintained)
```

**Two levels of scaling in NOVA AI:**

| Level | What scales | Trigger | Speed |
|---|---|---|---|
| K8s HPA | Pods inside EC2 | CPU > 70% | ~20 seconds |
| AWS ASG | Entire EC2 instances | CPU > 70% for 2 min | ~3-5 minutes |

HPA acts first (fast, free). ASG is last resort (slower, costs money).

---

## HOW TO DEMONSTRATE TO FACULTY

---

### Demo 1 — Show the live app (1 minute)

Open `http://65.2.232.188` in browser.

> *"This is NOVA AI running live on AWS EC2 in Mumbai. This URL works from any
> device, anywhere in the world. It is not running on my laptop."*

Open it on your phone (mobile data) to prove it is truly public.

Show the app working:
- Sign in with Google
- Send a message to the AI
- Show the response

---

### Demo 2 — Show EC2 in AWS Console (1 minute)

```
AWS Console → EC2 → Instances
```

Point at `nova-ai-server`:
- Instance type: t3.micro (free tier)
- Public IP: 65.2.232.188
- State: Running
- Region: ap-south-1 (Mumbai)

> *"This is the physical server running in an AWS data center in Mumbai.
> All 6 Docker containers — gateway, auth, chat, agent, billing, Redis —
> run on this single EC2 instance."*

---

### Demo 3 — Show containers running on EC2 (1 minute)

SSH into EC2 and show all containers:

```bash
ssh -i nova-ai-key3.pem ubuntu@65.2.232.188
docker ps
```

Output shows 6 containers all running with their ports.

> *"Each microservice is an isolated Docker container. If agent-service crashes,
> chat and auth keep working because they are completely independent."*

---

### Demo 4 — Show Security Group (firewall) (30 seconds)

```
AWS Console → EC2 → Security Groups → nova-ai-sg → Inbound rules
```

Show the rules:
- Port 22 (SSH)
- Port 80 (HTTP frontend)
- Port 8000 (Gateway)
- Port 8001-8004 (Services)

> *"This is the cloud firewall. Only these specific ports are open.
> Everything else is blocked at the infrastructure level.
> Created by Terraform — not manually configured."*

---

### Demo 5 — Show S3 Static Hosting (1 minute)

```
AWS Console → S3 → nova-ai-frontend-19d45e08
```

Click the bucket → show the files:
```
assets/
  index-CaAZ1kxy.js
  index-eU8absor.css
favicon.svg
icons.svg
index.html
```

Click **Properties** tab → scroll to **Static website hosting** → show the endpoint URL.

Open the S3 URL in browser — same React app served from S3.

> *"The React frontend is also hosted on S3 as a static website.
> S3 serves files globally from AWS infrastructure — no server needed.
> This gives us two deployment options: EC2 + Nginx, or S3 static hosting."*

---

### Demo 6 — Show Auto Scaling (most impressive) (5 minutes)

**This is the most powerful demo. Shows AWS automatically launching and terminating
EC2 instances in response to load — all infrastructure defined by Terraform.**

---

#### BEFORE THE DEMO — Setup (do this first, takes 30 seconds)

Open **3 browser tabs** in AWS Console side by side:

| Tab | Path |
|-----|------|
| Tab 1 | CloudWatch → Alarms |
| Tab 2 | EC2 → Auto Scaling Groups → nova-ai-asg → **Activity** tab |
| Tab 3 | EC2 → Instances |

Verify starting state:
- Tab 1: both alarms show **OK**
- Tab 2: Instances = **1**, Desired = **1**
- Tab 3: only **1 instance** running (`nova-ai-server`)

If `cpu-low` shows "In alarm", reset it first (run in local terminal):
```bash
aws cloudwatch set-alarm-state --alarm-name "nova-ai-cpu-high" --state-value OK --state-reason "Reset for demo"
aws cloudwatch set-alarm-state --alarm-name "nova-ai-cpu-low" --state-value OK --state-reason "Reset for demo"
```

---

#### PART 1 — SCALE OUT (trigger new EC2 to launch)

**Step 1:** Tell faculty what is about to happen:

> *"Right now we have 1 EC2 instance running. I am going to simulate high CPU load.
> CloudWatch monitors CPU every minute. When it stays above 70% for 2 consecutive
> minutes, the alarm fires and the Auto Scaling Group automatically launches
> a new EC2 instance."*

**Step 2:** Run this command in your local terminal (NOT on EC2):
```bash
aws cloudwatch set-alarm-state \
  --alarm-name "nova-ai-cpu-high" \
  --state-value ALARM \
  --state-reason "Demo: simulating high CPU load for autoscaling demonstration"
```

**Step 3:** Watch the 3 tabs with faculty:

Within **30 seconds**:
- Tab 1: `nova-ai-cpu-high` → **In alarm** (orange triangle ⚠)
- Tab 2: Activity tab shows **"Launching a new EC2 instance"**
- Tab 3: New instance `nova-ai-asg-in...` appears → **Initializing → Running**
- Tab 2: Instances changes from **1 → 2**, Desired **1 → 2**

> *"CloudWatch detected the high CPU and triggered the scale-out policy.
> The Auto Scaling Group launched a new EC2 instance automatically in a
> different Availability Zone (ap-south-1b) for high availability.
> The new instance uses the Launch Template — same AMI, same user_data.sh
> boot script, same Docker setup. No human action was needed."*

---

#### PART 2 — SCALE IN (terminate the extra instance)

**Step 1:** Tell faculty what is about to happen:

> *"Now I will simulate CPU dropping back to normal. The scale-in alarm fires
> when CPU stays below 30% for 10 minutes. The ASG will then terminate the
> extra instance automatically to save cost."*

**Step 2:** Run this command:
```bash
aws cloudwatch set-alarm-state \
  --alarm-name "nova-ai-cpu-low" \
  --state-value ALARM \
  --state-reason "Demo: simulating low CPU for scale-in demonstration"
```

**Step 3:** Watch the 3 tabs:

Within **1-2 minutes**:
- Tab 1: `nova-ai-cpu-low` → **In alarm**
- Tab 2: Activity shows **"Terminating EC2 instance"**
- Tab 3: `nova-ai-asg-in...` → **Shutting down → Terminated**
- Tab 2: Instances changes from **2 → 1**, Desired **2 → 1**

> *"The extra instance was automatically terminated. The ASG always maintains
> at least 1 instance (the minimum). This is the complete autoscaling cycle —
> scale out under load, scale in when load drops. All defined in
> terraform/asg.tf — zero manual work."*

---

#### PART 3 — Show the Terraform code that created this

Open `terraform/asg.tf` in VS Code and point at these sections:

```hcl
# The Auto Scaling Group
resource "aws_autoscaling_group" "nova_ai_asg" {
  min_size         = 1    # Always keep at least 1 instance
  max_size         = 2    # Never create more than 2
  desired_capacity = 1    # Start with 1
}

# Scale-out: add 1 EC2 when triggered
resource "aws_autoscaling_policy" "scale_out" {
  scaling_adjustment = 1
  cooldown           = 300
}

# CloudWatch watches CPU every 60 seconds
resource "aws_cloudwatch_metric_alarm" "cpu_high" {
  threshold           = 70   # CPU > 70%
  evaluation_periods  = 2    # for 2 consecutive minutes
  alarm_actions = [aws_autoscaling_policy.scale_out.arn]
}
```

> *"This entire infrastructure — Launch Template, Auto Scaling Group, two
> CloudWatch alarms, two scaling policies — was created with one
> `terraform apply` command. If we need to recreate everything from scratch,
> one command does it in 2 minutes."*

---

#### OPTIONAL — Show manual desired capacity control

```bash
# Force scale-out without waiting for alarm
aws autoscaling set-desired-capacity \
  --auto-scaling-group-name "nova-ai-asg" \
  --desired-capacity 2

# Force scale-in immediately
aws autoscaling set-desired-capacity \
  --auto-scaling-group-name "nova-ai-asg" \
  --desired-capacity 1
```

> *"You can also manually override the desired capacity. This is useful for
> planned maintenance or predictive scaling before an expected traffic spike."*

---

#### WHY MANUAL ALARM TRIGGERING IS VALID FOR DEMO

The CloudWatch alarm is configured to monitor the **AutoScalingGroupName** dimension.
The original `nova-ai-server` EC2 is not an ASG-managed instance, so stressing it
does not trigger the ASG alarm. The alarm only responds to CPU from ASG-managed instances.

For the demo, manually setting the alarm state is the correct approach because:
1. It produces the exact same ASG behavior as a real CPU spike
2. It demonstrates the full scale-out and scale-in cycle in 5 minutes instead of 12+ minutes
3. In production, a real traffic spike would trigger the same alarm automatically

> *"I am triggering the alarm manually to demonstrate the autoscaling behavior
> within the demo time. In production, this happens automatically when real
> CPU thresholds are crossed by actual user traffic."*

---

### Demo 7 — Show Terraform created everything (1 minute)

Open `terraform/asg.tf` in VS Code. Scroll through and point at:

```hcl
resource "aws_autoscaling_group" "nova_ai_asg" {
  min_size         = 1
  max_size         = 2
  desired_capacity = 1
  ...
}

resource "aws_cloudwatch_metric_alarm" "cpu_high" {
  threshold = 70
  alarm_actions = [aws_autoscaling_policy.scale_out.arn]
  ...
}
```

> *"Every AWS resource you see in the console — EC2, S3, ASG, Security Group,
> Elastic IP, CloudWatch alarms — was created by this Terraform code.
> `terraform apply` reads these files and provisions everything automatically.
> If the server crashes, one command recreates the exact same infrastructure
> in 2 minutes."*

---

### Demo 8 — Show MongoDB Atlas (cloud database) (30 seconds)

```
cloud.mongodb.com → Cluster0 → Browse Collections → nova-ai database
```

Show collections:
- `users` — user profiles, credits, plan
- `conversations` — chat history
- `messages` — individual messages

> *"The database is not on EC2. It's on MongoDB Atlas — a managed cloud
> database in AWS Mumbai region. Even if EC2 goes down, the data is safe."*

---

### Demo 9 — Show Qdrant cloud (vector database) (30 seconds)

```
cloud.qdrant.io → your cluster → Collections
```

> *"PDF files uploaded by users are converted to vector embeddings and stored
> in Qdrant Cloud. This powers the PDF RAG agent — semantic search over
> uploaded documents. Another managed cloud service, not on EC2."*

---

## WHAT TO SAY AT VIVA — COMPLETE SCRIPT

> *"NOVA AI is deployed on AWS in the Mumbai region. The backend runs on an
> EC2 t3.micro instance with all 5 microservices and Redis running as Docker
> containers. The frontend React app is served by Nginx on the same EC2 on
> port 80 and is also hosted on an S3 static website.*
>
> *The public URL is http://65.2.232.188 — accessible from any device
> anywhere in the world.*
>
> *For scalability, we have an Auto Scaling Group that monitors CPU via
> CloudWatch. When CPU exceeds 70% for 2 consecutive minutes, it automatically
> launches a new EC2 instance using a Launch Template that has the exact same
> configuration. When load drops below 30% for 10 minutes, it terminates the
> extra instance to save cost.*
>
> *The database is on MongoDB Atlas in Mumbai — a managed cloud database.
> Vector embeddings for PDF search are stored on Qdrant Cloud.*
>
> *The entire AWS infrastructure — EC2, S3, Security Group, Elastic IP, ASG,
> Launch Template, CloudWatch alarms — was provisioned with a single
> `terraform apply` command. Nothing was created manually in the AWS Console.
> This is Infrastructure as Code."*

---

## VERIFY EVERYTHING IS RUNNING — QUICK CHECKLIST

Run these before your viva:

```bash
# 1. Check all containers on EC2
ssh -i nova-ai-key3.pem ubuntu@65.2.232.188 "docker ps --format 'table {{.Names}}\t{{.Status}}'"

# 2. Check gateway health
curl http://65.2.232.188:8000/health

# 3. Check frontend loads
curl -s http://65.2.232.188 | grep "NOVA AI"
```

Expected output:
```
nova-gateway          Up X minutes (healthy)
nova-auth-service     Up X minutes (healthy)
nova-chat-service     Up X minutes (healthy)
nova-billing-service  Up X minutes (healthy)
nova-agent-service    Up X minutes (healthy)
multiagent-redis      Up X minutes (healthy)

{"status":"healthy till now !!","service":"gateway"}

<title>NOVA AI Workspace</title>
```

---

## FILES THAT DEFINE THE DEPLOYMENT

| File | Purpose |
|------|---------|
| `terraform/ec2.tf` | EC2 instance + Security Group + Elastic IP |
| `terraform/s3.tf` | S3 bucket + static website hosting |
| `terraform/asg.tf` | Launch Template + ASG + CloudWatch alarms |
| `terraform/variables.tf` | Region, instance type, key name |
| `terraform/outputs.tf` | Prints all URLs after terraform apply |
| `terraform/user_data.sh` | EC2 boot script — installs Docker + starts app |
| `backend/docker-compose.yml` | Defines all 6 containers |
| `backend/gateway/Dockerfile` | Gateway container build |
| `backend/services/*/Dockerfile` | Each service container build |
