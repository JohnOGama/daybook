import { Body, Controller, Delete, Get, Inject, Param, ParseUUIDPipe, Patch, Post, Put, Query, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { parseOrThrow } from '../../../shared/utils/parse-or-throw.ts';
import { AuthGuard, UserId } from '../../auth/index.ts';
import { BudgetAiService } from '../../budget/index.ts';
import { SpaceLockService } from '../../spaces/index.ts';
import { FitnessFoodService } from './fitness-food-service.ts';
import {
  addLogsSchema,
  daysSchema,
  exerciseSchema,
  fitnessReadSchema,
  foodSchema,
  mealPlanSchema,
  newExerciseSchema,
  newFoodSchema,
  newMealPlanSchema,
  newServingSchema,
  newTemplateSchema,
  newWorkoutSchema,
  saveProfileSchema,
  searchFoodsSchema,
  spaceQuerySchema,
  templateSchema,
  updateLogSchema,
  weightQuerySchema,
  weightSchema,
  workoutSchema,
} from './fitness-schemas.ts';
import { FitnessService } from './fitness-service.ts';
import { FitnessWorkoutService } from './fitness-workout-service.ts';

@UseGuards(AuthGuard)
@Controller('fitness')
export class FitnessController {
  constructor(
    @Inject(FitnessService) private readonly fitness: FitnessService,
    @Inject(FitnessFoodService) private readonly foods: FitnessFoodService,
    @Inject(FitnessWorkoutService) private readonly training: FitnessWorkoutService,
    @Inject(SpaceLockService) private readonly lock: SpaceLockService,
    @Inject(BudgetAiService) private readonly ai: BudgetAiService,
  ) {}

  @Get()
  async load(@UserId() userId: string, @Query() query: unknown, @Req() request: Request) {
    const { spaceId } = parseOrThrow(spaceQuerySchema, query);
    await this.lock.assertUnlocked(userId, spaceId, request.headers.cookie);
    return { ...(await this.fitness.load(userId, spaceId)), aiEnabled: this.ai.enabled };
  }

  @Put('profile')
  saveProfile(@UserId() userId: string, @Body() body: unknown) {
    const { spaceId, ...profile } = parseOrThrow(saveProfileSchema, body);
    return this.fitness.saveProfile(userId, spaceId, profile);
  }

  @Get('foods')
  async searchFoods(@UserId() userId: string, @Query() query: unknown, @Req() request: Request) {
    const { spaceId, q } = parseOrThrow(searchFoodsSchema, query);
    await this.lock.assertUnlocked(userId, spaceId, request.headers.cookie);
    return this.foods.searchFoods(userId, spaceId, q);
  }

  @Get('foods/mine')
  async customFoods(@UserId() userId: string, @Query() query: unknown, @Req() request: Request) {
    const { spaceId } = parseOrThrow(spaceQuerySchema, query);
    await this.lock.assertUnlocked(userId, spaceId, request.headers.cookie);
    return this.foods.customFoods(userId, spaceId);
  }

  @Get('foods/recent')
  async recentFoods(@UserId() userId: string, @Query() query: unknown, @Req() request: Request) {
    const { spaceId } = parseOrThrow(spaceQuerySchema, query);
    await this.lock.assertUnlocked(userId, spaceId, request.headers.cookie);
    return this.foods.recentFoods(userId, spaceId);
  }

  @Post('foods')
  createFood(@UserId() userId: string, @Body() body: unknown) {
    return this.foods.createFood(userId, parseOrThrow(newFoodSchema, body));
  }

  @Patch('foods/:id')
  updateFood(@UserId() userId: string, @Param('id', ParseUUIDPipe) id: string, @Body() body: unknown) {
    return this.foods.updateFood(userId, id, parseOrThrow(foodSchema, body));
  }

  @Delete('foods/:id')
  removeFood(@UserId() userId: string, @Param('id', ParseUUIDPipe) id: string) {
    return this.foods.removeFood(userId, id);
  }

  @Post('foods/:id/servings')
  addServing(@UserId() userId: string, @Param('id', ParseUUIDPipe) foodId: string, @Body() body: unknown) {
    return this.foods.addServing(userId, { ...parseOrThrow(newServingSchema, body), foodId });
  }

  @Delete('servings/:id')
  removeServing(@UserId() userId: string, @Param('id', ParseUUIDPipe) id: string) {
    return this.foods.removeServing(userId, id);
  }

  @Get('days')
  async days(@UserId() userId: string, @Query() query: unknown, @Req() request: Request) {
    const { spaceId, from, to } = parseOrThrow(daysSchema, query);
    await this.lock.assertUnlocked(userId, spaceId, request.headers.cookie);
    const [logs, workouts] = await Promise.all([this.foods.logs(userId, spaceId, from, to), this.training.workouts(userId, spaceId, from, to)]);
    return { logs, workouts };
  }

  @Post('logs')
  addLogs(@UserId() userId: string, @Body() body: unknown) {
    const { spaceId, logs } = parseOrThrow(addLogsSchema, body);
    return this.foods.addLogs(userId, spaceId, logs);
  }

  @Patch('logs/:id')
  updateLog(@UserId() userId: string, @Param('id', ParseUUIDPipe) id: string, @Body() body: unknown) {
    return this.foods.updateLog(userId, id, parseOrThrow(updateLogSchema, body));
  }

  @Delete('logs/:id')
  removeLog(@UserId() userId: string, @Param('id', ParseUUIDPipe) id: string) {
    return this.foods.removeLog(userId, id);
  }

  @Put('weights')
  saveWeight(@UserId() userId: string, @Body() body: unknown) {
    const { spaceId, day, weightG } = parseOrThrow(weightSchema, body);
    return this.fitness.saveWeight(userId, spaceId, day, weightG);
  }

  @Delete('weights')
  removeWeight(@UserId() userId: string, @Query() query: unknown) {
    const { spaceId, day } = parseOrThrow(weightQuerySchema, query);
    return this.fitness.removeWeight(userId, spaceId, day);
  }

  @Post('meal-plans')
  createMealPlan(@UserId() userId: string, @Body() body: unknown) {
    return this.fitness.createMealPlan(userId, parseOrThrow(newMealPlanSchema, body));
  }

  @Put('meal-plans/:id')
  saveMealPlan(@UserId() userId: string, @Param('id', ParseUUIDPipe) id: string, @Body() body: unknown) {
    return this.fitness.saveMealPlan(userId, id, parseOrThrow(mealPlanSchema, body));
  }

  @Delete('meal-plans/:id')
  removeMealPlan(@UserId() userId: string, @Param('id', ParseUUIDPipe) id: string) {
    return this.fitness.removeMealPlan(userId, id);
  }

  @Get('exercises')
  async exercises(@UserId() userId: string, @Query() query: unknown, @Req() request: Request) {
    const { spaceId } = parseOrThrow(spaceQuerySchema, query);
    await this.lock.assertUnlocked(userId, spaceId, request.headers.cookie);
    return this.training.listExercises(userId, spaceId);
  }

  @Post('exercises')
  createExercise(@UserId() userId: string, @Body() body: unknown) {
    return this.training.createExercise(userId, parseOrThrow(newExerciseSchema, body));
  }

  @Patch('exercises/:id')
  updateExercise(@UserId() userId: string, @Param('id', ParseUUIDPipe) id: string, @Body() body: unknown) {
    return this.training.updateExercise(userId, id, parseOrThrow(exerciseSchema, body));
  }

  @Delete('exercises/:id')
  removeExercise(@UserId() userId: string, @Param('id', ParseUUIDPipe) id: string) {
    return this.training.removeExercise(userId, id);
  }

  @Post('templates')
  createTemplate(@UserId() userId: string, @Body() body: unknown) {
    return this.training.createTemplate(userId, parseOrThrow(newTemplateSchema, body));
  }

  @Put('templates/:id')
  saveTemplate(@UserId() userId: string, @Param('id', ParseUUIDPipe) id: string, @Body() body: unknown) {
    return this.training.saveTemplate(userId, id, parseOrThrow(templateSchema, body));
  }

  @Delete('templates/:id')
  removeTemplate(@UserId() userId: string, @Param('id', ParseUUIDPipe) id: string) {
    return this.training.removeTemplate(userId, id);
  }

  @Post('workouts')
  createWorkout(@UserId() userId: string, @Body() body: unknown) {
    return this.training.createWorkout(userId, parseOrThrow(newWorkoutSchema, body));
  }

  @Put('workouts/:id')
  saveWorkout(@UserId() userId: string, @Param('id', ParseUUIDPipe) id: string, @Body() body: unknown) {
    return this.training.saveWorkout(userId, id, parseOrThrow(workoutSchema, body));
  }

  @Delete('workouts/:id')
  removeWorkout(@UserId() userId: string, @Param('id', ParseUUIDPipe) id: string) {
    return this.training.removeWorkout(userId, id);
  }

  @Post('ai/read')
  async read(@UserId() userId: string, @Body() body: unknown, @Req() request: Request) {
    const { spaceId, summary } = parseOrThrow(fitnessReadSchema, body);
    await this.lock.assertUnlocked(userId, spaceId, request.headers.cookie);
    await this.fitness.assertSpace(userId, spaceId);
    return this.ai.fitnessRead(summary);
  }
}
