import { Body, Controller, Delete, Get, Inject, Param, ParseUUIDPipe, Post, Put, Query, UseGuards } from '@nestjs/common';
import { parseOrThrow } from '../../../shared/utils/parse-or-throw.ts';
import { AuthGuard, UserId } from '../../auth/index.ts';
import {
  createItemSchema,
  createVaultSchema,
  importItemsSchema,
  listItemsSchema,
  passcodeWrapSchema,
  recoveryWrapSchema,
  spaceKeySchema,
  updateItemSchema,
} from './vault-schemas.ts';
import { VaultService } from './vault-service.ts';

@UseGuards(AuthGuard)
@Controller('vault')
export class VaultController {
  constructor(@Inject(VaultService) private readonly vault: VaultService) {}

  @Get()
  async get(@UserId() userId: string) {
    return { vault: await this.vault.get(userId) };
  }

  @Post()
  create(@UserId() userId: string, @Body() body: unknown) {
    return this.vault.create(userId, parseOrThrow(createVaultSchema, body));
  }

  @Put('passcode')
  setPasscode(@UserId() userId: string, @Body() body: unknown) {
    return this.vault.setPasscode(userId, parseOrThrow(passcodeWrapSchema, body));
  }

  @Put('recovery')
  setRecovery(@UserId() userId: string, @Body() body: unknown) {
    return this.vault.setRecovery(userId, parseOrThrow(recoveryWrapSchema, body));
  }

  @Delete()
  erase(@UserId() userId: string) {
    return this.vault.erase(userId);
  }

  @Get('spaces/:spaceId/key')
  async spaceKey(@UserId() userId: string, @Param('spaceId', ParseUUIDPipe) spaceId: string) {
    return { key: await this.vault.spaceKey(userId, spaceId) };
  }

  @Put('spaces/:spaceId/key')
  setSpaceKey(@UserId() userId: string, @Param('spaceId', ParseUUIDPipe) spaceId: string, @Body() body: unknown) {
    return this.vault.setSpaceKey(userId, spaceId, parseOrThrow(spaceKeySchema, body));
  }

  @Get('items')
  listItems(@UserId() userId: string, @Query() query: unknown) {
    const { spaceId, includeDeleted } = parseOrThrow(listItemsSchema, query);
    return this.vault.listItems(userId, spaceId, includeDeleted === 'true');
  }

  @Post('items')
  createItem(@UserId() userId: string, @Body() body: unknown) {
    return this.vault.createItem(userId, parseOrThrow(createItemSchema, body));
  }

  @Post('items/import')
  importItems(@UserId() userId: string, @Body() body: unknown) {
    return this.vault.importItems(userId, parseOrThrow(importItemsSchema, body));
  }

  @Put('items/:id')
  updateItem(@UserId() userId: string, @Param('id', ParseUUIDPipe) id: string, @Body() body: unknown) {
    return this.vault.updateItem(userId, id, parseOrThrow(updateItemSchema, body));
  }

  @Delete('items/:id')
  removeItem(@UserId() userId: string, @Param('id', ParseUUIDPipe) id: string) {
    return this.vault.removeItem(userId, id);
  }
}
