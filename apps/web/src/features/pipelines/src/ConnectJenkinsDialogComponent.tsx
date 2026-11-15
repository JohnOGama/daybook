'use client';

import { useMutation } from '@tanstack/react-query';
import { Copy, Sparkles } from 'lucide-react';
import { useMemo, useState } from 'react';
import { SkeletonBox } from 'skullet/react';
import { toast } from 'sonner';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/shared/components/ui/alert-dialog';
import { Button } from '@/shared/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/shared/components/ui/dialog';
import { Input } from '@/shared/components/ui/input';
import { Label } from '@/shared/components/ui/label';
import { Textarea } from '@/shared/components/ui/textarea';
import { cn } from '@/shared/utils/cn';
import { usePipelineKey } from '../hooks/usePipelineKey';
import { helperSnippet, markAdded } from './jenkinsfile-lines';
import { instrumentJenkinsfile } from './pipelines-api';

type ConnectJenkinsDialogProps = { open: boolean; onOpenChange(open: boolean): void; spaceId: string; spaceTitle: string; isOwner: boolean };

const copy = async (text: string, what: string) => {
  try {
    await navigator.clipboard.writeText(text);
    toast.success(`${what} copied`);
  } catch {
    toast.error(`Could not copy the ${what.toLowerCase()}`);
  }
};

const when = (iso: string) => new Date(iso).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' });

// The key (owner only): made, replaced, and shown just once.
function KeySection({ spaceId }: { spaceId: string }) {
  const { status, create } = usePipelineKey(spaceId, true);
  const [fresh, setFresh] = useState<string | null>(null);
  const make = () => create.mutate(undefined, { onSuccess: ({ key }) => setFresh(key), onError: (error) => toast.error(error.message) });

  return (
    <section aria-label="Key" className="flex flex-col gap-2.5 rounded-xl border bg-card p-4">
      {fresh ? (
        <>
          <Label htmlFor="pipeline-key">Key for this space</Label>
          <div className="flex gap-2">
            <Input id="pipeline-key" readOnly value={fresh} className="font-mono text-[12.5px]" onFocus={(event) => event.currentTarget.select()} />
            <Button onClick={() => void copy(fresh, 'Key')}>
              <Copy aria-hidden />
              Copy
            </Button>
          </div>
          <p className="text-xs text-signal">Shown once. Daybook keeps only a hash of it; if you lose it, make a new one.</p>
          <p className="text-xs text-muted-foreground">Add it in Jenkins as a secret text credential named DAYBOOK_KEY.</p>
        </>
      ) : status.isPending ? (
        <SkeletonBox width="60%" height={20} />
      ) : status.data ? (
        <div className="flex flex-wrap items-center gap-3">
          <p className="text-sm">
            Made {when(status.data.createdAt)} · last used {status.data.lastUsedAt ? when(status.data.lastUsedAt) : 'never'}
          </p>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="outline" size="sm" className="ml-auto border-destructive/45 text-destructive hover:text-destructive">
                Replace key
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Replace the key?</AlertDialogTitle>
                <AlertDialogDescription>The old key stops working at once. Update the DAYBOOK_KEY credential in Jenkins with the new one.</AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction variant="destructive" onClick={make}>
                  Replace
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-3">
          <p className="text-sm text-muted-foreground">Not made yet</p>
          <Button size="sm" className="ml-auto" disabled={create.isPending} onClick={make}>
            Make a key
          </Button>
        </div>
      )}
    </section>
  );
}

// The AI helper (editors and the owner): paste a Jenkinsfile, get it back with the reporting lines added.
function AiSection({ spaceId }: { spaceId: string }) {
  const [pasted, setPasted] = useState('');
  const instrument = useMutation({ mutationFn: (jenkinsfile: string) => instrumentJenkinsfile({ spaceId, jenkinsfile }) });
  const result = instrument.data;
  const lines = useMemo(() => (result ? markAdded(instrument.variables ?? '', result.jenkinsfile) : []), [result, instrument.variables]);
  const added = lines.filter((line) => line.added).length;
  const daybookUrl = typeof window === 'undefined' ? '' : window.location.origin;

  return (
    <div className="grid min-h-0 gap-4 md:grid-cols-2">
      <section aria-label="Your Jenkinsfile" className="flex min-w-0 flex-col gap-2">
        <Label htmlFor="pasted-jenkinsfile">Your production Jenkinsfile</Label>
        <Textarea
          id="pasted-jenkinsfile"
          spellCheck={false}
          value={pasted}
          onChange={(event) => setPasted(event.target.value)}
          placeholder="pipeline { … }"
          className="h-72 resize-none font-mono text-xs leading-relaxed whitespace-pre"
        />
        <p className="text-xs text-muted-foreground">Only this text goes to the AI, never your key. Take any passwords or tokens written in the file out first.</p>
        <Button className="self-start rounded-full" disabled={!pasted.trim() || instrument.isPending} onClick={() => instrument.mutate(pasted)}>
          <Sparkles className="text-signal" aria-hidden />
          Add Daybook reporting
        </Button>
      </section>

      {instrument.isError ? (
        <div className="flex min-w-0 flex-col gap-2">
          <p role="alert" className="text-sm text-destructive">
            {instrument.error.message}
          </p>
          <section aria-label="Add by hand" className="flex min-h-0 flex-col gap-2">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-medium">Add by hand</h3>
              <Button variant="outline" size="sm" onClick={() => void copy(helperSnippet(daybookUrl), 'Snippet')}>
                <Copy aria-hidden />
                Copy
              </Button>
            </div>
            <pre className="h-72 overflow-auto rounded-xl border bg-background p-3 font-mono text-xs leading-relaxed">{helperSnippet(daybookUrl)}</pre>
          </section>
        </div>
      ) : result ? (
        <section aria-label="With Daybook reporting" className="flex min-w-0 flex-col gap-2">
          <div className="flex flex-wrap items-center gap-2.5">
            <h3 className="text-sm font-medium">With Daybook reporting</h3>
            <span className="text-xs text-status-done">+{added} lines</span>
            <span className="text-xs text-muted-foreground">Your steps are unchanged</span>
            <Button variant="outline" size="sm" className="ml-auto" onClick={() => void copy(result.jenkinsfile, 'Jenkinsfile')}>
              <Copy aria-hidden />
              Copy
            </Button>
          </div>
          <pre className="h-72 overflow-auto rounded-xl border bg-background py-3 font-mono text-xs leading-relaxed">
            {lines.map((line, index) => (
              <span key={index} data-added={line.added} className={cn('block px-3', line.added && 'bg-status-done/12')}>
                {line.text || ' '}
              </span>
            ))}
          </pre>
          <p className="text-xs text-muted-foreground">{result.summary} Check it before you commit it to your repository. Daybook does not change Jenkins itself.</p>
        </section>
      ) : (
        <p className="grid place-items-center rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">
          Paste your Jenkinsfile and the version with reporting added shows here.
        </p>
      )}
    </div>
  );
}

// Connect Jenkins: the key (owner only) and the AI that adds reporting to a Jenkinsfile.
export function ConnectJenkinsDialogComponent({ open, onOpenChange, spaceId, spaceTitle, isOwner }: ConnectJenkinsDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-5xl">
        <DialogHeader>
          <DialogTitle>Connect Jenkins to {spaceTitle}</DialogTitle>
          <DialogDescription>
            {isOwner ? 'Add the key to Jenkins as a secret text credential named DAYBOOK_KEY. ' : ''}Paste your Jenkinsfile and let AI add the reporting to every stage.
          </DialogDescription>
        </DialogHeader>
        {isOwner && <KeySection spaceId={spaceId} />}
        <AiSection spaceId={spaceId} />
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Done
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
