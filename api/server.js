import express from 'express';
import cors from 'cors';
import { ObjectId } from 'mongodb';
import { randomUUID } from 'node:crypto';
import { connectToDatabase } from '../lib/db.js';
import { calculateTargets } from '../lib/nutrition.js';
import { getTrendData } from '../lib/trends.js';

const app = express();

app.use(cors());
app.use(express.json({ limit: '10mb' }));

function apiError(res, statusCode, message) {
  return res.status(statusCode).json({ error: { message } });
}

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

// Main test route
app.get('/api/health', (req, res) => {
  res.json({ ok: true, service: 'nutrix-api', timestamp: new Date().toISOString() });
});

app.post('/api/users/anonymous', async (req, res) => {
  try {
    const { db } = await connectToDatabase();
    const usersCollection = db.collection('users');
    const userId = req.body?.userId;

    if (userId) {
      const existingUser = await usersCollection.findOne({ _id: userId });
      if (existingUser) {
        return res.status(200).json({ user: { id: existingUser._id } });
      }
    }

    const newUser = {
      _id: randomUUID(),
      email: null,
      display_name: 'Anonymous User',
      created_at: new Date(),
      updated_at: new Date()
    };

    await usersCollection.insertOne(newUser);
    return res.status(201).json({ user: { id: newUser._id } });
  } catch (err) {
    return apiError(res, 500, err.message || 'Failed to create anonymous user');
  }
});

app.get('/api/profile', async (req, res) => {
  if (!req.query.userId) {
    return apiError(res, 400, 'Missing required userId parameter.');
  }

  try {
    const { db } = await connectToDatabase();
    const profile = await db.collection('profiles').findOne({ user_id: req.query.userId });
    return res.status(200).json({ profile });
  } catch (err) {
    return apiError(res, 500, err.message || 'Failed to load profile');
  }
});

app.put('/api/profile', async (req, res) => {
  const { userId, age, gender, heightCm, weightKg, activityLevel, goal } = req.body || {};
  if (!userId) {
    return apiError(res, 400, 'Missing required userId parameter.');
  }

  if (!age || !gender || !heightCm || !weightKg || !activityLevel || !goal) {
    return apiError(res, 400, 'Missing vital registration metrics fields.');
  }

  try {
    const { db } = await connectToDatabase();
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
      updated_at: new Date()
    };

    await db.collection('profiles').updateOne(
      { user_id: userId },
      { $set: profileData, $setOnInsert: { created_at: new Date() } },
      { upsert: true }
    );

    return res.status(200).json({ profile: profileData });
  } catch (err) {
    return apiError(res, 500, err.message || 'Failed to save profile');
  }
});

app.post('/api/meals', async (req, res) => {
  const { userId } = req.body || {};
  if (!userId) {
    return apiError(res, 400, 'Missing required userId parameter.');
  }

  try {
    const { db } = await connectToDatabase();
    const meal = {
      user_id: userId,
      ...cleanMeal(req.body),
      eaten_at: req.body.eatenAt ? new Date(req.body.eatenAt) : new Date(),
      created_at: new Date(),
      updated_at: new Date()
    };

    const result = await db.collection('meals').insertOne(meal);
    return res.status(201).json({ meal: { ...meal, id: result.insertedId.toString() } });
  } catch (err) {
    return apiError(res, 500, err.message || 'Failed to save meal');
  }
});

app.patch('/api/meals/:id', async (req, res) => {
  const { userId } = req.body || {};
  if (!userId) {
    return apiError(res, 400, 'Missing required userId parameter.');
  }

  if (!ObjectId.isValid(req.params.id)) {
    return apiError(res, 400, 'Invalid meal id.');
  }

  try {
    const { db } = await connectToDatabase();
    const updates = {
      ...cleanMeal(req.body),
      updated_at: new Date()
    };

    const result = await db.collection('meals').findOneAndUpdate(
      { _id: new ObjectId(req.params.id), user_id: userId },
      { $set: updates },
      { returnDocument: 'after' }
    );
    const updatedMeal = result && Object.prototype.hasOwnProperty.call(result, 'value')
      ? result.value
      : result;

    if (!updatedMeal) {
      return apiError(res, 404, 'Meal not found.');
    }

    return res.status(200).json({ meal: { ...updatedMeal, id: updatedMeal._id.toString() } });
  } catch (err) {
    return apiError(res, 500, err.message || 'Failed to update meal');
  }
});

app.get('/api/trends', async (req, res) => {
  try {
    const { db } = await connectToDatabase();
    const data = await getTrendData(db, {
      userId: req.query.userId,
      period: req.query.period
    });

    return res.status(200).json(data);
  } catch (err) {
    return apiError(res, 500, err.message || 'Failed to load trends');
  }
});

// DO NOT use app.listen() here. Vercel needs the app exported:
export default app;
