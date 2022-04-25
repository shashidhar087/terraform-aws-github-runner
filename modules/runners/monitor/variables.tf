variable "config" {
  type = object({
    lambda = object({
      log_level                      = string
      log_type                       = string
      logging_retention_in_days      = number
      logging_kms_key_id             = string
      reserved_concurrent_executions = number
      s3_bucket                      = string
      s3_key                         = string
      s3_object_version              = string
      security_group_ids             = list(string)
      timeout                        = number
      zip                            = string
      subnet_ids                     = list(string)
    })
    tags = map(string)
    ghes = object({
      url        = string
      ssl_verify = string
    })
    github_app_parameters = object({
      key_base64 = map(string)
      id         = map(string)
    })
    subnet_ids = list(string)
    runner = object({
      owner = string
      role = object({
        arn = string
      })
    })
    environment = string
    pool = list(object({
      schedule_expression = string
      size                = number
    }))
    schedule_expression       = string
    role_permissions_boundary = string
    kms_key_arn               = string
    role_path                 = string
    cw_metric_namespace       = string
    cw_metric_name            = string
    cw_dimension_name         = string
    cw_dimension_value        = string
    cw_unit                   = string
    runner_alert_sns_protocol = string
    runner_alert_sns_endpoint = string
  })
}
variable "aws_partition" {
  description = "(optional) partition for the arn if not 'aws'"
  type        = string
  default     = "aws"
}
