import { closestCenter, type CollisionDetection } from '@dnd-kit/core';

export const withinSameList: CollisionDetection = (args) => {
  const list = args.active.data.current?.sortable?.containerId;
  return closestCenter({
    ...args,
    droppableContainers: args.droppableContainers.filter(
      (container) => container.data.current?.sortable?.containerId === list,
    ),
  });
};
