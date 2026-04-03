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
CRON_SECRET=...                  # gerado pela Vercel para cron jobs
ATACADO_EMAIL=...                # email de login no atacado (opcional)
ATACADO_PASSWORD=...             # senha do atacado (opcional)
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

## Scripts de scraping

> **Para o dia a dia, use apenas `npm run scrape:all`** — ele faz tudo e sincroniza com o Turso (Vercel atualiza sem deploy).

| Comando | O que faz | Fonte | Dados capturados |
|---|---|---|---|
| `npm run scrape:all` | **Roda tudo em sequencia** | atacado + varejo | Tudo abaixo + sync Turso |
| `npm run scrape:atacado` | Imagens + estoque | floraamaratacado.com.br | Imagens, estoque por tamanho, preco custo |
| `npm run scrape` | Precos do varejo | floraamar.com.br | **Somente precos** (SEM imagens!) |
| `npm run scrape:sync` | Envia JSONs para o Turso | arquivos locais | Nenhum (apenas sincroniza) |
| `npm run scrape:details` | **DESATIVADO** | — | — |
| `npm run scrape:info` | Specs tecnicas (opcional) | floraamaratacado.com.br | Composicao, tecnologia, compressao |

### Como funciona

O `scrape:all` roda 3 scripts em sequencia:

1. **scrape:atacado** — Varre 8 categorias do atacado. Captura imagens do CDN (sem marca/logo), estoque por tamanho (P/M/G) e preco de custo. Apos as listagens, abre cada pagina de produto para galeria completa. Salva em `atacado-details.json` e sincroniza com o Turso.

2. **scrape** (precos varejo) — Varre 6 categorias do varejo. Captura **somente precos** de venda ao consumidor (para referencia na coluna "Varejo" do admin). **NAO captura imagens do varejo** (tem marca). Salva em `scrape-maps.json` e sincroniza com o Turso.

3. **scrape:sync** — Envia os JSONs locais para o Turso (redundancia caso os scripts acima nao consigam sincronizar).

### Regras OBRIGATORIAS

Do site de **varejo** (floraamar.com.br) capturamos **ESTRITAMENTE SOMENTE PREÇO**.
E PROIBIDO capturar do varejo: imagens, estoque, nomes, descricoes ou qualquer outro dado.

- **Imagens**: SOMENTE do atacado (CDN sem marca/logo)
- **Estoque**: SOMENTE do atacado
- **Precos varejo**: somente para referencia/comparacao (coluna "Varejo" no admin)
- **Nome Flora Amar**: NUNCA deve aparecer no site publico
- **Delay**: controlado por `SCRAPE_DELAY` no `.env.local` (padrao: 5000ms). Nao diminua muito.
- **CloudFront**: pode bloquear requests de servidor. Rode local (IP residencial) se o cron da Vercel falhar.

### Cron automatico (Vercel)

O endpoint `GET /api/scrape` roda diariamente as 9h (configurado em `vercel.json`).
Captura estoque do atacado + precos do varejo e salva direto no Turso.
Se o CloudFront bloquear, os dados ficam com a data antiga e o dashboard admin mostra um alerta.

### Fluxo de dados

```
Scrape (local ou cron) → Turso (banco) → App le em runtime via /api/catalog-data
                                          ↓ fallback se Turso vazio
                                     JSONs estaticos (src/data/)
```

Nao precisa de redeploy para atualizar estoque, precos ou imagens.

## Outros scripts

| Comando | O que faz |
|---|---|
| `npm run dev` | Roda o servidor local |
| `npm run build` | Gera build de producao |
| `npm run admin:reset` | Reseta a senha admin |
| `npm run db:migrate` | Migra dados para o SQLite |

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

O scraper mostra `[OVERRIDE]` no log quando usa um slug manual.

## Seguranca

- Secrets **nunca** ficam no codigo — sempre em variaveis de ambiente
- APIs protegidas por `Authorization: Bearer` header
- POST de pedidos tem rate limiting (5 pedidos/min por IP)
- Input de clientes validado (email, telefone, tamanho de strings)
- Senha admin armazenada como hash SHA-256 (nunca em texto)
- **Nenhuma referencia ao fornecedor** no site publico (somente na area admin)

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
4. **Configure o banco Turso (OBRIGATORIO para pedidos e dados dinamicos):**
   - Crie gratis em https://turso.tech
   - `turso db create melfit`
   - `turso db tokens create melfit`
   - `TURSO_DATABASE_URL` — URL do banco (ex: `libsql://melfit-usuario.turso.io`)
   - `TURSO_AUTH_TOKEN` — token gerado
5. Opcional:
   - `CRON_SECRET` — gerado pela Vercel para cron jobs
   - `SCRAPE_DELAY` — delay do scraper (padrao 5000ms)
6. Deploy!

## Estrutura de dados

| Arquivo | O que guarda |
|---|---|
| `src/data/products.ts` | Catalogo de produtos (custo atacado, categorias, tags) |
| `src/data/atacado-details.json` | Imagens, estoque e precos do atacado |
| `src/data/scrape-maps.json` | Mapa de precos do varejo (somente precos, sem imagens) |
| `src/data/product-details.json` | Tabela de medidas e estoque fallback do varejo |
| `src/data/product-info.json` | Specs tecnicas (composicao, tecnologia) |
| `src/data/url-overrides.json` | Mapeamento manual de URLs varejo/atacado |
| `src/data/price-history.json` | Historico de mudancas de precos |
