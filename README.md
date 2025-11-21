## Firebase Recipe Analytics Pipeline

A complete Data Engineering pipeline that generates synthetic recipe data, creates a user interaction simulation, ingests it into a Firebase NoSQL database, and performs an ETL process to extract normalized insights.



---

## 📌 Features
* **Synthetic dataset generation-** Programmatically creates recipes (ingredients, steps) and user interactions.
* **Firestore Ingestion-** automated loading of structured document data into the cloud.
* **ETL → Normalized CSV export-** Extracts NoSQL data and transforms it into a normalized Relational CSV schema.
* **Data Quality Validation-** Automated validation scripts to ensure data integrity.
* **Analytics and insights generation-** Generates textual insights and summaries.
* **Optional chart generation with Python-** Python integration for generating statistical charts.
* **Fully modular and reproducible pipeline-** Fully modular design allows the pipeline to be reset and re-run easily.


---

## 1. Overview
This project implements a complete Data Engineering pipeline that generates synthetic recipe data, loads it into a Firebase NoSQL database, extracts it into a normalized relational schema (CSV), and performs data quality validation and analytics.

**Author:** Vedant Raut

---

## 2. Data Model
The pipeline bridges the gap between NoSQL and SQL paradigms.

Source: Firestore (Document-based, nested arrays for ingredients and steps).

Destination: Normalized CSV (Relational, 4 distinct tables).


* **Recipes Table:** Core metadata (ID, Name, Prep Time, Difficulty) - Primary Table
* **Ingredients** - Specific items required for a dish - One-to-Many (Recipe → Ingredients)
* **Steps** - Sequential cooking instructions. - One-to-Many (Recipe → Steps)
* **Interactions** - User events (Views, Likes) timestamped.- Linked by Recipe ID
![ERD](/docs/ERD.png)
[View on dbdiagram.io] (https://dbdiagram.io/d/69204741228c5bbc1ae7221b)

---

## 3. Instructions for Running the Pipeline

### Prerequisites
* Node.js: Ensure Node is installed for the JS scripts.
                    npm install nodejs


* Python: Required for generate_charts.py (with pandas and matplotlib).
                    pip install pandas matplotlib

* Firebase Project: A generic Firestore project. 
                    👉 [See setup documentation](implementation.md)

* Credentials: Place your Firebase serviceAccountKey.json in the root directory.

## 4. Execution Guide
1.  **Step 1: Seed & Generate Data** Populate the database with the "Gold Standard" recipe (Puran Poli) and generate synthetic bulk data.
                    node seeding_data.js

2.  **Step 2: ETL Process (Extract, Transform, Load)** Connect to Firestore, fetch documents, flatten nested arrays, and write to CSV.
                    node export_etl.js

3.  **Step 3: Data Validation** Run the QA script to ensure the CSVs adhere to the schema and business rules.
                    node validate_rule.js
                    
4.  **Step 4: Generate Analytics** Calculate summaries and business insights based on the extracted data.
                    node analysis.py

5.  **Step 5: Visualization:** Generate visual charts in the output/charts/ directory.
                    python generate_charts.py


---

## 5. ETL Technical Details
TThe export_etl.js script handles the core engineering complexity: 
* **Extract:** Uses the Firebase Admin SDK to stream documents from `recipes` and `interactions`.
* **Transform:**  
    * Unnesting: Converts arrays (e.g., ['sugar', 'spice']) into rows in a child table linked by recipe_id
    * Sanitization: Escapes characters to prevent CSV breakage (handling commas/quotes within text fields).
    * Normalization: Splits a single JSON object into 3 logical tables (Recipe, Ingredients, Steps).
* **Load:** Writes synchronous updates to the local file system (output/).

---

## 6. Insights Summary
Based on the analysis of the generated dataset:

* **📊 Content Difficulty Distributional Analysis:**
    *   7 Easy Recipes
    *   6 Medium Recipes
    *   7 Hard Recipes

* **User Preference Analysis:**
    *    Correlation: Neutral correlation between prep time and popularity.
    *    Average Time: Popular dishes avg 68.8 mins vs Global avg 68.5 mins.
    *    Insights: Users are equally willing to cook quick meals and time-intensive feasts.


* **Top Ingredient:** 
    *    Top Ingredient: Chili powder (Appears in 11 recipes).
* **Engagement:** 
    *    "Hard" recipes garnered only 4 likes total, whereas the single top dish ("Savory Lentils Delight") gained 3 likes.
---
