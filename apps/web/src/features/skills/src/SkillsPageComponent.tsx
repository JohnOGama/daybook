'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect } from 'react';
import { Skeleton, SkeletonBox } from 'skullet/react';
import { toast } from 'sonner';
import { type NotebookPage, PageListComponent, usePageMutations, usePages } from '@/features/notebook';
import { useActiveSpace, useSpaceAccess } from '@/features/spaces';
import { EmptyStateComponent } from '@/shared/components/EmptyStateComponent';
import { EmptyNotebookIcon } from '@/shared/components/EmptyStateIconsComponent';
import { Button } from '@/shared/components/ui/button';
import { readFolder, skillsFromFolder } from './skill-folder';
import { skillContent, skillOf } from './skill-md';
import { SkillEditorComponent } from './SkillEditorComponent';
import { UploadFolderButtonComponent } from './UploadFolderButtonComponent';

const SAMPLE_SKILLS: NotebookPage[] = ['deploy-checklist', 'pr-review', 'db-migration'].map((title, index) => ({
  id: `sample-${index}`,
  title,
  content: { type: 'skill', description: 'Use when shipping a release to production', body: '' },
  createdAt: '',
  version: 0,
}));

const skillSnippet = (page: NotebookPage) => skillOf(page).description.trim() || 'No description yet';

export function SkillsPageComponent() {
  const router = useRouter();
  const params = useSearchParams();
  const space = useActiveSpace();
  const { canEdit } = useSpaceAccess();
  const { data, isPending, isError } = usePages();
  const { create } = usePageMutations();
  const skills = isPending ? SAMPLE_SKILLS : (data ?? []);
  const active = skills.find(({ id }) => id === params.get('page')) ?? skills[0];
  const hrefOf = (pageId: string) => `/skills?${new URLSearchParams({ space: space?.id ?? '', page: pageId })}`;
  const shownId = isPending ? undefined : active?.id;

  // Keep the open skill in the URL, so reordering the list can't swap it for whichever skill is now first.
  useEffect(() => {
    if (shownId && params.get('page') !== shownId) router.replace(hrefOf(shownId));
  });

  function addSkill() {
    router.replace(hrefOf(create()));
  }

  async function upload(files: File[]) {
    const { skills: found, skipped } = skillsFromFolder(await readFolder(files));
    if (found.length === 0) {
      toast.error('No SKILL.md in that folder. Pick a skill folder, like .claude/skills/my-skill.');
      return;
    }
    let opened = '';
    for (const skill of found) opened = create({ title: skill.name, content: skillContent(skill) });
    router.replace(hrefOf(opened));
    const added = found.length === 1 ? `Added ${found[0].name}` : `Added ${found.length} skills`;
    if (skipped.length === 0) toast(added);
    else toast(`${added}. Left out ${skipped.length} ${skipped.length === 1 ? 'file' : 'files'} that aren't text or are too large: ${skipped.slice(0, 3).join(', ')}${skipped.length > 3 ? '…' : ''}`);
  }

  if (isError) {
    return (
      <p role="alert" className="px-6 py-8 text-sm text-destructive">
        Could not load these skills. Please try again.
      </p>
    );
  }

  return (
    <div className="flex flex-col md:flex-row">
      <aside className="shrink-0 border-b md:sticky md:top-0 md:h-[calc(100dvh-1rem)] md:w-72 md:overflow-y-auto md:border-r md:border-b-0">
        <Skeleton loading={isPending} label="Loading skills">
          <PageListComponent
            title={space?.title}
            pages={skills}
            activeId={active?.id}
            isPending={isPending}
            hrefOf={hrefOf}
            onAddPage={addSkill}
            canEdit={canEdit}
            itemName="skill"
            snippetOf={skillSnippet}
            actions={<UploadFolderButtonComponent onFiles={upload} />}
          />
        </Skeleton>
      </aside>
      {isPending && (
        <div role="status" aria-label="Loading skill" className="mx-auto flex w-full max-w-3xl flex-col gap-3 px-4 py-8 md:px-8">
          <SkeletonBox width="40%" height={28} />
          <SkeletonBox width="100%" height={36} />
          <SkeletonBox width="100%" height={60} />
          <SkeletonBox width="100%" height={240} />
        </div>
      )}
      {!isPending && active && space && <SkillEditorComponent key={active.id} page={active} spaceId={space.id} canEdit={canEdit} />}
      {!isPending && !active && (
        <div className="flex-1">
          <EmptyStateComponent
            icon={<EmptyNotebookIcon />}
            title="No skills yet"
            description={canEdit ? 'Write a Claude Code skill, let the AI improve it, then download it as SKILL.md.' : 'Nothing has been written here yet.'}
            action={canEdit ? <Button onClick={addSkill}>Add skill</Button> : undefined}
          />
        </div>
      )}
    </div>
  );
}
