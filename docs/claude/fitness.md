# Fitness rules

## Fitness rules

- Whole numbers, no floats: food weight and macros in milligrams (`...Mg`), energy in whole kcal, body weight in grams (`weightG`), height in millimetres, a serving count in thousandths (`quantityMilli`). Food nutrition is stored per 100 g.
- Built-in foods (USDA SR Legacy) and exercises (free-exercise-db) are shared rows with no `spaceId` or `userId`, loaded by `fitness:import-foods` and `fitness:import-exercises`; they are read-only through the API. Custom foods, servings and exercises carry the space and owner. A serving can be added to a built-in food and belongs to the space that added it.
- A logged food (`fitness_food_logs`) stores its own name, amount and numbers, so editing or deleting a food never changes a past day. Workouts and templates store each exercise's name and muscles the same way.
- Meal plans, workout templates and workouts each keep their items as one JSON document, checked by zod on the way in and replaced whole on save.
- Nothing is logged automatically and nothing recurs. Applying a meal plan or starting a workout from a template copies it onto the day as planned rows (`eaten: false`, `done: false`); planned rows never count towards totals, averages, muscle load or the forecast until they are ticked.
- Targets, BMI, day totals, the forecast and muscle load are computed in the browser (`targets-math.ts`, `food-math.ts`, `forecast-math.ts`, `workout-math.ts`); the API only stores and checks ownership. Days with nothing eaten are left out of averages, never counted as zero.
- The body diagram's shapes (`body-shapes.ts`) are from react-body-highlighter (MIT, notice in the file). Its one upper-back region stands for both lats and middle back.
- The AI read reuses `BudgetAiService.fitnessRead` through `POST /fitness/ai/read`. It is sent only what `fitness-summary.ts` builds: figures, never food, exercise or workout names.
- There is no offline queue and a Fitness space cannot be duplicated.
