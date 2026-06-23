import { connectToDatabase } from '../lib/db.js';
import { sendError } from '../lib/errors.js';
import { getTrendData } from '../lib/trends.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return sendError(res, 405, 'Method Not Allowed');
  }

  try {
    const { db } = await connectToDatabase();
    const data = await getTrendData(db, {
      userId: req.query.userId,
      period: req.query.period
    });

    return res.status(200).json(data);
  } catch (err) {
    return sendError(res, 500, 'Failed to load trends', err.message);
  }
}
