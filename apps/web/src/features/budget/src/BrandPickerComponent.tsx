'use client';

import { Check, Search } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/shared/components/ui/popover';
import { cn } from '@/shared/utils/cn';
import { BRAND_GROUPS, type BrandGroup, findBrand, searchBrands } from './brand-icons';
import { BrandTileComponent } from './BrandIconComponent';

type BrandPickerProps = { id: string; value: string | null; onChange: (icon: string | null) => void; groups?: readonly BrandGroup[] };

// Optional logo for an account or a recurring item, chosen from presets.
export function BrandPickerComponent({ id, value, onChange, groups = BRAND_GROUPS }: BrandPickerProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const chosen = value ? findBrand(value) : undefined;
  const matches = searchBrands(query);
  const shownGroups = query ? BRAND_GROUPS : groups;

  function pick(icon: string | null) {
    onChange(icon);
    setOpen(false);
    setQuery('');
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button id={id} type="button" variant="outline" className="w-full justify-start gap-2.5 font-normal">
          {chosen ? (
            <>
              <BrandTileComponent brand={chosen} className="size-5 rounded-[5px]" />
              {chosen.name}
            </>
          ) : (
            <span className="text-muted-foreground">No icon</span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-[min(22rem,calc(100vw-2rem))] p-0">
        <div className="relative border-b">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <Input
            autoFocus
            aria-label="Search icons"
            placeholder="Search Netflix, GCash, BDO…"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            className="h-10 rounded-none border-0 pl-9 shadow-none focus-visible:ring-0"
          />
        </div>
        <div className="max-h-80 overflow-y-auto p-2">
          {!query && (
            <button
              type="button"
              onClick={() => pick(null)}
              className={cn('mb-1 flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-accent', !value && 'font-medium')}
            >
              No icon
              {!value && <Check className="ml-auto size-4" aria-hidden />}
            </button>
          )}
          {shownGroups.map((group) => {
            const brands = matches.filter((brand) => brand.group === group);
            if (brands.length === 0) return null;
            return (
              <section key={group} aria-label={group} className="mb-2">
                <h3 className="px-2 pt-1 pb-1.5 text-[11px] font-medium tracking-wide text-muted-foreground uppercase">{group}</h3>
                <ul className="grid grid-cols-4 gap-1">
                  {brands.map((brand) => (
                    <li key={brand.key}>
                      <button
                        type="button"
                        aria-pressed={value === brand.key}
                        onClick={() => pick(brand.key)}
                        className={cn(
                          'flex w-full flex-col items-center gap-1 rounded-md px-1 py-2 text-[11px] text-muted-foreground hover:bg-accent hover:text-foreground',
                          value === brand.key && 'bg-accent text-foreground',
                        )}
                      >
                        <BrandTileComponent brand={brand} className="size-8" />
                        <span className="w-full truncate text-center">{brand.name}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              </section>
            );
          })}
          {matches.length === 0 && <p className="px-2 py-6 text-center text-sm text-muted-foreground">No preset for “{query}”.</p>}
        </div>
      </PopoverContent>
    </Popover>
  );
}
