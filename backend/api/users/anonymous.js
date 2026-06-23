import { sendError } from '../../lib/errors.js';
import { resolveAnonymousUser } from '../../lib/session.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return sendError(res, 405, 'Method Not Allowed');
  }

  try {
    const requestedUserId = req.body?.userId || null;
    const user = resolveAnonymousUser(req, res, requestedUserId);
    return res.status(user.isNew ? 201 : 200).json({ user: { id: user.id } });
  } catch (err) {
    return sendError(res, 500, 'Session error during anonymous resolution', err.message);
  }
}
