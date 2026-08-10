variable "project" { default = "phrasex" }
variable "environment" { default = "prod" }
variable "aws_region" { default = "eu-west-2" }
variable "pexels_api_key" { sensitive = true }
variable "jwt_key" { sensitive = true }
variable "db_instance_class" { default = "db.t4g.micro" }
variable "api_desired_count" { default = 1 }
