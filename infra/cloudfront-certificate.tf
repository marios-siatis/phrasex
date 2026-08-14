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
    name  = aws_acm_certificate.www.domain_validation_options[0].resource_record_name
    type  = aws_acm_certificate.www.domain_validation_options[0].resource_record_type
    value = aws_acm_certificate.www.domain_validation_options[0].resource_record_value
  }
}
