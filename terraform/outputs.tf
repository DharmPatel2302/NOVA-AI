# ============================================================
#  NOVA AI — Terraform Outputs
#  Printed after terraform apply — shows all access URLs
# ============================================================

output "ec2_public_ip" {
  description = "Elastic (fixed) public IP of the EC2 instance"
  value       = aws_eip.nova_ai_eip.public_ip
}

output "ec2_instance_id" {
  description = "EC2 instance ID"
  value       = aws_instance.nova_ai.id
}

output "ssh_command" {
  description = "SSH command to connect to the server"
  value       = "ssh -i nova-ai-key.pem ubuntu@${aws_eip.nova_ai_eip.public_ip}"
}

output "gateway_url" {
  description = "API Gateway endpoint"
  value       = "http://${aws_eip.nova_ai_eip.public_ip}:8000"
}

output "frontend_url" {
  description = "Frontend URL (served by Nginx on port 80)"
  value       = "http://${aws_eip.nova_ai_eip.public_ip}"
}

output "s3_website_url" {
  description = "S3 static website URL"
  value       = "http://${aws_s3_bucket_website_configuration.frontend.website_endpoint}"
}

output "s3_bucket_name" {
  description = "S3 bucket name for frontend hosting"
  value       = aws_s3_bucket.frontend.bucket
}
