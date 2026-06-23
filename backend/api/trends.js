import { sendError } from '../lib/errors.js';
import { getTrendData } from '../lib/trends.js';
import { getMeals, getProfile } from '../lib/session.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return sendError(res, 405, 'Method Not Allowed');
  }

  try {
    const data = getTrendData({
      meals: getMeals(req),
      profile: getProfile(req),
      period: req.query.period
    });

    return res.status(200).json(data);
  } catch (err) {
    return sendError(res, 500, 'Failed to load trends', err.message);
  }
}
