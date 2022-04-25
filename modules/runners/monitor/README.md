# Monitor/Alert module

Monitoring of runners and alerting feature is introduced in conjunction with Pooling feature.

This module creates the AWS resources required to monitor the runners and send alert to SNS topic. However terraform modules are always exposed and theoretically can be used anywhere. This module is seen as a strict inner module.

## Why a submodule for the monitor

The monitoring of runners is an opt-in feature. All inputs of the module are already defined on a higher level. See the mapping of the variables in [`monitor.tf`](../monitor.tf)
