import { sendError } from '../../lib/errors.js';
import { getUserId, updateMeal } from '../../lib/session.js';

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
  const userId = req.body?.userId || getUserId(req);

  if (!userId) {
    return sendError(res, 400, 'Missing anonymous session. Create a user first.');
  }

  try {
    const updatedMeal = updateMeal(req, res, id, cleanMeal(req.body));
    if (!updatedMeal) {
      return sendError(res, 404, 'Meal not found.');
    }

    return res.status(200).json({ meal: updatedMeal });
  } catch (err) {
    return sendError(res, 500, 'Failed to update meal cookie', err.message);
  }
}
