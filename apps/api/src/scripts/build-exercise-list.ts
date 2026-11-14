// Rebuilds the bundled exercise list from free-exercise-db's exercises.json.
// Usage: tsx src/scripts/build-exercise-list.ts <path to exercises.json>
import { readFile, writeFile } from 'node:fs/promises';
import { exercisesFromDataset } from '../features/fitness/src/exercise-import.ts';

const [path] = process.argv.slice(2);
const exercises = exercisesFromDataset(JSON.parse(await readFile(path, 'utf8')));
await writeFile(new URL('../features/fitness/data/exercises.json', import.meta.url), `${JSON.stringify(exercises)}\n`);
console.log(`Wrote ${exercises.length} exercises.`);
