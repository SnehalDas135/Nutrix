# Nutrix Working Context

## Current Structure

- `frontend/` contains the static app: `index.html`, `styles.css`, `script.js`, and `env.js`.
- `backend/` contains API implementation files and shared helpers.
- `api/` contains thin Vercel adapter files that re-export handlers from `backend/api/`.
- `.codex/context.md` keeps a short persistence and architecture summary for future Codex sessions.

## Persistence

Nutrix uses cookie-backed persistence instead of MongoDB. The frontend writes browser cookies immediately so reload restores data even before the backend session responds.

- `frontend/script.js` stores anonymous user id, profile, and recent meals in browser cookies.
- `backend/lib/session.js` mirrors anonymous user id, profile, and recent meals in HTTP-only cookies when served through Vercel.
- `GET /api/meals` reads meals from the cookie session.
- `POST /api/meals` appends a meal to the cookie session.
- `PATCH /api/meals/:id` updates a saved meal in the cookie session.
- `GET /api/profile` reads the saved profile from cookies.
- `PUT /api/profile` stores calculated profile targets in cookies.
- `GET /api/trends?period=weekly` calculates chart data from cookie meals.

## Gemini Queue

`frontend/script.js` queues meal analysis and chat requests when Gemini returns a temporary high-demand response.

- Queued requests retry automatically with backoff.
- A yellow dot appears beside queued meal/chat UI.
- A small floating queue indicator appears while work is queued or retrying.

## Deployment

- `vercel.json` rewrites `/` and root static asset paths to `frontend/`.
- `/api/*` continues to resolve through Vercel's root `api/` directory.
- `GEMINI_API_KEY` should be configured in Vercel environment variables for deployed proxy usage.
