import React from "react";
import Svg, { Circle, Path, Rect } from "react-native-svg";
import { HotelPortalIcon, type HotelPortalIconName } from "./HotelPortalIcon";

export type EsimIconName = "globe" | "cellular" | "download" | "receipt" | "albums" | "radio-on" | "radio-off" | "close-circle" | HotelPortalIconName;
export function EsimIcon({ name, size = 20, color }: { name: EsimIconName; size?: number; color: string }) {
  if (name === "globe" || name === "cellular" || name === "download" || name === "receipt" || name === "albums" || name === "radio-on" || name === "radio-off" || name === "close-circle") {
    const stroke = { stroke: color, strokeWidth: 1.8, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, fill: "none" };
    return <Svg width={size} height={size} viewBox="0 0 24 24">
      {name === "globe" && <><Circle {...stroke} cx="12" cy="12" r="9" /><Path {...stroke} d="M3 12h18M12 3c-5 5-5 13 0 18m0-18c5 5 5 13 0 18" /></>}
      {name === "cellular" && <><Rect {...stroke} x="5" y="3" width="14" height="18" rx="3" /><Path {...stroke} d="M8 13v3m3-6v6m3-9v9m3-5v5" /></>}
      {name === "download" && <Path {...stroke} d="M12 3v12m-4-4 4 4 4-4M4 17v3h16v-3" />}
      {name === "receipt" && <Path {...stroke} d="M5 3h14v18l-3-2-4 2-4-2-3 2V3Zm3 5h8m-8 4h8" />}
      {name === "albums" && <><Rect {...stroke} x="5" y="6" width="15" height="15" rx="2" /><Path {...stroke} d="M3 17V5a2 2 0 0 1 2-2h12" /></>}
      {(name === "radio-on" || name === "radio-off") && <><Circle {...stroke} cx="12" cy="12" r="9" />{name === "radio-on" && <Circle cx="12" cy="12" r="5" fill={color} />}</>}
      {name === "close-circle" && <><Circle {...stroke} cx="12" cy="12" r="9" /><Path {...stroke} d="m9 9 6 6m0-6-6 6" /></>}
    </Svg>;
  }
  return <HotelPortalIcon name={name} size={size} color={color} />;
}