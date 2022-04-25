import { Octokit } from '@octokit/rest';
import { mocked } from 'jest-mock';
import nock from 'nock';

import * as metric from '../aws/cloudwatch';
import { listEC2Runners } from '../aws/runners';
import * as ghAuth from '../gh-auth/gh-auth';
import { monitorRunners } from '../monitor/monitor-runner';

const mockOctokit = {
  paginate: jest.fn(),
  checks: { get: jest.fn() },
  actions: {
    createRegistrationTokenForOrg: jest.fn(),
  },
  apps: {
    getOrgInstallation: jest.fn(),
  },
};

jest.mock('@octokit/rest', () => ({
  Octokit: jest.fn().mockImplementation(() => mockOctokit),
}));

jest.mock('./../aws/runners');
jest.mock('./../gh-auth/gh-auth');
jest.mock('./../aws/cloudwatch');

const mocktokit = Octokit as jest.MockedClass<typeof Octokit>;
const mockedAppAuth = mocked(ghAuth.createGithubAppAuth, true);
const mockedInstallationAuth = mocked(ghAuth.createGithubInstallationAuth, true);
const mockCreateClient = mocked(ghAuth.createOctoClient, true);
const mockListRunners = mocked(listEC2Runners);

const cleanEnv = process.env;

const ORG = 'my-org';

beforeEach(() => {
  nock.disableNetConnect();
  jest.resetModules();
  jest.clearAllMocks();
  process.env = { ...cleanEnv };
  process.env.GITHUB_APP_KEY_BASE64 = 'TEST_CERTIFICATE_DATA';
  process.env.GITHUB_APP_ID = '1337';
  process.env.GITHUB_APP_CLIENT_ID = 'TEST_CLIENT_ID';
  process.env.GITHUB_APP_CLIENT_SECRET = 'TEST_CLIENT_SECRET';
  process.env.ENVIRONMENT = 'unit-test-environment';
  process.env.ENABLE_ORGANIZATION_RUNNERS = 'true';
  process.env.RUNNER_OWNER = ORG;
  process.env.CW_METRIC_NAMESPACE = 'DJ/github_runners';
  process.env.CW_METRIC_NAME = 'runner_count';
  process.env.CW_DIMENSION_NAME = 'Runner_Name';
  process.env.CW_DIMENSION_VALUE = 'test-runner';
  process.env.CW_UNIT = 'Count';

  const mockTokenReturnValue = {
    data: {
      token: '1234abcd',
    },
  };
  mockOctokit.actions.createRegistrationTokenForOrg.mockImplementation(() => mockTokenReturnValue);

  mockOctokit.paginate.mockImplementation(() => [
    {
      id: 1,
      name: 'i-1',
      os: 'linux',
      status: 'online',
      busy: false,
      labels: [],
    },
    {
      id: 2,
      name: 'i-2',
      os: 'linux',
      status: 'online',
      busy: true,
      labels: [],
    },
    {
      id: 3,
      name: 'i-3',
      os: 'linux',
      status: 'offline',
      busy: false,
      labels: [],
    },
    {
      id: 11,
      name: 'j-1', // some runner of another env
      os: 'linux',
      status: 'online',
      busy: false,
      labels: [],
    },
    {
      id: 12,
      name: 'j-2', // some runner of another env
      os: 'linux',
      status: 'online',
      busy: true,
      labels: [],
    },
  ]);

  mockListRunners.mockImplementation(async () => [
    {
      instanceId: 'i-1',
      launchTime: new Date(),
      type: 'Org',
      owner: ORG,
    },
    {
      instanceId: 'i-2',
      launchTime: new Date(),
      type: 'Org',
      owner: ORG,
    },
    {
      instanceId: 'i-3',
      launchTime: new Date(),
      type: 'Org',
      owner: ORG,
    },
  ]);

  const mockInstallationIdReturnValueOrgs = {
    data: {
      id: 1,
    },
  };
  mockOctokit.apps.getOrgInstallation.mockImplementation(() => mockInstallationIdReturnValueOrgs);

  mockedAppAuth.mockResolvedValue({
    type: 'app',
    token: 'token',
    appId: 1,
    expiresAt: 'some-date',
  });
  mockedInstallationAuth.mockResolvedValue({
    type: 'token',
    tokenType: 'installation',
    token: 'token',
    createdAt: 'some-date',
    expiresAt: 'some-date',
    permissions: {},
    repositorySelection: 'all',
    installationId: 0,
  });

  mockCreateClient.mockResolvedValue(new mocktokit());
});

describe('Test Monitor Runners.', () => {
  describe('With GitHub Cloud', () => {
    it('Monitors Runners.', async () => {
      const spy = jest.spyOn(metric, 'putCustomMetric');
      await expect(monitorRunners({ metricName: 'test-runner-metric' })).resolves;
      expect(spy).toBeCalled;
    });
  });

  describe('With GHES', () => {
    beforeEach(() => {
      process.env.GHES_URL = 'https://github.enterprise.something';
    });

    it('Monitors Runners.', async () => {
      const spy = jest.spyOn(metric, 'putCustomMetric');
      await expect(monitorRunners({ metricName: 'test-runner-metric' })).resolves;
      expect(spy).toBeCalled;
    });
  });
});
