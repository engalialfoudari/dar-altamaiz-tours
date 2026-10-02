import { Redirect, useLocalSearchParams } from "expo-router";
import { esimPaymentReturnRedirectHref } from "@/lib/esimPaymentReturn";

export default function EsimPaymentReturnRoute() {
  const params = useLocalSearchParams<{ orderId?: string | string[] }>();

  return (
    <Redirect href={esimPaymentReturnRedirectHref(params.orderId)} />
  );
}