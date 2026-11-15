import { Body, Controller, Delete, Get, Inject, NotFoundException, Param, ParseUUIDPipe, Patch, Post, Put, Query, Req, Res, UseGuards } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import type { Request, Response } from 'express';
import { DB, type Db } from '../../../shared/db/create-db.ts';
import {
  budgetAccounts,
  budgetCategories,
  budgetEntries,
  budgetGoalContributions,
  budgetGoals,
  budgetSchedules,
} from '../../../shared/db/schema.ts';
import { parseOrThrow } from '../../../shared/utils/parse-or-throw.ts';
import { AuthGuard, UserId } from '../../auth/index.ts';
import { SpaceAccessService, SpaceLockService } from '../../spaces/index.ts';
import {
  createAccountSchema,
  createCategorySchema,
  createContributionSchema,
  createEntrySchema,
  createGoalSchema,
  createScheduleSchema,
  categorizeSchema,
  insightsSchema,
  receiptSchema,
  scanReceiptSchema,
  entryShapeSchema,
  scheduleShapeSchema,
  spaceQuerySchema,
  updateAccountSchema,
  updateBudgetSchema,
  updateCategorySchema,
  updateGoalSchema,
} from './budget-schemas.ts';
import { BudgetAiService } from './budget-ai-service.ts';
import { BudgetService } from './budget-service.ts';

@UseGuards(AuthGuard)
@Controller('budget')
export class BudgetController {
  constructor(
    @Inject(BudgetService) private readonly budget: BudgetService,
    @Inject(SpaceLockService) private readonly lock: SpaceLockService,
    @Inject(BudgetAiService) private readonly ai: BudgetAiService,
    @Inject(SpaceAccessService) private readonly access: SpaceAccessService,
    @Inject(DB) private readonly db: Db,
  ) {}

  @Get()
  async load(@UserId() userId: string, @Query() query: unknown, @Req() request: Request) {
    const { spaceId } = parseOrThrow(spaceQuerySchema, query);
    const { ownerId } = await this.access.resolve(userId, spaceId, 'view');
    await this.lock.assertUnlocked(userId, spaceId, request.headers.cookie);
    return this.budget.load(ownerId, spaceId);
  }

  @Put(':spaceId')
  async updateSettings(@UserId() userId: string, @Param('spaceId', ParseUUIDPipe) spaceId: string, @Body() body: unknown) {
    const changes = parseOrThrow(updateBudgetSchema, body);
    const { ownerId } = await this.access.resolve(userId, spaceId, 'edit');
    return this.budget.updateSettings(ownerId, spaceId, changes);
  }

  @Post('accounts')
  async createAccount(@UserId() userId: string, @Body() body: unknown) {
    const input = parseOrThrow(createAccountSchema, body);
    const { ownerId } = await this.access.resolve(userId, input.spaceId, 'edit');
    return this.budget.createAccount(ownerId, input);
  }

  @Patch('accounts/:id')
  async updateAccount(@UserId() userId: string, @Param('id', ParseUUIDPipe) id: string, @Body() body: unknown) {
    const changes = parseOrThrow(updateAccountSchema, body);
    const { ownerId } = await this.access.resolveRow(userId, budgetAccounts, id, 'edit');
    return this.budget.updateAccount(ownerId, id, changes);
  }

  @Delete('accounts/:id')
  async removeAccount(@UserId() userId: string, @Param('id', ParseUUIDPipe) id: string) {
    const { ownerId } = await this.access.resolveRow(userId, budgetAccounts, id, 'edit');
    return this.budget.removeAccount(ownerId, id);
  }

  @Post('categories')
  async createCategory(@UserId() userId: string, @Body() body: unknown) {
    const input = parseOrThrow(createCategorySchema, body);
    const { ownerId } = await this.access.resolve(userId, input.spaceId, 'edit');
    return this.budget.createCategory(ownerId, input);
  }

  @Patch('categories/:id')
  async updateCategory(@UserId() userId: string, @Param('id', ParseUUIDPipe) id: string, @Body() body: unknown) {
    const changes = parseOrThrow(updateCategorySchema, body);
    const { ownerId } = await this.access.resolveRow(userId, budgetCategories, id, 'edit');
    return this.budget.updateCategory(ownerId, id, changes);
  }

  @Delete('categories/:id')
  async removeCategory(@UserId() userId: string, @Param('id', ParseUUIDPipe) id: string) {
    const { ownerId } = await this.access.resolveRow(userId, budgetCategories, id, 'edit');
    return this.budget.removeCategory(ownerId, id);
  }

  @Post('entries')
  async createEntry(@UserId() userId: string, @Body() body: unknown) {
    const input = parseOrThrow(createEntrySchema, body);
    const { ownerId } = await this.access.resolve(userId, input.spaceId, 'edit');
    return this.budget.createEntry(ownerId, input);
  }

  @Put('entries/:id')
  async updateEntry(@UserId() userId: string, @Param('id', ParseUUIDPipe) id: string, @Body() body: unknown) {
    const input = parseOrThrow(entryShapeSchema, body);
    const { ownerId } = await this.access.resolveRow(userId, budgetEntries, id, 'edit');
    return this.budget.updateEntry(ownerId, id, input);
  }

  @Delete('entries/:id')
  async removeEntry(@UserId() userId: string, @Param('id', ParseUUIDPipe) id: string) {
    const { ownerId } = await this.access.resolveRow(userId, budgetEntries, id, 'edit');
    return this.budget.removeEntry(ownerId, id);
  }

  @Post('schedules')
  async createSchedule(@UserId() userId: string, @Body() body: unknown) {
    const input = parseOrThrow(createScheduleSchema, body);
    const { ownerId } = await this.access.resolve(userId, input.spaceId, 'edit');
    return this.budget.createSchedule(ownerId, input);
  }

  @Put('schedules/:id')
  async updateSchedule(@UserId() userId: string, @Param('id', ParseUUIDPipe) id: string, @Body() body: unknown) {
    const input = parseOrThrow(scheduleShapeSchema, body);
    const { ownerId } = await this.access.resolveRow(userId, budgetSchedules, id, 'edit');
    return this.budget.updateSchedule(ownerId, id, input);
  }

  @Delete('schedules/:id')
  async removeSchedule(@UserId() userId: string, @Param('id', ParseUUIDPipe) id: string) {
    const { ownerId } = await this.access.resolveRow(userId, budgetSchedules, id, 'edit');
    return this.budget.removeSchedule(ownerId, id);
  }

  @Post('goals')
  async createGoal(@UserId() userId: string, @Body() body: unknown) {
    const input = parseOrThrow(createGoalSchema, body);
    const { ownerId } = await this.access.resolve(userId, input.spaceId, 'edit');
    return this.budget.createGoal(ownerId, input);
  }

  @Patch('goals/:id')
  async updateGoal(@UserId() userId: string, @Param('id', ParseUUIDPipe) id: string, @Body() body: unknown) {
    const changes = parseOrThrow(updateGoalSchema, body);
    const { ownerId } = await this.access.resolveRow(userId, budgetGoals, id, 'edit');
    return this.budget.updateGoal(ownerId, id, changes);
  }

  @Delete('goals/:id')
  async removeGoal(@UserId() userId: string, @Param('id', ParseUUIDPipe) id: string) {
    const { ownerId } = await this.access.resolveRow(userId, budgetGoals, id, 'edit');
    return this.budget.removeGoal(ownerId, id);
  }

  @Post('contributions')
  async addContribution(@UserId() userId: string, @Body() body: unknown) {
    const input = parseOrThrow(createContributionSchema, body);
    const { ownerId } = await this.access.resolveRow(userId, budgetGoals, input.goalId, 'edit');
    return this.budget.addContribution(ownerId, input);
  }

  @Delete('contributions/:id')
  async removeContribution(@UserId() userId: string, @Param('id', ParseUUIDPipe) id: string) {
    const [contribution] = await this.db
      .select({ goalId: budgetGoalContributions.goalId })
      .from(budgetGoalContributions)
      .where(eq(budgetGoalContributions.id, id));
    if (!contribution) throw new NotFoundException('Contribution not found');
    const { ownerId } = await this.access.resolveRow(userId, budgetGoals, contribution.goalId, 'edit');
    return this.budget.removeContribution(ownerId, id);
  }

  @Put('receipts/:entryId')
  async saveReceipt(@UserId() userId: string, @Param('entryId', ParseUUIDPipe) entryId: string, @Body() body: unknown) {
    const receipt = parseOrThrow(receiptSchema, body);
    const { ownerId } = await this.access.resolveRow(userId, budgetEntries, entryId, 'edit');
    return this.budget.saveReceipt(ownerId, entryId, receipt);
  }

  @Get('receipts/:entryId')
  async receipt(@UserId() userId: string, @Param('entryId', ParseUUIDPipe) entryId: string, @Req() request: Request, @Res() response: Response) {
    const { ownerId, spaceId } = await this.access.resolveRow(userId, budgetEntries, entryId, 'view');
    // A receipt is the space's content, so it sits behind the space password like the budget itself.
    await this.lock.assertUnlocked(userId, spaceId, request.headers.cookie);
    const { mediaType, data } = await this.budget.receipt(ownerId, entryId);
    response.set({ 'Content-Type': mediaType, 'Cache-Control': 'private, max-age=86400', 'X-Content-Type-Options': 'nosniff' }).send(data);
  }

  @Delete('receipts/:entryId')
  async removeReceipt(@UserId() userId: string, @Param('entryId', ParseUUIDPipe) entryId: string) {
    const { ownerId } = await this.access.resolveRow(userId, budgetEntries, entryId, 'edit');
    return this.budget.removeReceipt(ownerId, entryId);
  }

  @Post('ai/categorize')
  async categorize(@UserId() userId: string, @Body() body: unknown, @Req() request: Request) {
    const { spaceId, kind, note, amount } = parseOrThrow(categorizeSchema, body);
    const { ownerId } = await this.access.resolve(userId, spaceId, 'edit');
    await this.lock.assertUnlocked(userId, spaceId, request.headers.cookie);
    const categories = await this.budget.categoriesFor(ownerId, spaceId, kind);
    return { categoryId: await this.ai.categorize(categories, { note, kind, amount }) };
  }

  @Post('ai/scan-receipt')
  async scanReceipt(@UserId() userId: string, @Body() body: unknown, @Req() request: Request) {
    const { spaceId, today, mediaType, data } = parseOrThrow(scanReceiptSchema, body);
    const { ownerId } = await this.access.resolve(userId, spaceId, 'edit');
    await this.lock.assertUnlocked(userId, spaceId, request.headers.cookie);
    const categories = await this.budget.categoriesFor(ownerId, spaceId, 'expense');
    return this.ai.scanReceipt(categories, { mediaType, data }, today);
  }

  @Post('ai/insights')
  async insights(@UserId() userId: string, @Body() body: unknown, @Req() request: Request) {
    const { spaceId, summary } = parseOrThrow(insightsSchema, body);
    const { ownerId } = await this.access.resolve(userId, spaceId, 'edit');
    await this.lock.assertUnlocked(userId, spaceId, request.headers.cookie);
    await this.budget.categoriesFor(ownerId, spaceId);
    return this.ai.insights(summary);
  }
}
