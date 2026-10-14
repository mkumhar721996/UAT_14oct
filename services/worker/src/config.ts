export interface WorkerConfig {
  awsRegion: string;
  queueUrl: string;
  pollIntervalMs: number;
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): WorkerConfig {
  const queueUrl = env.JOB_QUEUE_URL ?? '';
  if (!queueUrl) {
    throw new Error('JOB_QUEUE_URL environment variable is required');
  }

  return {
    awsRegion: env.AWS_REGION ?? 'us-east-1',
    queueUrl,
    pollIntervalMs: Number(env.POLL_INTERVAL_MS ?? 5000),
  };
}
