import { putCustomMetric } from '../aws/cloudwatch';
import { listEC2Runners } from '../aws/runners';
import { createGithubAppAuth, createGithubInstallationAuth, createOctoClient } from '../gh-auth/gh-auth';
import { logger as rootLogger } from '../logger';

const logger = rootLogger.getChildLogger({ name: 'monitor' });

export interface MonitorEvent {
  metricName: string;
}

export async function monitorRunners(event: MonitorEvent): Promise<void> {
  logger.info(`Listing idle runners`);
  const environment = process.env.ENVIRONMENT;
  const ghesBaseUrl = process.env.GHES_URL;
  const runnerOwner = process.env.RUNNER_OWNER;
  const nameSpace = process.env.CW_METRIC_NAMESPACE;
  const metricName = event.metricName;
  const dimensionName = process.env.CW_DIMENSION_NAME;
  const dimensionValue = process.env.CW_DIMENSION_VALUE;
  const unit = process.env.CW_UNIT;

  let ghesApiUrl = '';
  if (ghesBaseUrl) {
    ghesApiUrl = `${ghesBaseUrl}/api/v3`;
  }

  const installationId = await getInstallationId(ghesApiUrl, runnerOwner);
  const ghAuth = await createGithubInstallationAuth(installationId, ghesApiUrl);
  const githubInstallationClient = await createOctoClient(ghAuth.token, ghesApiUrl);

  // Look up the runners registered in GitHub, could be also non managed by this module.
  const runners = await githubInstallationClient.paginate(
    githubInstallationClient.actions.listSelfHostedRunnersForOrg,
    {
      org: runnerOwner,
      per_page: 100,
    },
  );
  const idleRunners = runners.filter((r) => !r.busy && r.status === 'online').map((r) => r.name);

  // Look up the managed ec2 runners in AWS, but running does not mean idle
  const ec2runners = (
    await listEC2Runners({
      environment,
      runnerOwner,
      runnerType: 'Org',
      statuses: ['running'],
    })
  ).map((r) => r.instanceId);

  const managedIdleRunners = ec2runners.filter((r) => idleRunners.includes(r));
  logger.info(`Idle runner count is ${managedIdleRunners.length}`);

  logger.info(`Put Custom Metric Begin`);

  await putCustomMetric({
    nameSpace: nameSpace,
    metricName: metricName,
    value: managedIdleRunners.length,
    unit: unit,
    dimensionName: dimensionName,
    dimensionValue: dimensionValue,
  });
}

async function getInstallationId(ghesApiUrl: string, org: string): Promise<number> {
  const ghAuth = await createGithubAppAuth(undefined, ghesApiUrl);
  const githubClient = await createOctoClient(ghAuth.token, ghesApiUrl);

  return (
    await githubClient.apps.getOrgInstallation({
      org,
    })
  ).data.id;
}
