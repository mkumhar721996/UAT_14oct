export interface RevalidationConfig {
  secret: string;
}

export class RevalidationConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'RevalidationConfigError';
  }
}

// No fallback secret: a missing variable must never resolve to a default credential.
export function loadRevalidationConfig(env: NodeJS.ProcessEnv = process.env): RevalidationConfig {
  const secret = env.REVALIDATION_SECRET ?? '';
  if (!secret) throw new RevalidationConfigError('REVALIDATION_SECRET environment variable is required');
  return { secret };
}
