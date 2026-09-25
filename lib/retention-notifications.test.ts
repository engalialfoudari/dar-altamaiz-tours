import { Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Notifications from "expo-notifications";
import { scheduleRetentionNotifications } from "../utils/notifications";

jest.mock("expo-constants", () => ({
  __esModule: true,
  default: { executionEnvironment: "standalone" },
}));

jest.mock("@react-native-async-storage/async-storage", () => ({
  __esModule: true,
  default: {
    getItem: jest.fn(),
    setItem: jest.fn(),
  },
}));

jest.mock("expo-notifications", () => ({
  getPermissionsAsync: jest.fn(),
  requestPermissionsAsync: jest.fn(),
  cancelAllScheduledNotificationsAsync: jest.fn(),
  scheduleNotificationAsync: jest.fn(),
  SchedulableTriggerInputTypes: { DATE: "date" },
}));

const mockedStorage = AsyncStorage as jest.Mocked<typeof AsyncStorage>;
const mockedNotifications = Notifications as jest.Mocked<typeof Notifications>;

describe("retention notification schedule", () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date(2026, 8, 17, 10, 0, 0));
    jest.spyOn(Math, "random").mockReturnValue(0);
    jest.clearAllMocks();
    mockedStorage.getItem.mockResolvedValue(null);
    mockedNotifications.getPermissionsAsync.mockResolvedValue({
      granted: true,
      canAskAgain: true,
    } as Awaited<ReturnType<typeof Notifications.getPermissionsAsync>>);
    mockedNotifications.scheduleNotificationAsync.mockResolvedValue("scheduled");
  });

  afterEach(() => {
    jest.restoreAllMocks();
    jest.useRealTimers();
  });

  it("schedules the 3, 6, and 9-day reminders plus the long-term sequence", async () => {
    const platformReplacement = jest.replaceProperty(Platform, "OS", "android");

    await scheduleRetentionNotifications();

    expect(mockedNotifications.cancelAllScheduledNotificationsAsync).toHaveBeenCalledTimes(1);
    expect(mockedNotifications.scheduleNotificationAsync).toHaveBeenCalledTimes(17);

    const base = new Date(2026, 8, 17);
    const offsets = mockedNotifications.scheduleNotificationAsync.mock.calls.map(([request]) => {
      const date = (request.trigger as { date: Date }).date;
      const target = new Date(date.getFullYear(), date.getMonth(), date.getDate());
      return Math.round((target.getTime() - base.getTime()) / (24 * 60 * 60 * 1000));
    });

    expect(offsets).toEqual([
      3, 6, 9, 7, 21,
      51, 81, 111, 141, 171, 201, 231, 261, 291, 321, 351, 381,
    ]);
    expect(mockedStorage.setItem).toHaveBeenCalledWith(
      "push_last_scheduled_v1",
      String(Date.now()),
    );

    platformReplacement.restore();
  });

  it("keeps an existing schedule intact during the 12-hour throttle window", async () => {
    const platformReplacement = jest.replaceProperty(Platform, "OS", "android");
    mockedStorage.getItem.mockResolvedValue(String(Date.now() - 60 * 60 * 1000));

    await scheduleRetentionNotifications();

    expect(mockedNotifications.cancelAllScheduledNotificationsAsync).not.toHaveBeenCalled();
    expect(mockedNotifications.scheduleNotificationAsync).not.toHaveBeenCalled();

    platformReplacement.restore();
  });
});