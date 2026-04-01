# MelFit - Catalogo de Moda Fitness

Catalogo de revenda de roupas fitness com sistema de precificacao, carrinho e checkout via WhatsApp.

## Rodando o projeto

```bash
npm install
npm run dev
```

Abra http://localhost:3000

## Senha padrao do admin

- **Usuario:** admin
- **Senha:** flora2024

## Perdeu a senha do admin?

Voce NAO precisa acessar o painel admin para recuperar. Escolha uma das opcoes:

### Opcao 1: Rodando local (seu computador)

Abra o terminal na pasta do projeto e rode:

```bash
npm run admin:reset -- sua-nova-senha
```

Reinicie o servidor (`npm run dev`). Pronto, pode logar com a nova senha.

### Opcao 2: Na Vercel (producao)

1. Abra https://vercel.com e entre no seu projeto
2. Va em **Settings** > **Environment Variables**
3. Se ja existe `ADMIN_PASSWORD_HASH`, clique em editar. Se nao, clique em **Add New**
4. Para gerar o codigo da nova senha, abra https://emn178.github.io/online-tools/sha256.html
   - Digite sua nova senha no campo "Input"
   - Copie o resultado do campo "Output" (um codigo longo com letras e numeros)
5. Na Vercel:
   - **Nome:** `ADMIN_PASSWORD_HASH`
   - **Valor:** cole o codigo que voce copiou
   - Clique em **Save**
6. Va em **Deployments** > clique nos **3 pontinhos** do deploy mais recente > **Redeploy**
7. Pronto! Acesse o site e logue com a nova senha

## Scripts disponiveis

| Comando | O que faz |
|---|---|
| `npm run dev` | Roda o servidor local |
| `npm run build` | Gera build de producao |
| `npm run scrape` | Atualiza precos e imagens do fabricante |
| `npm run scrape:details` | Busca imagens extras, estoque e medidas |
| `npm run admin:reset` | Reseta a senha admin (veja acima) |
| `npm run db:migrate` | Migra dados para o SQLite |

## Deploy na Vercel

1. Suba o projeto no GitHub
2. Importe no Vercel (https://vercel.com/new)
3. Configure as variaveis de ambiente (opcional):
   - `ADMIN_PASSWORD_HASH` - hash SHA-256 da senha admin (se quiser trocar a padrao)
   - `API_SECRET` - secret para proteger as APIs (se quiser trocar o padrao)
   - `CRON_SECRET` - gerado automaticamente pela Vercel para os cron jobs
   - `TURSO_DATABASE_URL` - URL do banco Turso (se quiser usar banco na nuvem)
   - `TURSO_AUTH_TOKEN` - token do Turso
4. Deploy! O scraping automatico roda 2x por dia (9h e 21h UTC)
