export function errorDetails(error: unknown, fallback: string, secret?: string): string {
  const value = error as { message?: unknown; statusCode?: unknown; cause?: unknown } | null;
  const message = typeof error === "string" ? error : value?.message;
  const cause = value?.cause instanceof Error ? value.cause.message : undefined;
  const detail = [
    typeof value?.statusCode === "number" ? `HTTP ${value.statusCode}` : undefined,
    typeof message === "string" && message.trim() ? message : fallback,
    cause && cause !== message ? cause : undefined,
  ].filter(Boolean).join("\n");

  return (secret ? detail.replaceAll(secret, "[redacted]") : detail)
    .replace(/\bBearer\s+[\w.+/=-]+/gi, "Bearer [redacted]")
    .slice(0, 4000);
}
