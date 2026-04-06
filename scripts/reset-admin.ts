/**
 * Reset da senha admin.
 *
 * Uso:
 *   npm run admin:reset -- minha-senha   → define senha customizada
 *
 * Gera o hash SHA-256 e atualiza .env.local.
 */

import { createHash } from "crypto";
import * as fs from "fs";
import * as path from "path";

const newPassword = process.argv[2];
if (!newPassword) {
  console.error("\n  Uso: npm run admin:reset -- sua-nova-senha\n");
  process.exit(1);
}
const hash = createHash("sha256").update(newPassword).digest("hex");

console.log(`\n  Reset de senha admin`);
console.log(`  ====================\n`);
console.log(`  Nova senha: ${newPassword}`);
console.log(`  Hash SHA-256: ${hash}\n`);

// Update .env.local
const envPath = path.join(__dirname, "..", ".env.local");
let envContent = "";

if (fs.existsSync(envPath)) {
  envContent = fs.readFileSync(envPath, "utf-8");
  // Remove existing ADMIN_PASSWORD_HASH line
  envContent = envContent
    .split("\n")
    .filter((line) => !line.startsWith("ADMIN_PASSWORD_HASH"))
    .join("\n")
    .trim();
}

envContent += `\nADMIN_PASSWORD_HASH=${hash}\n`;
fs.writeFileSync(envPath, envContent);

console.log(`  Salvo em .env.local`);
console.log(`  Reinicie o servidor (npm run dev) para aplicar.\n`);
console.log(`  Na Vercel: adicione ADMIN_PASSWORD_HASH=${hash} nas env vars.\n`);
