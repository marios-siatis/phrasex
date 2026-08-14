// Lambda, ECR repo, and EventBridge rule for scheduled posting checker
resource "aws_ecr_repository" "lambda_checker" {
  name = "${local.name}-lambda-checker"
}

data "aws_iam_policy_document" "lambda_assume" {
  statement {
    actions = ["sts:AssumeRole"]
    principals {
      type        = "Service"
      identifiers = ["lambda.amazonaws.com"]
    }
  }
}

resource "aws_iam_role" "lambda" {
  name               = "${local.name}-lambda"
  assume_role_policy = data.aws_iam_policy_document.lambda_assume.json
}

resource "aws_iam_role_policy_attachment" "lambda_basic" {
  role       = aws_iam_role.lambda.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
}

resource "aws_lambda_function" "checker" {
  function_name = "${local.name}-checker"
  package_type  = "Image"
  image_uri     = "${aws_ecr_repository.lambda_checker.repository_url}:latest"
  role          = aws_iam_role.lambda.arn

  environment {
    variables = {
      DATABASE_URL            = var.lambda_database_url
      THRESHOLD_HOURS         = tostring(var.lambda_threshold_hours)
      INSTAGRAM_GRAPH_VERSION = var.lambda_instagram_graph_version
    }
  }
}

resource "aws_cloudwatch_event_rule" "checker_schedule" {
  name                = "${local.name}-checker-schedule"
  schedule_expression = "rate(5 minutes)"
}

resource "aws_cloudwatch_event_target" "checker_target" {
  rule = aws_cloudwatch_event_rule.checker_schedule.name
  arn  = aws_lambda_function.checker.arn
}

resource "aws_lambda_permission" "allow_events" {
  statement_id  = "AllowExecutionFromCloudWatch"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.checker.function_name
  principal     = "events.amazonaws.com"
  source_arn    = aws_cloudwatch_event_rule.checker_schedule.arn
}

output "lambda_checker_ecr" {
  value = aws_ecr_repository.lambda_checker.repository_url
}
