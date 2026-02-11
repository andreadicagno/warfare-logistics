/** Darken a 0xRRGGBB color by `amount` (0 = no change, 1 = black). */
export function darken(color: number, amount: number): number {
  const factor = 1 - amount;
  const r = Math.floor(((color >> 16) & 0xff) * factor);
  const g = Math.floor(((color >> 8) & 0xff) * factor);
  const b = Math.floor((color & 0xff) * factor);
  return (r << 16) | (g << 8) | b;
}

/** Shift each RGB channel by `factor` (e.g. +0.08 = 8% brighter, -0.08 = 8% darker). */
export function adjustLuminosity(color: number, factor: number): number {
  const r = Math.min(255, Math.max(0, Math.round(((color >> 16) & 0xff) * (1 + factor))));
  const g = Math.min(255, Math.max(0, Math.round(((color >> 8) & 0xff) * (1 + factor))));
  const b = Math.min(255, Math.max(0, Math.round((color & 0xff) * (1 + factor))));
  return (r << 16) | (g << 8) | b;
}
