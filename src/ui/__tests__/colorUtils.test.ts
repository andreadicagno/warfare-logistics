import { describe, expect, it } from 'vitest';
import { adjustLuminosity, darken } from '../colorUtils';

describe('darken', () => {
  it('darkens white by 30%', () => {
    expect(darken(0xffffff, 0.3)).toBe(0xb2b2b2);
  });

  it('darkens a color by 50%', () => {
    expect(darken(0x804020, 0.5)).toBe(0x402010);
  });

  it('returns black when amount is 1', () => {
    expect(darken(0xff8844, 1.0)).toBe(0x000000);
  });

  it('returns same color when amount is 0', () => {
    expect(darken(0x8a9e5e, 0.0)).toBe(0x8a9e5e);
  });
});

describe('adjustLuminosity', () => {
  it('brightens a color by positive factor', () => {
    expect(adjustLuminosity(0x808080, 0.08)).toBe(0x8a8a8a);
  });

  it('darkens a color by negative factor', () => {
    expect(adjustLuminosity(0x808080, -0.08)).toBe(0x767676);
  });

  it('clamps to 255', () => {
    expect(adjustLuminosity(0xffffff, 0.5)).toBe(0xffffff);
  });

  it('clamps to 0', () => {
    expect(adjustLuminosity(0x000000, -0.5)).toBe(0x000000);
  });
});
