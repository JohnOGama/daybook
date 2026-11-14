// Loads the built-in exercise list.
// Usage: pnpm --filter api fitness:import-exercises [path to free-exercise-db's exercises.json]
// With no path it loads the list kept in this repository, which was made from that dataset (public domain).
import { readFile } from 'node:fs/promises';
import { createDb } from '../shared/db/create-db.ts';
import { exercisesFromDataset, saveBuiltInExercises } from '../features/fitness/src/exercise-import.ts';
import type { ExerciseInput } from '../features/fitness/src/fitness-schemas.ts';

if (!process.env.DATABASE_URL) {
  console.error('Set DATABASE_URL in apps/api/.env first.');
  process.exit(1);
}

const [path] = process.argv.slice(2);
const bundled = new URL('../features/fitness/data/exercises.json', import.meta.url);
const exercises: ExerciseInput[] = path ? exercisesFromDataset(JSON.parse(await readFile(path, 'utf8'))) : JSON.parse(await readFile(bundled, 'utf8'));

await saveBuiltInExercises(createDb(process.env.DATABASE_URL), exercises);
console.log(`Imported ${exercises.length} exercises.`);
process.exit(0);
