import { Body, Controller, Delete, Get, Inject, Param, ParseUUIDPipe, Patch, Post, Put, Query, Req, Res, UseGuards } from '@nestjs/common';
import type { Request, Response } from 'express';
import { parseOrThrow } from '../../../shared/utils/parse-or-throw.ts';
import { AuthGuard, UserId } from '../../auth/index.ts';
import { SpaceLockService } from '../../spaces/index.ts';
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
  ) {}

  @Get()
  async load(@UserId() userId: string, @Query() query: unknown, @Req() request: Request) {
    const { spaceId } = parseOrThrow(spaceQuerySchema, query);
    await this.lock.assertUnlocked(userId, spaceId, request.headers.cookie);
    return this.budget.load(userId, spaceId);
  }

  @Put(':spaceId')
  updateSettings(@UserId() userId: string, @Param('spaceId', ParseUUIDPipe) spaceId: string, @Body() body: unknown) {
    return this.budget.updateSettings(userId, spaceId, parseOrThrow(updateBudgetSchema, body));
  }

  @Post('accounts')
  createAccount(@UserId() userId: string, @Body() body: unknown) {
    return this.budget.createAccount(userId, parseOrThrow(createAccountSchema, body));
  }

  @Patch('accounts/:id')
  updateAccount(@UserId() userId: string, @Param('id', ParseUUIDPipe) id: string, @Body() body: unknown) {
    return this.budget.updateAccount(userId, id, parseOrThrow(updateAccountSchema, body));
  }

  @Delete('accounts/:id')
  removeAccount(@UserId() userId: string, @Param('id', ParseUUIDPipe) id: string) {
    return this.budget.removeAccount(userId, id);
  }

  @Post('categories')
  createCategory(@UserId() userId: string, @Body() body: unknown) {
    return this.budget.createCategory(userId, parseOrThrow(createCategorySchema, body));
  }

  @Patch('categories/:id')
  updateCategory(@UserId() userId: string, @Param('id', ParseUUIDPipe) id: string, @Body() body: unknown) {
    return this.budget.updateCategory(userId, id, parseOrThrow(updateCategorySchema, body));
  }

  @Delete('categories/:id')
  removeCategory(@UserId() userId: string, @Param('id', ParseUUIDPipe) id: string) {
    return this.budget.removeCategory(userId, id);
  }

  @Post('entries')
  createEntry(@UserId() userId: string, @Body() body: unknown) {
    return this.budget.createEntry(userId, parseOrThrow(createEntrySchema, body));
  }

  @Put('entries/:id')
  updateEntry(@UserId() userId: string, @Param('id', ParseUUIDPipe) id: string, @Body() body: unknown) {
    return this.budget.updateEntry(userId, id, parseOrThrow(entryShapeSchema, body));
  }

  @Delete('entries/:id')
  removeEntry(@UserId() userId: string, @Param('id', ParseUUIDPipe) id: string) {
    return this.budget.removeEntry(userId, id);
  }

  @Post('schedules')
  createSchedule(@UserId() userId: string, @Body() body: unknown) {
    return this.budget.createSchedule(userId, parseOrThrow(createScheduleSchema, body));
  }

  @Put('schedules/:id')
  updateSchedule(@UserId() userId: string, @Param('id', ParseUUIDPipe) id: string, @Body() body: unknown) {
    return this.budget.updateSchedule(userId, id, parseOrThrow(scheduleShapeSchema, body));
  }

  @Delete('schedules/:id')
  removeSchedule(@UserId() userId: string, @Param('id', ParseUUIDPipe) id: string) {
    return this.budget.removeSchedule(userId, id);
  }

  @Post('goals')
  createGoal(@UserId() userId: string, @Body() body: unknown) {
    return this.budget.createGoal(userId, parseOrThrow(createGoalSchema, body));
  }

  @Patch('goals/:id')
  updateGoal(@UserId() userId: string, @Param('id', ParseUUIDPipe) id: string, @Body() body: unknown) {
    return this.budget.updateGoal(userId, id, parseOrThrow(updateGoalSchema, body));
  }

  @Delete('goals/:id')
  removeGoal(@UserId() userId: string, @Param('id', ParseUUIDPipe) id: string) {
    return this.budget.removeGoal(userId, id);
  }

  @Post('contributions')
  addContribution(@UserId() userId: string, @Body() body: unknown) {
    return this.budget.addContribution(userId, parseOrThrow(createContributionSchema, body));
  }

  @Delete('contributions/:id')
  removeContribution(@UserId() userId: string, @Param('id', ParseUUIDPipe) id: string) {
    return this.budget.removeContribution(userId, id);
  }

  @Put('receipts/:entryId')
  saveReceipt(@UserId() userId: string, @Param('entryId', ParseUUIDPipe) entryId: string, @Body() body: unknown) {
    return this.budget.saveReceipt(userId, entryId, parseOrThrow(receiptSchema, body));
  }

  @Get('receipts/:entryId')
  async receipt(@UserId() userId: string, @Param('entryId', ParseUUIDPipe) entryId: string, @Res() response: Response) {
    const { mediaType, data } = await this.budget.receipt(userId, entryId);
    response.set({ 'Content-Type': mediaType, 'Cache-Control': 'private, max-age=86400', 'X-Content-Type-Options': 'nosniff' }).send(data);
  }

  @Delete('receipts/:entryId')
  removeReceipt(@UserId() userId: string, @Param('entryId', ParseUUIDPipe) entryId: string) {
    return this.budget.removeReceipt(userId, entryId);
  }

  @Post('ai/categorize')
  async categorize(@UserId() userId: string, @Body() body: unknown, @Req() request: Request) {
    const { spaceId, kind, note, amount } = parseOrThrow(categorizeSchema, body);
    await this.lock.assertUnlocked(userId, spaceId, request.headers.cookie);
    const categories = await this.budget.categoriesFor(userId, spaceId, kind);
    return { categoryId: await this.ai.categorize(categories, { note, kind, amount }) };
  }

  @Post('ai/scan-receipt')
  async scanReceipt(@UserId() userId: string, @Body() body: unknown, @Req() request: Request) {
    const { spaceId, today, mediaType, data } = parseOrThrow(scanReceiptSchema, body);
    await this.lock.assertUnlocked(userId, spaceId, request.headers.cookie);
    const categories = await this.budget.categoriesFor(userId, spaceId, 'expense');
    return this.ai.scanReceipt(categories, { mediaType, data }, today);
  }

  @Post('ai/insights')
  async insights(@UserId() userId: string, @Body() body: unknown, @Req() request: Request) {
    const { spaceId, summary } = parseOrThrow(insightsSchema, body);
    await this.lock.assertUnlocked(userId, spaceId, request.headers.cookie);
    await this.budget.categoriesFor(userId, spaceId);
    return this.ai.insights(summary);
  }
}
