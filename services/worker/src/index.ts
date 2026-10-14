import { loadConfig } from './config.js';
import { handleJob } from './jobs/handleJob.js';
import { SqsConsumer } from './queue/sqsConsumer.js';

async function main(): Promise<void> {
  const config = loadConfig();
  const consumer = new SqsConsumer(config, handleJob);

  console.log('[worker] started, polling job queue');

  for (;;) {
    await consumer.pollOnce();
  }
}

main().catch((error: unknown) => {
  console.error('[worker] fatal error', error);
  process.exit(1);
});
