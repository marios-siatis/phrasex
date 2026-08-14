# ---------------------------------------------------------
# Lambda Checker ECR Repository
# ---------------------------------------------------------

resource "aws_ecr_repository" "lambda_checker" {
  name = "${local.name}-lambda-checker"
}

# ---------------------------------------------------------
# Lambda IAM Role
# ---------------------------------------------------------

data "aws_iam_policy_document" "lambda_assume" {
  statement {
    actions = [
      "sts:AssumeRole"
    ]

    principals {
      type = "Service"

      identifiers = [
        "lambda.amazonaws.com"
      ]
    }
  }
}

resource "aws_iam_role" "lambda" {
  name               = "${local.name}-lambda"
  assume_role_policy = data.aws_iam_policy_document.lambda_assume.json
}

resource "aws_iam_role_policy_attachment" "lambda_basic" {
  role = aws_iam_role.lambda.name

  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
}

# ---------------------------------------------------------
# Lambda VPC networking
# ---------------------------------------------------------

resource "aws_iam_role_policy" "lambda_vpc" {
  name = "${local.name}-lambda-vpc"
  role = aws_iam_role.lambda.id

  policy = jsonencode({
    Version = "2012-10-17"

    Statement = [
      {
        Effect = "Allow"

        Action = [
          "ec2:CreateNetworkInterface",
          "ec2:DescribeNetworkInterfaces",
          "ec2:DeleteNetworkInterface",
          "ec2:AssignPrivateIpAddresses",
          "ec2:UnassignPrivateIpAddresses"
        ]

        Resource = "*"
      }
    ]
  })
}

# ---------------------------------------------------------
# Lambda Function
# ---------------------------------------------------------

resource "aws_lambda_function" "checker" {
  function_name = "${local.name}-checker"

  package_type = "Image"

  image_uri = "${aws_ecr_repository.lambda_checker.repository_url}:latest"

  role = aws_iam_role.lambda.arn

  memory_size = 512
  timeout     = 60

  vpc_config {
    subnet_ids = aws_subnet.private[*].id

    security_group_ids = [
      aws_security_group.lambda.id
    ]
  }

  environment {
    variables = {
      DATABASE_URL = "postgresql://phrasex_admin:${random_password.database.result}@${aws_db_instance.postgres.address}:5432/phrasex?sslmode=require"

      THRESHOLD_HOURS = tostring(
        var.lambda_threshold_hours
      )

      INSTAGRAM_GRAPH_VERSION = var.lambda_instagram_graph_version
    }
  }

  depends_on = [
    aws_iam_role_policy_attachment.lambda_basic,
    aws_iam_role_policy.lambda_vpc,
    aws_db_instance.postgres
  ]
}

# ---------------------------------------------------------
# EventBridge Schedule
# ---------------------------------------------------------

resource "aws_cloudwatch_event_rule" "checker_schedule" {
  name = "${local.name}-checker-schedule"

  schedule_expression = "rate(5 minutes)"
}

resource "aws_cloudwatch_event_target" "checker_target" {
  rule = aws_cloudwatch_event_rule.checker_schedule.name
  arn  = aws_lambda_function.checker.arn
}

# ---------------------------------------------------------
# Allow EventBridge to invoke Lambda
# ---------------------------------------------------------

resource "aws_lambda_permission" "allow_events" {
  statement_id = "AllowExecutionFromCloudWatch"

  action = "lambda:InvokeFunction"

  function_name = aws_lambda_function.checker.function_name

  principal = "events.amazonaws.com"

  source_arn = aws_cloudwatch_event_rule.checker_schedule.arn
}

# ---------------------------------------------------------
# Outputs
# ---------------------------------------------------------

output "lambda_checker_ecr" {
  value = aws_ecr_repository.lambda_checker.repository_url
}