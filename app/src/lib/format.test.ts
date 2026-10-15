import { formatClock, formatDuration } from './format';

describe('formatDuration', () => {
  it('floors to whole minutes', () => {
    expect(formatDuration(1780)).toBe('29 min');
  });
});

describe('formatClock', () => {
  it('formats minutes:seconds with zero-padded seconds', () => {
    expect(formatClock(1780)).toBe('29:40');
  });
});
