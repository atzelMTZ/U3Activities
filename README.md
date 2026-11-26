# Atlas Research Hub
1. `npm i` · copy `.env.example` to `.env.local` and fill it · `npm run dev`
2. The FIRST account registered becomes admin; promote others in /admin.
3. Deploy: push to GitHub, import in Vercel, add the env vars (APP_URL = your Vercel URL).
4. Sentry: `npx @sentry/wizard@latest -i nextjs`
