# MelFit - Catalogo de Moda Fitness

Catalogo de revenda de roupas fitness com sistema de precificacao, carrinho e checkout via WhatsApp.

## Rodando o projeto

```bash
npm install
cp .env.example .env.local   # depois preencha os valores (veja abaixo)
npm run dev
```

Abra http://localhost:3000

## Configuracao obrigatoria (.env.local)

Sem essas variaveis o login e as APIs **nao funcionam**:

```bash
# Gere com: npm run admin:reset -- sua-senha (o hash aparece no terminal)
ADMIN_PASSWORD_HASH=hash-sha256-da-sua-senha

# Gere com: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
API_SECRET=valor-aleatorio-gerado
```

Opcionais:

```bash
SCRAPE_DELAY=2000              # delay entre requests do scraper (ms, padrao: 5000)
TURSO_DATABASE_URL=libsql://...  # banco na nuvem (necessario na Vercel)
TURSO_AUTH_TOKEN=...             # token do Turso
CRON_SECRET=...                  # gerado pela Vercel automaticamente
```

## Senha padrao do admin

- **Usuario:** admin
- **Senha:** flora2024

> Troque a senha antes de publicar! Rode `npm run admin:reset -- nova-senha`

## Perdeu a senha do admin?

### Opcao 1: Rodando local

```bash
npm run admin:reset -- sua-nova-senha
```

Reinicie o servidor. Pronto.

### Opcao 2: Na Vercel (producao)

1. Abra https://vercel.com > seu projeto > **Settings** > **Environment Variables**
2. Edite `ADMIN_PASSWORD_HASH` com o novo hash
   - Para gerar: abra https://emn178.github.io/online-tools/sha256.html, digite a senha, copie o resultado
3. **Deployments** > 3 pontinhos > **Redeploy**

## Scripts disponiveis

| Comando | O que faz |
|---|---|
| `npm run dev` | Roda o servidor local |
| `npm run build` | Gera build de producao |
| `npm run scrape` | Atualiza precos e imagens do varejo (rode local!) |
| `npm run scrape:details` | Busca imagens extras, estoque e medidas |
| `npm run admin:reset` | Reseta a senha admin |
| `npm run db:migrate` | Migra dados para o SQLite |

### Sobre o scraping

O scraper busca precos do site de varejo (floraamar.com.br) para referencia.
**Deve ser rodado no seu computador** (IP residencial) porque o CloudFront bloqueia servidores.

O `npm run scrape` roda em 5 fases com logs detalhados:

1. **Categorias** — busca nas paginas de listagem (tops, shorts, etc)
2. **Imagens** — busca fotos faltantes em paginas individuais
3. **Pecas avulsas** — busca produtos do catalogo nao encontrados nas listagens
4. **Pecas de conjuntos** — desmembra conjuntos e busca preco de cada peca
5. **Overrides manuais** — busca URLs configuradas em `url-overrides.json`

O delay entre requests e controlado pela variavel `SCRAPE_DELAY` no `.env.local` (padrao: 5000ms).
Nao diminua muito para nao sobrecarregar o site do fornecedor.

## URL Overrides (mapeamento manual)

Quando o scraper nao encontra um produto automaticamente (nome diferente no varejo),
edite `src/data/url-overrides.json`:

```json
{
  "products": {
    "Nome Do Produto No Catalogo": {
      "varejoSlug": "slug-correto-no-varejo"
    }
  }
}
```

Exemplo real:
```json
{
  "products": {
    "Conjunto Top Basic Duplo e Short Basic Coffee": {
      "varejoSlug": "conjunto-basic-top-short-coffee"
    }
  }
}
```

O scraper mostra `[OVERRIDE]` no log quando usa um slug manual.

## Seguranca

- Secrets **nunca** ficam no codigo — sempre em variaveis de ambiente
- APIs protegidas por `Authorization: Bearer` header
- POST de pedidos tem rate limiting (5 pedidos/min por IP)
- Input de clientes validado (email, telefone, tamanho de strings)
- Senha admin armazenada como hash SHA-256 (nunca em texto)

## Modelo de precos

Cascata de prioridade para margem e frete:

```
Override individual do produto > Override da categoria > Valor global
```

Formulas:
- **Preco cartao** = custo × (1 + margem%) × (1 + taxaCartao%)
- **Preco PIX** = preco cartao × (1 - descontoPIX%)
- **Lucro** = custo × (1 + margem%) - custo - frete

## Deploy na Vercel

1. Suba o projeto no GitHub
2. Importe no Vercel (https://vercel.com/new)
3. **Configure as variaveis de ambiente (OBRIGATORIO):**
   - `ADMIN_PASSWORD_HASH` — hash SHA-256 da senha admin
   - `API_SECRET` — secret para proteger as APIs
4. **Configure o banco Turso (OBRIGATORIO para pedidos):**
   - Crie gratis em https://turso.tech
   - `turso db create melfit`
   - `turso db tokens create melfit`
   - `TURSO_DATABASE_URL` — URL do banco (ex: `libsql://melfit-usuario.turso.io`)
   - `TURSO_AUTH_TOKEN` — token gerado
5. Opcional:
   - `CRON_SECRET` — gerado pela Vercel para cron jobs
   - `SCRAPE_DELAY` — delay do scraper (padrao 5000ms)
6. Deploy!

> O scraping via cron (2x/dia) pode falhar se o CloudFront bloquear.
> Nesse caso, rode `npm run scrape` localmente e faca push dos JSONs atualizados.

## Estrutura de dados

| Arquivo | O que guarda |
|---|---|
| `src/data/products.ts` | Catalogo de produtos (custo atacado, categorias, tags) |
| `src/data/scraped-prices.json` | Precos e imagens do varejo (atualizado pelo scraper) |
| `src/data/scrape-maps.json` | Mapas rapidos nome→preco e nome→imagem |
| `src/data/atacado-details.json` | Detalhes do atacado (slugs, estoque, galerias) |
| `src/data/url-overrides.json` | Mapeamento manual de URLs varejo/atacado |
| `src/data/price-history.json` | Historico de mudancas de precos |
| `data/melfit.db` | Banco SQLite local (gitignored) |
