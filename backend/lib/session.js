import { randomUUID } from 'node:crypto';

const ONE_YEAR = 60 * 60 * 24 * 365;
const MAX_MEALS = 20;

const COOKIES = {
  userId: 'nutrix_user_id',
  profile: 'nutrix_profile',
  meals: 'nutrix_meals'
};

function parseCookies(req) {
  const header = req.headers?.cookie || '';
  return header.split(';').reduce((cookies, pair) => {
    const index = pair.indexOf('=');
    if (index === -1) {
      return cookies;
    }

    const name = pair.slice(0, index).trim();
    const value = pair.slice(index + 1).trim();
    if (name) {
      cookies[name] = decodeURIComponent(value);
    }
    return cookies;
  }, {});
}

function encodeJson(value) {
  return Buffer.from(JSON.stringify(value), 'utf8').toString('base64url');
}

function decodeJson(value, fallback) {
  if (!value) {
    return fallback;
  }

  try {
    return JSON.parse(Buffer.from(value, 'base64url').toString('utf8'));
  } catch {
    return fallback;
  }
}

function serializeCookie(name, value) {
  const parts = [
    `${name}=${encodeURIComponent(value)}`,
    'Path=/',
    `Max-Age=${ONE_YEAR}`,
    'SameSite=Lax',
    'HttpOnly'
  ];

  if (process.env.NODE_ENV === 'production') {
    parts.push('Secure');
  }

  return parts.join('; ');
}

function appendSetCookie(res, cookie) {
  const existing = res.getHeader('Set-Cookie');
  const next = Array.isArray(existing)
    ? [...existing, cookie]
    : existing
      ? [existing, cookie]
      : [cookie];
  res.setHeader('Set-Cookie', next);
}

function setCookie(res, name, value) {
  appendSetCookie(res, serializeCookie(name, value));
}

function setJsonCookie(res, name, value) {
  setCookie(res, name, encodeJson(value));
}

export function getUserId(req) {
  return parseCookies(req)[COOKIES.userId] || null;
}

export function resolveAnonymousUser(req, res, requestedUserId = null) {
  const userId = requestedUserId || getUserId(req) || randomUUID();
  setCookie(res, COOKIES.userId, userId);
  return {
    id: userId,
    isNew: !requestedUserId && !getUserId(req)
  };
}

export function getProfile(req) {
  return decodeJson(parseCookies(req)[COOKIES.profile], null);
}

export function saveProfile(res, profile) {
  setJsonCookie(res, COOKIES.profile, profile);
  return profile;
}

export function getMeals(req) {
  const meals = decodeJson(parseCookies(req)[COOKIES.meals], []);
  return Array.isArray(meals) ? meals : [];
}

export function saveMeals(res, meals) {
  const boundedMeals = meals.slice(-MAX_MEALS);
  setJsonCookie(res, COOKIES.meals, boundedMeals);
  return boundedMeals;
}

export function addMeal(req, res, meal) {
  const meals = getMeals(req);
  const now = new Date().toISOString();
  const savedMeal = {
    id: randomUUID(),
    ...meal,
    eatenAt: meal.eatenAt || now,
    createdAt: now,
    updatedAt: now
  };

  saveMeals(res, [...meals, savedMeal]);
  return savedMeal;
}

export function updateMeal(req, res, mealId, updates) {
  let updatedMeal = null;
  const meals = getMeals(req).map((meal) => {
    if (meal.id !== mealId) {
      return meal;
    }

    updatedMeal = {
      ...meal,
      ...updates,
      id: meal.id,
      createdAt: meal.createdAt,
      eatenAt: updates.eatenAt || meal.eatenAt,
      updatedAt: new Date().toISOString()
    };
    return updatedMeal;
  });

  if (updatedMeal) {
    saveMeals(res, meals);
  }

  return updatedMeal;
}
