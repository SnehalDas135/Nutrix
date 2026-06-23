# Nutrix Context

- Frontend files live in `frontend/`.
- Backend implementation files live in `backend/`.
- Root `api/` files are Vercel adapters that re-export backend handlers.
- Persistence is cookie based through browser cookies plus `backend/lib/session.js`; MongoDB is not used.
- Gemini high-demand responses are queued in `frontend/script.js` and retried automatically.
