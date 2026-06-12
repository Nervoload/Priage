terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

variable "name" {
  type    = string
  default = "priage-production"
}
variable "edge_resource_arn" {
  type        = string
  description = "ARN of the regional API Gateway stage or ALB serving the backend."
}
variable "database_resource_arn" {
  type        = string
  description = "ARN of the managed PostgreSQL/RDS resource protected by AWS Backup."
}
variable "backup_role_arn" {
  type        = string
  description = "IAM role AWS Backup uses for backup and restore."
}

resource "aws_kms_key" "priage" {
  description             = "Priage PHI encryption and backup key"
  deletion_window_in_days = 30
  enable_key_rotation     = true
}

resource "aws_s3_bucket" "assets" {
  bucket_prefix = "${var.name}-assets-"
}

resource "aws_s3_bucket_public_access_block" "assets" {
  bucket                  = aws_s3_bucket.assets.id
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_policy" "assets_tls_only" {
  bucket = aws_s3_bucket.assets.id
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Sid       = "DenyInsecureTransport"
      Effect    = "Deny"
      Principal = "*"
      Action    = "s3:*"
      Resource = [
        aws_s3_bucket.assets.arn,
        "${aws_s3_bucket.assets.arn}/*",
      ]
      Condition = {
        Bool = {
          "aws:SecureTransport" = "false"
        }
      }
    }]
  })
}

resource "aws_s3_bucket_versioning" "assets" {
  bucket = aws_s3_bucket.assets.id
  versioning_configuration { status = "Enabled" }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "assets" {
  bucket = aws_s3_bucket.assets.id
  rule {
    apply_server_side_encryption_by_default {
      kms_master_key_id = aws_kms_key.priage.arn
      sse_algorithm     = "aws:kms"
    }
    bucket_key_enabled = true
  }
}

resource "aws_s3_bucket_lifecycle_configuration" "assets" {
  bucket = aws_s3_bucket.assets.id
  rule {
    id     = "archive-and-expire"
    status = "Enabled"
    filter {}
    transition {
      days          = 90
      storage_class = "STANDARD_IA"
    }

    transition {
      days          = 365
      storage_class = "GLACIER_IR"
    }

    noncurrent_version_expiration {
      noncurrent_days = 30
    }

    abort_incomplete_multipart_upload {
      days_after_initiation = 1
    }
  }

  rule {
    id     = "expire-quarantine"
    status = "Enabled"
    filter {
      prefix = "quarantine/"
    }
    expiration {
      days = 30
    }
    noncurrent_version_expiration {
      noncurrent_days = 30
    }
  }
}

resource "aws_wafv2_web_acl" "priage" {
  name  = var.name
  scope = "REGIONAL"
  default_action { allow {} }

  rule {
    name     = "AWSManagedCommonRules"
    priority = 10
    override_action { none {} }
    statement {
      managed_rule_group_statement {
        name        = "AWSManagedRulesCommonRuleSet"
        vendor_name = "AWS"
      }
    }
    visibility_config {
      cloudwatch_metrics_enabled = true
      metric_name                = "priage-common-rules"
      sampled_requests_enabled   = true
    }
  }

  rule {
    name     = "RateLimitPerIp"
    priority = 20
    action { block {} }
    statement {
      rate_based_statement {
        aggregate_key_type = "IP"
        limit              = 1000
      }
    }
    visibility_config {
      cloudwatch_metrics_enabled = true
      metric_name                = "priage-ip-rate-limit"
      sampled_requests_enabled   = true
    }
  }

  visibility_config {
    cloudwatch_metrics_enabled = true
    metric_name                = "priage-waf"
    sampled_requests_enabled   = true
  }
}

resource "aws_wafv2_web_acl_association" "priage" {
  resource_arn = var.edge_resource_arn
  web_acl_arn  = aws_wafv2_web_acl.priage.arn
}

resource "aws_backup_vault" "priage" {
  name        = var.name
  kms_key_arn = aws_kms_key.priage.arn
}

resource "aws_backup_vault_lock_configuration" "priage" {
  backup_vault_name   = aws_backup_vault.priage.name
  changeable_for_days = 3
  min_retention_days  = 7
  max_retention_days  = 365
}

resource "aws_backup_plan" "priage" {
  name = var.name
  rule {
    rule_name                = "continuous-pitr-and-daily-retention"
    target_vault_name        = aws_backup_vault.priage.name
    schedule                 = "cron(0 5 * * ? *)"
    enable_continuous_backup = true
    lifecycle {
      cold_storage_after = 30
      delete_after       = 365
    }
  }
}

resource "aws_backup_selection" "protected_data" {
  iam_role_arn = var.backup_role_arn
  name         = "${var.name}-database-and-assets"
  plan_id      = aws_backup_plan.priage.id
  resources    = [var.database_resource_arn, aws_s3_bucket.assets.arn]
}

resource "aws_secretsmanager_secret" "backend" {
  name                    = "${var.name}/backend"
  kms_key_id              = aws_kms_key.priage.arn
  recovery_window_in_days = 30
}

output "asset_bucket" { value = aws_s3_bucket.assets.id }
output "kms_key_arn" { value = aws_kms_key.priage.arn }
output "backend_secret_arn" { value = aws_secretsmanager_secret.backend.arn }
