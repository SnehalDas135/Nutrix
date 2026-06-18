# Deploying Nutrix

Nutrix is a small static web app split into three files:

- `nutrix.html` for the page structure
- `styles.css` for styling
- `script.js` for app logic and API configuration

No build step, no dependencies to install. You just need to (1) add your API key and (2) put all three files somewhere they can be opened in a browser.

For deployment at a root URL like `https://your-site.com/`, most static hosts expect the HTML file to be named `index.html`. You can either rename `nutrix.html` to `index.html` before deploying, or keep the name and open the deployed page at `/nutrix.html`.

## Step 1 — Get a free Gemini API key

1. Go to https://aistudio.google.com/apikey
2. Create a new key (no credit card required for the free tier)
3. Open `script.js`, find the `CONFIG` block near the top, and paste your key in:
   ```js
   var CONFIG = {
     API_KEY: "AIza...your key here...",
     MODEL: "gemini-2.0-flash"
   };
   ```

⚠️ **Security note:** this puts your key directly in client-side JavaScript. That's fine for personal/local use where only you can see the file. If you deploy this somewhere public (a real URL anyone can visit), anyone who views page source can steal your key and run up your bill. For a public-facing deployment, use the proxy approach in Step 4 instead of pasting the key directly.

## Step 2 — Try it locally first

Just double-click `nutrix.html` or open it in Chrome/Safari/Firefox. Everything works, including AI chat and photo analysis, as long as your key is set and your browser can reach the external CDN/API URLs.

## Step 3 — Deploy for free (personal use, key embedded)

**Option A: Netlify Drop (fastest, no account needed for testing)**
1. Go to https://app.netlify.com/drop
2. Rename `nutrix.html` to `index.html`, then drag the whole project folder, including the HTML file, `styles.css`, and `script.js`, onto the page
3. You get a live URL instantly (e.g. `random-name.netlify.app`)
4. To keep it permanently, create a free Netlify account when prompted

**Option B: Vercel**
1. Install the CLI: `npm i -g vercel`
2. Rename `nutrix.html` to `index.html`, then in the folder containing the HTML file, `styles.css`, and `script.js`, run `vercel`
3. Follow the prompts — you'll get a live URL

**Option C: GitHub Pages**
1. Rename `nutrix.html` to `index.html`, then create a new GitHub repo and upload the HTML file, `styles.css`, and `script.js`
2. Go to Settings → Pages → set source to your main branch
3. Your app will be live at `https://yourusername.github.io/reponame`

Any of these takes under 5 minutes.

## Step 4 — (Recommended for public use) Hide your API key with a proxy

If you want to share the URL with others or just don't want your key sitting in plaintext, add a tiny serverless function that holds the key server-side, and have the app call that instead of Anthropic directly.

Example using a Vercel serverless function:

Create `api/gemini.js` in your project:
```js
export default async function handler(req, res) {
  const model = req.body.model || "gemini-2.0-flash";
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${process.env.GEMINI_API_KEY}`;
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(req.body.payload)
  });
  const data = await response.json();
  res.status(200).json(data);
}
```

Then in Vercel's dashboard, add `GEMINI_API_KEY` as an environment variable (Settings → Environment Variables) — never commit it to your code.

Finally, in `script.js`, change `geminiUrl()` to call `/api/gemini` instead of Google directly, and send the key only from the server.

This way the key never reaches the browser.

## Step 5 — Start using it

1. Open your deployed URL (or local file)
2. Go to the **Profile** tab, fill in your age, gender, height, weight, activity level and goal, then tap **Calculate my targets** — this sets your science-based calorie and macro targets
3. Go to **Today** and start logging meals — type a description or upload a photo
4. Check **Trends** for your daily/weekly/monthly charts
5. Use **AI Chat** any time for nutrition questions, context-aware of your targets and today's intake

## Notes on persistence

Right now the app resets its food log when you refresh the page (data lives only in memory, by design — no browser storage is used). If you want your log, profile, and history to persist across sessions, the next step would be wiring up a real backend (e.g. a database) — let me know if you want help with that.
