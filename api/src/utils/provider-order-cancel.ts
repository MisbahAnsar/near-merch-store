/**
 * Provider cancel is idempotent when the external order is already gone.
 * Treat these as successful cleanup so draft delete is not blocked forever.
 */
export function isProviderOrderAlreadyGone(errorMessage: string): boolean {
  const msg = errorMessage.toLowerCase();
  return (
    msg.includes("not found") ||
    msg.includes("404") ||
    msg.includes("does not exist") ||
    msg.includes("no such order") ||
    msg.includes("already cancelled") ||
    msg.includes("already canceled") ||
    msg.includes("already deleted")
  );
}
