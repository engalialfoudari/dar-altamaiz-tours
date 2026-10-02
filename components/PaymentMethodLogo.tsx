import React from "react";
import { Image } from "react-native";
import Svg, { Circle, G, Path, Text as SvgText } from "react-native-svg";

export type StorePaymentMethod = "knet" | "cc" | "apple-pay" | "samsung-pay";

export function PaymentMethodLogo({ method }: { method: StorePaymentMethod }) {
  if (method === "knet") {
    return <Image source={require("../assets/images/knet-transparent.png")} style={{ width: 42, height: 40 }} resizeMode="contain" accessibilityLabel="KNET" />;
  }
  if (method === "cc") {
    return <Svg width={62} height={26} viewBox="0 0 94 32">
      <SvgText x="24" y="22" textAnchor="middle" fontFamily="serif" fontWeight="900" fontSize="15" fill="#1A1F71" letterSpacing="1">VISA</SvgText>
      <Circle cx="69" cy="16" r="9.5" fill="#EB001B" />
      <Circle cx="79" cy="16" r="9.5" fill="#F79E1B" />
      <Path d="M74 7.5a9.5 9.5 0 0 1 0 17 9.5 9.5 0 0 1 0-17Z" fill="#FF5F00" />
    </Svg>;
  }
  if (method === "apple-pay") {
    return <Svg width={63} height={28} viewBox="0 0 96 42">
      <G transform="translate(17,11) scale(0.88)">
        <Path d="M14.6 2.1c.8-1 1.3-2.4 1.1-3.8-1.2.1-2.7.8-3.6 1.9-.8.9-1.4 2.3-1.2 3.6 1.4.1 2.8-.7 3.7-1.7z" fill="#111" />
        <Path d="M15.7 4c-2-.1-3.8 1.1-4.7 1.1-1 0-2.5-1-4.1-1C4.8 4.2 2.6 5.5 1.4 7.7c-2.3 4 .4 9.9 1.6 13.2 1 2.8 2.2 5.8 4.8 5.7 1.9-.1 2.7-1.2 5-1.2 2.4 0 3.1 1.2 5.1 1.1 2.1-.1 3.3-2.3 4.5-5.1.9-2 1.3-3 1.3-3.1-2.2-.8-3.8-3.1-3.8-5.8 0-2.5 1.3-4.6 3.3-5.7-1.2-1.7-3-2.8-5.5-2.8z" fill="#111" />
      </G>
      <SvgText x="66" y="28" textAnchor="middle" fontSize="17" fill="#111" fontWeight="300">Pay</SvgText>
    </Svg>;
  }
  return <Svg width={63} height={28} viewBox="0 0 96 42">
    <SvgText x="48" y="18" textAnchor="middle" fontSize="9" fontWeight="700" letterSpacing="2" fill="#1428A0">SAMSUNG</SvgText>
    <SvgText x="48" y="33" textAnchor="middle" fontSize="15" fontWeight="300" fill="#1428A0">Pay</SvgText>
  </Svg>;
}