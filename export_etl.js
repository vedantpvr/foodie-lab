// export_etl.js
// Exports Firestore collections and recipe subcollections to normalized CSV files.
// Writes to ./output: recipe.csv, ingredients.csv, steps.csv, interactions.csv, users.csv

const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');
const createCsvWriter = require('csv-writer').createObjectCsvWriter;

const SERVICE_KEY = path.join(__dirname, 'serviceAccountKey.json');
if (!fs.existsSync(SERVICE_KEY)) {
  console.error('serviceAccountKey.json not found in project root. Place your Firebase service account key there.');
  process.exit(1);
}

const serviceAccount = require(SERVICE_KEY);

if (!admin.apps.length) {
  admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
}
const db = admin.firestore();

const OUTPUT_DIR = path.join(__dirname, 'output');

function ensureOutputDir() {
  if (!fs.existsSync(OUTPUT_DIR)) fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

function toISO(ts) {
  if (!ts) return '';
  try {
    if (typeof ts.toDate === 'function') return ts.toDate().toISOString();
    if (ts instanceof Date) return ts.toISOString();
    return String(ts);
  } catch (e) {
    return String(ts);
  }
}

async function exportRecipes() {
  const recipeWriter = createCsvWriter({
    path: path.join(OUTPUT_DIR, 'recipe.csv'),
    header: [
      { id: 'recipe_id', title: 'recipe_id' },
      { id: 'name', title: 'name' },
      { id: 'description', title: 'description' },
      { id: 'servings', title: 'servings' },
      { id: 'prep_time_min', title: 'prep_time_min' },
      { id: 'cook_time_min', title: 'cook_time_min' },
      { id: 'total_time_min', title: 'total_time_min' },
      { id: 'difficulty', title: 'difficulty' },
      { id: 'cuisine', title: 'cuisine' },
      { id: 'tags', title: 'tags' },
      { id: 'author_user_id', title: 'author_user_id' },
      { id: 'created_at', title: 'created_at' },
    ],
  });

  const snapshot = await db.collection('recipes').get();
  const rows = [];
  snapshot.forEach((doc) => {
    const d = doc.data() || {};
    const prep = d.prep_time_min != null ? Number(d.prep_time_min) : 0;
    const cook = d.cook_time_min != null ? Number(d.cook_time_min) : 0;
    const total = d.total_time_min != null ? Number(d.total_time_min) : prep + cook;

    rows.push({
      recipe_id: doc.id,
      name: d.name || '',
      description: d.description || '',
      servings: d.servings != null ? d.servings : '',
      prep_time_min: isNaN(prep) ? '' : prep,
      cook_time_min: isNaN(cook) ? '' : cook,
      total_time_min: isNaN(total) ? '' : total,
      difficulty: d.difficulty || '',
      cuisine: d.cuisine || '',
      tags: Array.isArray(d.tags) ? d.tags.join(',') : (d.tags || ''),
      author_user_id: d.author_user_id || '',
      created_at: toISO(d.created_at),
    });
  });

  await recipeWriter.writeRecords(rows);
  console.log('✅ recipe.csv written');
  // return list of recipe ids for next step
  return rows.map(r => r.recipe_id);
}

async function exportIngredientsAndSteps(recipeIds) {
  const ingredientsWriter = createCsvWriter({
    path: path.join(OUTPUT_DIR, 'ingredients.csv'),
    header: [
      { id: 'recipe_id', title: 'recipe_id' },
      { id: 'ingredient_id', title: 'ingredient_id' },
      { id: 'name', title: 'name' },
      { id: 'quantity', title: 'quantity' },
      { id: 'unit', title: 'unit' },
      { id: 'notes', title: 'notes' },
      { id: 'order', title: 'order' },
    ],
  });

  const stepsWriter = createCsvWriter({
    path: path.join(OUTPUT_DIR, 'steps.csv'),
    header: [
      { id: 'recipe_id', title: 'recipe_id' },
      { id: 'step_id', title: 'step_id' },
      { id: 'order', title: 'order' },
      { id: 'text', title: 'text' },
    ],
  });

  const ingredientsRows = [];
  const stepsRows = [];

  for (const rid of recipeIds) {
    try {
      const ingSnap = await db.collection('recipes').doc(rid).collection('ingredients').get();
      ingSnap.forEach((doc) => {
        const d = doc.data() || {};
        ingredientsRows.push({
          recipe_id: rid,
          ingredient_id: d.ingredient_id || doc.id,
          name: d.name || '',
          quantity: d.quantity != null ? d.quantity : '',
          unit: d.unit || '',
          notes: d.notes || '',
          order: d.order != null ? d.order : '',
        });
      });
    } catch (e) {
      console.warn(`Warning: could not read ingredients for ${rid}: ${e.message}`);
    }

    try {
      const stepSnap = await db.collection('recipes').doc(rid).collection('steps').get();
      stepSnap.forEach((doc) => {
        const d = doc.data() || {};
        stepsRows.push({
          recipe_id: rid,
          step_id: d.step_id || doc.id,
          order: d.order != null ? d.order : '',
          text: d.text || '',
        });
      });
    } catch (e) {
      console.warn(`Warning: could not read steps for ${rid}: ${e.message}`);
    }
  }

  await ingredientsWriter.writeRecords(ingredientsRows);
  console.log('✅ ingredients.csv written');

  await stepsWriter.writeRecords(stepsRows);
  console.log('✅ steps.csv written');
}

async function exportInteractions() {
  const writer = createCsvWriter({
    path: path.join(OUTPUT_DIR, 'interactions.csv'),
    header: [
      { id: 'interaction_id', title: 'interaction_id' },
      { id: 'user_id', title: 'user_id' },
      { id: 'recipe_id', title: 'recipe_id' },
      { id: 'type', title: 'type' },
      { id: 'rating', title: 'rating' },
      { id: 'difficulty_used', title: 'difficulty_used' },
      { id: 'source', title: 'source' },
      { id: 'created_at', title: 'created_at' },
    ],
  });

  const snap = await db.collection('interactions').get();
  const rows = [];
  snap.forEach((doc) => {
    const d = doc.data() || {};
    rows.push({
      interaction_id: d.interaction_id || doc.id,
      user_id: d.user_id || '',
      recipe_id: d.recipe_id || '',
      type: d.type || '',
      rating: d.rating != null ? d.rating : '',
      difficulty_used: d.difficulty_used || '',
      source: d.source || '',
      created_at: toISO(d.created_at),
    });
  });

  await writer.writeRecords(rows);
  console.log('✅ interactions.csv written');
}

async function exportUsers() {
  const writer = createCsvWriter({
    path: path.join(OUTPUT_DIR, 'users.csv'),
    header: [
      { id: 'user_id', title: 'user_id' },
      { id: 'name', title: 'name' },
      { id: 'email', title: 'email' },
      { id: 'country', title: 'country' },
      { id: 'created_at', title: 'created_at' },
    ],
  });

  const snap = await db.collection('users').get();
  const rows = [];
  snap.forEach((doc) => {
    const d = doc.data() || {};
    rows.push({
      user_id: doc.id,
      name: d.name || '',
      email: d.email || '',
      country: d.country || '',
      created_at: toISO(d.created_at),
    });
  });

  await writer.writeRecords(rows);
  console.log('✅ users.csv written');
}

async function run() {
  try {
    ensureOutputDir();
    console.log('Starting export...');
    const recipeIds = await exportRecipes();
    await exportIngredientsAndSteps(recipeIds);
    await exportInteractions();
    await exportUsers();
    console.log('All exports complete. Files are in ./output/');
  } catch (err) {
    console.error('ETL failed:', err);
    process.exit(1);
  }
}

run();
