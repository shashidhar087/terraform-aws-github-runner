import { CloudWatch } from '@aws-sdk/client-cloudwatch';

import { logger as rootLogger } from '../logger';

const logger = rootLogger.getChildLogger({ name: 'cloudwatch' });

export interface CustomMetricParams {
  nameSpace?: string;
  metricName?: string;
  value?: number;
  unit?: string;
  dimensionName?: string;
  dimensionValue?: string;
}

export async function putCustomMetric(metricParams: CustomMetricParams): Promise<void> {
  const client = new CloudWatch({ region: process.env.AWS_REGION });

  try {
    await client.putMetricData({
      MetricData: [
        {
          MetricName: metricParams.metricName,
          Value: metricParams.value,
          Unit: metricParams.unit,
          Dimensions: [
            {
              Name: metricParams.dimensionName,
              Value: metricParams.dimensionValue,
            },
          ],
        },
      ],
      Namespace: metricParams.nameSpace,
    });
    logger.info(`Put Custom Metric Done`);
  } catch (e) {
    logger.warn('Put metric data failed.', e);
    throw e;
  }
}
