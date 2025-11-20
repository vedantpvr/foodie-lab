#!/usr/bin/env python3
"""
generate_charts.py

Reads normalized CSVs in ./output/ (recipe.csv, ingredients.csv, interactions.csv).
If not found, synthesizes a dataset for demo. Generates 3 PNG charts and saves to ./output/charts/.

Requirements:
  pip install pandas matplotlib
(Do not install seaborn; script uses matplotlib as required.)
"""

import os
from pathlib import Path
import pandas as pd
import matplotlib
matplotlib.use('Agg')  # non-interactive backend
import matplotlib.pyplot as plt
import random

# Output folder
OUT_DIR = Path("output/charts")
OUT_DIR.mkdir(parents=True, exist_ok=True)

# Candidate paths to find CSVs
CANDIDATE_ING = [Path("output/ingredients.csv"), Path("/mnt/data/output/ingredients.csv")]
CANDIDATE_RECIPE = [Path("output/recipe.csv"), Path("/mnt/data/output/recipe.csv")]
CANDIDATE_INTER = [Path("output/interactions.csv"), Path("/mnt/data/output/interactions.csv")]

def try_read(candidates):
    for p in candidates:
        if p.exists():
            try:
                df = pd.read_csv(p)
                print(f"Loaded: {p}")
                return df
            except Exception as e:
                print(f"Found {p} but failed to read: {e}")
    return None

ingredients_df = try_read(CANDIDATE_ING)
recipe_df = try_read(CANDIDATE_RECIPE)
inter_df = try_read(CANDIDATE_INTER)

used_synthetic = False

if ingredients_df is None or recipe_df is None or inter_df is None:
    used_synthetic = True
    print("One or more CSVs not found; generating synthetic dataset for charts.")
    # Build synthetic recipe list (includes puran poli)
    sample_recipes = [
        "recipe_puran_poli","recipe_pasta_alfredo","recipe_veg_biryani","recipe_aloo_paratha","recipe_egg_fried_rice",
        "recipe_mutton_masala","recipe_paneer_butter_masala","recipe_fish_curry","recipe_dal_tadka","recipe_chapati",
        "recipe_idli_sambhar","recipe_chicken_biryani","recipe_tomato_soup","recipe_pav_bhaji","recipe_upma",
        "recipe_poha","recipe_omelette","recipe_maggi","recipe_fried_chicken","recipe_chicken_kebab"
    ]
    recipe_rows = []
    for rid in sample_recipes:
        prep = random.randint(10,40)
        cook = random.randint(10,60)
        recipe_rows.append({
            "recipe_id": rid,
            "name": rid.replace("recipe_","").replace("_"," ").title(),
            "prep_time_min": prep,
            "cook_time_min": cook,
            "total_time_min": prep + cook,
            "difficulty": random.choice(["easy","medium","hard"])
        })
    recipe_df = pd.DataFrame(recipe_rows)

    common_ings = ["onion","garlic","tomato","chicken","oil","salt","turmeric","cumin","coriander","ghee","sugar","jaggery"]
    ing_rows = []
    for rid in sample_recipes:
        num_ing = random.randint(5,9)
        picked = random.choices(common_ings, k=num_ing)
        for i, name in enumerate(picked, start=1):
            ing_rows.append({
                "recipe_id": rid,
                "ingredient_id": f"{rid}_ing{i}",
                "name": name,
                "quantity": random.choice([1,2,50,100,200]),
                "unit": random.choice(["g","tbsp","tsp","cup","unit"]),
                "notes": "",
                "order": i
            })
    ingredients_df = pd.DataFrame(ing_rows)

    inter_rows = []
    for i in range(400):
        rid = random.choice(sample_recipes)
        t = random.choices(["view","like","cook_attempt","rating"], weights=[0.6,0.2,0.15,0.05])[0]
        inter_rows.append({
            "interaction_id": f"int_{i}",
            "user_id": f"user{random.randint(1,12)}",
            "recipe_id": rid,
            "type": t,
            "rating": random.choice([None,3,4,5]) if t=="rating" else ""
        })
    inter_df = pd.DataFrame(inter_rows)

# --- 1) Top ingredients (bar chart)
top_ing = ingredients_df['name'].astype(str).str.strip().value_counts().reset_index()
top_ing.columns = ['ingredient','count']
top_ing = top_ing.head(20)

fig1, ax1 = plt.subplots(figsize=(10,6))
ax1.bar(top_ing['ingredient'], top_ing['count'])
ax1.set_title('Top Ingredients (by occurrence)')
ax1.set_ylabel('Count')
ax1.set_xlabel('Ingredient')
plt.xticks(rotation=45, ha='right')
plt.tight_layout()
chart1 = OUT_DIR / "top_ingredients.png"
fig1.savefig(chart1)
plt.close(fig1)

# Save preview CSV
preview_csv = OUT_DIR / "top_ingredients_preview.csv"
top_ing.to_csv(preview_csv, index=False)

# --- 2) Histogram: prep_time_min distribution
prep_series = pd.to_numeric(recipe_df['prep_time_min'], errors='coerce').dropna()
fig2, ax2 = plt.subplots(figsize=(8,5))
ax2.hist(prep_series, bins=10)
ax2.set_title('Distribution of Prep Time (minutes)')
ax2.set_xlabel('Prep time (min)')
ax2.set_ylabel('Number of recipes')
plt.tight_layout()
chart2 = OUT_DIR / "prep_time_histogram.png"
fig2.savefig(chart2)
plt.close(fig2)

# --- 3) Scatter: prep_time_min vs like_count
likes = inter_df[inter_df['type']=='like'].groupby('recipe_id').size().reset_index(name='like_count')
if 'recipe_id' not in recipe_df.columns:
    # if recipe_df index is not labeled, ensure column exists
    recipe_df = recipe_df.rename(columns={recipe_df.columns[0]:'recipe_id'}) if 'recipe_id' not in recipe_df.columns else recipe_df

prep_likes_df = recipe_df[['recipe_id','prep_time_min']].merge(likes, on='recipe_id', how='left').fillna(0)
prep_likes_df['prep_time_min'] = pd.to_numeric(prep_likes_df['prep_time_min'], errors='coerce').fillna(0)
prep_likes_df['like_count'] = pd.to_numeric(prep_likes_df['like_count'], errors='coerce').fillna(0)

fig3, ax3 = plt.subplots(figsize=(8,6))
ax3.scatter(prep_likes_df['prep_time_min'], prep_likes_df['like_count'])
ax3.set_title('Prep Time vs Like Count')
ax3.set_xlabel('Prep time (min)')
ax3.set_ylabel('Like count')
plt.tight_layout()
chart3 = OUT_DIR / "prep_vs_likes_scatter.png"
fig3.savefig(chart3)
plt.close(fig3)

# Create README in charts folder
readme_lines = []
if used_synthetic:
    readme_lines.append("NOTE: Some CSVs were not found; charts generated from a synthetic dataset.")
else:
    readme_lines.append("Charts generated from existing CSV exports in output/")

readme_lines.append("")
readme_lines.append(f"Top ingredients chart: {chart1}")
readme_lines.append(f"Prep time histogram: {chart2}")
readme_lines.append(f"Prep vs likes scatter: {chart3}")
(OUT_DIR / "README_charts.txt").write_text("\n".join(map(str, readme_lines)))

print("Charts created in:", OUT_DIR)
print("- top ingredients preview saved to:", preview_csv)
