export type ViewportSize = {
  width: number;
  height: number;
};

export type StableViewportResult = {
  stable: ViewportSize;
  layoutHeight: number;
  keyboardViewportReduced: boolean;
};

const KEYBOARD_HEIGHT_THRESHOLD = 160;
const ORIENTATION_WIDTH_THRESHOLD = 80;

export function resolveStableViewport(
  previous: ViewportSize,
  current: ViewportSize,
  isWeb: boolean,
  hasTextInputFocus: boolean,
): StableViewportResult {
  if (!isWeb || Math.abs(previous.width - current.width) >= ORIENTATION_WIDTH_THRESHOLD) {
    return {
      stable: current,
      layoutHeight: current.height,
      keyboardViewportReduced: false,
    };
  }

  const stable = {
    width: current.width,
    height: Math.max(previous.height, current.height),
  };
  const keyboardViewportReduced =
    hasTextInputFocus &&
    stable.height - current.height >= KEYBOARD_HEIGHT_THRESHOLD;

  return {
    stable,
    layoutHeight: keyboardViewportReduced ? stable.height : current.height,
    keyboardViewportReduced,
  };
}