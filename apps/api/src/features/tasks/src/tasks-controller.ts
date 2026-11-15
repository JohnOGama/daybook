import {
  Body,
  BadRequestException,
  Controller,
  Delete,
  Get,
  Inject,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { tasks as tasksTable } from '../../../shared/db/schema.ts';
import { parseOrThrow } from '../../../shared/utils/parse-or-throw.ts';
import { AuthGuard, UserId } from '../../auth/index.ts';
import { SpaceAccessService, SpaceLockService } from '../../spaces/index.ts';
import {
  copySchema,
  createManySchema,
  createManySubtasksSchema,
  createSubtaskSchema,
  createTaskSchema,
  finishedSchema,
  rangeSchema,
  removeManySchema,
  reorderSchema,
  todaySchema,
  updateTaskSchema,
} from './task-schemas.ts';
import { TasksService } from './tasks-service.ts';

@UseGuards(AuthGuard)
@Controller('tasks')
export class TasksController {
  constructor(
    @Inject(TasksService) private readonly tasks: TasksService,
    @Inject(SpaceLockService) private readonly lock: SpaceLockService,
    @Inject(SpaceAccessService) private readonly access: SpaceAccessService,
  ) {}

  @Get()
  async list(@UserId() userId: string, @Query() query: unknown, @Req() request: Request) {
    const { spaceId, ...range } = parseOrThrow(rangeSchema, query);
    const { ownerId } = await this.access.resolve(userId, spaceId, 'view');
    await this.lock.assertUnlocked(userId, spaceId, request.headers.cookie);
    return this.tasks.list(ownerId, spaceId, range);
  }

  @Post()
  async create(@UserId() userId: string, @Body() body: unknown) {
    const input = parseOrThrow(createTaskSchema, body);
    const { ownerId } = await this.access.resolve(userId, input.spaceId, 'edit');
    return this.tasks.create(ownerId, input);
  }

  @Post('bulk')
  async createMany(@UserId() userId: string, @Body() body: unknown) {
    const input = parseOrThrow(createManySchema, body);
    const { ownerId } = await this.access.resolve(userId, input.spaceId, 'edit');
    return this.tasks.createMany(ownerId, input);
  }

  @Post('bulk-delete')
  async removeMany(@UserId() userId: string, @Body() body: unknown) {
    const { ids } = parseOrThrow(removeManySchema, body);
    const { ownerId } = await this.access.resolveRows(userId, tasksTable, ids, 'edit');
    return this.tasks.removeMany(ownerId, ids);
  }

  @Post(':id/subtasks')
  async createSubtask(
    @UserId() userId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: unknown,
  ) {
    const input = parseOrThrow(createSubtaskSchema, body);
    const { ownerId } = await this.access.resolveRow(userId, tasksTable, id, 'edit');
    return this.tasks.createSubtask(ownerId, id, input);
  }

  @Post(':id/subtasks/bulk')
  async createManySubtasks(
    @UserId() userId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: unknown,
  ) {
    const { subtasks } = parseOrThrow(createManySubtasksSchema, body);
    const { ownerId } = await this.access.resolveRow(userId, tasksTable, id, 'edit');
    return this.tasks.createManySubtasks(ownerId, id, subtasks);
  }

  @Patch(':id')
  async update(
    @UserId() userId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: unknown,
  ) {
    const input = parseOrThrow(updateTaskSchema, body);
    const { ownerId } = await this.access.resolveRow(userId, tasksTable, id, 'edit');
    return this.tasks.update(ownerId, id, input);
  }

  @Put(':id/finished')
  async setFinished(
    @UserId() userId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: unknown,
  ) {
    const { finished, today, status } = parseOrThrow(finishedSchema, body);
    const { ownerId } = await this.access.resolveRow(userId, tasksTable, id, 'edit');
    return this.tasks.setFinished(ownerId, id, finished, today, status);
  }

  @Post(':id/copy')
  async copy(
    @UserId() userId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: unknown,
  ) {
    const { today, spaceId, newIds } = parseOrThrow(copySchema, body);
    const source = await this.access.resolveRow(userId, tasksTable, id, 'edit');
    const target = spaceId ? await this.access.resolve(userId, spaceId, 'edit') : source;
    if (target.ownerId !== source.ownerId) {
      throw new BadRequestException('Tasks can only be copied between spaces with the same owner');
    }
    return this.tasks.copy(source.ownerId, id, today, spaceId, newIds);
  }

  @Put('order')
  async reorder(@UserId() userId: string, @Body() body: unknown) {
    const { ids } = parseOrThrow(reorderSchema, body);
    const { ownerId } = await this.access.resolveRows(userId, tasksTable, ids, 'edit');
    return this.tasks.reorder(ownerId, ids);
  }

  @Delete(':id')
  async remove(
    @UserId() userId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Query() query: unknown,
  ) {
    const { today } = parseOrThrow(todaySchema, query);
    const { ownerId } = await this.access.resolveRow(userId, tasksTable, id, 'edit');
    return this.tasks.remove(ownerId, id, today);
  }
}
