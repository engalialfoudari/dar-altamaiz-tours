import { Redirect, useLocalSearchParams } from "expo-router";

export default function HotelPaymentReturnRoute() {
  const params = useLocalSearchParams<{
    orderId?: string | string[];
    status?: string | string[];
  }>();
  const rawOrderId = Array.isArray(params.orderId) ? params.orderId[0] : params.orderId;
  const rawStatus = Array.isArray(params.status) ? params.status[0] : params.status;
  const orderId = String(rawOrderId ?? "")
    .replace(/[^A-Za-z0-9_-]/g, "")
    .slice(0, 100);
  const status = rawStatus === "failed" ? "failed" : "success";

  return (
    <Redirect
      href={{
        pathname: "/",
        params: {
          hotelPaymentOrderId: orderId,
          hotelPaymentStatus: status,
        },
      }}
    />
  );
}