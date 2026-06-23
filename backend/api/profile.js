import { sendError } from '../lib/errors.js';
import { calculateTargets } from '../lib/nutrition.js';
import { getProfile, getUserId, saveProfile } from '../lib/session.js';

export default async function handler(req, res) {
  const { method } = req;
  const userId = method === 'GET'
    ? req.query.userId || getUserId(req)
    : req.body?.userId || getUserId(req);

  if (!userId) {
    return sendError(res, 400, 'Missing anonymous session. Create a user first.');
  }

  try {
    if (method === 'GET') {
      return res.status(200).json({ profile: getProfile(req) });
    }

    if (method === 'PUT') {
      const { age, gender, heightCm, weightKg, activityLevel, goal } = req.body;

      if (!age || !gender || !heightCm || !weightKg || !activityLevel || !goal) {
        return sendError(res, 400, 'Missing vital registration metrics fields.');
      }

      const targets = calculateTargets({ age, gender, heightCm, weightKg, activityLevel, goal });
      const profileData = {
        user_id: userId,
        age: parseInt(age, 10),
        gender,
        heightCm: parseFloat(heightCm),
        weightKg: parseFloat(weightKg),
        activityLevel: parseFloat(activityLevel),
        goal,
        ...targets,
        updatedAt: new Date().toISOString()
      };

      return res.status(200).json({ profile: saveProfile(res, profileData) });
    }

    return sendError(res, 405, 'Method Not Allowed');
  } catch (err) {
    return sendError(res, 500, 'Profile cookie persistence error', err.message);
  }
}
