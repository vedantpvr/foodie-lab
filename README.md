# Firebase Recipe Analytics Pipeline

## 📌 Features
* **Synthetic dataset generation** (recipes, ingredients, steps, interactions)
* **Automatic Firestore ingestion**
* **ETL → Normalized CSV export**
* **Data Quality Validation**
* **Analytics and insights generation**
* **Optional chart generation with Python**
* **Fully modular and reproducible pipeline**

---

## 📁 Project Structure


├── seeding_data.js           # Seeds database (Puran Poli) + Synthetic data
├── export_etl.js            # Extracts data to CSVs
├── validate_rule.js         # Quality assurance script
├── analysis.js             # Generates insights summary
├── generate_charts.py       # Python script for visualization
├── output/
│   ├── recipe.csv
│   ├── ingredients.csv
│   ├── steps.csv
│   ├── interactions.csv
│   ├── analytics_summary.txt
│   ├── validation_report.csv
│   └── charts/
│       ├── top_ingredients.png
│       ├── prep_time_histogram.png
│       └── prep_vs_likes_scatter.png
├── docs/
│   ├── ERD.png
│   └── data_dictionary.md
├── package.json
└── README.md 

## 1. Overview
This project implements a complete Data Engineering pipeline that generates synthetic recipe data, loads it into a Firebase NoSQL database, extracts it into a normalized relational schema (CSV), and performs data quality validation and analytics.

**Author:** Vedant Raut
**Assessment Duration:** < 10 Hours

---

## 2. Data Model
The source data in Firebase is document-based, but the output is normalized into four relational tables:

1.  **Recipes:** Core metadata (ID, Name, Prep Time, Difficulty).
2.  **Ingredients:** One-to-many relationship (Recipe ID <-> Ingredient Item).
3.  **Steps:** One-to-many relationship (Recipe ID <-> Step Instruction).
4.  **Interactions:** User event data (Views, Likes) linked to recipes.

---

## 3. Instructions for Running the Pipeline

### Prerequisites
* Node.js installed
* Firebase Service Account Key (`serviceAccountKey.json`) placed in the root folder.

### Execution Steps
1.  **Seed Data:** Run `node seeding_data.js` to upload the primary record ("Puran Poli").
2.  **Synthetic Data:** Run `node seeding_data.js` to create bulk random recipes and user interactions.
3.  **ETL Process:** Run `node export_etl.js` to extract Firestore data and transform it into CSV files.
4.  **Validation:** Run `node validate_rule.js` to check data integrity.
5.  **Analytics:** Run `node analysis.js` to generate insights.
6.  **Charts:** Run `node generate_chartsview business insights.

---

## 4. ETL Process Overview
The ETL pipeline (`export_etl.js`) connects to Firestore using the Admin SDK. 
* **Extract:** Fetches all documents from `recipes` and `interactions` collections.
* **Transform:** * Flattens nested `ingredients` arrays into a dedicated CSV structure.
    * Flattens nested `steps` arrays into a sequential CSV structure.
    * Sanitizes text fields (handling commas and quotes) to prevent CSV schema breakage.
* **Load:** Writes four clean `.csv` files to the local file system.

---

## 5. Insights Summary
Based on the analysis of the generated dataset:

* **Content Difficulty:** The recipe database is fairly balanced with **7 Easy**, **6 Medium**, and **7 Hard** recipes.
* **User Preference:** There is a **neutral** correlation between preparation time and popularity. The most popular dishes average **68.8 mins**, which is nearly identical to the global average of **68.5 mins**, suggesting users are equally open to quick and long recipes.
* **Top Ingredient:** **Chili powder** is the most frequently used component (appearing in 11 recipes).
* **Engagement:** The "Hard" difficulty recipes received a total of **4 likes** across 7 recipes, which is relatively low compared to the top-performing dish ("Savory Lentils Delight") which garnered 3 likes on its own.
* **Seed Data Performance:** The manually seeded "Puran Poli" recipe received **0 interactions** in this simulation, highlighting the need for better content discovery mechanisms for new uploads.

* **Content Difficulty:** The recipe database is split between [Insert Easy Count] Easy, [Insert Medium Count] Medium, and [Insert Hard Count] Hard recipes.
* **User Preference:** There is a [Positive/Negative] correlation between preparation time and popularity. Popular dishes average [Insert Time] mins vs the global average of [Insert Time] mins.
* **Top Ingredient:** [Insert Ingredient] is the most frequently used component.
* **Engagement:** The "Hard" difficulty recipes received a total of [Insert Number] likes, indicating [High/Low] user willingness to attempt complex dishes.

---

## 6. Limitations
* **Data Volume:** The dataset is currently small (approx. 20 records) and generated synthetically, which may not fully reflect real-world user behavior distributions.
* **In-Memory Processing:** The analytics engine loads all CSVs into memory. For datasets exceeding 1GB, this should be migrated to a dedicated tool like Python Pandas or SQL.