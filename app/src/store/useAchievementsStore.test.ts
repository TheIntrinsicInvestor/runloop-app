import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAchievementsStore } from './useAchievementsStore';

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
}));

const mockGet = AsyncStorage.getItem as jest.Mock;
const mockSet = AsyncStorage.setItem as jest.Mock;

beforeEach(() => {
  useAchievementsStore.setState({ seenIds: [] });
  jest.clearAllMocks();
});

describe('useAchievementsStore', () => {
  it('hydrate loads the seen-set from AsyncStorage', async () => {
    mockGet.mockResolvedValueOnce(JSON.stringify(['first-run', 'lifetime-100km']));
    await useAchievementsStore.getState().hydrate();
    expect(useAchievementsStore.getState().seenIds).toEqual(['first-run', 'lifetime-100km']);
  });

  it('hydrate handles empty storage without throwing', async () => {
    mockGet.mockResolvedValueOnce(null);
    await useAchievementsStore.getState().hydrate();
    expect(useAchievementsStore.getState().seenIds).toEqual([]);
  });

  it('markSeen adds new ids and persists the merged set', async () => {
    useAchievementsStore.setState({ seenIds: ['first-run'] });
    mockSet.mockResolvedValueOnce(undefined);
    await useAchievementsStore.getState().markSeen(['lifetime-100km']);
    expect(useAchievementsStore.getState().seenIds).toEqual(['first-run', 'lifetime-100km']);
    expect(mockSet).toHaveBeenCalledWith(
      '@runloop/achievements-seen',
      JSON.stringify(['first-run', 'lifetime-100km']),
    );
  });

  it('markSeen never records the same id twice', async () => {
    useAchievementsStore.setState({ seenIds: ['first-run'] });
    mockSet.mockResolvedValueOnce(undefined);
    await useAchievementsStore.getState().markSeen(['first-run']);
    expect(useAchievementsStore.getState().seenIds).toEqual(['first-run']);
  });

  it('markSeen is a no-op for an empty id list (no AsyncStorage write)', async () => {
    useAchievementsStore.setState({ seenIds: ['first-run'] });
    await useAchievementsStore.getState().markSeen([]);
    expect(mockSet).not.toHaveBeenCalled();
  });
});
