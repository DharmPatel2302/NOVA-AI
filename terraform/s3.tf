# ============================================================
#  NOVA AI — S3 Frontend Static Hosting
#  Serves the built React app (dist/) as a public website
# ============================================================

# Random suffix so bucket name is globally unique
resource "random_id" "bucket_suffix" {
  byte_length = 4
}

# ── S3 Bucket ────────────────────────────────────────────────
resource "aws_s3_bucket" "frontend" {
  bucket        = "${var.project_name}-frontend-${random_id.bucket_suffix.hex}"
  force_destroy = true

  tags = {
    Name    = "${var.project_name}-frontend"
    Project = var.project_name
  }
}

# ── Disable "Block Public Access" ───────────────────────────
# Required to serve files publicly as a static website
resource "aws_s3_bucket_public_access_block" "frontend" {
  bucket = aws_s3_bucket.frontend.id

  block_public_acls       = false
  block_public_policy     = false
  ignore_public_acls      = false
  restrict_public_buckets = false
}

# ── Enable Static Website Hosting ───────────────────────────
resource "aws_s3_bucket_website_configuration" "frontend" {
  bucket = aws_s3_bucket.frontend.id

  index_document {
    suffix = "index.html"
  }

  # React SPA — all routes fall back to index.html
  error_document {
    key = "index.html"
  }
}

# ── Bucket Policy: allow public read ────────────────────────
resource "aws_s3_bucket_policy" "frontend" {
  bucket = aws_s3_bucket.frontend.id

  # Must wait for public access block to be disabled first
  depends_on = [aws_s3_bucket_public_access_block.frontend]

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid       = "PublicReadGetObject"
        Effect    = "Allow"
        Principal = "*"
        Action    = "s3:GetObject"
        Resource  = "${aws_s3_bucket.frontend.arn}/*"
      }
    ]
  })
}
