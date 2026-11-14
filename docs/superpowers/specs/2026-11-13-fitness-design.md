# Fitness design

Date: 2026-11-13

Items marked **(my call)** were chosen by Claude, not the owner, and can be overruled. There is no mockup yet.

## What it is

Fitness is a sixth tool for a space, beside List, Notebook, Book, Vault and Budget. It is for one person tracking their own body: what they eat against calorie and macro targets, what they train, how their weight is moving and where it is heading. Days are filled in by hand, usually by starting from a saved meal plan or workout template and ticking off what actually happened. Nothing recurs on its own.

## Goals

- Log food by amount in the unit that suits it: grams, tablespoons, cups, pieces and so on, for example "250 g cooked rice".
- Find foods in a built-in open food database, and add your own.
- Set a goal (calorie deficit, maintenance or surplus) and macro targets, worked out from height, weight, age, sex and activity, or typed in by hand.
- See BMI, today's calories and macros against target, and how the week is going.
- Log body weight and see a forecast of where it is heading, with advanced settings to tune the forecast.
- Build workout templates and meal plans, apply one to a day, and record what was actually done.
- See on a body diagram which muscles an exercise, a workout or a week of training works.
- Ask AI for a plain-language read of where you stand.

## Non-goals (for now)

All **(my call)**:

- Branded and packaged products, barcode scanning, and recognising food from a photo.
- Recipes (a dish built from ingredients with its own serving size). A meal plan or a custom food covers this for now.
- Recurring or scheduled workouts and meals. The owner asked for templates instead.
- Imperial units. Everything is kg, cm, g and ml.
- Micronutrients, water, sleep, steps, and syncing with a watch or a health app.
- Estimating calories burned by a workout. Training is covered by the activity level in the profile.
- Exercise photos or videos, a rest timer, and one-rep-max estimates.
- Body measurements other than weight (waist, body fat).
- Working offline, and duplicating a Fitness space.

## Anti-goals

These would make it a failure even if everything else worked:

- Anything that logs food or a workout by itself. A day only holds what the owner put there or ticked.
- Past days changing because a food, plan or template was edited later.
- The forecast or the AI read presented as fact or as medical advice. Both are estimates and say so.
- The full food diary or free-text notes sent to the AI.
- A calorie target set below a safe floor with no warning.
- One person seeing or changing another person's data.

## Where the numbers come from

### Food database **(my call)**

USDA FoodData Central, the SR Legacy set: about 7,800 generic foods (raw and cooked ingredients, staples, common dishes) with household measures such as "1 cup" and "1 tbsp" given in grams. It is public domain (CC0), so it can be stored and shown without restriction.

- It is imported once into the database by a script, not called live. The app then needs no API key, works when USDA is down, and never tells a third party what the owner eats.
- Only energy, protein, carbohydrate, fat and fibre are kept, per 100 g, plus each food's household measures.
- SR Legacy is frozen (last released April 2018), which is fine for generic foods. Its weak spot is local and home-cooked dishes, which is what custom foods are for.
- Custom foods belong to the space. A custom food has a name, the same five numbers per 100 g or per serving, and its own serving sizes.

### Serving types

- Weight units (g, kg, oz, lb) work for every food.
- Volume and count units (tsp, tbsp, cup, ml, piece, slice, "1 medium") are offered for a food only when its weight is known for that food: from the USDA measures, or from a serving the owner adds ("my bowl = 180 g"). A tablespoon of oil and a tablespoon of flour weigh different amounts, so there is no generic conversion.
- The owner can add a serving to any food, including built-in ones.

### Targets and BMI

- The profile holds sex, birth date, height, activity level, goal, goal weight and pace. Current weight is the latest entry in the weight log.
- BMI is weight in kg divided by height in metres squared, shown with the standard bands and a line saying it cannot tell muscle from fat.
- Resting energy uses the Mifflin-St Jeor equation; daily energy is that times an activity factor (sedentary 1.2 up to very active 1.9). **(my call)**
- The calorie target is daily energy minus or plus the goal: pace in kg per week × 7,700 kcal ÷ 7. Goal is one of lose (deficit), maintain, or gain (surplus).
- Macro targets come from one of: a preset split (balanced, high protein, low carb), protein in grams per kg of body weight with the rest split by percentage, or numbers typed in by hand. The owner picks which. **(my call on the presets)**
- A warning shows when the target falls below resting energy, or the pace is above 1% of body weight per week. It warns; it does not block. **(my call)**

### Forecast

- Two lines on one chart from today forward: "on plan" (what the calorie target implies) and "on trend" (what logged intake and the recent weight trend imply). Past weigh-ins are shown behind them, with a smoothed trend line.
- It states the date the goal weight is reached on each line, or says it is not being approached.
- Advanced settings: how far ahead to look, kcal per kg of body weight change (7,700 by default), how many days the trend looks back, and whether daily energy comes from the formula or is worked out from the owner's own intake and weight change once there are at least three weeks of both. **(my call)**
- Always labelled as an estimate. Days with no food logged are left out of averages, not counted as zero.

### Exercises and muscles **(my call)**

- A built-in exercise list with each exercise's primary and secondary muscles and equipment, seeded from an open, public-domain exercise dataset (free-exercise-db is the candidate; confirm its licence before importing). Names, muscles and equipment only.
- The owner can add custom exercises and pick their muscles.
- Seventeen muscle groups: neck, traps, shoulders, chest, biceps, triceps, forearms, abs, lats, middle back, lower back, glutes, abductors, adductors, quads, hamstrings, calves.
- An exercise is one of three kinds: weight and reps, reps only (bodyweight), or time (and optional distance, for cardio).

## Templates, plans and a day

This is the centre of the tool.

- A **workout template** is a named, ordered list of exercises, each with planned sets (for example 4 × 8 at 60 kg).
- A **meal plan** is a named list of foods with amounts, grouped into Breakfast, Lunch, Dinner and Snacks. **(my call on the four groups)**
- **Applying** one to a day copies its contents onto that day as planned items. Planned food shows greyed and does not count; ticking it marks it eaten and it counts. Planned sets work the same way: tick each set as it is done, changing reps or weight if they differed. **(my call; this mirrors planned entries in Budget)**
- Anything can also be added to a day directly, without a template.
- A day keeps its own copy. Editing or deleting a template or plan afterwards never changes days already filled in, and a logged food keeps the calories and macros it had when logged.
- More than one plan or template can be applied to the same day, and a day's contents can be saved back as a new template or plan.
- Each exercise in a workout shows what was done last time.

## Screens

The space opens at `/fitness?space=<id>` with a tab row like Budget's. **(my call on the tab set)**

- **Today:** a day switcher, then calories and the three macros against target as meters, the day's food by meal with Add food and Apply meal plan, and the day's workout with Start from template. This is where most time is spent.
- **Food search (a sheet):** search box, recent and most-used foods first, then results from the owner's foods and the built-in database. Picking a food asks for amount and serving type and shows the resulting calories and macros before adding.
- **Workouts:** the day's workout in full (exercises, sets, ticks, last time), the body diagram for it, and past workouts by date.
- **Progress:** weight log and Add weigh-in, BMI, the forecast chart with its advanced settings, weekly averages of calories and macros against target, and a body diagram shaded by how much each muscle group was trained in the last seven days.
- **Library:** meal plans, workout templates, my foods and my exercises, each with create, edit and delete.
- **Settings:** profile, goal and pace, macro method and targets.
- **AI read:** a card on Progress, on request, like Budget's monthly check-in.

### Body diagram

Front and back views of a figure, one region per muscle group. Primary muscles are filled in the `signal` accent and secondary ones in the same colour at lower strength; everything else stays neutral, in keeping with the app's monochrome look. The same component is used for one exercise, a template, a day's workout and the weekly view. Each highlighted group is also listed by name beside the figure, so the diagram is never the only way to read it. The outline comes from an openly licensed body map (react-body-highlighter's shapes, MIT, are the candidate; confirm the licence and credit it in the file) rather than being drawn from scratch. **(my call)**

## AI

Uses the existing Gemini service and is off unless `GEMINI_API_KEY` is set.

- **What it does:** on request, writes a short read of where the owner stands: a one-line headline, three to five observations (weight trend against goal, how close intake has been to target, which muscle groups are getting little work, where the forecast points) and one practical suggestion.
- **What it is sent:** summary figures only. Age, sex, height, goal, the weight trend, average daily calories and macros against target for the last 7 and 30 days, days logged, sets per muscle group per week, and the forecast dates. Never the food diary, food names, notes or the space title.
- **Limits:** told not to diagnose, not to recommend supplements, medication or extreme diets, and to use only the figures given. The reply is checked against a schema before use, and the card says it is an AI estimate, not medical advice.

## Rules for the builder

- Follow the Budget tool's shape: a `fitness` space tool, a NestJS feature with every query scoped to `userId`, `SpaceLockService.assertUnlocked` on every route that returns contents, a web feature folder with React Query, optimistic updates and Skullet loading states.
- The built-in food and exercise lists are shared, read-only tables with no owner. Everything else belongs to a space.
- "Today" is the browser's local date (`useToday`), never the server's.
- Food search runs on the server against the shared table; it must stay fast with about 7,800 foods and 14,000 measures.
- Targets, BMI, totals and the forecast are computed in the browser by small tested functions, as Budget's totals are. The API stores and checks ownership.
- Day data is loaded by day or date range, not all at once, since a food log grows without limit.
- The space goes to Trash like any other. Rows inside it are hard-deleted, with Undo on delete where Budget has it.
- Tests must not need the USDA download; use a handful of fixture foods.

## Left to the builder

- Table and column layout, and how amounts are stored (whole numbers, as Budget does with cents, are preferred over floats).
- The import scripts' form, and how they are re-run safely.
- The exact activity levels and preset macro splits.
- Chart drawing; reuse what Budget's forecast and reports already do.
- Build order. A sensible one: space tool, profile and targets; food database and the food log; meal plans; weight log and forecast; exercises, templates and workouts; body diagram; AI read.

## Changed while building

- The exercise list (876 exercises) is kept in the repository and loaded with one command, instead of being downloaded.
- Custom foods and custom exercises can be created and deleted, but not yet edited in place.
- Sets are logged on the Workouts tab; Today shows the day's workout and can start one.
- "Measured" daily energy feeds the forecast only. Today's targets always use the formula.
- The body outline has one upper-back region, shared by lats and middle back.
- Imperial weight units (oz, lb) are offered when logging food, since they cost nothing; everything else stays metric.
