// validate_data.js
const fs = require('fs');
const path = require('path');
const csv = require('csv-parser');
const createCsvWriter = require('csv-writer').createObjectCsvWriter;

const OUTPUT_DIR = path.join(__dirname, 'output');
if (!fs.existsSync(OUTPUT_DIR)) {
  console.error('Error: output/ directory does not exist. Run export_etl.js first.');
  process.exit(1);
}

function readCsv(filePath) {
  return new Promise((resolve, reject) => {
    const rows = [];
    if (!fs.existsSync(filePath)) {
      resolve(rows); // empty array if file missing
      return;
    }
    fs.createReadStream(filePath)
      .pipe(csv())
      .on('data', (data) => rows.push(data))
      .on('end', () => resolve(rows))
      .on('error', (err) => reject(err));
  });
}

function addError(errors, table, rowIdx, msg) {
  errors.push({ table, row_index: rowIdx, error: msg });
}

function isNumberString(val) {
  if (val === '' || val === null || val === undefined) return false;
  return !isNaN(Number(val));
}

(async function main() {
  try {
    const recipePath = path.join(OUTPUT_DIR, 'recipe.csv');
    const ingPath = path.join(OUTPUT_DIR, 'ingredients.csv');
    const stepsPath = path.join(OUTPUT_DIR, 'steps.csv');
    const interPath = path.join(OUTPUT_DIR, 'interactions.csv');

    const [recipes, ingredients, steps, interactions] = await Promise.all([
      readCsv(recipePath),
      readCsv(ingPath),
      readCsv(stepsPath),
      readCsv(interPath),
    ]);

    const errors = [];
    const validDifficulties = new Set(['easy', 'medium', 'hard']);
    const validInteractionTypes = new Set(['view', 'like', 'cook_attempt', 'rating']);

    // --- Validate recipes
    recipes.forEach((row, idx) => {
      const rid = row.recipe_id ?? '';
      if (!rid || String(rid).trim() === '') addError(errors, 'recipe', idx, 'recipe_id is missing or empty');
      if (!row.name || String(row.name).trim() === '') addError(errors, 'recipe', idx, 'name is missing or empty');

      const servings = row.servings === '' ? NaN : Number(row.servings);
      if (isNaN(servings) || servings < 1) addError(errors, 'recipe', idx, `servings must be a number >= 1 (got '${row.servings}')`);

      const prep = row.prep_time_min === '' ? NaN : Number(row.prep_time_min);
      const cook = row.cook_time_min === '' ? NaN : Number(row.cook_time_min);
      if (!isNaN(prep) && prep < 0) addError(errors, 'recipe', idx, `prep_time_min must be >= 0 (got '${row.prep_time_min}')`);
      if (!isNaN(cook) && cook < 0) addError(errors, 'recipe', idx, `cook_time_min must be >= 0 (got '${row.cook_time_min}')`);

      const diff = (row.difficulty || '').toString().trim().toLowerCase();
      if (diff && !validDifficulties.has(diff)) addError(errors, 'recipe', idx, `invalid difficulty: '${row.difficulty}'`);
      if (!diff) addError(errors, 'recipe', idx, 'difficulty is missing or empty');
    });

    // --- Validate ingredients
    ingredients.forEach((row, idx) => {
      if (!row.recipe_id || String(row.recipe_id).trim() === '') addError(errors, 'ingredients', idx, 'recipe_id is missing or empty');
      if (!row.name || String(row.name).trim() === '') addError(errors, 'ingredients', idx, 'ingredient name is missing or empty');
      if (row.quantity !== '' && row.quantity !== null && row.quantity !== undefined) {
        if (!isNumberString(row.quantity) || Number(row.quantity) < 0) {
          addError(errors, 'ingredients', idx, `quantity must be numeric and >= 0 (got '${row.quantity}')`);
        }
      }
    });

    // --- Validate steps
    steps.forEach((row, idx) => {
      if (!row.recipe_id || String(row.recipe_id).trim() === '') addError(errors, 'steps', idx, 'recipe_id is missing or empty');
      if (!row.text || String(row.text).trim() === '') addError(errors, 'steps', idx, 'step text is missing or empty');
      const order = row.order === '' ? NaN : Number(row.order);
      if (isNaN(order) || order < 1 || !Number.isInteger(order)) addError(errors, 'steps', idx, `order must be an integer >= 1 (got '${row.order}')`);
    });

    // --- Validate interactions
    interactions.forEach((row, idx) => {
      if (!row.interaction_id || String(row.interaction_id).trim() === '') addError(errors, 'interactions', idx, 'interaction_id is missing or empty');
      if (!row.user_id || String(row.user_id).trim() === '') addError(errors, 'interactions', idx, 'user_id is missing or empty');
      if (!row.recipe_id || String(row.recipe_id).trim() === '') addError(errors, 'interactions', idx, 'recipe_id is missing or empty');

      const type = (row.type || '').toString().trim().toLowerCase();
      if (!type || !validInteractionTypes.has(type)) addError(errors, 'interactions', idx, `invalid or missing type: '${row.type}'`);

      if (row.rating !== '' && row.rating !== null && row.rating !== undefined) {
        if (!isNumberString(row.rating)) {
          addError(errors, 'interactions', idx, `rating must be numeric 0-5 (got '${row.rating}')`);
        } else {
          const r = Number(row.rating);
          if (r < 0 || r > 5) addError(errors, 'interactions', idx, `rating out of range 0-5 (got '${row.rating}')`);
        }
      }
    });

    // --- Write validation_report.csv
    const reportPath = path.join(OUTPUT_DIR, 'validation_report.csv');
    const csvWriter = createCsvWriter({
      path: reportPath,
      header: [
        { id: 'table', title: 'table' },
        { id: 'row_index', title: 'row_index' },
        { id: 'error', title: 'error' },
      ],
    });

    await csvWriter.writeRecords(errors);
    if (errors.length === 0) {
      console.log('✅ Validation passed: no errors found. (validation_report.csv created but empty)');
    } else {
      console.log(`⚠ Validation finished: ${errors.length} error(s) found. See ${reportPath}`);
    }

  } catch (err) {
    console.error('❌ Validation script error:', err);
    process.exit(1);
  }
})();
