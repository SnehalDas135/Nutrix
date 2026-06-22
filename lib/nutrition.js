export function calculateTargets({ age, gender, heightCm, weightKg, activityLevel, goal }) {
  // 1. Calculate Basal Metabolic Rate (BMR)
  let bmr = (10 * weightKg) + (6.25 * heightCm) - (5 * age);
  if (gender.toLowerCase() === 'male') {
    bmr += 5;
  } else {
    bmr -= 161;
  }

  // 2. Total Daily Energy Expenditure (TDEE)
  let calories = Math.round(bmr * parseFloat(activityLevel));

  // 3. Adjust calories based on fitness goal
  if (goal === 'cut') calories -= 500;
  if (goal === 'bulk') calories += 500;
  if (goal === 'lean') calories += 250;
  // 'maintain' keeps calories as is

  // Floor safety lower limit
  if (calories < 1200) calories = 1200;

  // 4. Macro Splits (Rule of thumb: 30% Protein, 45% Carbs, 25% Fat)
  // Protein: 4 calories per gram
  // Carbs: 4 calories per gram
  // Fat: 9 calories per gram
  const proteinTarget = Math.round((calories * 0.30) / 4);
  const carbTarget = Math.round((calories * 0.45) / 4);
  const fatTarget = Math.round((calories * 0.25) / 9);
  const fiberTarget = 30; // standard default baseline

  return {
    calorieTarget: calories,
    proteinTarget,
    carbTarget,
    fatTarget,
    fiberTarget
  };
}