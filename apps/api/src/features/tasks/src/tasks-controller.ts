import {
  Body,
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
  UseGuards,
} from '@nestjs/common';
import { parseOrThrow } from '../../../shared/utils/parse-or-throw.ts';
import { AuthGuard, UserId } from '../../auth/index.ts';
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
  constructor(@Inject(TasksService) private readonly tasks: TasksService) {}

  @Get()
  list(@UserId() userId: string, @Query() query: unknown) {
    const { spaceId, ...range } = parseOrThrow(rangeSchema, query);
    return this.tasks.list(userId, spaceId, range);
  }

  @Post()
  create(@UserId() userId: string, @Body() body: unknown) {
    return this.tasks.create(userId, parseOrThrow(createTaskSchema, body));
  }

  @Post('bulk')
  createMany(@UserId() userId: string, @Body() body: unknown) {
    return this.tasks.createMany(userId, parseOrThrow(createManySchema, body));
  }

  @Post('bulk-delete')
  removeMany(@UserId() userId: string, @Body() body: unknown) {
    return this.tasks.removeMany(userId, parseOrThrow(removeManySchema, body).ids);
  }

  @Post(':id/subtasks')
  createSubtask(
    @UserId() userId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: unknown,
  ) {
    return this.tasks.createSubtask(userId, id, parseOrThrow(createSubtaskSchema, body));
  }

  @Post(':id/subtasks/bulk')
  createManySubtasks(
    @UserId() userId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: unknown,
  ) {
    return this.tasks.createManySubtasks(userId, id, parseOrThrow(createManySubtasksSchema, body).subtasks);
  }

  @Patch(':id')
  update(
    @UserId() userId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: unknown,
  ) {
    return this.tasks.update(userId, id, parseOrThrow(updateTaskSchema, body));
  }

  @Put(':id/finished')
  setFinished(
    @UserId() userId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: unknown,
  ) {
    const { finished, today, status } = parseOrThrow(finishedSchema, body);
    return this.tasks.setFinished(userId, id, finished, today, status);
  }

  @Post(':id/copy')
  copy(
    @UserId() userId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: unknown,
  ) {
    const { today, spaceId, newIds } = parseOrThrow(copySchema, body);
    return this.tasks.copy(userId, id, today, spaceId, newIds);
  }

  @Put('order')
  reorder(@UserId() userId: string, @Body() body: unknown) {
    return this.tasks.reorder(userId, parseOrThrow(reorderSchema, body).ids);
  }

  @Delete(':id')
  remove(
    @UserId() userId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Query() query: unknown,
  ) {
    return this.tasks.remove(userId, id, parseOrThrow(todaySchema, query).today);
  }
}
