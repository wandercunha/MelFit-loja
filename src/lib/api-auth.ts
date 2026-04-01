export function isAuthorized(request: Request): boolean {
  const { searchParams } = new URL(request.url);
  const secret = searchParams.get("secret");
  const apiSecret = process.env.API_SECRET || "melfit2024";

  // Check query param
  if (secret === apiSecret) return true;

  // Check Authorization header (for cron jobs)
  const authHeader = request.headers.get("authorization");
  if (authHeader === `Bearer ${process.env.CRON_SECRET}`) return true;

  return false;
}
