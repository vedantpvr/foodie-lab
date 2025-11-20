// insert_data.js
const admin = require("firebase-admin");

// ----------------------
// FIREBASE INIT
// ----------------------
const serviceAccount = require("./serviceAccountKey.json");

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
}

const db = admin.firestore();

// ----------------------
// MAIN
// ----------------------
async function main() {
  await insertPuranPoli();
  await insertSyntheticRecipes();
  await insertUsers();
  await insertInteractions();

  console.log("✅ All data inserted successfully (Puran Poli + synthetic).");
}

// ----------------------
// 1. YOUR MAIN RECIPE: PURAN POLI
// ----------------------
async function insertPuranPoli() {
  const puranPoli = {
    name: "Puran Poli",
    description: "Traditional Maharashtrian sweet flatbread stuffed with chana dal and jaggery, made for festivals.",
    servings: 4,
    prep_time_min: 45,
    cook_time_min: 30,
    total_time_min: 75,
    difficulty: "medium",
    cuisine: "Indian",
    tags: ["sweet", "festival", "maharashtrian"],
    author_user_id: "user_vedant",
    created_at: admin.firestore.Timestamp.now(),
  };

  const recipeRef = db.collection("recipes").doc("recipe_puran_poli");
  await recipeRef.set(puranPoli);

  // --- Ingredients for Puran Poli ---
  const ingredients = [
    ["chana dal", 1, "cup", "soaked 2–3 hours"],
    ["jaggery", 1, "cup", "grated"],
    ["cardamom powder", 0.5, "tsp", ""],
    ["nutmeg powder", 0.25, "tsp", "optional"],
    ["wheat flour", 2, "cups", ""],
    ["maida (optional)", 0.5, "cup", ""],
    ["turmeric powder", 0.25, "tsp", ""],
    ["salt", 0.25, "tsp", ""],
    ["oil", 2, "tbsp", "for dough"],
    ["ghee", 4, "tbsp", "for roasting polis"],
    ["water", 1, "cup", "as required for dough"],
  ];

  for (let i = 0; i < ingredients.length; i++) {
    const [name, quantity, unit, notes] = ingredients[i];
    await recipeRef.collection("ingredients").doc(`ing${i + 1}`).set({
      ingredient_id: `ing${i + 1}`,
      name,
      quantity,
      unit,
      notes,
      order: i + 1,
    });
  }

  // --- Steps for Puran Poli ---
  const steps = [
    "Wash and soak chana dal for 2–3 hours, then pressure cook until soft but not mushy.",
    "Drain excess water, add grated jaggery to the hot dal and cook on low heat until jaggery melts and mixture thickens.",
    "Add cardamom powder and nutmeg powder, mix well and let the puran filling cool completely.",
    "In a mixing bowl, combine wheat flour, maida (optional), turmeric, salt and oil. Add water gradually and knead a soft, smooth dough.",
    "Cover the dough with a damp cloth and rest for at least 20–30 minutes.",
    "Divide the cooled puran filling into equal lemon-sized balls.",
    "Divide the dough into slightly smaller balls than the puran balls.",
    "Flatten a dough ball, place a puran ball in the center and gently seal the edges to cover the filling completely.",
    "Dust with dry flour and gently roll into a medium-thick disc (poli) without tearing.",
    "Heat a tawa on medium flame, place the rolled poli and cook until light brown spots appear.",
    "Apply ghee on both sides and cook until golden and slightly crisp.</>",
    "Serve hot Puran Poli with extra ghee or warm milk.",
  ];

  for (let i = 0; i < steps.length; i++) {
    await recipeRef.collection("steps").doc(`step${i + 1}`).set({
      step_id: `step${i + 1}`,
      order: i + 1,
      text: steps[i],
    });
  }

  console.log("✅ Puran Poli recipe, ingredients, and steps inserted.");
}

// ----------------------
// 2. SYNTHETIC RECIPES (20)
// ----------------------
async function insertSyntheticRecipes() {
  const sampleRecipes = [
    "Masala Dosa",
    "Paneer Butter Masala",
    "Veg Pulao",
    "Gulab Jamun",
    "Kheer",
    "Aloo Paratha",
    "Poha",
    "Misal Pav",
    "Vada Pav",
    "Sabudana Khichdi",
    "Shrikhand",
    "Dal Tadka",
    "Jeera Rice",
    "Palak Paneer",
    "Upma",
    "Idli Sambhar",
    "Chicken Biryani",
    "Fish Curry",
    "Egg Curry",
    "Matar Paneer",
  ];

  const difficulties = ["easy", "medium", "hard"];
  const authors = ["user1", "user2", "user3"];

  for (const name of sampleRecipes) {
    const rid = "recipe_" + name.toLowerCase().replace(/\s+/g, "_");
    await db.collection("recipes").doc(rid).set({
      name,
      description: `Synthetic recipe: ${name}`,
      servings: randInt(2, 6),
      prep_time_min: randInt(10, 40),
      cook_time_min: randInt(10, 50),
      total_time_min: null, // will be derived in ETL
      difficulty: sample(difficulties),
      cuisine: "Indian",
      tags: ["synthetic"],
      author_user_id: sample(authors),
      created_at: admin.firestore.Timestamp.now(),
    });
  }

  console.log("✅ Synthetic recipes inserted.");
}

// ----------------------
// 3. USERS
// ----------------------
async function insertUsers() {
  const batch = db.batch();

  const mainUserRef = db.collection("users").doc("user_vedant");
  batch.set(mainUserRef, {
    user_id: "user_vedant",
    name: "Vedant Raut",
    email: "vedant@example.com",
    country: "IN",
    created_at: admin.firestore.Timestamp.now(),
  });

  for (let i = 1; i <= 10; i++) {
    const userRef = db.collection("users").doc(`user${i}`);
    batch.set(userRef, {
      user_id: `user${i}`,
      name: `User ${i}`,
      email: `user${i}@test.com`,
      country: "IN",
      created_at: admin.firestore.Timestamp.now(),
    });
  }

  await batch.commit();
  console.log("✅ Users inserted.");
}

// ----------------------
// 4. INTERACTIONS (e.g., 300 random events)
// ----------------------
async function insertInteractions() {
  const recipesSnap = await db.collection("recipes").get();
  const recipeIds = [];
  recipesSnap.forEach((doc) => recipeIds.push(doc.id));

  const interactionTypes = ["view", "like", "cook_attempt", "rating"];
  const difficultyUsed = ["easy", "medium", "hard"];
  const sources = ["web", "mobile"];

  let batch = db.batch();
  let count = 0;
  const batchSize = 500;

  for (let i = 0; i < 300; i++) {
    const docRef = db.collection("interactions").doc(`int_${i}`);
    const type = sample(interactionTypes);
    const rating =
      type === "rating" ? sample([null, 3, 4, 5]) : null;

    batch.set(docRef, {
      interaction_id: `int_${i}`,
      recipe_id: sample(recipeIds),
      user_id: sample([
        "user_vedant",
        ...Array.from({ length: 10 }, (_, idx) => `user${idx + 1}`),
      ]),
      type,
      rating,
      difficulty_used: sample(difficultyUsed),
      source: sample(sources),
      created_at: admin.firestore.Timestamp.now(),
    });

    count++;
    if (count === batchSize) {
      await batch.commit();
      batch = db.batch();
      count = 0;
    }
  }

  if (count > 0) {
    await batch.commit();
  }

  console.log("✅ Interactions inserted.");
}

// ----------------------
// HELPERS
// ----------------------
function randInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function sample(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

main().catch((err) => {
  console.error("❌ Error inserting data:", err);
});
