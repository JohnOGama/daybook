// Loads the built-in food list from the USDA FoodData Central "SR Legacy" JSON download.
// Usage: pnpm --filter api fitness:import-foods <path to the unzipped .json file>
import { readFile } from 'node:fs/promises';
import { createDb } from '../shared/db/create-db.ts';
import { foodsFromSrLegacy, saveBuiltInFoods } from '../features/fitness/src/usda-import.ts';

const [path] = process.argv.slice(2);
if (!path || !process.env.DATABASE_URL) {
  console.error('Usage: fitness:import-foods <path to SR Legacy .json>, with DATABASE_URL set in apps/api/.env');
  process.exit(1);
}

const foods = foodsFromSrLegacy(JSON.parse(await readFile(path, 'utf8')));
await saveBuiltInFoods(createDb(process.env.DATABASE_URL), foods);
console.log(`Imported ${foods.length} foods.`);
process.exit(0);
