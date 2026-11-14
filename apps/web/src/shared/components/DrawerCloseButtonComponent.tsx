import { X } from 'lucide-react';
import { Button } from '@/shared/components/ui/button';
import { DrawerClose } from '@/shared/components/ui/drawer';

// The shadcn Drawer has no close button of its own; this puts one in the top-right corner.
export function DrawerCloseButtonComponent() {
  return (
    <DrawerClose asChild>
      <Button variant="ghost" size="icon" aria-label="Close" className="absolute top-3 right-3 size-8 text-muted-foreground">
        <X aria-hidden />
      </Button>
    </DrawerClose>
  );
}
