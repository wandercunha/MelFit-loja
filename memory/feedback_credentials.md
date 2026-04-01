---
name: Never hardcode credentials
description: User credentials must be in .env.local, never in source code
type: feedback
---

Never hardcode user credentials in source code. Always use environment variables via .env.local (gitignored).

**Why:** Security best practice — credentials in code get committed to git.
**How to apply:** Use process.env.ATACADO_EMAIL / process.env.ATACADO_PASSWORD for scraper auth.
