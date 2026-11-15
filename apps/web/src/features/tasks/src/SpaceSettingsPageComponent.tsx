'use client';

import { SpaceSettingsComponent, useActiveSpace, useSpaceAccess } from '@/features/spaces';
import { TasksHeaderComponent } from './TasksHeaderComponent';

export function SpaceSettingsPageComponent() {
  const space = useActiveSpace();
  const { isOwner } = useSpaceAccess();

  return (
    <>
      <TasksHeaderComponent title="Settings" subtitle={space?.title ?? ''} />
      {space && isOwner && (
        <div className="px-4 py-6 md:px-6">
          <SpaceSettingsComponent space={space} />
        </div>
      )}
    </>
  );
}
