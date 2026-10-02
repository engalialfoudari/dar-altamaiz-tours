import React from "react";
import { act, fireEvent, render, waitFor } from "@testing-library/react-native";
import { AccountEsimPurchases } from "./AccountEsimPurchases";

jest.mock("./EsimIcon", () => ({ EsimIcon: () => null }));
jest.mock("./HotelPortalIcon", () => ({ HotelPortalIcon: () => null }));

const order = {
  orderId: "ESIM-test", status: "completed", amountKwd: 3.25,
  product: { destination: "United Kingdom", title: "1 GB · 7 days" },
  createdAt: "2026-10-02T12:00:00.000Z",
};
const response = (orders: unknown[]) => ({ ok: true, json: async () => ({ orders }) }) as Response;
const props = { apiBase: "https://example.test/api", accountKey: "session-one", language: "en" as const };

describe("Account purchased eSIMs", () => {
  it("shows actual orders, price and status and opens the selected order", async () => {
    const request = jest.fn().mockResolvedValue(response([order]));
    const onOpenOrders = jest.fn();
    const view = render(<AccountEsimPurchases {...props} request={request} onOpenOrders={onOpenOrders} />);
    expect(view.getByText("Loading your eSIMs…")).toBeTruthy();
    await waitFor(() => expect(view.getByText("United Kingdom")).toBeTruthy());
    expect(view.getByText("1 GB · 7 days")).toBeTruthy();
    expect(view.getByText("KWD 3.250")).toBeTruthy();
    expect(view.getByText("Ready to install")).toBeTruthy();
    expect(request).toHaveBeenCalledWith("https://example.test/api/esim/orders", expect.objectContaining({ signal: expect.anything() }));
    fireEvent.press(view.getByTestId("account-esim-details-ESIM-test"));
    expect(onOpenOrders).toHaveBeenCalledWith("ESIM-test");
    fireEvent.press(view.getByTestId("account-esim-entry"));
    expect(onOpenOrders).toHaveBeenLastCalledWith();
  });

  it("shows honest empty and pending states in Arabic", async () => {
    const request = jest.fn().mockResolvedValueOnce(response([])).mockResolvedValueOnce(response([
      { ...order, status: "pending_review" },
    ]));
    const view = render(<AccountEsimPurchases {...props} language="ar" request={request} />);
    await waitFor(() => expect(view.getByText("لا توجد طلبات شرائح بعد")).toBeTruthy());
    fireEvent.press(view.getByTestId("account-esim-refresh"));
    await waitFor(() => expect(view.getByText("قيد المراجعة")).toBeTruthy());
    expect(view.queryByText("جاهزة للتثبيت")).toBeNull();
  });

  it("reports failure instead of pretending there are no purchases, and retries", async () => {
    const request = jest.fn().mockRejectedValueOnce(new Error("offline")).mockResolvedValueOnce(response([order]));
    const view = render(<AccountEsimPurchases {...props} request={request} />);
    await waitFor(() => expect(view.getByText("We couldn’t load your eSIMs.")).toBeTruthy());
    expect(view.queryByText("No eSIM orders yet")).toBeNull();
    fireEvent.press(view.getByText("Try again"));
    await waitFor(() => expect(view.getByText("United Kingdom")).toBeTruthy());
  });

  it("clears purchases and ignores a late response when accounts change", async () => {
    let resolve!: (value: Response) => void;
    const request = jest.fn()
      .mockResolvedValueOnce(response([order]))
      .mockImplementationOnce(() => new Promise<Response>((done) => { resolve = done; }))
      .mockResolvedValueOnce(response([]));
    const view = render(<AccountEsimPurchases {...props} request={request} />);
    await waitFor(() => expect(view.getByText("United Kingdom")).toBeTruthy());
    fireEvent.press(view.getByTestId("account-esim-refresh"));
    await waitFor(() => expect(request).toHaveBeenCalledTimes(2));
    view.rerender(<AccountEsimPurchases {...props} accountKey="session-two" request={request} />);
    await waitFor(() => expect(view.getByText("No eSIM orders yet")).toBeTruthy());
    await act(async () => { resolve(response([order])); });
    expect(view.queryByText("United Kingdom")).toBeNull();
    expect(request.mock.calls[1][1].signal.aborted).toBe(true);
  });
});