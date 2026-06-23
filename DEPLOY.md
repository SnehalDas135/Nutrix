# Deploying Nutrix

Nutrix is a static frontend with Vercel API functions:

- `frontend/index.html` for the page structure
- `frontend/styles.css` for styling
- `frontend/script.js` for app logic
- `backend/api/` for the real API implementations
- `api/` for thin Vercel adapters

No database is required. Anonymous user id, profile targets, and recent meals are stored in browser cookies through the backend endpoints.

## Step 1 - Get a Gemini API key

1. Go to https://aistudio.google.com/apikey
2. Create a new key.
3. Do not paste the key into frontend code for Vercel deployment.

Keep `frontend/env.js` like this for deployed usage:

```js
const env = {
  API_KEY: "",
  MODEL: "gemini-2.5-flash-lite"
};
```

## Step 2 - Add the key in Vercel

In Vercel Dashboard:

1. Open your project.
2. Go to Settings -> Environment Variables.
3. Add `GEMINI_API_KEY`.
4. Select Production, Preview, and Development.
5. Save, then redeploy.

## Step 3 - Deploy on Vercel

1. Install the CLI: `npm i -g vercel`
2. Run `vercel`
3. Follow the prompts.
4. Redeploy after adding `GEMINI_API_KEY`.

## Step 4 - Test locally with Vercel envs

1. Run `vercel link`
2. Run `vercel env pull .env.local`
3. Run `vercel dev`
4. Open the local Vercel URL.

## Notes on persistence

The app now uses cookie-backed persistence instead of MongoDB. Meal logs are saved through `POST /api/meals`, profile targets through `PUT /api/profile`, and trends are calculated from the saved cookie meals through `GET /api/trends?period=weekly`.
