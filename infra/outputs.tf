output "api_url" { value = "http://${aws_lb.api.dns_name}/api" }
output "frontend_url" { value = "https://${aws_cloudfront_distribution.web.domain_name}" }
output "frontend_bucket" { value = aws_s3_bucket.web.bucket }
output "api_ecr_repository" { value = aws_ecr_repository.api.repository_url }