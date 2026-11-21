import { HttpException } from '@nestjs/common';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { type FitnessMcpTools, ToolError } from './fitness-mcp-tools.ts';
import { dayInput, logFoodInput, logWeightInput, logWorkoutInput, removeFoodLogInput, removeWorkoutInput, searchInput } from './mcp-schemas.ts';

const DATE_RULE = "Every tool that takes a day needs the user's local date as YYYY-MM-DD.";

async function answer(run: () => Promise<unknown>): Promise<CallToolResult> {
  try {
    return { content: [{ type: 'text', text: JSON.stringify(await run()) }] };
  } catch (error) {
    if (error instanceof ToolError || (error instanceof HttpException && error.getStatus() < 500)) {
      return { isError: true, content: [{ type: 'text', text: error.message }] };
    }
    console.error('MCP tool failed', error);
    return { isError: true, content: [{ type: 'text', text: 'Something went wrong in Daybook. Try again.' }] };
  }
}

// One server per request (the transport is stateless), acting as the person the access token belongs to.
export function buildMcpServer(tools: FitnessMcpTools, userId: string): McpServer {
  const server = new McpServer({ name: 'daybook', version: '1.0.0' });

  server.registerTool(
    'list_fitness_spaces',
    { description: "The person's Daybook Fitness spaces they can log into. Other tools take one of these ids as spaceId when there is more than one." },
    () => answer(() => tools.listSpaces(userId)),
  );
  server.registerTool(
    'search_foods',
    { description: 'Find foods by name, with nutrition per 100 g and their servings. Search first, then log by id with log_food.', inputSchema: searchInput },
    (input) => answer(() => tools.searchFoods(userId, input)),
  );
  server.registerTool(
    'log_food',
    {
      description: `Log what the person ate for one meal. For each item, give a food id from search_foods with grams, or one of its servings and how many. Log a one-off food with your own estimate of its weight, kcal and macros only when search_foods finds nothing that fits. ${DATE_RULE}`,
      inputSchema: logFoodInput,
    },
    (input) => answer(() => tools.logFood(userId, input)),
  );
  server.registerTool(
    'search_exercises',
    { description: 'Find exercises by name. Search first, then log by id with log_workout.', inputSchema: searchInput },
    (input) => answer(() => tools.searchExercises(userId, input)),
  );
  server.registerTool(
    'log_workout',
    {
      description: `Log a finished workout: each exercise by id from search_exercises (or by name when nothing fits) with its sets in reps, kg, seconds or meters. A found exercise keeps its own kind (weight, reps or time), so give the measures that kind uses. ${DATE_RULE}`,
      inputSchema: logWorkoutInput,
    },
    (input) => answer(() => tools.logWorkout(userId, input)),
  );
  server.registerTool(
    'get_day',
    { description: `One day's food logs by meal with ids and totals (eaten only), and its workouts. ${DATE_RULE}`, inputSchema: dayInput },
    (input) => answer(() => tools.getDay(userId, input)),
  );
  server.registerTool(
    'remove_food_log',
    { description: 'Remove one logged food, by its id from get_day or log_food. Use it to undo a mistake.', inputSchema: removeFoodLogInput },
    (input) => answer(() => tools.removeFoodLog(userId, input)),
  );
  server.registerTool(
    'remove_workout',
    { description: 'Remove one logged workout, by its id from get_day or log_workout.', inputSchema: removeWorkoutInput },
    (input) => answer(() => tools.removeWorkout(userId, input)),
  );
  server.registerTool(
    'log_weight',
    { description: `Save the person's weigh-in for a day, in kg. It replaces that day's weigh-in. ${DATE_RULE}`, inputSchema: logWeightInput },
    (input) => answer(() => tools.logWeight(userId, input)),
  );

  return server;
}
