const routes = [
  'GET /api/health',
  'POST /api/users/anonymous',
  'GET /api/profile',
  'PUT /api/profile',
  'GET /api/meals',
  'POST /api/meals',
  'PATCH /api/meals/:id',
  'GET /api/trends',
  'POST /api/gemini'
];

export default function handler(req, res) {
  return res.status(200).json({
    ok: true,
    service: 'nutrix-api',
    persistence: 'cookies',
    routes
  });
}
