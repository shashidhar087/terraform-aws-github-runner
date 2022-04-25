resource "aws_lambda_function" "monitor" {

  s3_bucket                      = var.config.lambda.s3_bucket != null ? var.config.lambda.s3_bucket : null
  s3_key                         = var.config.lambda.s3_key != null ? var.config.lambda.s3_key : null
  s3_object_version              = var.config.lambda.s3_object_version != null ? var.config.lambda.s3_object_version : null
  filename                       = var.config.lambda.s3_bucket == null ? var.config.lambda.zip : null
  source_code_hash               = var.config.lambda.s3_bucket == null ? filebase64sha256(var.config.lambda.zip) : null
  function_name                  = "${var.config.environment}-monitor-ghrunners"
  role                           = aws_iam_role.monitor.arn
  handler                        = "index.monitorRunner"
  runtime                        = "nodejs14.x"
  timeout                        = var.config.lambda.timeout
  reserved_concurrent_executions = var.config.lambda.reserved_concurrent_executions
  memory_size                    = 512
  tags                           = var.config.tags

  environment {
    variables = {
      ENVIRONMENT                          = var.config.environment
      GHES_URL                             = var.config.ghes.url
      LOG_LEVEL                            = var.config.lambda.log_level
      LOG_TYPE                             = var.config.lambda.log_type
      NODE_TLS_REJECT_UNAUTHORIZED         = var.config.ghes.url != null && !var.config.ghes.ssl_verify ? 0 : 1
      PARAMETER_GITHUB_APP_ID_NAME         = var.config.github_app_parameters.id.name
      PARAMETER_GITHUB_APP_KEY_BASE64_NAME = var.config.github_app_parameters.key_base64.name
      RUNNER_OWNER                         = var.config.runner.owner
      CW_METRIC_NAMESPACE                  = var.config.cw_metric_namespace
      CW_METRIC_NAME                       = var.config.cw_metric_name
      CW_DIMENSION_NAME                    = var.config.cw_dimension_name
      CW_DIMENSION_VALUE                   = var.config.cw_dimension_value
      CW_UNIT                              = var.config.cw_unit
    }
  }

  dynamic "vpc_config" {
    for_each = var.config.lambda.subnet_ids != null && var.config.lambda.security_group_ids != null ? [true] : []
    content {
      security_group_ids = var.config.lambda.security_group_ids
      subnet_ids         = var.config.lambda.subnet_ids
    }
  }
}

resource "aws_cloudwatch_log_group" "monitor" {
  name              = "/aws/lambda/${aws_lambda_function.monitor.function_name}"
  retention_in_days = var.config.lambda.logging_retention_in_days
  kms_key_id        = var.config.lambda.logging_kms_key_id
  tags              = var.config.tags
}

resource "aws_iam_role" "monitor" {
  name                 = "${var.config.environment}-action-monitor-lambda-role"
  assume_role_policy   = data.aws_iam_policy_document.lambda_assume_role_policy.json
  path                 = var.config.role_path
  permissions_boundary = var.config.role_permissions_boundary
  tags                 = var.config.tags
}

resource "aws_iam_role_policy" "monitor" {
  name = "${var.config.environment}-lambda-monitor-policy"
  role = aws_iam_role.monitor.name
  policy = templatefile("${path.module}/policies/lambda-monitor.json", {
    arn_runner_instance_role  = var.config.runner.role.arn
    github_app_id_arn         = var.config.github_app_parameters.id.arn
    github_app_key_base64_arn = var.config.github_app_parameters.key_base64.arn
    kms_key_arn               = var.config.kms_key_arn
  })
}

resource "aws_iam_role_policy" "monitor_logging" {
  name = "${var.config.environment}-lambda-logging"
  role = aws_iam_role.monitor.name
  policy = templatefile("${path.module}/../policies/lambda-cloudwatch.json", {
    log_group_arn = aws_cloudwatch_log_group.monitor.arn
  })
}

resource "aws_iam_role_policy_attachment" "monitor_vpc_execution_role" {
  count      = length(var.config.lambda.subnet_ids) > 0 ? 1 : 0
  role       = aws_iam_role.monitor.name
  policy_arn = "arn:${var.aws_partition}:iam::aws:policy/service-role/AWSLambdaVPCAccessExecutionRole"
}

data "aws_iam_policy_document" "lambda_assume_role_policy" {
  statement {
    actions = ["sts:AssumeRole"]

    principals {
      type        = "Service"
      identifiers = ["lambda.amazonaws.com"]
    }
  }
}

# per config object one trigger is created to trigger the lambda.
resource "aws_cloudwatch_event_rule" "monitor" {
  count               = length(var.config.pool)
  name                = "${var.config.environment}-monitor-${count.index}-rule"
  schedule_expression = var.config.pool[count.index].schedule_expression
  tags                = var.config.tags
}

resource "aws_cloudwatch_event_target" "monitor" {
  count = length(var.config.pool)

  input = jsonencode({
    metricName = aws_cloudwatch_metric_alarm.runner_alert_alarm[count.index].metric_name
  })
  rule = aws_cloudwatch_event_rule.monitor[count.index].name
  arn  = aws_lambda_function.monitor.arn
}

resource "aws_lambda_permission" "monitor" {
  count = length(var.config.pool)

  statement_id  = "AllowExecutionFromCloudWatch-${count.index}"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.monitor.function_name
  principal     = "events.amazonaws.com"
  source_arn    = aws_cloudwatch_event_rule.monitor[count.index].arn
}

resource "aws_sns_topic" "runner_alert_topic" {
  name = "${var.config.environment}-runner-opsgenie-alert"
  tags = var.config.tags
}

resource "aws_sns_topic_subscription" "runner_alert_subscribe" {
  topic_arn = aws_sns_topic.runner_alert_topic.arn
  protocol  = var.config.runner_alert_sns_protocol
  endpoint  = var.config.runner_alert_sns_endpoint
}

resource "aws_cloudwatch_metric_alarm" "runner_alert_alarm" {
  count = length(var.config.pool)

  alarm_name          = "${var.config.environment}-runner-alarm-${count.index}"
  comparison_operator = "LessThanThreshold"
  evaluation_periods  = "2"
  metric_name         = "${var.config.cw_metric_name}-${count.index}"
  namespace           = var.config.cw_metric_namespace
  period              = "300"
  statistic           = "Minimum"
  threshold           = ceil(var.config.pool[count.index].size / 4)
  alarm_description   = "This metric monitors idle runner count"
  actions_enabled     = "true"
  alarm_actions       = [aws_sns_topic.runner_alert_topic.arn]
  ok_actions          = [aws_sns_topic.runner_alert_topic.arn]
  dimensions = {
    "${var.config.cw_dimension_name}" = "${var.config.cw_dimension_value}"
  }
  tags = var.config.tags
}
