// api/health.js
export default function handler(request, response) {
  return response.status(200).json({
    ok: true,
    service: "nutrix-api",
    timestamp: new Date().toISOString()
  });
}