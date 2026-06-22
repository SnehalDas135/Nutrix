# Nutrix Backend Working Notes

This document is the backend work plan for Nutrix. The project started as a static frontend with one Vercel API function that proxies Gemini requests. The backend now has MongoDB helpers, anonymous users, profile persistence, meal writes, and a database-backed Trends API.

## 1. Current Project State

### Files that matter for backend

- `api/gemini.js`
  - Existing Vercel serverless function.
  - Accepts only `POST`.
  - Reads `GEMINI_API_KEY` from server environment variables.
  - Sends the request payload to the Gemini `generateContent` endpoint.
  - Allows only a small model allowlist.

- `script.js`
  - Contains the browser state and chart rendering.
  - Calls `/api/gemini` when `env.API_KEY` is empty.
  - Calls Gemini directly from the browser when `env.API_KEY` is filled.
  - Saves logged meals through `/api/meals`.
  - Loads Trends data through `/api/trends`.

- `env.js`
  - Local frontend config.
  - Should not contain real production secrets.
  - If a real Gemini key was committed or shared, rotate it before deployment.

- `DEPLOY.md`
  - Explains current Vercel deployment flow.
  - Notes the required MongoDB `DATABASE_URL`.

- `api/server.js`
  - Express app used by the current `vercel.json` catch-all route.
  - Exposes health, anonymous user, profile, meals, and trends routes.

- `lib/db.js`
  - Connects to MongoDB using `DATABASE_URL`.
  - Uses the `nutrix` database.

- `lib/trends.js`
  - Aggregates meal records into daily, weekly, and monthly chart data.

### Current backend behavior

Core backend endpoints now include:

```txt
GET /api/health
POST /api/users/anonymous
GET /api/profile?userId=...
PUT /api/profile
POST /api/meals
PATCH /api/meals/:id
GET /api/trends?userId=...&period=weekly
POST /api/gemini
```

Request shape used by the frontend:

```json
{
  "model": "gemini-2.5-flash-lite",
  "payload": {
    "contents": [],
    "generationConfig": {
      "maxOutputTokens": 1000
    }
  }
}
```

Response shape:

```json
{
  "candidates": []
}
```

Errors are returned in this shape:

```json
{
  "error": {
    "message": "Error message"
  }
}
```

## 2. Backend Goals

The backend should eventually handle:

- Secure AI requests without exposing API keys in the browser.
- User profiles with age, gender, height, weight, activity level, and goal.
- Daily targets for calories, protein, carbs, fat, and fiber.
- Meal logging with nutrition values.
- Meal updates and corrections.
- Daily, weekly, and monthly nutrition summaries.
- Optional chat history persistence.
- Authentication or at least anonymous user sessions.
- Validation, rate limiting, and clear error responses.

## 3. Recommended Backend Direction

Because this project already has a Vercel API function and no build system, the simplest backend path is:

1. Keep using Vercel serverless functions under `api/`.
2. Add a database service.
3. Add backend endpoints one by one.
4. Update `script.js` to read/write through those endpoints.

Current backend stack:

```txt
Frontend: static HTML/CSS/JS
Backend: Vercel Functions plus Express in api/server.js
Database: MongoDB via DATABASE_URL
AI: Gemini through /api/gemini only
Auth: start anonymous, add real auth later
```

## 4. Environment Variables

Backend environment variables should live in Vercel project settings and local `.env.local`.

Required now:

```txt
GEMINI_API_KEY=
```

Required after database is added:

```txt
DATABASE_URL=
```

Optional later:

```txt
AUTH_SECRET=
RATE_LIMIT_SECRET=
NODE_ENV=
```

Frontend config should not contain secrets. Keep `env.js` like this for deployed usage:

```js
const env = {
  API_KEY: "",
  MODEL: "gemini-2.5-flash-lite"
};
```

## 5. Data Model Plan

### users

Use this even if starting with anonymous users. Anonymous users can be represented by a generated `user_id` stored in localStorage.

```sql
create table users (
  id uuid primary key default gen_random_uuid(),
  email text unique,
  display_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
```

### profiles

One profile per user.

```sql
create table profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  age int not null,
  gender text not null,
  height_cm numeric not null,
  weight_kg numeric not null,
  activity_level numeric not null,
  goal text not null,
  calorie_target int not null,
  protein_target int not null,
  carb_target int not null,
  fat_target int not null,
  fiber_target int not null default 30,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id)
);
```

### meals

Stores user meal history.

```sql
create table meals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  eaten_at timestamptz not null default now(),
  food_name text not null,
  calories int not null default 0,
  protein int not null default 0,
  carbs int not null default 0,
  fat int not null default 0,
  fiber int not null default 0,
  source text not null default 'manual',
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
```

### ai_logs

Optional but useful for debugging, costs, and safety.

```sql
create table ai_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references users(id) on delete set null,
  feature text not null,
  model text not null,
  prompt_tokens int,
  output_tokens int,
  success boolean not null,
  error_message text,
  created_at timestamptz not null default now()
);
```

## 6. API Endpoint Plan

Use JSON for all requests and responses.

### Health check

```txt
GET /api/health
```

Response:

```json
{
  "ok": true,
  "service": "nutrix-api"
}
```

### Create or resolve anonymous user

```txt
POST /api/users/anonymous
```

Request:

```json
{
  "userId": "optional-existing-user-id"
}
```

Response:

```json
{
  "user": {
    "id": "uuid"
  }
}
```

Frontend use:

- On page load, read `nutrix_user_id` from localStorage.
- If missing, call this endpoint.
- Store returned user id in localStorage.

### Get profile

```txt
GET /api/profile?userId=uuid
```

Response:

```json
{
  "profile": {
    "age": 25,
    "gender": "male",
    "heightCm": 175,
    "weightKg": 70,
    "activityLevel": 1.55,
    "goal": "maintain",
    "calorieTarget": 2200,
    "proteinTarget": 165,
    "carbTarget": 248,
    "fatTarget": 61,
    "fiberTarget": 30
  }
}
```

### Upsert profile

```txt
PUT /api/profile
```

Request:

```json
{
  "userId": "uuid",
  "age": 25,
  "gender": "male",
  "heightCm": 175,
  "weightKg": 70,
  "activityLevel": 1.55,
  "goal": "maintain"
}
```

Backend should calculate targets, not just trust the frontend.

Response:

```json
{
  "profile": {
    "calorieTarget": 2200,
    "proteinTarget": 165,
    "carbTarget": 248,
    "fatTarget": 61,
    "fiberTarget": 30
  }
}
```

### List meals

```txt
GET /api/meals?userId=uuid&date=2026-06-22
```

Response:

```json
{
  "meals": [
    {
      "id": "uuid",
      "foodName": "2 boiled eggs",
      "calories": 156,
      "protein": 12,
      "carbs": 1,
      "fat": 10,
      "fiber": 0,
      "eatenAt": "2026-06-22T08:30:00.000Z"
    }
  ],
  "totals": {
    "calories": 156,
    "protein": 12,
    "carbs": 1,
    "fat": 10,
    "fiber": 0
  }
}
```

### Create meal

```txt
POST /api/meals
```

Request:

```json
{
  "userId": "uuid",
  "foodName": "100g rice",
  "calories": 130,
  "protein": 3,
  "carbs": 28,
  "fat": 0,
  "fiber": 1,
  "source": "ai"
}
```

Response:

```json
{
  "meal": {
    "id": "uuid"
  }
}
```

### Update meal

```txt
PATCH /api/meals/:id
```

Request:

```json
{
  "userId": "uuid",
  "calories": 150,
  "protein": 4,
  "carbs": 30,
  "fat": 1,
  "fiber": 2
}
```

### Delete meal

```txt
DELETE /api/meals/:id?userId=uuid
```

### Trends

```txt
GET /api/trends?userId=uuid&period=weekly
```

Supported periods:

```txt
daily
weekly
monthly
```

Response:

```json
{
  "period": "weekly",
  "labels": ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
  "calories": [0, 0, 0, 0, 0, 0, 0],
  "macros": {
    "protein": [0, 0, 0, 0, 0, 0, 0],
    "carbs": [0, 0, 0, 0, 0, 0, 0],
    "fat": [0, 0, 0, 0, 0, 0, 0]
  }
}
```

### AI nutrition estimate

Keep `/api/gemini` as a low-level proxy if needed, but the better backend endpoint is:

```txt
POST /api/ai/nutrition
```

Request:

```json
{
  "userId": "uuid",
  "text": "2 boiled eggs and toast",
  "image": {
    "mimeType": "image/jpeg",
    "base64": "..."
  },
  "lastMealId": "uuid"
}
```

Response:

```json
{
  "action": "add",
  "meal": {
    "foodName": "2 boiled eggs and toast",
    "calories": 320,
    "protein": 18,
    "carbs": 28,
    "fat": 14,
    "fiber": 3,
    "note": "Add fruit or vegetables for more fiber."
  }
}
```

Why this endpoint is better than only using `/api/gemini`:

- Backend controls the prompt.
- Backend validates and normalizes Gemini output.
- Backend can save the meal directly.
- Frontend does not need to parse fragile AI text.
- Easier to log errors and usage.

## 7. Validation Rules

Add validation before database writes.

### Profile validation

- `age`: integer, 13 to 100.
- `gender`: `male` or `female` for current UI.
- `heightCm`: number, 100 to 250.
- `weightKg`: number, 30 to 300.
- `activityLevel`: one of `1.2`, `1.375`, `1.55`, `1.725`, `1.9`.
- `goal`: one of `cut`, `maintain`, `bulk`, `lean`.

### Meal validation

- `foodName`: required string, max 200 characters.
- `calories`: integer, 0 to 5000.
- `protein`: integer, 0 to 500.
- `carbs`: integer, 0 to 1000.
- `fat`: integer, 0 to 500.
- `fiber`: integer, 0 to 200.
- `eatenAt`: valid date, default to now.

### AI validation

- Reject empty text when no image is provided.
- Limit text length, for example 1000 characters.
- Limit image size before sending to Gemini.
- Allow only supported image MIME types.
- Use a strict response format and parse defensively.

## 8. Backend Implementation Phases

### Phase 1: Clean current backend

- Remove secrets from `env.js`.
- Rotate any key that was placed in frontend code.
- Keep all AI requests going through `/api/gemini`.
- Add `/api/health`.
- Add shared response helpers for JSON errors.
- Add shared model allowlist if more AI endpoints are added.

Done when:

- App can run locally with `vercel dev`.
- `/api/health` returns `{ "ok": true }`.
- Gemini works without a browser-exposed API key.

### Phase 2: Add persistence foundation

- Choose Postgres provider.
- Add `DATABASE_URL`.
- Add database client utility.
- Create migrations for `users`, `profiles`, and `meals`.
- Add anonymous user endpoint.
- Store `nutrix_user_id` in localStorage.

Done when:

- Refreshing the browser keeps the same anonymous user.
- Database contains the created user.

### Phase 3: Persist profile and targets

- Move target calculation into backend.
- Add `GET /api/profile`.
- Add `PUT /api/profile`.
- Update profile tab to load saved values on page load.
- Update profile tab to save values after target calculation.

Done when:

- Profile survives page refresh.
- Targets are calculated consistently by the backend.

### Phase 4: Persist meals

- Add `GET /api/meals`.
- Add `POST /api/meals`.
- Add `PATCH /api/meals/:id`.
- Add `DELETE /api/meals/:id`.
- Update meal list rendering to use backend data.
- Recalculate totals from backend meal list.

Done when:

- Logged meals survive refresh.
- Correcting the last meal updates the existing record.
- Deleting a meal updates totals.

### Phase 5: Backend-owned AI nutrition

- Add `POST /api/ai/nutrition`.
- Move nutrition prompt from `script.js` into backend.
- Parse Gemini output on the backend.
- Return structured JSON to the frontend.
- Optionally save meal directly inside the endpoint.
- Add `ai_logs` table if debugging or usage tracking is needed.

Done when:

- Frontend receives structured meal JSON.
- Frontend no longer parses nutrition lines from raw AI text.
- AI errors are clear and user-friendly.

### Phase 6: Trends from real data

- Add `GET /api/trends`.
- Aggregate meals by day/hour/week in SQL.
- Update chart data from backend response.
- Keep empty states when there are no meals.

Done when:

- Daily, weekly, and monthly charts use real saved meals.
- Charts still render cleanly with no data.

### Phase 7: Auth and privacy

- Decide whether anonymous mode is enough.
- If real accounts are needed, add Supabase Auth, Clerk, or another auth provider.
- Scope every query by authenticated user id.
- Add account deletion/data export if needed.

Done when:

- Users cannot access another user's profile or meals.
- Backend does not trust frontend-provided ownership blindly.

## 9. Suggested File Structure

If continuing with Vercel functions:

```txt
api/
  gemini.js
  health.js
  users/
    anonymous.js
  profile.js
  meals/
    index.js
    [id].js
  trends.js
  ai/
    nutrition.js
lib/
  db.js
  errors.js
  nutrition.js
  validation.js
migrations/
  001_init.sql
```

Notes:

- `lib/db.js` should create and export the database client.
- `lib/errors.js` should keep API error responses consistent.
- `lib/nutrition.js` should hold target calculations and AI parsing helpers.
- `lib/validation.js` should validate request bodies.

## 10. Frontend Changes Needed Later

The frontend currently owns too much state. After backend endpoints exist, update `script.js` in this order:

1. Add `apiFetch(path, options)` helper.
2. Add `getOrCreateUserId()` using localStorage and `/api/users/anonymous`.
3. Load profile on startup.
4. Save profile through `/api/profile`.
5. Load meals on startup.
6. Save meals through `/api/meals`.
7. Replace hardcoded trend data with `/api/trends`.
8. Replace raw Gemini nutrition parsing with `/api/ai/nutrition`.

Important frontend state after backend migration:

```js
var state = {
  userId: null,
  calories: 0,
  protein: 0,
  carbs: 0,
  fat: 0,
  fiber: 0,
  meals: [],
  chatHistory: []
};
```

## 11. Security Checklist

- Do not put real API keys in `env.js`.
- Keep `GEMINI_API_KEY` server-side only.
- Rotate exposed keys before production.
- Validate all request bodies.
- Add maximum payload sizes for AI image uploads.
- Add basic rate limiting for AI endpoints.
- Never return raw stack traces to the frontend.
- Log backend errors internally with enough context.
- Scope all profile and meal queries to the current user.
- Use HTTPS in production.

## 12. Testing Checklist

Manual checks for current backend:

```bash
vercel dev
```

```bash
curl -i http://localhost:3000/api/health
```

```bash
curl -i -X POST http://localhost:3000/api/gemini \
  -H "Content-Type: application/json" \
  -d '{"payload":{"contents":[{"role":"user","parts":[{"text":"Say hello"}]}]}}'
```

Manual checks after persistence:

- Create anonymous user.
- Save profile.
- Refresh page and confirm profile remains.
- Log a meal.
- Refresh page and confirm meal remains.
- Update last meal.
- Delete a meal.
- Confirm trends update from saved meals.

Suggested automated tests later:

- Unit test target calculation.
- Unit test meal validation.
- Unit test AI nutrition parser.
- Integration test profile upsert.
- Integration test meal CRUD.
- Integration test trends aggregation.

## 13. First Backend Tasks To Do Next

Start here:

1. Remove the frontend API key from `env.js` and rotate it if it was real.
2. Add `api/health.js`.
3. Add a small shared nutrition target calculator in `lib/nutrition.js`.
4. Choose database provider.
5. Add `DATABASE_URL` locally and in Vercel.
6. Create migrations for `users`, `profiles`, and `meals`.
7. Implement anonymous user creation.
8. Implement profile save/load.
9. Implement meal save/load.
10. Move AI nutrition parsing to the backend.

## 14. Open Decisions

- Should users sign in, or is anonymous localStorage identity enough for now?
- Which database provider should be used?
- Should AI endpoints save meals automatically, or should the frontend confirm first?
- Should food images be stored, or only used temporarily for AI analysis?
- Should chat history persist, or should it stay session-only?
- Should nutrition values support decimals, or are rounded integers enough?

## 15. Practical Backend Definition Of Done

Backend work is in good shape when:

- A user can refresh the page without losing profile or meals.
- All Gemini calls happen through backend endpoints.
- Real secrets are not present in frontend files.
- Meal CRUD works from the UI.
- Trends come from saved meal records.
- API errors are consistent and understandable.
- The code can be deployed on Vercel with only environment variables changed.
