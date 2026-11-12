import { existsSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { BRANDS, brandForName, findBrand, searchBrands } from './brand-icons';

describe('brand presets', () => {
  it('has unique keys and a valid colour for every preset', () => {
    expect(new Set(BRANDS.map(({ key }) => key)).size).toBe(BRANDS.length);
    for (const brand of BRANDS) expect(brand.hex).toMatch(/^[0-9A-F]{6}$/);
  });

  it('includes the requested subscriptions and Philippine banks and e-wallets', () => {
    for (const key of ['netflix', 'anthropic', 'spotify', 'gcash', 'maya', 'maribank', 'metrobank']) expect(findBrand(key)).toBeDefined();
    expect(findBrand('netflix')?.path).toBeTruthy();
    expect(findBrand('gcash')?.initials).toBe('G');
  });

  it('finds presets by name or by another name people use', () => {
    expect(searchBrands('pay').map(({ key }) => key)).toEqual(expect.arrayContaining(['paypal', 'shopeepay', 'grabpay', 'maya']));
    expect(searchBrands('banco de oro').map(({ key }) => key)).toEqual(['bdo']);
  });

  it('recognises a brand inside an account or schedule name, but not inside another word', () => {
    expect(brandForName('Netflix Premium')?.key).toBe('netflix');
    expect(brandForName('my gcash wallet')?.key).toBe('gcash');
    expect(brandForName('Seabank savings')?.key).toBe('maribank');
    expect(brandForName('Groceries')).toBeUndefined();
    expect(brandForName('Smartphone plan')).toBeUndefined();
  });

  it('shows a saved logo image for the brands that have one, and every image file exists', () => {
    const withImages = BRANDS.filter((brand) => brand.image).map(({ key }) => key);
    expect(withImages.sort()).toEqual(['claude', 'gcash', 'maribank', 'maya', 'metrobank', 'netflix', 'spotify', 'tiktok']);
    for (const brand of BRANDS.filter(({ image }) => image)) expect(existsSync(`public${brand.image}`)).toBe(true);
    expect(findBrand('bdo')?.image).toBeUndefined();
  });
});
