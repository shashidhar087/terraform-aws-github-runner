module "monitor" {
  count = var.enable_runner_monitor == 0 ? 0 : 1

  source = "./monitor"

  config = {
    environment = var.environment
    ghes = {
      ssl_verify = var.ghes_ssl_verify
      url        = var.ghes_url
    }
    github_app_parameters = var.github_app_parameters
    kms_key_arn           = local.kms_key_arn
    lambda = {
      log_level                      = var.log_level
      log_type                       = var.log_type
      logging_retention_in_days      = var.logging_retention_in_days
      logging_kms_key_id             = var.logging_kms_key_id
      reserved_concurrent_executions = var.pool_lambda_reserved_concurrent_executions
      s3_bucket                      = var.lambda_s3_bucket
      s3_key                         = var.runners_lambda_s3_key
      s3_object_version              = var.runners_lambda_s3_object_version
      security_group_ids             = var.lambda_security_group_ids
      subnet_ids                     = var.lambda_subnet_ids
      timeout                        = var.pool_lambda_timeout
      zip                            = local.lambda_zip
    }
    schedule_expression       = var.monitor_schedule_expression
    role_path                 = local.role_path
    role_permissions_boundary = var.role_permissions_boundary
    cw_metric_namespace       = var.cw_metric_namespace
    cw_metric_name            = var.cw_metric_name
    cw_dimension_name         = var.cw_dimension_name
    cw_dimension_value        = var.cw_dimension_value
    cw_unit                   = var.cw_unit
    runner_alert_sns_protocol = var.runner_alert_sns_protocol
    runner_alert_sns_endpoint = var.runner_alert_sns_endpoint
    runner = {
      owner = var.pool_runner_owner
      role  = aws_iam_role.runner
    }
    pool       = var.pool_config
    subnet_ids = var.subnet_ids
    tags       = local.tags
  }

  aws_partition = var.aws_partition

}
