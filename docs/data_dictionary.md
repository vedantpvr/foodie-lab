# Data Dictionary

## recipe.csv
- recipe_id (string)
- name (string)
- description (string)
- servings (int)
- prep_time_min (int)
- cook_time_min (int)
- total_time_min (int)
- difficulty (enum: easy, medium, hard)
- cuisine (string)
- tags (string, comma-separated)
- author_user_id (string)
- created_at (ISO timestamp)

## ingredients.csv
- recipe_id (string)
- ingredient_id (string)
- name (string)
- quantity (number)
- unit (string)
- notes (string)
- order (int)

## steps.csv
- recipe_id (string)
- step_id (string)
- order (int)
- text (string)

## interactions.csv
- interaction_id (string)
- user_id (string)
- recipe_id (string)
- type (enum: view, like, cook_attempt, rating)
- rating (number, optional)
- difficulty_used (string, optional)
- source (string)
- created_at (ISO timestamp)

