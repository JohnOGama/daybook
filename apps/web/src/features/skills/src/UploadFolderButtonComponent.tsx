'use client';

import { FolderUp } from 'lucide-react';
import { useRef } from 'react';
import { Button } from '@/shared/components/ui/button';

// React's types don't know the folder-picking attribute, so it goes in as a plain prop.
const PICK_FOLDER = { webkitdirectory: '' };

export function UploadFolderButtonComponent({ onFiles }: { onFiles: (files: File[]) => void }) {
  const input = useRef<HTMLInputElement>(null);
  return (
    <>
      <Button variant="outline" size="sm" onClick={() => input.current?.click()}>
        <FolderUp aria-hidden />
        Upload folder
      </Button>
      <input
        ref={input}
        type="file"
        multiple
        hidden
        aria-label="Skill folder"
        {...PICK_FOLDER}
        onChange={(event) => {
          const files = [...(event.target.files ?? [])];
          // Cleared, so picking the same folder again still counts as a change.
          event.target.value = '';
          if (files.length > 0) onFiles(files);
        }}
      />
    </>
  );
}
