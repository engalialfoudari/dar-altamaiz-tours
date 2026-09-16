import React from "react";
import { fireEvent, render } from "@testing-library/react-native";

import { AppHeader } from "./AppHeader";

jest.mock("./MarqueeTicker", () => ({
  MarqueeTicker: () => null,
}));

describe("AppHeader", () => {
  it("routes the visible back and information controls to their callbacks", () => {
    const onBack = jest.fn();
    const onInfo = jest.fn();
    const { getByTestId } = render(
      <AppHeader onBack={onBack} canGoBack onInfo={onInfo} />,
    );

    fireEvent.press(getByTestId("app-header-back"));
    fireEvent.press(getByTestId("app-header-info"));

    expect(onBack).toHaveBeenCalledTimes(1);
    expect(onInfo).toHaveBeenCalledTimes(1);
  });

  it("does not render an inert right-hand header button", () => {
    const { queryByTestId } = render(<AppHeader />);

    expect(queryByTestId("app-header-info")).toBeNull();
  });

  it("still invokes the supplied back callback when history state is unavailable", () => {
    const onBack = jest.fn();
    const { getByTestId } = render(<AppHeader onBack={onBack} canGoBack={false} />);

    fireEvent.press(getByTestId("app-header-back"));

    expect(onBack).toHaveBeenCalledTimes(1);
  });

  it("dismisses and restores the announcement header", () => {
    const { getByTestId, queryByTestId } = render(<AppHeader />);

    fireEvent.press(getByTestId("app-header-dismiss"));
    expect(queryByTestId("app-header-dismiss")).toBeNull();

    fireEvent.press(getByTestId("app-header-expand"));
    expect(getByTestId("app-header-dismiss")).toBeTruthy();
  });
});