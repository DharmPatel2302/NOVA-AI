# ============================================================
#  NOVA AI — Auto Scaling Group (ASG)
#
#  What this does:
#  Monitors EC2 CPU via CloudWatch. When CPU > 70% for 2 minutes,
#  automatically launches a NEW EC2 instance. When CPU < 30%,
#  terminates the extra instance. This is INSTANCE-level scaling
#  (different from K8s HPA which scales pods inside one instance).
#
#  Architecture:
#  ┌─────────────────────────────────────────────┐
#  │  CloudWatch Alarm (CPU > 70%)               │
#  │         ↓ triggers                          │
#  │  Scale-Out Policy → ASG launches new EC2    │
#  │         ↓                                   │
#  │  EC2 #1 (original)  +  EC2 #2 (new)        │
#  │  Each runs full Docker Compose stack        │
#  └─────────────────────────────────────────────┘
#
#  Min: 1 instance  Max: 2 instances  (free tier safe)
# ============================================================

# ── Launch Template ──────────────────────────────────────────
# A blueprint for every EC2 instance the ASG creates.
# Same config as the original EC2 — same AMI, same startup script.
resource "aws_launch_template" "nova_ai_lt" {
  name_prefix   = "${var.project_name}-lt-"
  image_id      = var.ami_id
  instance_type = var.instance_type
  key_name      = var.key_name

  # Same security group as the original EC2
  vpc_security_group_ids = [aws_security_group.nova_ai_sg.id]

  # Same boot script — new instances self-configure automatically
  user_data = base64encode(file("${path.module}/user_data.sh"))

  # 20GB SSD — same as original EC2
  block_device_mappings {
    device_name = "/dev/sda1"
    ebs {
      volume_size           = 20
      volume_type           = "gp3"
      delete_on_termination = true
    }
  }

  tag_specifications {
    resource_type = "instance"
    tags = {
      Name    = "${var.project_name}-asg-instance"
      Project = var.project_name
    }
  }

  tags = {
    Name    = "${var.project_name}-launch-template"
    Project = var.project_name
  }
}

# ── Auto Scaling Group ───────────────────────────────────────
# The core resource. Maintains between min and max EC2 instances.
# Uses all available subnets in the default VPC for high availability.
resource "aws_autoscaling_group" "nova_ai_asg" {
  name                = "${var.project_name}-asg"
  min_size            = 1       # Always keep at least 1 instance running
  max_size            = 2       # Never create more than 2 (free tier safe)
  desired_capacity    = 1       # Start with 1 instance
  vpc_zone_identifier = tolist(data.aws_subnets.default.ids)

  launch_template {
    id      = aws_launch_template.nova_ai_lt.id
    version = "$Latest"         # Always use latest launch template version
  }

  # Health check — if EC2 health check fails, replace the instance
  health_check_type         = "EC2"
  health_check_grace_period = 120   # Wait 2 min before health checking (boot time)

  # Keep instances running even during update (no interruption)
  default_instance_warmup = 60

  tag {
    key                 = "Name"
    value               = "${var.project_name}-asg-instance"
    propagate_at_launch = true
  }

  tag {
    key                 = "Project"
    value               = var.project_name
    propagate_at_launch = true
  }

  # Don't destroy ASG when terraform destroy runs if instances are running
  lifecycle {
    create_before_destroy = true
  }
}

# ── Scale-Out Policy ─────────────────────────────────────────
# Add 1 new EC2 instance when triggered by CloudWatch alarm
resource "aws_autoscaling_policy" "scale_out" {
  name                   = "${var.project_name}-scale-out"
  autoscaling_group_name = aws_autoscaling_group.nova_ai_asg.name
  adjustment_type        = "ChangeInCapacity"
  scaling_adjustment     = 1    # Add 1 instance
  cooldown               = 300  # Wait 5 minutes before scaling again
}

# ── Scale-In Policy ──────────────────────────────────────────
# Remove 1 EC2 instance when triggered (scale back down)
resource "aws_autoscaling_policy" "scale_in" {
  name                   = "${var.project_name}-scale-in"
  autoscaling_group_name = aws_autoscaling_group.nova_ai_asg.name
  adjustment_type        = "ChangeInCapacity"
  scaling_adjustment     = -1   # Remove 1 instance
  cooldown               = 300  # Wait 5 minutes before scaling again
}

# ── CloudWatch Alarm: CPU High → Scale Out ───────────────────
# Triggers when EC2 CPU stays above 70% for 2 consecutive minutes
resource "aws_cloudwatch_metric_alarm" "cpu_high" {
  alarm_name          = "${var.project_name}-cpu-high"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 2           # Must be true for 2 periods in a row
  metric_name         = "CPUUtilization"
  namespace           = "AWS/EC2"
  period              = 60          # Check every 60 seconds
  statistic           = "Average"
  threshold           = 70          # CPU > 70% → trigger scale-out
  alarm_description   = "NOVA AI EC2 CPU above 70% — scaling out"

  dimensions = {
    AutoScalingGroupName = aws_autoscaling_group.nova_ai_asg.name
  }

  # When alarm fires → execute scale-out policy
  alarm_actions = [aws_autoscaling_policy.scale_out.arn]
}

# ── CloudWatch Alarm: CPU Low → Scale In ────────────────────
# Triggers when EC2 CPU drops below 30% for 10 consecutive minutes
# (longer window prevents premature scale-in)
resource "aws_cloudwatch_metric_alarm" "cpu_low" {
  alarm_name          = "${var.project_name}-cpu-low"
  comparison_operator = "LessThanThreshold"
  evaluation_periods  = 10          # Must be true for 10 periods (10 min)
  metric_name         = "CPUUtilization"
  namespace           = "AWS/EC2"
  period              = 60
  statistic           = "Average"
  threshold           = 30          # CPU < 30% → trigger scale-in
  alarm_description   = "NOVA AI EC2 CPU below 30% — scaling in"

  dimensions = {
    AutoScalingGroupName = aws_autoscaling_group.nova_ai_asg.name
  }

  # When alarm fires → execute scale-in policy
  alarm_actions = [aws_autoscaling_policy.scale_in.arn]
}
