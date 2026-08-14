variable "project" { default = "phrasex" }
variable "environment" { default = "prod" }
variable "aws_region" { default = "eu-west-2" }
variable "pexels_api_key" { sensitive = true }
variable "jwt_key" { sensitive = true }
variable "db_instance_class" { default = "db.t4g.micro" }
variable "api_desired_count" { default = 1 }

variable "lambda_database_url" {
  description = "Database URL used by the scheduler lambda (overrides default)."
  default     = ""
}

variable "lambda_threshold_hours" {
  description = "How many hours ahead of now the checker should look for scheduled posts."
  default     = 1
}

variable "lambda_instagram_graph_version" {
  description = "Instagram Graph API version used by the checker"
  default     = "16.0"
}
