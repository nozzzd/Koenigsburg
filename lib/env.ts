/**
 * Lazy env accessor: values are read at request time, not module load,
 * so `next build` succeeds without secrets present.
 */
export function env(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}
