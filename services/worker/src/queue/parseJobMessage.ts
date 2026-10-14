export interface JobMessage {
  jobType: string;
  payload: Record<string, unknown>;
}

function isJobMessage(value: unknown): value is JobMessage {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  const candidate = value as Record<string, unknown>;
  return typeof candidate.jobType === 'string' && typeof candidate.payload === 'object' && candidate.payload !== null;
}

export function parseJobMessage(body: string): JobMessage {
  const parsed: unknown = JSON.parse(body);
  if (!isJobMessage(parsed)) {
    throw new Error('Job message must have a string "jobType" and an object "payload"');
  }
  return parsed;
}
