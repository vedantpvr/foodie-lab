// analytics.js
const fs = require('fs');
const path = require('path');
const csv = require('csv-parser');

const OUTPUT_DIR = path.join(__dirname, 'output');
const RECIPE_CSV = path.join(OUTPUT_DIR, 'recipe.csv');
const ING_CSV = path.join(OUTPUT_DIR, 'ingredients.csv');
const STEP_CSV = path.join(OUTPUT_DIR, 'steps.csv');
const INTER_CSV = path.join(OUTPUT_DIR, 'interactions.csv');
const REPORT_PATH = path.join(OUTPUT_DIR, 'analytics_summary.txt');

if (!fs.existsSync(OUTPUT_DIR)) {
  console.error('Error: output/ directory does not exist. Run export_etl.js first.');
  process.exit(1);
}

function readCsv(filePath) {
  return new Promise((resolve, reject) => {
    const rows = [];
    if (!fs.existsSync(filePath)) {
      return resolve(rows);
    }
    fs.createReadStream(filePath)
      .pipe(csv())
      .on('data', (data) => rows.push(data))
      .on('end', () => resolve(rows))
      .on('error', (err) => reject(err));
  });
}

function mean(arr) {
  if (!arr.length) return 0;
  return arr.reduce((s, v) => s + v, 0) / arr.length;
}

function pearson(x, y) {
  if (!x.length || x.length !== y.length) return 0;
  const n = x.length;
  const meanX = mean(x);
  const meanY = mean(y);
  let num = 0, denX = 0, denY = 0;
  for (let i = 0; i < n; i++) {
    const dx = x[i] - meanX;
    const dy = y[i] - meanY;
    num += dx * dy;
    denX += dx * dx;
    denY += dy * dy;
  }
  if (denX === 0 || denY === 0) return 0;
  return num / Math.sqrt(denX * denY);
}

function topN(obj, n = 10) {
  return Object.entries(obj)
    .sort((a, b) => b[1] - a[1])
    .slice(0, n)
    .map(([k, v]) => ({ key: k, value: v }));
}

(async function main() {
  try {
    const [recipes, ingredients, steps, interactions] = await Promise.all([
      readCsv(RECIPE_CSV),
      readCsv(ING_CSV),
      readCsv(STEP_CSV),
      readCsv(INTER_CSV),
    ]);

    // Basic counts
    const totalRecipes = recipes.length;
    const totalIngredients = ingredients.length;
    const totalSteps = steps.length;
    const totalInteractions = interactions.length;

    // Build quick maps
    const recipeMap = {}; // recipe_id -> recipe row
    recipes.forEach(r => {
      // normalize numeric fields
      const prep = Number(r.prep_time_min) || 0;
      const cook = Number(r.cook_time_min) || 0;
      recipeMap[r.recipe_id] = {
        ...r,
        prep_time_min: prep,
        cook_time_min: cook,
        total_time_min: (r.total_time_min && !isNaN(Number(r.total_time_min))) ? Number(r.total_time_min) : (prep + cook),
      };
    });

    // 1) Most common ingredients
    const ingredientCounts = {};
    for (const ing of ingredients) {
      const name = (ing.name || '').trim();
      if (!name) continue;
      ingredientCounts[name] = (ingredientCounts[name] || 0) + 1;
    }
    const topIngredients = topN(ingredientCounts, 20);

    // 2) Average prep & cook time
    const prepTimes = recipes.map(r => Number(r.prep_time_min) || 0).filter(v => !isNaN(v));
    const cookTimes = recipes.map(r => Number(r.cook_time_min) || 0).filter(v => !isNaN(v));
    const avgPrep = mean(prepTimes);
    const avgCook = mean(cookTimes);

    // 3) Difficulty distribution
    const difficultyDist = {};
    for (const r of recipes) {
      const d = (r.difficulty || '').toString().trim().toLowerCase() || 'unknown';
      difficultyDist[d] = (difficultyDist[d] || 0) + 1;
    }

    // 4-7) Interaction aggregations
    const viewsCount = {};
    const likesCount = {};
    const attemptsCount = {};
    const ratingsPerRecipe = {}; // recipe_id -> [ratings]
    const usersSet = new Set();

    for (const it of interactions) {
      const rid = it.recipe_id || 'UNKNOWN';
      const type = (it.type || '').toString().trim().toLowerCase();
      const uid = it.user_id || null;
      if (uid) usersSet.add(uid);

      if (type === 'view') {
        viewsCount[rid] = (viewsCount[rid] || 0) + 1;
      } else if (type === 'like') {
        likesCount[rid] = (likesCount[rid] || 0) + 1;
      } else if (type === 'cook_attempt') {
        attemptsCount[rid] = (attemptsCount[rid] || 0) + 1;
      } else if (type === 'rating') {
        const r = it.rating !== '' && it.rating != null ? Number(it.rating) : NaN;
        if (!isNaN(r)) {
          ratingsPerRecipe[rid] = ratingsPerRecipe[rid] || [];
          ratingsPerRecipe[rid].push(r);
        }
      }
    }

    const topViewed = topN(viewsCount, 10);
    const topLiked = topN(likesCount, 10);
    const topAttempts = topN(attemptsCount, 10);

    // 8) Average rating per recipe (top 10)
    const avgRatingPerRecipe = {};
    for (const [rid, arr] of Object.entries(ratingsPerRecipe)) {
      if (arr && arr.length) avgRatingPerRecipe[rid] = mean(arr);
    }
    const topAvgRated = topN(avgRatingPerRecipe, 10);

    // 9) Correlation: prep_time_min vs like_count (for recipes that exist)
    const likeCountsVector = [];
    const prepVector = [];
    for (const r of recipes) {
      const rid = r.recipe_id;
      const prep = Number(r.prep_time_min) || 0;
      const likes = likesCount[rid] || 0;
      prepVector.push(prep);
      likeCountsVector.push(likes);
    }
    const prepLikesCorr = pearson(prepVector, likeCountsVector);

    // 10) Ingredients in top-liked recipes
    const topLikedIds = topLiked.map(x => x.key);
    const ingInTopLiked = {};
    for (const ing of ingredients) {
      if (topLikedIds.includes(ing.recipe_id)) {
        const name = (ing.name || '').trim();
        if (!name) continue;
        ingInTopLiked[name] = (ingInTopLiked[name] || 0) + 1;
      }
    }
    const topIngInTopLiked = topN(ingInTopLiked, 20);

    // 11) Ingredients associated with high engagement (recipes with likes > median)
    const likeValues = Object.values(likesCount).map(v => Number(v));
    const medianLikes = (() => {
      if (!likeValues.length) return 0;
      likeValues.sort((a,b) => a-b);
      const mid = Math.floor(likeValues.length/2);
      return likeValues.length % 2 === 0 ? (likeValues[mid-1] + likeValues[mid]) / 2 : likeValues[mid];
    })();

    const highEngRecipeIds = new Set(Object.entries(likesCount).filter(([rid, cnt]) => Number(cnt) > medianLikes).map(([rid]) => rid));
    const ingCountsHighEng = {};
    for (const ing of ingredients) {
      if (highEngRecipeIds.has(ing.recipe_id)) {
        const name = (ing.name || '').trim();
        if (!name) continue;
        ingCountsHighEng[name] = (ingCountsHighEng[name] || 0) + 1;
      }
    }
    const topIngHighEng = topN(ingCountsHighEng, 20);

    // 12) Additional summary stats
    const totalUsers = usersSet.size;

    // Build report text
    const lines = [];
    lines.push("ANALYTICS SUMMARY");
    lines.push("==================");
    lines.push("");
    lines.push(`Report generated: ${new Date().toISOString()}`);
    lines.push("");
    lines.push("SUMMARY STATS");
    lines.push("-------------");
    lines.push(`Total recipes: ${totalRecipes}`);
    lines.push(`Total ingredients rows: ${totalIngredients}`);
    lines.push(`Total steps rows: ${totalSteps}`);
    lines.push(`Total interactions: ${totalInteractions}`);
    lines.push(`Detected users (from interactions): ${totalUsers}`);
    lines.push("");
    lines.push("1) MOST COMMON INGREDIENTS (top 20)");
    lines.push("----------------------------------");
    topIngredients.forEach((it, idx) => lines.push(`${idx+1}. ${it.key} — ${it.value}`));
    lines.push("");

    lines.push("2) AVERAGE PREPARATION TIME (min)");
    lines.push("----------------------------------");
    lines.push(`Average prep_time_min: ${avgPrep.toFixed(2)}`);
    lines.push("");

    lines.push("3) AVERAGE COOK TIME (min)");
    lines.push("---------------------------");
    lines.push(`Average cook_time_min: ${avgCook.toFixed(2)}`);
    lines.push("");

    lines.push("4) DIFFICULTY DISTRIBUTION");
    lines.push("---------------------------");
    Object.entries(difficultyDist).forEach(([k,v]) => lines.push(`${k}: ${v}`));
    lines.push("");

    lines.push("5) MOST VIEWED RECIPES (top 10)");
    lines.push("--------------------------------");
    topViewed.forEach((it, idx) => {
      const name = recipeMap[it.key] ? recipeMap[it.key].name : it.key;
      lines.push(`${idx+1}. ${name} (${it.key}) — ${it.value} views`);
    });
    lines.push("");

    lines.push("6) MOST LIKED RECIPES (top 10)");
    lines.push("-------------------------------");
    topLiked.forEach((it, idx) => {
      const name = recipeMap[it.key] ? recipeMap[it.key].name : it.key;
      lines.push(`${idx+1}. ${name} (${it.key}) — ${it.value} likes`);
    });
    lines.push("");

    lines.push("7) MOST COOK-ATTEMPTED RECIPES (top 10)");
    lines.push("----------------------------------------");
    topAttempts.forEach((it, idx) => {
      const name = recipeMap[it.key] ? recipeMap[it.key].name : it.key;
      lines.push(`${idx+1}. ${name} (${it.key}) — ${it.value} attempts`);
    });
    lines.push("");

    lines.push("8) AVERAGE RATING PER RECIPE (top 10)");
    lines.push("-------------------------------------");
    if (Object.keys(avgRatingPerRecipe).length === 0) {
      lines.push("No rating data available.");
    } else {
      topAvgRated.forEach((it, idx) => {
        const name = recipeMap[it.key] ? recipeMap[it.key].name : it.key;
        lines.push(`${idx+1}. ${name} (${it.key}) — avg rating: ${it.value.toFixed(2)}`);
      });
    }
    lines.push("");

    lines.push("9) CORRELATION: PREP TIME vs LIKE COUNT");
    lines.push("---------------------------------------");
    lines.push(`Pearson correlation (prep_time_min vs like_count): ${prepLikesCorr.toFixed(4)}`);
    lines.push("");

    lines.push("10) INGREDIENTS IN TOP-LIKED RECIPES (top 20)");
    lines.push("---------------------------------------------");
    if (topIngInTopLiked.length === 0) lines.push("No ingredient data for top-liked recipes.");
    else topIngInTopLiked.forEach((it, idx) => lines.push(`${idx+1}. ${it.key} — ${it.value}`));
    lines.push("");

    lines.push("11) INGREDIENTS ASSOCIATED WITH HIGH-ENGAGEMENT RECIPES (top 20)");
    lines.push("-----------------------------------------------------------------");
    if (topIngHighEng.length === 0) lines.push("No high-engagement ingredient data available.");
    else topIngHighEng.forEach((it, idx) => lines.push(`${idx+1}. ${it.key} — ${it.value}`));
    lines.push("");

    lines.push("12) NOTES & NEXT STEPS");
    lines.push("----------------------");
    lines.push("- Use timestamps to compute time-windowed metrics (e.g., last 30 days).");
    lines.push("- If you want visualizations (bar charts, correlation plots), I can generate them separately.");
    lines.push("- For high-volume projects, move aggregations to a DB or use streaming/BigQuery.");
    lines.push("");

    const reportText = lines.join('\n');

    // Save report
    fs.writeFileSync(REPORT_PATH, reportText, 'utf8');
    console.log('✅ Analytics complete. Summary written to:', REPORT_PATH);
    console.log('--- summary (first 20 lines) ---');
    console.log(reportText.split('\n').slice(0, 20).join('\n'));
    console.log('---------------------------------');

  } catch (err) {
    console.error('❌ Analytics error:', err);
    process.exit(1);
  }
})();
