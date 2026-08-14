resource "aws_acm_certificate" "api" {
  domain_name       = "api.phrasex.com"
  validation_method = "DNS"

  lifecycle {
    create_before_destroy = true
  }
}

output "api_certificate_arn" {
  value = aws_acm_certificate.api.arn
}

output "api_certificate_validation" {
  value = {
    name  = one(aws_acm_certificate.api.domain_validation_options).resource_record_name
    type  = one(aws_acm_certificate.api.domain_validation_options).resource_record_type
    value = one(aws_acm_certificate.api.domain_validation_options).resource_record_value
  }
}