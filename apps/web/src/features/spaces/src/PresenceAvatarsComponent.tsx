'use client';

import { Avatar, AvatarFallback, AvatarGroup, AvatarGroupCount, AvatarImage } from '@/shared/components/ui/avatar';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/shared/components/ui/tooltip';
import { authClient } from '@/shared/services/auth-client';
import { type PresenceMember, useSpacePresence } from '../hooks/useSpacePresence';

const SHOWN = 4;
const ACCESS_LABEL = { owner: 'Owner', edit: 'Can edit', view: 'Can view' } as const;

const initials = (name: string) =>
  name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((word) => word[0]?.toUpperCase() ?? '')
    .join('') || '?';

const label = (person: PresenceMember) => `${person.name} · ${ACCESS_LABEL[person.access]}`;

// The other people who have this space open right now. You are never in it.
export function PresenceAvatarsComponent() {
  const presence = useSpacePresence();
  const me = authClient.useSession().data?.user.id;
  const others = presence?.members.filter((member) => member.userId !== me) ?? [];
  if (others.length === 0) return null;
  const shown = others.slice(0, SHOWN);
  const rest = others.slice(shown.length);

  return (
    <AvatarGroup role="list" aria-label="People here" className="ml-auto shrink-0">
      {shown.map((person) => (
        <Tooltip key={person.userId}>
          <TooltipTrigger asChild>
            <Avatar role="listitem" size="sm" tabIndex={0} aria-label={label(person)}>
              {person.image && <AvatarImage src={person.image} alt={person.name} />}
              <AvatarFallback className="text-[10px] font-medium text-foreground">{initials(person.name)}</AvatarFallback>
            </Avatar>
          </TooltipTrigger>
          <TooltipContent>{label(person)}</TooltipContent>
        </Tooltip>
      ))}
      {rest.length > 0 && (
        <Tooltip>
          <TooltipTrigger asChild>
            <AvatarGroupCount role="listitem" tabIndex={0} aria-label={`${rest.length} more`} className="size-6 text-[10px]">
              +{rest.length}
            </AvatarGroupCount>
          </TooltipTrigger>
          <TooltipContent>
            {rest.map((person) => (
              <div key={person.userId}>{label(person)}</div>
            ))}
          </TooltipContent>
        </Tooltip>
      )}
    </AvatarGroup>
  );
}
