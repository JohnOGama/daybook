'use client';

import { SpaceSettingsComponent, useActiveSpace } from '@/features/spaces';
import { TasksHeaderComponent } from './TasksHeaderComponent';

export function SpaceSettingsPageComponent() {
  const space = useActiveSpace();

  return (
    <>
      <TasksHeaderComponent title="Settings" subtitle={space?.title ?? ''} />
      {space && (
        <div className="px-4 py-6 md:px-6">
          <SpaceSettingsComponent space={space} />
        </div>
      )}
    </>
  );
}
