# Deploying Nutrix


Nutrix is a small static web app with one Vercel API function:

- `nutrix.html` for the page structure
- `styles.css` for styling
- `script.js` for app logic and API configuration
- `api/gemini.js` for the server-side Gemini proxy on Vercel

No build step, no dependencies to install.

For deployment at a root URL like `https://your-site.com/`, most static hosts expect the HTML file to be named `index.html`. You can either rename `nutrix.html` to `index.html` before deploying, or keep the name and open the deployed page at `/nutrix.html`.

## Step 1 — Get a free Gemini API key

1. Go to https://aistudio.google.com/apikey
2. Create a new key (no credit card required for the free tier)
3. Do not paste the key into `env.js` for Vercel deployment.

Keep `env.js` like this:
```js
const env = {
  API_KEY: "",
  MODEL: "gemini-2.5-flash-lite"
};
```

## Step 2 — Add the key in Vercel

In Vercel Dashboard:

1. Open your project
2. Go to Settings → Environment Variables
3. Add `GEMINI_API_KEY`
4. Paste your Gemini API key as the value
5. Select Production, Preview, and Development
6. Save, then redeploy

<<<<<<< HEAD
## Backend database setup

The Trends page now reads from MongoDB through backend endpoints. Add this environment variable in Vercel and in `.env.local` for local testing:

```txt
DATABASE_URL=mongodb+srv://...
```

The app uses the `nutrix` database and creates/reads these collections:

- `users` for anonymous browser sessions
- `profiles` for saved profile targets
- `meals` for logged meals used by Trends

Meal logs are saved through `POST /api/meals`, and Trends loads aggregated chart data from `GET /api/trends?userId=...&period=weekly`.

=======
>>>>>>> 31a8d0f55f4ef128f2b2f8cbc9b444d70dd662b1
## Step 3 — Deploy on Vercel

1. Install the CLI: `npm i -g vercel`
2. Rename `nutrix.html` to `index.html`, or open the deployed page at `/nutrix.html`
3. Run `vercel`
4. Follow the prompts
5. Redeploy after adding `GEMINI_API_KEY`

## Step 4 — Test locally with Vercel envs

If you want to test the proxy locally:

1. Run `vercel link`
2. Run `vercel env pull .env.local`
3. Run `vercel dev`
4. Open the local Vercel URL

## Step 5 — Start using it

1. Open your deployed URL (or local file)
2. Go to the **Profile** tab, fill in your age, gender, height, weight, activity level and goal, then tap **Calculate my targets** — this sets your science-based calorie and macro targets
3. Go to **Today** and start logging meals — type a description or upload a photo
4. Check **Trends** for your daily/weekly/monthly charts
5. Use **AI Chat** any time for nutrition questions, context-aware of your targets and today's intake

## Notes on persistence

Right now the app resets its food log when you refresh the page (data lives only in memory, by design — no browser storage is used). If you want your log, profile, and history to persist across sessions, the next step would be wiring up a real backend (e.g. a database) — let me know if you want help with that.
