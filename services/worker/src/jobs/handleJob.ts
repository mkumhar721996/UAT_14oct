import type { JobMessage } from '../queue/parseJobMessage.js';

export async function handleJob(job: JobMessage): Promise<void> {
  switch (job.jobType) {
    default:
      console.log(`[worker] received job "${job.jobType}"`, job.payload);
  }
}
