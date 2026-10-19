export function isValidRevalidationToken(token: string | undefined, env: NodeJS.ProcessEnv = process.env): boolean {
  const expected = env.REVALIDATION_TOKEN ?? '';
  return expected.length > 0 && token === expected;
}
