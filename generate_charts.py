
"""
generate_charts.py

Reads normalized CSVs in ./output/:
  - recipe.csv
  - ingredients.csv
  - interactions.csv
  - users.csv

If any are missing, synthetic fallback data is used.

Generates:
  - Top ingredients bar chart
  - Prep time histogram
  - Prep time vs like count scatter
  - Users by country bar chart
  - Top users by interactions
  - Interactions per day (if timestamps available)

Outputs to:
  ./output/charts/
  ./output/charts/users/

Requirements:
  pip install pandas matplotlib
"""

import os
from pathlib import Path
import pandas as pd
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
import random

# -------------------------
# Output folders
# -------------------------
CHART_DIR = Path("output/charts")
USER_CHART_DIR = CHART_DIR / "users"
CHART_DIR.mkdir(parents=True, exist_ok=True)
USER_CHART_DIR.mkdir(parents=True, exist_ok=True)

# Candidate CSV paths
CANDIDATE_CSVS = {
    "ingredients": [Path("output/ingredients.csv"), Path("/mnt/data/output/ingredients.csv")],
    "recipe": [Path("output/recipe.csv"), Path("/mnt/data/output/recipe.csv")],
    "interactions": [Path("output/interactions.csv"), Path("/mnt/data/output/interactions.csv")],
    "users": [Path("output/users.csv"), Path("/mnt/data/output/users.csv")],
}

def try_read(candidates):
    for p in candidates:
        if p.exists():
            try:
                print(f"Loaded: {p}")
                return pd.read_csv(p)
            except Exception as e:
                print(f"Found {p} but failed to read: {e}")
    return None


# -------------------------
# Load CSVs if exist
# -------------------------
ingredients_df = try_read(CANDIDATE_CSVS["ingredients"])
recipe_df = try_read(CANDIDATE_CSVS["recipe"])
inter_df = try_read(CANDIDATE_CSVS["interactions"])
users_df = try_read(CANDIDATE_CSVS["users"])

used_synthetic = False

# -------------------------
# Synthetic fallback dataset
# -------------------------
if ingredients_df is None or recipe_df is None or inter_df is None:
    used_synthetic = True
    print("Synthesizing fallback dataset...")

    sample_recipes = [
        "recipe_puran_poli","recipe_pasta_alfredo","recipe_veg_biryani",
        "recipe_aloo_paratha","recipe_egg_fried_rice","recipe_paneer_butter_masala"
    ]

    recipe_rows = []
    ing_rows = []
    inter_rows = []
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
        for i in range(5):
            ing_rows.append({
                "recipe_id": rid,
                "ingredient_id": f"{rid}_ing{i+1}",
                "name": random.choice(["onion","garlic","salt","oil","turmeric"]),
                "quantity": random.choice([1,2,3]),
                "unit": "unit",
                "order": i+1
            })

    for i in range(100):
        rid = random.choice(sample_recipes)
        t = random.choice(["view","like","cook_attempt","rating"])
        inter_rows.append({
            "interaction_id": f"int_{i}",
            "user_id": f"user{random.randint(1,10)}",
            "recipe_id": rid,
            "type": t,
            "rating": random.choice([None,3,4,5]) if t=="rating" else ""
        })

    recipe_df = pd.DataFrame(recipe_rows)
    ingredients_df = pd.DataFrame(ing_rows)
    inter_df = pd.DataFrame(inter_rows)

# ------------------------------
# CHART 1 — TOP INGREDIENTS
# ------------------------------
top_ing = ingredients_df["name"].astype(str).str.strip().value_counts().reset_index()
top_ing.columns = ["ingredient", "count"]
top_ing = top_ing.head(20)

fig1, ax1 = plt.subplots(figsize=(10,6))
ax1.bar(top_ing["ingredient"], top_ing["count"])
ax1.set_title("Top Ingredients (by occurrence)")
ax1.set_xlabel("Ingredient")
ax1.set_ylabel("Count")
plt.xticks(rotation=45, ha="right")
plt.tight_layout()
fig1.savefig(CHART_DIR / "top_ingredients.png")
plt.close(fig1)

top_ing.to_csv(CHART_DIR / "top_ingredients_preview.csv", index=False)


# ------------------------------
# CHART 2 — PREP TIME HISTOGRAM
# ------------------------------
prep_series = pd.to_numeric(recipe_df["prep_time_min"], errors="coerce").dropna()

fig2, ax2 = plt.subplots(figsize=(8,5))
ax2.hist(prep_series, bins=10)
ax2.set_title("Preparation Time Distribution")
ax2.set_xlabel("Prep Time (min)")
ax2.set_ylabel("Number of Recipes")
plt.tight_layout()
fig2.savefig(CHART_DIR / "prep_time_histogram.png")
plt.close(fig2)


# ------------------------------
# CHART 3 — PREP TIME VS LIKES
# ------------------------------
likes = inter_df[inter_df["type"]=="like"].groupby("recipe_id").size().reset_index(name="like_count")

prep_likes = recipe_df.merge(likes, on="recipe_id", how="left").fillna(0)
prep_likes["prep_time_min"] = pd.to_numeric(prep_likes["prep_time_min"], errors="coerce").fillna(0)

fig3, ax3 = plt.subplots(figsize=(8,6))
ax3.scatter(prep_likes["prep_time_min"], prep_likes["like_count"])
ax3.set_title("Prep Time vs Like Count")
ax3.set_xlabel("Prep Time (min)")
ax3.set_ylabel("Likes")
plt.tight_layout()
fig3.savefig(CHART_DIR / "prep_vs_likes_scatter.png")
plt.close(fig3)


# =========================================================
#               USER ANALYTICS (NEW SECTION)
# =========================================================

if users_df is not None:

    # --------------------------------------
    # USERS 1: Users by Country
    # --------------------------------------
    if "country" in users_df.columns:
        country_counts = users_df["country"].fillna("unknown").astype(str).value_counts()
        fig_u1, ax_u1 = plt.subplots(figsize=(8,5))
        country_counts.plot(kind="bar", ax=ax_u1)
        ax_u1.set_title("Users by Country")
        ax_u1.set_xlabel("Country")
        ax_u1.set_ylabel("User Count")
        plt.xticks(rotation=45, ha="right")
        plt.tight_layout()
        fig_u1.savefig(USER_CHART_DIR / "users_by_country.png")
        plt.close(fig_u1)

    # --------------------------------------
    # USERS 2: Top Users by Interactions
    # --------------------------------------
    if "user_id" in inter_df.columns:
        top_users = inter_df["user_id"].fillna("unknown").value_counts().head(20)
        fig_u2, ax_u2 = plt.subplots(figsize=(8,6))
        top_users.plot(kind="barh", ax=ax_u2)
        ax_u2.set_title("Top Users by Interaction Count")
        ax_u2.set_xlabel("Interactions")
        ax_u2.set_ylabel("User ID")
        plt.tight_layout()
        fig_u2.savefig(USER_CHART_DIR / "top_users_by_interactions.png")
        plt.close(fig_u2)

    # --------------------------------------
    # USERS 3: Interactions per Day (if timestamps exist)
    # --------------------------------------
    if "created_at" in inter_df.columns:
        try:
            inter_df["created_at_parsed"] = pd.to_datetime(inter_df["created_at"], errors="coerce")
            df_time = inter_df.dropna(subset=["created_at_parsed"])
            if not df_time.empty:
                df_time["date"] = df_time["created_at_parsed"].dt.date
                daily = df_time.groupby("date").size()

                fig_u3, ax_u3 = plt.subplots(figsize=(10,5))
                daily.plot(ax=ax_u3)
                ax_u3.set_title("Interactions Per Day")
                ax_u3.set_xlabel("Date")
                ax_u3.set_ylabel("Interactions")
                plt.xticks(rotation=45, ha="right")
                plt.tight_layout()
                fig_u3.savefig(USER_CHART_DIR / "interactions_per_day.png")
                plt.close(fig_u3)
        except:
            pass


# ------------------------------
# README FILE FOR CHARTS
# ------------------------------
readme = []

if used_synthetic:
    readme.append("NOTE: Missing CSVs — synthetic fallback data used for demo charts.")
else:
    readme.append("Charts generated from ETL CSV files in /output/")

readme.append("")
readme.append("Recipe Charts:")
readme.append("- top_ingredients.png")
readme.append("- prep_time_histogram.png")
readme.append("- prep_vs_likes_scatter.png")
readme.append("")
readme.append("User Charts:")
readme.append("- users_by_country.png")
readme.append("- top_users_by_interactions.png")


(CHART_DIR / "README_charts.txt").write_text("\n".join(readme))

print("\nAll charts saved to:", CHART_DIR)
print("User charts saved to:", USER_CHART_DIR)
