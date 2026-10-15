import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRunHistoryStore } from './useRunHistoryStore';
import type { Run } from './useRunHistoryStore';

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
}));

const mockGet = AsyncStorage.getItem as jest.Mock;
const mockSet = AsyncStorage.setItem as jest.Mock;

const geometry = { type: 'LineString' as const, coordinates: [[103.8, 1.3]] as [number, number][] };

const sampleRun: Run = {
  id: 'run-1',
  routeId: 'r-1',
  plannedKm: 5,
  actualKm: 4.8,
  durationSec: 1800,
  elapsedSec: 1850,
  startedAt: '2026-06-30T08:00:00.000Z',
  endedAt: '2026-06-30T08:30:00.000Z',
  plannedGeometry: geometry,
  segments: [[[103.8, 1.3, 0, null]]],
  splits: [{ km: 1, sec: 360 }],
};

beforeEach(() => {
  useRunHistoryStore.setState({ runs: [] });
  jest.clearAllMocks();
});

describe('useRunHistoryStore', () => {
  it('hydrate loads runs from AsyncStorage', async () => {
    mockGet.mockResolvedValueOnce(JSON.stringify([sampleRun]));
    await useRunHistoryStore.getState().hydrate();
    expect(useRunHistoryStore.getState().runs).toEqual([sampleRun]);
  });

  it('hydrate normalizes legacy runs (flat tracePoints -> one segment)', async () => {
    const legacy = {
      id: 'legacy-1',
      routeId: 'r-0',
      plannedKm: 5,
      actualKm: 4.9,
      durationSec: 1700,
      startedAt: '2026-05-01T08:00:00.000Z',
      endedAt: '2026-05-01T08:28:00.000Z',
      plannedGeometry: geometry,
      tracePoints: [[103.8, 1.3], [103.81, 1.31]],
    };
    mockGet.mockResolvedValueOnce(JSON.stringify([legacy]));
    await useRunHistoryStore.getState().hydrate();
    const [run] = useRunHistoryStore.getState().runs;
    expect(run.segments).toEqual([[[103.8, 1.3], [103.81, 1.31]]]);
    expect((run as Record<string, unknown>).tracePoints).toBeUndefined();
    expect(run.splits).toBeUndefined();
  });

  it('hydrate handles null (empty storage)', async () => {
    mockGet.mockResolvedValueOnce(null);
    await useRunHistoryStore.getState().hydrate();
    expect(useRunHistoryStore.getState().runs).toEqual([]);
  });

  it('hydrate handles corrupted JSON without throwing', async () => {
    mockGet.mockResolvedValueOnce('{corrupt');
    await expect(useRunHistoryStore.getState().hydrate()).resolves.toBeUndefined();
    expect(useRunHistoryStore.getState().runs).toEqual([]);
  });

  it('saveRun prepends run and persists to AsyncStorage', async () => {
    mockSet.mockResolvedValueOnce(undefined);
    await useRunHistoryStore.getState().saveRun(sampleRun);
    expect(useRunHistoryStore.getState().runs[0]).toEqual(sampleRun);
    expect(mockSet).toHaveBeenCalledWith('@runloop/run-history', JSON.stringify([sampleRun]));
  });

  it('saveRun prepends to existing runs', async () => {
    useRunHistoryStore.setState({ runs: [sampleRun] });
    const run2: Run = { ...sampleRun, id: 'run-2' };
    mockSet.mockResolvedValueOnce(undefined);
    await useRunHistoryStore.getState().saveRun(run2);
    expect(useRunHistoryStore.getState().runs[0].id).toBe('run-2');
    expect(useRunHistoryStore.getState().runs[1].id).toBe('run-1');
  });
});
