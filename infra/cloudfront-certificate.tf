resource "aws_acm_certificate" "www" {
  provider = aws.us_east_1

  domain_name       = "www.phrasex.com"
  validation_method = "DNS"

  lifecycle {
    create_before_destroy = true
  }
}

output "cloudfront_certificate_arn" {
  value = aws_acm_certificate.www.arn
}

output "cloudfront_certificate_validation" {
  value = {
    name  = one(aws_acm_certificate.www.domain_validation_options).resource_record_name
    type  = one(aws_acm_certificate.www.domain_validation_options).resource_record_type
    value = one(aws_acm_certificate.www.domain_validation_options).resource_record_value
  }
}
