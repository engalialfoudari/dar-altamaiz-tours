jest.mock("@react-native-async-storage/async-storage", () => ({
  getItem: jest.fn(() => Promise.resolve("test-device-id")),
  setItem: jest.fn(() => Promise.resolve()),
}));

jest.mock("expo-application", () => ({
  getAndroidId: jest.fn(() => "test-device-id"),
  getIosIdForVendorAsync: jest.fn(() => Promise.resolve("test-device-id")),
}));

jest.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
}));