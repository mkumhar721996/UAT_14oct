import { describe, expect, it } from 'vitest';
import { loadConfig } from './config.js';

describe('loadConfig', () => {
  it('reads values from the environment', () => {
    const config = loadConfig({
      JOB_QUEUE_URL: 'https://sqs.example.com/queue',
      AWS_REGION: 'us-west-2',
      POLL_INTERVAL_MS: '1000',
    });

    expect(config).toEqual({
      awsRegion: 'us-west-2',
      queueUrl: 'https://sqs.example.com/queue',
      pollIntervalMs: 1000,
    });
  });

  it('throws when the queue URL is missing', () => {
    expect(() => loadConfig({})).toThrow(/JOB_QUEUE_URL/);
  });
});
