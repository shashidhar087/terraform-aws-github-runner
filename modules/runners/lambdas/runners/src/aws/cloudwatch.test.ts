import nock from 'nock';

import { putCustomMetric } from './cloudwatch';

jest.mock('@aws-sdk/client-cloudwatch');

const cleanEnv = process.env;

beforeEach(() => {
  jest.resetModules();
  jest.clearAllMocks();
  process.env = { ...cleanEnv };
  nock.disableNetConnect();
});

describe('Test putCustomMetric', () => {
  test('Puts custom metric', async () => {
    // Arrange
    await expect(
      putCustomMetric({
        nameSpace: 'DJ/github_runners',
        metricName: 'runner_count',
        value: 5,
        unit: 'Count',
        dimensionName: 'Runner_Name',
        dimensionValue: 'test-runner',
      }),
    ).resolves.toBe(undefined);
  });
});
