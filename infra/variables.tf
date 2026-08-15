variable "project" {
  type    = string
  default = "phrasex"
}

variable "environment" {
  type    = string
  default = "prod"
}

variable "aws_region" {
  type    = string
  default = "eu-west-2"
}

variable "jwt_key" {
  type      = string
  sensitive = true
}

variable "pexels_api_key" {
  type      = string
  sensitive = true
}

variable "api_desired_count" {
  type    = number
  default = 2
}

variable "lambda_threshold_hours" {
  type    = number
  default = 4
}

variable "lambda_instagram_graph_version" {
  type    = string
  default = "24.0"
}
