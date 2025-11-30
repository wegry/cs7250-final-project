import { interpolateViridis } from "d3-scale-chromatic";

export function getViridisColors(n: number): string[] {
  if (n === 1) return [interpolateViridis(0.5)];
  return Array.from({ length: n }, (_, i) => interpolateViridis(i / (n - 1)));
}
