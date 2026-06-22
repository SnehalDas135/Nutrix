import { ObjectId } from 'mongodb';
import { connectToDatabase } from '../../lib/db.js';
import { sendError } from '../../lib/errors.js';

function cleanMeal(body) {
  return {
    foodName: String(body.foodName || 'Logged meal').slice(0, 200),
    calories: Math.max(0, Math.round(Number(body.calories) || 0)),
    protein: Math.max(0, Math.round(Number(body.protein) || 0)),
    carbs: Math.max(0, Math.round(Number(body.carbs) || 0)),
    fat: Math.max(0, Math.round(Number(body.fat) || 0)),
    fiber: Math.max(0, Math.round(Number(body.fiber) || 0)),
    source: String(body.source || 'ai').slice(0, 40)
  };
}

export default async function handler(req, res) {
  if (req.method !== 'PATCH') {
    return sendError(res, 405, 'Method Not Allowed');
  }

  const { id } = req.query;
  const { userId } = req.body || {};

  if (!userId) {
    return sendError(res, 400, 'Missing required userId parameter.');
  }

  if (!ObjectId.isValid(id)) {
    return sendError(res, 400, 'Invalid meal id.');
  }

  try {
    const { db } = await connectToDatabase();
    const result = await db.collection('meals').findOneAndUpdate(
      { _id: new ObjectId(id), user_id: userId },
      { $set: { ...cleanMeal(req.body), updated_at: new Date() } },
      { returnDocument: 'after' }
    );
    const updatedMeal = result && Object.prototype.hasOwnProperty.call(result, 'value')
      ? result.value
      : result;

    if (!updatedMeal) {
      return sendError(res, 404, 'Meal not found.');
    }

    return res.status(200).json({ meal: { ...updatedMeal, id: updatedMeal._id.toString() } });
  } catch (err) {
    return sendError(res, 500, 'Failed to update meal', err.message);
  }
}
