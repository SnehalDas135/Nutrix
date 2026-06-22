import { MongoClient } from 'mongodb';

const uri = process.env.DATABASE_URL;
let cachedClient = null;
let cachedDb = null;

export async function connectToDatabase() {
  if (cachedClient && cachedDb) {
    return { client: cachedClient, db: cachedDb };
  }

  if (!uri) {
    throw new Error('DATABASE_URL is missing from environment variables.');
  }

  const client = new MongoClient(uri);
  await client.connect();
  const db = client.db('nutrix');

  cachedClient = client;
  cachedDb = db;

  return { client, db };
}