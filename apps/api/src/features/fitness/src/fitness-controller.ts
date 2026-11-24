import { Body, Controller, Delete, Get, Inject, Param, ParseUUIDPipe, Patch, Post, Put, Query, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { fitnessExercises, fitnessFoodLogs, fitnessFoodServings, fitnessFoods, fitnessMealPlans, fitnessWorkoutTemplates, fitnessWorkouts } from '../../../shared/db/schema.ts';
import { parseOrThrow } from '../../../shared/utils/parse-or-throw.ts';
import { AuthGuard, UserId } from '../../auth/index.ts';
import { BudgetAiService } from '../../budget/index.ts';
import { SpaceAccessService, SpaceLockService } from '../../spaces/index.ts';
import { FitnessFoodService } from './fitness-food-service.ts';
import {
  addLogsSchema,
  daysSchema,
  exerciseSchema,
  fitnessReadSchema,
  foodSchema,
  newExerciseSchema,
  newFoodSchema,
  newMealPlanSchema,
  newServingSchema,
  newTemplateSchema,
  newWorkoutSchema,
  saveMealPlanSchema,
  saveProfileSchema,
  saveTemplateSchema,
  saveWorkoutSchema,
  searchFoodsSchema,
  spaceQuerySchema,
  updateLogSchema,
  waterSchema,
  weightQuerySchema,
  weightSchema,
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
    @Inject(SpaceAccessService) private readonly access: SpaceAccessService,
  ) {}

  @Get()
  async load(@UserId() userId: string, @Query() query: unknown, @Req() request: Request) {
    const { spaceId } = parseOrThrow(spaceQuerySchema, query);
    const { ownerId } = await this.access.resolve(userId, spaceId, 'view');
    await this.lock.assertUnlocked(userId, spaceId, request.headers.cookie);
    return { ...(await this.fitness.load(ownerId, spaceId)), aiEnabled: this.ai.enabled };
  }

  @Put('profile')
  async saveProfile(@UserId() userId: string, @Body() body: unknown) {
    const { spaceId, ...profile } = parseOrThrow(saveProfileSchema, body);
    const { ownerId } = await this.access.resolve(userId, spaceId, 'edit');
    return this.fitness.saveProfile(ownerId, spaceId, profile);
  }

  @Get('foods')
  async searchFoods(@UserId() userId: string, @Query() query: unknown, @Req() request: Request) {
    const { spaceId, q } = parseOrThrow(searchFoodsSchema, query);
    const { ownerId } = await this.access.resolve(userId, spaceId, 'view');
    await this.lock.assertUnlocked(userId, spaceId, request.headers.cookie);
    return this.foods.searchFoods(ownerId, spaceId, q);
  }

  @Get('foods/mine')
  async customFoods(@UserId() userId: string, @Query() query: unknown, @Req() request: Request) {
    const { spaceId } = parseOrThrow(spaceQuerySchema, query);
    const { ownerId } = await this.access.resolve(userId, spaceId, 'view');
    await this.lock.assertUnlocked(userId, spaceId, request.headers.cookie);
    return this.foods.customFoods(ownerId, spaceId);
  }

  @Get('foods/recent')
  async recentFoods(@UserId() userId: string, @Query() query: unknown, @Req() request: Request) {
    const { spaceId } = parseOrThrow(spaceQuerySchema, query);
    const { ownerId } = await this.access.resolve(userId, spaceId, 'view');
    await this.lock.assertUnlocked(userId, spaceId, request.headers.cookie);
    return this.foods.recentFoods(ownerId, spaceId);
  }

  @Post('foods')
  async createFood(@UserId() userId: string, @Body() body: unknown) {
    const food = parseOrThrow(newFoodSchema, body);
    const { ownerId } = await this.access.resolve(userId, food.spaceId, 'edit');
    return this.foods.createFood(ownerId, food);
  }

  @Patch('foods/:id')
  async updateFood(@UserId() userId: string, @Param('id', ParseUUIDPipe) id: string, @Body() body: unknown) {
    const changes = parseOrThrow(foodSchema, body);
    const { ownerId } = await this.access.resolveRow(userId, fitnessFoods, id, 'edit');
    return this.foods.updateFood(ownerId, id, changes);
  }

  @Delete('foods/:id')
  async removeFood(@UserId() userId: string, @Param('id', ParseUUIDPipe) id: string) {
    const { ownerId } = await this.access.resolveRow(userId, fitnessFoods, id, 'edit');
    return this.foods.removeFood(ownerId, id);
  }

  @Post('foods/:id/servings')
  async addServing(@UserId() userId: string, @Param('id', ParseUUIDPipe) foodId: string, @Body() body: unknown) {
    const serving = parseOrThrow(newServingSchema, body);
    const { ownerId } = await this.access.resolve(userId, serving.spaceId, 'edit');
    return this.foods.addServing(ownerId, { ...serving, foodId });
  }

  @Delete('servings/:id')
  async removeServing(@UserId() userId: string, @Param('id', ParseUUIDPipe) id: string) {
    const { ownerId } = await this.access.resolveRow(userId, fitnessFoodServings, id, 'edit');
    return this.foods.removeServing(ownerId, id);
  }

  @Get('days')
  async days(@UserId() userId: string, @Query() query: unknown, @Req() request: Request) {
    const { spaceId, from, to } = parseOrThrow(daysSchema, query);
    const { ownerId } = await this.access.resolve(userId, spaceId, 'view');
    await this.lock.assertUnlocked(userId, spaceId, request.headers.cookie);
    const [logs, workouts, water] = await Promise.all([
      this.foods.logs(ownerId, spaceId, from, to),
      this.training.workouts(ownerId, spaceId, from, to),
      this.fitness.water(ownerId, spaceId, from, to),
    ]);
    return { logs, workouts, water };
  }

  @Post('logs')
  async addLogs(@UserId() userId: string, @Body() body: unknown) {
    const { spaceId, logs } = parseOrThrow(addLogsSchema, body);
    const { ownerId } = await this.access.resolve(userId, spaceId, 'edit');
    return this.foods.addLogs(ownerId, spaceId, logs);
  }

  @Patch('logs/:id')
  async updateLog(@UserId() userId: string, @Param('id', ParseUUIDPipe) id: string, @Body() body: unknown) {
    const changes = parseOrThrow(updateLogSchema, body);
    const { ownerId } = await this.access.resolveRow(userId, fitnessFoodLogs, id, 'edit');
    return this.foods.updateLog(ownerId, id, changes);
  }

  @Delete('logs/:id')
  async removeLog(@UserId() userId: string, @Param('id', ParseUUIDPipe) id: string) {
    const { ownerId } = await this.access.resolveRow(userId, fitnessFoodLogs, id, 'edit');
    return this.foods.removeLog(ownerId, id);
  }

  @Put('weights')
  async saveWeight(@UserId() userId: string, @Body() body: unknown) {
    const { spaceId, day, weightG } = parseOrThrow(weightSchema, body);
    const { ownerId } = await this.access.resolve(userId, spaceId, 'edit');
    return this.fitness.saveWeight(ownerId, spaceId, day, weightG);
  }

  @Put('water')
  async saveWater(@UserId() userId: string, @Body() body: unknown) {
    const { spaceId, day, glasses } = parseOrThrow(waterSchema, body);
    const { ownerId } = await this.access.resolve(userId, spaceId, 'edit');
    return this.fitness.saveWater(ownerId, spaceId, day, glasses);
  }

  @Delete('weights')
  async removeWeight(@UserId() userId: string, @Query() query: unknown) {
    const { spaceId, day } = parseOrThrow(weightQuerySchema, query);
    const { ownerId } = await this.access.resolve(userId, spaceId, 'edit');
    return this.fitness.removeWeight(ownerId, spaceId, day);
  }

  @Post('meal-plans')
  async createMealPlan(@UserId() userId: string, @Body() body: unknown) {
    const input = parseOrThrow(newMealPlanSchema, body);
    const { ownerId } = await this.access.resolve(userId, input.spaceId, 'edit');
    return this.fitness.createMealPlan(ownerId, input);
  }

  @Put('meal-plans/:id')
  async saveMealPlan(@UserId() userId: string, @Param('id', ParseUUIDPipe) id: string, @Body() body: unknown) {
    const input = parseOrThrow(saveMealPlanSchema, body);
    const { ownerId } = await this.access.resolveRow(userId, fitnessMealPlans, id, 'edit');
    return this.fitness.saveMealPlan(ownerId, id, input);
  }

  @Delete('meal-plans/:id')
  async removeMealPlan(@UserId() userId: string, @Param('id', ParseUUIDPipe) id: string) {
    const { ownerId } = await this.access.resolveRow(userId, fitnessMealPlans, id, 'edit');
    return this.fitness.removeMealPlan(ownerId, id);
  }

  @Get('exercises')
  async exercises(@UserId() userId: string, @Query() query: unknown, @Req() request: Request) {
    const { spaceId } = parseOrThrow(spaceQuerySchema, query);
    const { ownerId } = await this.access.resolve(userId, spaceId, 'view');
    await this.lock.assertUnlocked(userId, spaceId, request.headers.cookie);
    return this.training.listExercises(ownerId, spaceId);
  }

  @Post('exercises')
  async createExercise(@UserId() userId: string, @Body() body: unknown) {
    const input = parseOrThrow(newExerciseSchema, body);
    const { ownerId } = await this.access.resolve(userId, input.spaceId, 'edit');
    return this.training.createExercise(ownerId, input);
  }

  @Patch('exercises/:id')
  async updateExercise(@UserId() userId: string, @Param('id', ParseUUIDPipe) id: string, @Body() body: unknown) {
    const input = parseOrThrow(exerciseSchema, body);
    const { ownerId } = await this.access.resolveRow(userId, fitnessExercises, id, 'edit');
    return this.training.updateExercise(ownerId, id, input);
  }

  @Delete('exercises/:id')
  async removeExercise(@UserId() userId: string, @Param('id', ParseUUIDPipe) id: string) {
    const { ownerId } = await this.access.resolveRow(userId, fitnessExercises, id, 'edit');
    return this.training.removeExercise(ownerId, id);
  }

  @Post('templates')
  async createTemplate(@UserId() userId: string, @Body() body: unknown) {
    const input = parseOrThrow(newTemplateSchema, body);
    const { ownerId } = await this.access.resolve(userId, input.spaceId, 'edit');
    return this.training.createTemplate(ownerId, input);
  }

  @Put('templates/:id')
  async saveTemplate(@UserId() userId: string, @Param('id', ParseUUIDPipe) id: string, @Body() body: unknown) {
    const input = parseOrThrow(saveTemplateSchema, body);
    const { ownerId } = await this.access.resolveRow(userId, fitnessWorkoutTemplates, id, 'edit');
    return this.training.saveTemplate(ownerId, id, input);
  }

  @Delete('templates/:id')
  async removeTemplate(@UserId() userId: string, @Param('id', ParseUUIDPipe) id: string) {
    const { ownerId } = await this.access.resolveRow(userId, fitnessWorkoutTemplates, id, 'edit');
    return this.training.removeTemplate(ownerId, id);
  }

  @Post('workouts')
  async createWorkout(@UserId() userId: string, @Body() body: unknown) {
    const input = parseOrThrow(newWorkoutSchema, body);
    const { ownerId } = await this.access.resolve(userId, input.spaceId, 'edit');
    return this.training.createWorkout(ownerId, input);
  }

  @Put('workouts/:id')
  async saveWorkout(@UserId() userId: string, @Param('id', ParseUUIDPipe) id: string, @Body() body: unknown) {
    const input = parseOrThrow(saveWorkoutSchema, body);
    const { ownerId } = await this.access.resolveRow(userId, fitnessWorkouts, id, 'edit');
    return this.training.saveWorkout(ownerId, id, input);
  }

  @Delete('workouts/:id')
  async removeWorkout(@UserId() userId: string, @Param('id', ParseUUIDPipe) id: string) {
    const { ownerId } = await this.access.resolveRow(userId, fitnessWorkouts, id, 'edit');
    return this.training.removeWorkout(ownerId, id);
  }

  @Post('ai/read')
  async read(@UserId() userId: string, @Body() body: unknown, @Req() request: Request) {
    const { spaceId, summary } = parseOrThrow(fitnessReadSchema, body);
    const { ownerId } = await this.access.resolve(userId, spaceId, 'edit');
    await this.lock.assertUnlocked(userId, spaceId, request.headers.cookie);
    await this.fitness.assertSpace(ownerId, spaceId);
    return this.ai.fitnessRead(summary);
  }
}
