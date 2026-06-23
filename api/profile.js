import { connectToDatabase } from '../lib/db.js';
import { sendError } from '../lib/errors.js';
import { calculateTargets } from '../lib/nutrition.js';

export default async function handler(req, res) {
  const { method } = req;
  const userId = method === 'GET' ? req.query.userId : req.body.userId;

  if (!userId) {
    return sendError(res, 400, 'Missing required userId parameter.');
  }

  try {
    const { db } = await connectToDatabase();
    const profilesCollection = db.collection('profiles');

    // --- CASE 1: FETCH PROFILE ---
    if (method === 'GET') {
      const profile = await profilesCollection.findOne({ user_id: userId });
      if (!profile) {
        return res.status(200).json({ profile: null });
      }
      return res.status(200).json({ profile });
    }

    // --- CASE 2: UPSERT PROFILE ---
    if (method === 'PUT') {
      const { age, gender, heightCm, weightKg, activityLevel, goal } = req.body;

      // Validate basic numeric inputs before writing to DB
      if (!age || !gender || !heightCm || !weightKg || !activityLevel || !goal) {
        return sendError(res, 400, 'Missing vital registration metrics fields.');
      }

      // Compute calculated targets on the safe backend layer
      const targets = calculateTargets({ age, gender, heightCm, weightKg, activityLevel, goal });

      const profileData = {
        user_id: userId,
        age: parseInt(age),
        gender,
        heightCm: parseFloat(heightCm),
        weightKg: parseFloat(weightKg),
        activityLevel: parseFloat(activityLevel),
        goal,
        ...targets,
        updated_at: new Date()
      };

      // Perform an upsert operation in MongoDB
      await profilesCollection.updateOne(
        { user_id: userId },
        { 
          $set: profileData,
          $setOnInsert: { created_at: new Date() } 
        },
        { upsert: true }
      );

      return res.status(200).json({ profile: profileData });
    }

    // Fallback error if incorrect HTTP Verb hit
    return sendError(res, 405, 'Method Not Allowed');

  } catch (err) {
    return sendError(res, 500, 'Profile persistence processing error', err.message);
  }
}