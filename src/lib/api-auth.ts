export function isAuthorized(request: Request): boolean {
  const apiSecret = process.env.API_SECRET;
  if (!apiSecret) {
    console.error("[AUTH] API_SECRET nao configurado nas variaveis de ambiente!");
    return false;
  }

  // 1. Authorization header (preferido)
  const authHeader = request.headers.get("authorization");
  if (authHeader === `Bearer ${apiSecret}`) return true;

  // 2. Query param (retrocompativel, para migracao)
  const { searchParams } = new URL(request.url);
  const secret = searchParams.get("secret");
  if (secret === apiSecret) return true;

  // 3. Cron secret da Vercel
  if (process.env.CRON_SECRET && authHeader === `Bearer ${process.env.CRON_SECRET}`) return true;

  return false;
}
