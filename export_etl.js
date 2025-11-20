// export_etl.js
const admin = require("firebase-admin");
const path = require("path");
const fs = require("fs");
const createCsvWriter = require("csv-writer").createObjectCsvWriter;

const serviceAccountPath = path.join(__dirname, "serviceAccountKey.json");
if (!fs.existsSync(serviceAccountPath)) {
  console.error("serviceAccountKey.json not found in project root.");
  process.exit(1);
}

const serviceAccount = require(serviceAccountPath);

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
}
const db = admin.firestore();

const OUTPUT_DIR = path.join(__dirname, "output");

async function ensureOutputDir() {
  if (!fs.existsSync(OUTPUT_DIR)) fs.mkdirSync(OUTPUT_DIR);
}

function toISO(ts) {
  if (!ts) return "";
  // Firestore timestamp object has toDate() method; if already Date, convert directly
  try {
    if (ts.toDate) return ts.toDate().toISOString();
    if (ts instanceof Date) return ts.toISOString();
  } catch (e) {}
  return String(ts);
}

async function exportRecipes() {
  const snapshot = await db.collection("recipes").get();
  const rows = [];

  snapshot.forEach((doc) => {
    const data = doc.data() || {};
    const prep = Number(data.prep_time_min) || 0;
    const cook = Number(data.cook_time_min) || 0;
    const total = data.total_time_min != null ? Number(data.total_time_min) : (prep + cook);

    rows.push({
      recipe_id: doc.id,
      name: data.name || "",
      description: data.description || "",
      servings: data.servings ?? "",
      prep_time_min: prep,
      cook_time_min: cook,
      total_time_min: total,
      difficulty: data.difficulty || "",
      cuisine: data.cuisine || "",
      tags: Array.isArray(data.tags) ? data.tags.join(",") : (data.tags || ""),
      author_user_id: data.author_user_id || "",
      created_at: toISO(data.created_at),
    });
  });

  const csvWriter = createCsvWriter({
    path: path.join(OUTPUT_DIR, "recipe.csv"),
    header: [
      { id: "recipe_id", title: "recipe_id" },
      { id: "name", title: "name" },
      { id: "description", title: "description" },
      { id: "servings", title: "servings" },
      { id: "prep_time_min", title: "prep_time_min" },
      { id: "cook_time_min", title: "cook_time_min" },
      { id: "total_time_min", title: "total_time_min" },
      { id: "difficulty", title: "difficulty" },
      { id: "cuisine", title: "cuisine" },
      { id: "tags", title: "tags" },
      { id: "author_user_id", title: "author_user_id" },
      { id: "created_at", title: "created_at" },
    ],
  });

  await csvWriter.writeRecords(rows);
  console.log("✅ recipe.csv written:", path.join(OUTPUT_DIR, "recipe.csv"));
  return rows.map(r => r.recipe_id);
}

async function exportIngredientsAndSteps(recipeIds) {
  const ingredientsRows = [];
  const stepsRows = [];

  for (const rid of recipeIds) {
    const ingSnap = await db.collection("recipes").doc(rid).collection("ingredients").get();
    ingSnap.forEach((doc) => {
      const d = doc.data() || {};
      ingredientsRows.push({
        recipe_id: rid,
        ingredient_id: d.ingredient_id || doc.id,
        name: d.name || "",
        quantity: d.quantity != null ? d.quantity : "",
        unit: d.unit || "",
        notes: d.notes || "",
        order: d.order != null ? d.order : "",
      });
    });

    const stepSnap = await db.collection("recipes").doc(rid).collection("steps").get();
    stepSnap.forEach((doc) => {
      const d = doc.data() || {};
      stepsRows.push({
        recipe_id: rid,
        step_id: d.step_id || doc.id,
        order: d.order != null ? d.order : "",
        text: d.text || "",
      });
    });
  }

  const ingWriter = createCsvWriter({
    path: path.join(OUTPUT_DIR, "ingredients.csv"),
    header: [
      { id: "recipe_id", title: "recipe_id" },
      { id: "ingredient_id", title: "ingredient_id" },
      { id: "name", title: "name" },
      { id: "quantity", title: "quantity" },
      { id: "unit", title: "unit" },
      { id: "notes", title: "notes" },
      { id: "order", title: "order" },
    ],
  });

  const stepWriter = createCsvWriter({
    path: path.join(OUTPUT_DIR, "steps.csv"),
    header: [
      { id: "recipe_id", title: "recipe_id" },
      { id: "step_id", title: "step_id" },
      { id: "order", title: "order" },
      { id: "text", title: "text" },
    ],
  });

  await ingWriter.writeRecords(ingredientsRows);
  console.log("✅ ingredients.csv written:", path.join(OUTPUT_DIR, "ingredients.csv"));

  await stepWriter.writeRecords(stepsRows);
  console.log("✅ steps.csv written:", path.join(OUTPUT_DIR, "steps.csv"));
}

async function exportInteractions() {
  const snap = await db.collection("interactions").get();
  const rows = [];
  snap.forEach((doc) => {
    const d = doc.data() || {};
    rows.push({
      interaction_id: d.interaction_id || doc.id,
      user_id: d.user_id || "",
      recipe_id: d.recipe_id || "",
      type: d.type || "",
      rating: d.rating != null ? d.rating : "",
      difficulty_used: d.difficulty_used || "",
      source: d.source || "",
      created_at: toISO(d.created_at),
    });
  });

  const writer = createCsvWriter({
    path: path.join(OUTPUT_DIR, "interactions.csv"),
    header: [
      { id: "interaction_id", title: "interaction_id" },
      { id: "user_id", title: "user_id" },
      { id: "recipe_id", title: "recipe_id" },
      { id: "type", title: "type" },
      { id: "rating", title: "rating" },
      { id: "difficulty_used", title: "difficulty_used" },
      { id: "source", title: "source" },
      { id: "created_at", title: "created_at" },
    ],
  });

  await writer.writeRecords(rows);
  console.log("✅ interactions.csv written:", path.join(OUTPUT_DIR, "interactions.csv"));
}

async function run() {
  try {
    await ensureOutputDir();
    console.log("Export started...");
    const recipeIds = await exportRecipes();
    await exportIngredientsAndSteps(recipeIds);
    await exportInteractions();
    console.log("✔️ ETL complete. CSV files are in the 'output' folder.");
  } catch (err) {
    console.error("❌ ETL failed:", err);
    process.exit(1);
  }
}

run();
