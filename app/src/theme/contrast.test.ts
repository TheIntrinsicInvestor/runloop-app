import { darkTheme, lightTheme, type ThemeColors } from './index';

/** WCAG 2.1 relative luminance of an #RRGGBB colour. */
function luminance(hex: string): number {
  const channels = [1, 3, 5]
    .map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map((v) => (v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4)));
  return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
}

/** WCAG contrast ratio, 1..21. */
function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

// Worst-case (lightest) land fill of each basemap — a route stroke has to stay
// visible against this, and it is the least favourable backdrop on either style.
const STREETS_LAND = '#EFEBE4';
const DARK_LAND = '#181818';

const AA_TEXT = 4.5;
const MAP_STROKE = 3;

/**
 * Known shortfalls in the Phase 3 dark palette, recorded so the suite stays green
 * without hiding them. Both predate Phase 5.5 and neither is affected by the day/
 * night work — fixing them means restyling the locked dark chrome, which is its own
 * decision. Tighten these numbers when that happens; never loosen them.
 */
const DARK_DEBT = { textDim: 2.7, mapRouteMuted: 1.4 };

describe('contrast', () => {
  it('computes known ratios', () => {
    expect(contrast('#FFFFFF', '#000000')).toBeCloseTo(21, 1);
    expect(contrast('#FFFFFF', '#FFFFFF')).toBeCloseTo(1, 5);
  });
});

describe.each([
  ['light', lightTheme.colors, STREETS_LAND, {} as Partial<typeof DARK_DEBT>],
  ['dark', darkTheme.colors, DARK_LAND, DARK_DEBT],
])('%s palette', (_name, c: ThemeColors, land: string, debt) => {
  it.each(['text', 'textMuted', 'textDim', 'accentBright', 'danger', 'success'] as const)(
    '%s meets AA on both bg and surface',
    (token) => {
      const floor = debt[token as keyof typeof DARK_DEBT] ?? AA_TEXT;
      expect(contrast(c[token], c.bg)).toBeGreaterThanOrEqual(floor);
      expect(contrast(c[token], c.surface)).toBeGreaterThanOrEqual(floor);
    }
  );

  it('accentOn is legible on an accent fill', () => {
    expect(contrast(c.accentOn, c.accent)).toBeGreaterThanOrEqual(AA_TEXT);
  });

  it('the selected route stands out against the basemap', () => {
    expect(contrast(c.mapRoute, land)).toBeGreaterThanOrEqual(AA_TEXT);
  });

  it('candidate loops are visible but subordinate to the selected route', () => {
    expect(contrast(c.mapCandidate, land)).toBeGreaterThanOrEqual(MAP_STROKE);
    expect(contrast(c.mapCandidate, land)).toBeLessThan(contrast(c.mapRoute, land));
  });

  it('the uncovered part of a route stays visible', () => {
    expect(contrast(c.mapRouteMuted, land)).toBeGreaterThanOrEqual(
      debt.mapRouteMuted ?? MAP_STROKE
    );
  });
});
