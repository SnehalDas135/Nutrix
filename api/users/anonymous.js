import { connectToDatabase } from '../../lib/db.js';
import { sendError } from '../../lib/errors.js';
import { randomUUID } from 'node:crypto';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return sendError(res, 405, 'Method Not Allowed');
  }

  const { userId } = req.body;

  try {
    const { db } = await connectToDatabase();
    const usersCollection = db.collection('users');

    // 1. Check if the frontend user session already exists in MongoDB
    if (userId) {
      const existingUser = await usersCollection.findOne({ _id: userId });
      if (existingUser) {
        return res.status(200).json({ user: { id: existingUser._id } });
      }
    }

    // 2. Generate a clean UUID and document for the new anonymous user
    const newId = randomUUID(); 
    const newUserDoc = {
      _id: newId,
      email: null,
      display_name: "Anonymous User",
      created_at: new Date(),
      updated_at: new Date()
    };

    await usersCollection.insertOne(newUserDoc);

    return res.status(201).json({
      user: { id: newId }
    });
  } catch (err) {
    return sendError(res, 500, 'Database error during anonymous session resolution', err.message);
  }
}
