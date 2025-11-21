// validate_data.js
// Runs data quality checks and writes:
//  - output/validation_invalid.csv
//  - output/validation_valid_summary.csv
//  - output/validation_report.json

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

    const errors = []; // flat list of errors for CSV output
    // map to collect per-row errors for counting valid/invalid
    const perRowErrors = {}; // key: `${table}::${idx}` -> { table, row_index, id, errors: [] }

    const validDifficulties = new Set(['easy', 'medium', 'hard']);
    const validInteractionTypes = new Set(['view', 'like', 'cook_attempt', 'rating']);

    function pushError(table, idx, id, msg) {
      // record flat error row
      errors.push({ table, row_index: idx, id: id || '', error: msg });

      // record per-row error (for counting)
      const key = `${table}::${idx}`;
      if (!perRowErrors[key]) {
        perRowErrors[key] = { table, row_index: idx, id: id || '', errors: [] };
      }
      perRowErrors[key].errors.push(msg);
    }

    // --- Validate recipes
    recipes.forEach((row, idx) => {
      const rid = row.recipe_id ?? '';
      if (!rid || String(rid).trim() === '') pushError('recipes', idx, rid || '', 'recipe_id is missing or empty');
      if (!row.name || String(row.name).trim() === '') pushError('recipes', idx, rid || '', 'name is missing or empty');

      const servings = row.servings === '' ? NaN : Number(row.servings);
      if (isNaN(servings) || servings < 1) pushError('recipes', idx, rid || '', `servings must be a number >= 1 (got '${row.servings}')`);

      const prep = row.prep_time_min === '' ? NaN : Number(row.prep_time_min);
      const cook = row.cook_time_min === '' ? NaN : Number(row.cook_time_min);
      if (!isNaN(prep) && prep < 0) pushError('recipes', idx, rid || '', `prep_time_min must be >= 0 (got '${row.prep_time_min}')`);
      if (!isNaN(cook) && cook < 0) pushError('recipes', idx, rid || '', `cook_time_min must be >= 0 (got '${row.cook_time_min}')`);

      const diff = (row.difficulty || '').toString().trim().toLowerCase();
      if (!diff) pushError('recipes', idx, rid || '', 'difficulty is missing or empty');
      else if (!validDifficulties.has(diff)) pushError('recipes', idx, rid || '', `invalid difficulty: '${row.difficulty}'`);
    });

    // --- Validate ingredients
    ingredients.forEach((row, idx) => {
      const rid = row.recipe_id ?? '';
      const iid = row.ingredient_id ?? '';
      if (!rid || String(rid).trim() === '') pushError('ingredients', idx, iid || '', 'recipe_id is missing or empty');
      if (!row.name || String(row.name).trim() === '') pushError('ingredients', idx, iid || '', 'ingredient name is missing or empty');
      if (row.quantity !== '' && row.quantity !== null && row.quantity !== undefined) {
        if (!isNumberString(row.quantity) || Number(row.quantity) < 0) {
          pushError('ingredients', idx, iid || '', `quantity must be numeric and >= 0 (got '${row.quantity}')`);
        }
      }
    });

    // --- Validate steps
    steps.forEach((row, idx) => {
      const rid = row.recipe_id ?? '';
      const sid = row.step_id ?? '';
      if (!rid || String(rid).trim() === '') pushError('steps', idx, sid || '', 'recipe_id is missing or empty');
      if (!row.text || String(row.text).trim() === '') pushError('steps', idx, sid || '', 'step text is missing or empty');
      const order = row.order === '' ? NaN : Number(row.order);
      if (isNaN(order) || order < 1 || !Number.isInteger(order)) pushError('steps', idx, sid || '', `order must be an integer >= 1 (got '${row.order}')`);
    });

    // --- Validate interactions
    interactions.forEach((row, idx) => {
      const iid = row.interaction_id ?? '';
      const uid = row.user_id ?? '';
      const rid = row.recipe_id ?? '';

      if (!iid || String(iid).trim() === '') pushError('interactions', idx, iid || '', 'interaction_id is missing or empty');
      if (!uid || String(uid).trim() === '') pushError('interactions', idx, iid || '', 'user_id is missing or empty');
      if (!rid || String(rid).trim() === '') pushError('interactions', idx, iid || '', 'recipe_id is missing or empty');

      const type = (row.type || '').toString().trim().toLowerCase();
      if (!type || !validInteractionTypes.has(type)) pushError('interactions', idx, iid || '', `invalid or missing type: '${row.type}'`);

      if (row.rating !== '' && row.rating !== null && row.rating !== undefined) {
        if (!isNumberString(row.rating)) {
          pushError('interactions', idx, iid || '', `rating must be numeric 0-5 (got '${row.rating}')`);
        } else {
          const r = Number(row.rating);
          if (r < 0 || r > 5) pushError('interactions', idx, iid || '', `rating out of range 0-5 (got '${row.rating}')`);
        }
      }
    });

    // --- Prepare outputs

    // 1) validation_invalid.csv (one line per error)
    const invalidWriter = createCsvWriter({
      path: path.join(OUTPUT_DIR, 'validation_invalid.csv'),
      header: [
        { id: 'table', title: 'table' },
        { id: 'row_index', title: 'row_index' },
        { id: 'id', title: 'id' },
        { id: 'error', title: 'error' },
      ],
    });

    await invalidWriter.writeRecords(errors);

    // 2) validation_valid_summary.csv
    // For each table compute total rows and valid rows (valid = total - unique invalid rows)
    const totals = {
      recipes: recipes.length,
      ingredients: ingredients.length,
      steps: steps.length,
      interactions: interactions.length,
    };

    // compute invalid row counts per table (unique rows)
    const invalidRowCounts = {};
    Object.keys(perRowErrors).forEach((k) => {
      const rec = perRowErrors[k];
      invalidRowCounts[rec.table] = (invalidRowCounts[rec.table] || 0) + 1;
    });

    const validSummary = [];
    Object.keys(totals).forEach((table) => {
      const total = totals[table] || 0;
      const invalid = invalidRowCounts[table] || 0;
      const valid = Math.max(0, total - invalid);
      validSummary.push({ table, valid_count: valid, total_count: total });
    });

    const summaryWriter = createCsvWriter({
      path: path.join(OUTPUT_DIR, 'validation_valid_summary.csv'),
      header: [
        { id: 'table', title: 'table' },
        { id: 'valid_count', title: 'valid_count' },
        { id: 'total_count', title: 'total_count' },
      ],
    });

    await summaryWriter.writeRecords(validSummary);

    // 3) validation_report.json
    const invalidRecordsDetailed = Object.keys(perRowErrors).map((k) => {
      const r = perRowErrors[k];
      return {
        table: r.table,
        row_index: r.row_index,
        id: r.id,
        errors: r.errors,
      };
    });

    const report = {
      generated_at: new Date().toISOString(),
      totals,
      valid_counts: validSummary.reduce((acc, s) => { acc[s.table] = s.valid_count; return acc; }, {}),
      invalid_count: Object.keys(perRowErrors).length,
      invalid_records: invalidRecordsDetailed,
    };

    fs.writeFileSync(path.join(OUTPUT_DIR, 'validation_report.json'), JSON.stringify(report, null, 2), 'utf8');

    // Console summary
    console.log('--- Validation Summary ---');
    Object.keys(totals).forEach((t) => {
      console.log(`${t}: ${validSummary.find(s => s.table === t).valid_count}/${totals[t]} valid`);
    });
    console.log('');
    console.log(`Invalid records: ${report.invalid_count}`);
    console.log(`Written: ${path.join(OUTPUT_DIR, 'validation_invalid.csv')}`);
    console.log(`Written: ${path.join(OUTPUT_DIR, 'validation_valid_summary.csv')}`);
    console.log(`Written: ${path.join(OUTPUT_DIR, 'validation_report.json')}`);

    if (report.invalid_count === 0) {
      console.log('✅ Validation passed: no invalid rows found.');
    } else {
      console.log('⚠ Validation finished with errors. Please review validation_invalid.csv and validation_report.json.');
    }

    process.exit(0);

  } catch (err) {
    console.error('❌ Validation script error:', err);
    process.exit(1);
  }
})();
