import {
  advanceRouteIndex,
  splitRouteAtIndex,
  progressIndexForTrace,
  type LngLat,
} from './routeProgress';

// A straight west→east line at the equator, ~111 m between vertices.
const line: LngLat[] = Array.from({ length: 20 }, (_, i) => [i * 0.001, 0]);

describe('advanceRouteIndex', () => {
  it('snaps to the nearest vertex ahead of the current index', () => {
    expect(advanceRouteIndex(line, [0.005, 0], 0)).toBe(5);
  });

  it('never moves backwards, even when the runner doubles back', () => {
    expect(advanceRouteIndex(line, [0.001, 0], 10)).toBe(10);
  });

  it('ignores vertices beyond the lookahead window', () => {
    // Target is vertex 15, but only 2 vertices ahead are considered.
    expect(advanceRouteIndex(line, [0.015, 0], 0, 2)).toBe(2);
  });

  it('handles an empty route', () => {
    expect(advanceRouteIndex([], [0, 0], 0)).toBe(0);
  });

  it('clamps an out-of-range starting index', () => {
    expect(advanceRouteIndex(line, [0.019, 0], 999)).toBe(19);
  });

  it('does not snap back to the start of a loop that closes on itself', () => {
    // A square loop whose last vertex sits on top of its first.
    const loop: LngLat[] = [
      [0, 0], [0.01, 0], [0.01, 0.01], [0, 0.01], [0, 0],
    ];
    // Runner is near the shared start/end point, most of the way round.
    expect(advanceRouteIndex(loop, [0.0001, 0.0001], 3)).toBe(4);
  });
});

describe('splitRouteAtIndex', () => {
  it('splits into behind and ahead sharing the boundary vertex', () => {
    const { behind, ahead } = splitRouteAtIndex(line, 5);
    expect(behind).toHaveLength(6);
    expect(ahead).toHaveLength(15);
    expect(behind[behind.length - 1]).toEqual(ahead[0]);
  });

  it('puts everything ahead at the start of a run', () => {
    const { behind, ahead } = splitRouteAtIndex(line, 0);
    expect(behind).toHaveLength(1);
    expect(ahead).toHaveLength(20);
  });

  it('puts everything behind at the end of a run', () => {
    const { behind, ahead } = splitRouteAtIndex(line, 19);
    expect(behind).toHaveLength(20);
    expect(ahead).toHaveLength(1);
  });

  it('handles an empty route', () => {
    expect(splitRouteAtIndex([], 3)).toEqual({ behind: [], ahead: [] });
  });
});

describe('progressIndexForTrace', () => {
  it('reports how far along the route a finished trace got', () => {
    const trace: LngLat[] = [[0, 0], [0.004, 0], [0.008, 0]];
    expect(progressIndexForTrace(line, trace)).toBe(8);
  });

  it('reaches the end for a fully completed route', () => {
    const trace = line.map((p) => [p[0], p[1]] as LngLat);
    expect(progressIndexForTrace(line, trace)).toBe(19);
  });

  it('leaves the whole route ahead when the trace is empty (legacy runs)', () => {
    expect(progressIndexForTrace(line, [])).toBe(0);
    expect(splitRouteAtIndex(line, progressIndexForTrace(line, [])).ahead).toHaveLength(20);
  });

  it('does not rewind when the trace doubles back at the end', () => {
    const trace: LngLat[] = [[0, 0], [0.010, 0], [0.006, 0]];
    expect(progressIndexForTrace(line, trace)).toBe(10);
  });
});
