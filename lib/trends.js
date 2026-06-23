const PERIODS = new Set(['daily', 'weekly', 'monthly']);

export function normalizePeriod(period) {
  return PERIODS.has(period) ? period : 'weekly';
}

export function emptyTrendData(period, target = 2200) {
  const normalized = normalizePeriod(period);
  const labels = {
    daily: ['12am', '4am', '8am', '12pm', '4pm', '8pm'],
    weekly: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
    monthly: ['Week 1', 'Week 2', 'Week 3', 'Week 4', 'Week 5']
  }[normalized];

  return {
    period: normalized,
    labels,
    cal: labels.map(() => 0),
    target,
    macros: {
      p: labels.map(() => 0),
      c: labels.map(() => 0),
      f: labels.map(() => 0)
    }
  };
}

function startOfDay(date) {
  const next = new Date(date);
  next.setHours(0, 0, 0, 0);
  return next;
}

function addDays(date, days) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function addMonths(date, months) {
  const next = new Date(date);
  next.setMonth(next.getMonth() + months);
  return next;
}

function getWeekStart(date) {
  const start = startOfDay(date);
  const day = start.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  return addDays(start, diff);
}

function getRange(period, now = new Date()) {
  if (period === 'daily') {
    const start = startOfDay(now);
    return { start, end: addDays(start, 1) };
  }

  if (period === 'monthly') {
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    return { start, end: addMonths(start, 1) };
  }

  const start = getWeekStart(now);
  return { start, end: addDays(start, 7) };
}

function getMealDate(meal) {
  const value = meal.eaten_at || meal.eatenAt || meal.created_at || meal.createdAt;
  const date = value ? new Date(value) : new Date();
  return Number.isNaN(date.getTime()) ? new Date() : date;
}

function getBucketIndex(period, date, rangeStart) {
  if (period === 'daily') {
    return Math.min(Math.floor(date.getHours() / 4), 5);
  }

  if (period === 'monthly') {
    return Math.min(Math.floor((date.getDate() - 1) / 7), 4);
  }

  const diffMs = startOfDay(date).getTime() - rangeStart.getTime();
  return Math.floor(diffMs / 86400000);
}

function numberValue(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

export async function getTrendData(db, { userId, period }) {
  const normalized = normalizePeriod(period);
  const profile = userId
    ? await db.collection('profiles').findOne({ user_id: userId })
    : null;
  const data = emptyTrendData(normalized, profile?.calorieTarget || 2200);

  if (!userId) {
    return data;
  }

  const { start, end } = getRange(normalized);
  const meals = await db.collection('meals').find({
    $or: [{ user_id: userId }, { userId }]
  }).toArray();

  meals.forEach((meal) => {
    const date = getMealDate(meal);
    if (date < start || date >= end) {
      return;
    }

    const bucket = getBucketIndex(normalized, date, start);
    if (bucket < 0 || bucket >= data.labels.length) {
      return;
    }

    data.cal[bucket] += numberValue(meal.calories);
    data.macros.p[bucket] += numberValue(meal.protein);
    data.macros.c[bucket] += numberValue(meal.carbs);
    data.macros.f[bucket] += numberValue(meal.fat);
  });

  return data;
}
