# ============================================================
#  NOVA AI — Terraform Variables
#  All configurable inputs in one place
# ============================================================

variable "aws_region" {
  description = "AWS region to deploy into"
  type        = string
  default     = "ap-south-1"
}

variable "project_name" {
  description = "Project name — used as prefix for all resources"
  type        = string
  default     = "nova-ai"
}

variable "instance_type" {
  description = "EC2 instance type (t3.micro = free tier)"
  type        = string
  default     = "t3.micro"
}

variable "key_name" {
  description = "Name of the EC2 key pair for SSH access"
  type        = string
  default     = "nova-ai-key3"
}

variable "github_repo" {
  description = "GitHub repo URL to clone on EC2 boot"
  type        = string
  default     = "https://github.com/DharmPatel2302/NOVA-AI.git"
}

variable "ami_id" {
  description = "Ubuntu 22.04 LTS AMI for ap-south-1"
  type        = string
  # Ubuntu 22.04 LTS (HVM), SSD — ap-south-1 (latest as of Oct 2026)
  default     = "ami-0644c826df601fd4f"
}
