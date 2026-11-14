'use client';

import { RefreshCw } from 'lucide-react';
import { Skeleton } from 'skullet/react';
import { SectionCardComponent } from '@/features/budget';
import { Badge } from '@/shared/components/ui/badge';
import { Button } from '@/shared/components/ui/button';
import { useJobsMutations } from '../hooks/useJobsMutations';
import { isMatchStale } from './jobs-math';
import type { Job, JobProfile } from './jobs-types';
import { MatchRingComponent } from './MatchRingComponent';

function Skills({ label, skills, missing }: { label: string; skills: string[]; missing?: boolean }) {
  if (skills.length === 0) return null;
  return (
    <ul aria-label={label} className="flex flex-wrap gap-1.5">
      {skills.map((skill) => (
        <li key={skill}>
          <Badge variant="outline" className={missing ? 'border-dashed text-muted-foreground' : undefined}>
            {skill}
          </Badge>
        </li>
      ))}
    </ul>
  );
}

const SAMPLE_MATCH = { pct: 80, summary: 'A strong fit on most of what the role asks for, with one or two gaps.', skillsHave: ['React', 'TypeScript'], skillsMissing: ['Testing'] };

// How well the owner's CV fits this job, as the AI estimates it, or why there is no estimate yet.
export function JobMatchCardComponent({ job, profile, onAddCv }: { job: Job; profile: JobProfile; onAddCv: () => void }) {
  const { recheckMatch } = useJobsMutations();
  const checking = recheckMatch.isPending && recheckMatch.variables === job.id;
  const match = job.match ?? (checking ? { ...SAMPLE_MATCH, matchedAt: '' } : null);
  const canCheck = Boolean(profile.cvText) && job.description.trim() !== '';

  return (
    <SectionCardComponent title="Match" action={<span className="text-xs text-muted-foreground">AI estimate</span>}>
      <div className="flex flex-col gap-3 px-4 pb-4 text-sm">
        {!profile.cvText ? (
          <div className="flex items-center justify-between gap-3">
            <p className="text-muted-foreground">Add your CV to see how well you match.</p>
            <Button variant="outline" size="sm" onClick={onAddCv}>
              Add your CV
            </Button>
          </div>
        ) : !canCheck ? (
          <p className="text-muted-foreground">Add a job description to see how well it matches.</p>
        ) : match ? (
          <Skeleton loading={checking} label="Checking the match">
            <div className="flex flex-col gap-3">
              <div className="flex items-start gap-3">
                <MatchRingComponent pct={match.pct} />
                <p className="text-muted-foreground">{match.summary}</p>
              </div>
              <Skills label="Skills you have" skills={match.skillsHave} />
              <Skills label="Skills to show" skills={match.skillsMissing} missing />
            </div>
          </Skeleton>
        ) : (
          <p className="text-muted-foreground">Not checked yet.</p>
        )}
        {canCheck && (
          <div className="flex items-center justify-between gap-3">
            <span className="text-xs text-signal">{isMatchStale(job, profile) ? 'CV changed since this match' : ''}</span>
            <Button variant="ghost" size="sm" disabled={checking} onClick={() => recheckMatch.mutate(job.id)}>
              <RefreshCw aria-hidden />
              {job.match ? 'Recheck' : 'Check match'}
            </Button>
          </div>
        )}
      </div>
    </SectionCardComponent>
  );
}
