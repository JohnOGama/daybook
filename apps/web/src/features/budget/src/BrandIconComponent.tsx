import type { ReactNode } from 'react';
import { cn } from '@/shared/utils/cn';
import { type BrandPreset, findBrand } from './brand-icons';
import { ACCOUNT_ICONS } from './budget-labels';
import type { BudgetAccount } from './budget-types';

// Picks black or white so the mark reads on the brand colour.
function luminance(hex: string): number {
  const [r, g, b] = [0, 2, 4].map((start) => {
    const channel = Number.parseInt(hex.slice(start, start + 2), 16) / 255;
    return channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

// A near-black brand would disappear on the dark app, so it sits on white instead.
function tileColours(hex: string): { background: string; ink: string } {
  const light = luminance(hex);
  if (light < 0.02) return { background: '#ffffff', ink: `#${hex}` };
  return { background: `#${hex}`, ink: light > 0.45 ? '#000000' : '#ffffff' };
}

// Always shown beside the name, so it's decorative for screen readers.
export function BrandTileComponent({ brand, className }: { brand: BrandPreset; className?: string }) {
  const { background, ink } = tileColours(brand.hex);
  // A logo image brings its own colours, so it sits on no tile and is never cropped.
  return (
    <span
      aria-hidden
      data-brand={brand.key}
      className={cn('grid shrink-0 place-items-center overflow-hidden rounded-lg', className)}
      style={{ background: brand.image ? undefined : background, color: ink, containerType: 'size' }}
    >
      {brand.image ? (
        <img src={brand.image} alt="" draggable={false} className="size-full object-contain" />
      ) : brand.path ? (
        <svg viewBox="0 0 24 24" className="size-[58%]" aria-hidden>
          <path d={brand.path} fill="currentColor" />
        </svg>
      ) : (
        <span className="leading-none font-bold tracking-tight" style={{ fontSize: brand.initials.length > 2 ? '30cqw' : '40cqw' }}>
          {brand.initials}
        </span>
      )}
    </span>
  );
}

// Shows the chosen brand, or the fallback (usually the account type or entry kind icon) when there is none.
export function BrandOrIconComponent({ icon, fallback, className }: { icon: string | null; fallback: ReactNode; className?: string }) {
  const brand = icon ? findBrand(icon) : undefined;
  return brand ? <BrandTileComponent brand={brand} className={className} /> : fallback;
}

// An account's logo when it has one, otherwise the icon for its type (bank, cash, card…).
export function AccountIconComponent({ account, className }: { account: BudgetAccount; className?: string }) {
  const Icon = ACCOUNT_ICONS[account.type];
  return (
    <BrandOrIconComponent
      icon={account.icon}
      className={className}
      fallback={
        <span className={cn('grid shrink-0 place-items-center rounded-lg bg-muted', className)}>
          <Icon className="size-4 text-muted-foreground" aria-hidden />
        </span>
      }
    />
  );
}
