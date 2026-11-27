'use client';

import { Star } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { LogoMarkComponent } from '@/shared/components/LogoMarkComponent';
import { Button } from '@/shared/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/shared/components/ui/tabs';
import { authClient } from '@/shared/services/auth-client';
import { FAQ, FEATURES, REPO_URL, SELF_HOST_STEPS, TOOL_SHOTS } from './landing-content';

const NO_RING = 'focus-visible:border-transparent focus-visible:ring-0 focus-visible:outline-none';

function Heading({ children }: { children: string }) {
  return <h2 className="font-display text-3xl font-extrabold tracking-tight text-balance md:text-4xl">{children}</h2>;
}

function ToolPreviews() {
  return (
    <Tabs defaultValue={TOOL_SHOTS[0].value} className="mt-6 gap-3">
      <TabsList className="h-auto flex-wrap justify-start">
        {TOOL_SHOTS.map((shot) => (
          <TabsTrigger key={shot.value} className={NO_RING} value={shot.value}>
            {shot.label}
          </TabsTrigger>
        ))}
      </TabsList>
      {TOOL_SHOTS.map((shot) => (
        <TabsContent key={shot.value} value={shot.value}>
          <Image src={`/landing/${shot.value}.jpg`} alt={shot.alt} width={1568} height={726} sizes="(min-width: 800px) 768px, 100vw" className="h-auto w-full rounded-2xl bg-muted" />
        </TabsContent>
      ))}
    </Tabs>
  );
}

export function LandingPageComponent() {
  const { data: session } = authClient.useSession();
  const signedIn = Boolean(session);

  return (
    <div className="mx-auto max-w-[800px] px-4">
      <header className="flex items-center justify-between gap-3 py-5">
        <Link href="/" className="flex items-center gap-2 font-display text-xl font-black">
          <LogoMarkComponent className="size-6" />
          Daybook
        </Link>
        <nav aria-label="Landing" className="flex items-center gap-1 text-sm">
          <a href="#tools" className="hidden rounded-lg px-3 py-1.5 text-muted-foreground hover:bg-muted hover:text-foreground sm:block">Tools</a>
          <a href="#start" className="hidden rounded-lg px-3 py-1.5 text-muted-foreground hover:bg-muted hover:text-foreground sm:block">Get started</a>
          <a href="#faq" className="hidden rounded-lg px-3 py-1.5 text-muted-foreground hover:bg-muted hover:text-foreground sm:block">FAQ</a>
          <a href={REPO_URL} className="rounded-lg px-3 py-1.5 text-muted-foreground hover:bg-muted hover:text-foreground">GitHub</a>
          <Button asChild size="sm">
            <Link href={signedIn ? '/list' : '/sign-in'}>{signedIn ? 'Dashboard' : 'Sign in'}</Link>
          </Button>
        </nav>
      </header>

      <main>
        <section className="py-12 text-center md:py-16">
          <h1 className="mx-auto max-w-[14ch] font-display text-4xl font-black tracking-tight text-balance md:text-6xl">One quiet place for everything you run.</h1>
          <p className="mx-auto mt-5 max-w-[56ch] text-base text-muted-foreground md:text-[17px]">
            Tasks, notes, books, budgets, workouts, job hunts, diagrams and uptime checks. Each lives in its own space with the right tool, and every space can be shared and edited live.
          </p>
          <div className="mt-7 flex flex-wrap justify-center gap-2.5">
            <Button asChild size="lg">
              <Link href={signedIn ? '/list' : '/sign-up'}>{signedIn ? 'Go to dashboard' : 'Open Daybook'}</Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <a href={REPO_URL}>
                <Star aria-hidden /> Star on GitHub
              </a>
            </Button>
          </div>
          <p className="mt-3.5 text-[13px] text-muted-foreground">Free to self-host. Your data stays in your own Postgres.</p>
        </section>

        <section id="tools" className="scroll-mt-4 py-12">
          <Heading>Every space runs one tool.</Heading>
          <p className="mt-3 max-w-[56ch] text-muted-foreground">Pick a tool to see how a space looks. The screenshots use example data.</p>
          <ToolPreviews />
        </section>

        <section className="py-12">
          <Heading>Built to be used every day.</Heading>
          <div className="mt-7 grid gap-3.5 sm:grid-cols-2 md:grid-cols-3">
            {FEATURES.map((feature) => (
              <div key={feature.title} className="rounded-2xl bg-muted p-5">
                <div className="grid size-8.5 place-items-center rounded-[10px] bg-background font-mono text-[13px] font-semibold">{feature.mark}</div>
                <h3 className="mt-3 font-display text-lg font-extrabold">{feature.title}</h3>
                <p className="mt-1.5 text-sm text-muted-foreground">{feature.text}</p>
              </div>
            ))}
          </div>
        </section>

        <section id="start" className="scroll-mt-4 py-12">
          <Heading>Use it hosted, or run your own.</Heading>
          <div className="mt-7 grid gap-3.5 md:grid-cols-2">
            <div className="rounded-2xl border border-foreground bg-muted p-6">
              <h3 className="font-display text-xl font-extrabold">Hosted</h3>
              <p className="mt-1.5 text-[13px] text-muted-foreground">Sign up and start in a minute.</p>
              <ul className="mt-3.5 grid gap-1.5 text-sm text-muted-foreground">
                <li>✓ All eleven tools</li>
                <li>✓ Sharing and live editing</li>
                <li>✓ No setup, no servers</li>
              </ul>
              <Button asChild className="mt-5">
                <Link href={signedIn ? '/list' : '/sign-up'}>{signedIn ? 'Go to dashboard' : 'Create an account'}</Link>
              </Button>
            </div>
            <div className="min-w-0 rounded-2xl border border-transparent bg-muted p-6">
              <h3 className="font-display text-xl font-extrabold">Self-host</h3>
              <p className="mt-1.5 text-[13px] text-muted-foreground">Needs Node 22, pnpm and Postgres.</p>
              <pre className="mt-4 overflow-x-auto rounded-[10px] bg-background p-4 font-mono text-[13px] leading-7">{SELF_HOST_STEPS}</pre>
              <Button asChild variant="outline" className="mt-4">
                <a href={`${REPO_URL}#readme`}>Read the self-host guide</a>
              </Button>
            </div>
          </div>
        </section>

        <section id="faq" className="scroll-mt-4 py-12">
          <Heading>Good to know.</Heading>
          <div className="mt-6">
            {FAQ.map((item, index) => (
              <details key={item.question} open={index === 0} className="border-t border-border py-4 last:border-b">
                <summary className="cursor-pointer outline-none text-base font-semibold">{item.question}</summary>
                <p className="mt-2.5 max-w-[62ch] text-muted-foreground">{item.answer}</p>
              </details>
            ))}
          </div>
        </section>
      </main>

      <footer className="mt-10 grid grid-cols-2 gap-7 pt-10 pb-14 text-sm md:grid-cols-[1.6fr_1fr_1fr]">
        <div className="col-span-2 md:col-span-1">
          <span className="font-display text-xl font-black">Daybook</span>
          <p className="mt-2.5 mb-3.5 max-w-[34ch] text-muted-foreground">A personal workspace for tasks, notes, money, health and more.</p>
          <Button asChild variant="outline" size="sm">
            <a href={REPO_URL}>
              <Star aria-hidden /> Star on GitHub
            </a>
          </Button>
        </div>
        <div className="grid content-start gap-1.5">
          <h2 className="mb-1.5 font-mono text-xs font-medium tracking-wider text-muted-foreground uppercase">Product</h2>
          <a href="#tools" className="text-muted-foreground hover:text-foreground">Tools</a>
          <a href="#start" className="text-muted-foreground hover:text-foreground">Get started</a>
          <Link href={signedIn ? '/list' : '/sign-in'} className="text-muted-foreground hover:text-foreground">{signedIn ? 'Dashboard' : 'Sign in'}</Link>
        </div>
        <div className="grid content-start gap-1.5">
          <h2 className="mb-1.5 font-mono text-xs font-medium tracking-wider text-muted-foreground uppercase">Project</h2>
          <a href={REPO_URL} className="text-muted-foreground hover:text-foreground">GitHub</a>
          <a href={`${REPO_URL}/issues`} className="text-muted-foreground hover:text-foreground">Issues</a>
        </div>
        <p className="col-span-full text-[13px] text-muted-foreground">© 2026 Daybook. Open source.</p>
      </footer>
    </div>
  );
}
