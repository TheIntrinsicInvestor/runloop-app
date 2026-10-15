import * as Location from 'expo-location';
import { showAlert, type AlertButton } from '@/components';
import { useSettingsStore } from '@/store/useSettingsStore';
import { ensureBackgroundTracking } from './backgroundPermission';

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
}));

jest.mock('expo-location', () => ({
  getBackgroundPermissionsAsync: jest.fn(),
  requestBackgroundPermissionsAsync: jest.fn(),
}));

jest.mock('@/components', () => ({ showAlert: jest.fn() }));

const mockGetPerms = Location.getBackgroundPermissionsAsync as jest.Mock;
const mockRequestPerms = Location.requestBackgroundPermissionsAsync as jest.Mock;
const mockAlert = showAlert as jest.Mock;

/** Drive our explainer sheet by invoking one of the buttons it was rendered with. */
function answerExplainer(choice: 'Continue' | 'Not now') {
  mockAlert.mockImplementation((_t: string, _m: string, buttons: AlertButton[]) => {
    buttons.find((b) => b.text === choice)?.onPress?.();
  });
}

beforeEach(() => {
  jest.clearAllMocks();
  useSettingsStore.setState({ askedBackgroundLocation: false });
});

describe('ensureBackgroundTracking', () => {
  it('grants immediately when permission already exists, without prompting', async () => {
    mockGetPerms.mockResolvedValueOnce({ status: 'granted', canAskAgain: false });

    await expect(ensureBackgroundTracking()).resolves.toEqual({ granted: true, justRefused: false });
    expect(mockAlert).not.toHaveBeenCalled();
    expect(mockRequestPerms).not.toHaveBeenCalled();
  });

  it('does not re-prompt on later runs once we have already asked', async () => {
    mockGetPerms.mockResolvedValueOnce({ status: 'denied', canAskAgain: true });
    useSettingsStore.setState({ askedBackgroundLocation: true });

    await expect(ensureBackgroundTracking()).resolves.toEqual({ granted: false, justRefused: false });
    expect(mockAlert).not.toHaveBeenCalled();
    expect(mockRequestPerms).not.toHaveBeenCalled();
  });

  it('stays silent when iOS will no longer show the prompt', async () => {
    mockGetPerms.mockResolvedValueOnce({ status: 'denied', canAskAgain: false });

    await expect(ensureBackgroundTracking()).resolves.toEqual({ granted: false, justRefused: false });
    expect(mockAlert).not.toHaveBeenCalled();
    expect(mockRequestPerms).not.toHaveBeenCalled();
  });

  it('skips the OS prompt when the user declines the explainer, but records the attempt', async () => {
    mockGetPerms.mockResolvedValueOnce({ status: 'undetermined', canAskAgain: true });
    answerExplainer('Not now');

    await expect(ensureBackgroundTracking()).resolves.toEqual({ granted: false, justRefused: true });
    expect(mockRequestPerms).not.toHaveBeenCalled();
    expect(useSettingsStore.getState().askedBackgroundLocation).toBe(true);
  });

  it('grants when the user accepts the explainer and iOS agrees', async () => {
    mockGetPerms.mockResolvedValueOnce({ status: 'undetermined', canAskAgain: true });
    mockRequestPerms.mockResolvedValueOnce({ status: 'granted' });
    answerExplainer('Continue');

    await expect(ensureBackgroundTracking()).resolves.toEqual({ granted: true, justRefused: false });
    expect(mockRequestPerms).toHaveBeenCalledTimes(1);
  });

  // "Allow Once" resolves as denied with no second prompt — indistinguishable from
  // a refusal, and the case that must still fall back to foreground tracking.
  it('reports a refusal when iOS denies after the explainer', async () => {
    mockGetPerms.mockResolvedValueOnce({ status: 'undetermined', canAskAgain: true });
    mockRequestPerms.mockResolvedValueOnce({ status: 'denied' });
    answerExplainer('Continue');

    await expect(ensureBackgroundTracking()).resolves.toEqual({ granted: false, justRefused: true });
    expect(useSettingsStore.getState().askedBackgroundLocation).toBe(true);
  });
});
