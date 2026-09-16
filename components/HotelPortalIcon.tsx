import React from "react";
import Svg, { Circle, Path, Rect } from "react-native-svg";

export type HotelPortalIconName =
  | "airplane"
  | "alps"
  | "arrow-back"
  | "arrow-forward"
  | "bed"
  | "beach"
  | "boat"
  | "briefcase"
  | "building"
  | "calendar"
  | "cart"
  | "chat"
  | "check"
  | "chevron-back"
  | "chevron-down"
  | "chevron-forward"
  | "chevron-up"
  | "clocktower"
  | "colosseum"
  | "close"
  | "cloud-off"
  | "compass"
  | "credit-card"
  | "eiffel"
  | "mosque"
  | "santorini"
  | "skyline"
  | "temple"
  | "location"
  | "lightbulb"
  | "minus"
  | "mail"
  | "map"
  | "mountain"
  | "moon"
  | "palm"
  | "phone"
  | "plus"
  | "refresh"
  | "search"
  | "sparkles"
  | "swap"
  | "tag"
  | "time"
  | "trash"
  | "torii"
  | "user"
  | "whatsapp";

export function HotelPortalIcon({
  name,
  size = 20,
  color,
}: {
  name: HotelPortalIconName;
  size?: number;
  color: string;
}) {
  const common = {
    stroke: color,
    strokeWidth: 1.9,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    fill: "none",
  };

  const content = {
    airplane: <Path {...common} d="m21 16-8.5-4.2L8.4 4.2a2 2 0 0 0-3.6.2l-.5 1.1 5.4 7.3-4.7 1.2-2.1-1.8-1 1 2.3 3.2 4.8-.7 8.4 3.9a2.1 2.1 0 0 0 2.8-1.1c.3-.8 0-1.8-.9-2.2Z" />,
    alps: <><Path {...common} d="m3 19 6.2-9.5L12 13l3.1-4.3L21 19H3Z" /><Path {...common} d="m7.5 12.1 1.7 1.6 1.3-2m4.2 1.1 1.2 1.3 1.1-1.5" /></>,
    "arrow-back": <Path {...common} d="M19 12H5m6-6-6 6 6 6" />,
    "arrow-forward": <Path {...common} d="M5 12h14m-6-6 6 6-6 6" />,
    bed: <><Path {...common} d="M3 18V7" /><Path {...common} d="M3 14h18v4M6 14v-4h4a3 3 0 0 1 3 3v1M21 18V10.5a2 2 0 0 0-2-2H3" /></>,
    beach: <><Circle {...common} cx="17.5" cy="6.5" r="2.5" /><Path {...common} d="M3 16c2.2-2 4.4-2 6.6 0s4.4 2 6.6 0 4.4-2 6.8 0M3 20c2.2-2 4.4-2 6.6 0s4.4 2 6.6 0 4.4-2 6.8 0M5 13.5c1.6-2.5 3.5-4 6.5-4" /></>,
    boat: <><Path {...common} d="M3 15h18l-2 4H5l-2-4Z" /><Path {...common} d="M12 4v11m0-11H7l3 4H6" /></>,
    briefcase: <><Rect {...common} x="3" y="7" width="18" height="13" rx="2" /><Path {...common} d="M8 7V5.5A1.5 1.5 0 0 1 9.5 4h5A1.5 1.5 0 0 1 16 5.5V7m-13 5h18M10 12v2h4v-2" /></>,
    building: <><Rect {...common} x="4" y="3" width="16" height="18" rx="1" /><Path {...common} d="M8 7h2m4 0h2M8 11h2m4 0h2M8 15h2m4 0h2M10 21v-3h4v3" /></>,
    calendar: <><Rect {...common} x="3" y="5" width="18" height="16" rx="2" /><Path {...common} d="M8 3v4m8-4v4M3 10h18" /></>,
    cart: <><Path {...common} d="M3 4h2l2.2 11.2a2 2 0 0 0 2 1.6h7.9a2 2 0 0 0 1.9-1.4L21 8H6" /><Circle {...common} cx="9" cy="20" r="1" /><Circle {...common} cx="17" cy="20" r="1" /></>,
    chat: <><Path {...common} d="M20 11.2c0 4.2-3.6 7.5-8 7.5-1.1 0-2.1-.2-3.1-.6L4 20l1.3-4.2A7.1 7.1 0 0 1 4 11.2c0-4.2 3.6-7.5 8-7.5s8 3.3 8 7.5Z" /><Path {...common} d="M8.5 11.3h.01m3.49 0H12m3.49 0h.01" /></>,
    check: <Path {...common} d="m5 12 4.2 4.2L19 6.5" />,
    "chevron-back": <Path {...common} d="m15 18-6-6 6-6" />,
    "chevron-down": <Path {...common} d="m6 9 6 6 6-6" />,
    "chevron-forward": <Path {...common} d="m9 18 6-6-6-6" />,
    "chevron-up": <Path {...common} d="m6 15 6-6 6 6" />,
    clocktower: <><Path {...common} d="m6 8 6-4 6 4M8 8h8v12H8zM6 20h12" /><Circle {...common} cx="12" cy="12.2" r="2.2" /><Path {...common} d="M12 10.8v1.5l1 .6" /></>,
    colosseum: <><Path {...common} d="M4 19h16M5 19V9m4 10V9m6 10V9m4 10V9M3.5 9h17L19 6H5L3.5 9Z" /><Path {...common} d="M5 6c1.4-2 2.9-3 4.5-3s3.1 1 4.5 3 3.1 1 4.5 0" /></>,
    close: <Path {...common} d="m6 6 12 12M18 6 6 18" />,
    "cloud-off": <><Path {...common} d="M6.6 18.3A4.8 4.8 0 0 1 8 9a5.5 5.5 0 0 1 10.4 2.1A3.6 3.6 0 0 1 18 18H8" /><Path {...common} d="m3 3 18 18" /></>,
    compass: <><Circle {...common} cx="12" cy="12" r="9" /><Path {...common} d="m15.5 8.5-2.1 5-5 2.1 2.1-5 5-2.1Z" /></>,
    "credit-card": <><Rect {...common} x="3" y="5" width="18" height="14" rx="2" /><Path {...common} d="M3 10h18M7 15h3" /></>,
    eiffel: <><Path {...common} d="M12 3 8 20m4-17 4 17M9.5 14h5M8.5 17.5h7M7 21h10M10.7 8h2.6" /><Path {...common} d="M9.8 6h4.4" /></>,
    mosque: <><Path {...common} d="M4 20h16M6 20v-7h12v7M5 13c.8-3 2.9-4.7 7-6 4.1 1.3 6.2 3 7 6M12 7V4m-1.3 0h2.6M8 13v7m8-7v7" /></>,
    location: <><Path {...common} d="M20 10.5c0 5.1-8 10.5-8 10.5S4 15.6 4 10.5a8 8 0 1 1 16 0Z" /><Circle {...common} cx="12" cy="10.5" r="2.4" /></>,
    lightbulb: <><Path {...common} d="M9 21h6m-6-3h6m0-2.5a6 6 0 1 0-6 0V18h6v-2.5Z" /></>,
    minus: <Path {...common} d="M5 12h14" />,
    mail: <><Rect {...common} x="3" y="5" width="18" height="14" rx="2" /><Path {...common} d="m4 7 8 6 8-6" /></>,
    map: <><Path {...common} d="m9 18-6 3V6l6-3 6 3 6-3v15l-6 3-6-3Z" /><Path {...common} d="M9 3v15m6-12v15" /></>,
    mountain: <><Path {...common} d="m3 19 6-10 3 5 2-3 7 8H3Z" /><Path {...common} d="m14 9 1-2 2 2" /></>,
    moon: <Path {...common} d="M20.5 15.4A8.5 8.5 0 0 1 8.6 3.5 8.5 8.5 0 1 0 20.5 15.4Z" />,
    palm: <><Path {...common} d="M12 20V9" /><Path {...common} d="M12 10C9 8 6 9 4 7c3-2 7-1 8 1M12 11c3-2 6-1 8-3-3-2-7-1-8 1M12 9c-1-3 0-5 2-7 2 3 1 6-2 7" /></>,
    phone: <Path {...common} d="M7.3 3.5 5.1 5.1c-1.2.9-.5 4.6 2.3 8.4 2.8 3.8 6 6 7.4 5.3l2.4-1.3-2.4-3.5-2.1 1.2a13 13 0 0 1-4.1-4.7l1.8-1.6-3.1-5.4Z" />,
    plus: <Path {...common} d="M12 5v14M5 12h14" />,
    refresh: <><Path {...common} d="M20 11a8 8 0 0 0-14.5-3.6L4 9" /><Path {...common} d="M4 4v5h5m-5 4a8 8 0 0 0 14.5 3.6L20 15" /><Path {...common} d="M20 20v-5h-5" /></>,
    search: <><Circle {...common} cx="10.8" cy="10.8" r="6.3" /><Path {...common} d="m16 16 4.5 4.5" /></>,
    santorini: <><Path {...common} d="M5 20V11h14v9M4 11h16M7 11V8h4v3m2 0V6h4v5M8 15h2m4 0h2m-6 5v-4h2v4" /><Path {...common} d="M7 8c.5-1.5 1.7-2.2 3-2.2S12.5 6.5 13 8" /></>,
    skyline: <><Path {...common} d="M4 20V9h5v11M9 20V5h6v15m0 0V8h5v12M3 20h18M6 12h1m5-4h1m-1 4h1m4 0h1m-5 4h1m4 0h1" /></>,
    sparkles: <><Path {...common} d="m12 3 .9 3.1L16 7l-3.1.9L12 11l-.9-3.1L8 7l3.1-.9L12 3Zm6.5 9 .6 2 2 .6-2 .6-.6 2-.6-2-2-.6 2-.6.6-2ZM5.5 14l.7 2.3 2.3.7-2.3.7-.7 2.3-.7-2.3-2.3-.7 2.3-.7.7-2.3Z" /></>,
    tag: <><Path {...common} d="M20.5 13.5 13.4 20.6a2 2 0 0 1-2.8 0L3.4 13.4V4h9.4l7.7 7.7a1.3 1.3 0 0 1 0 1.8Z" /><Circle {...common} cx="8.2" cy="8.2" r="1" /></>,
    temple: <><Path {...common} d="m4 9 8-5 8 5M5 9h14M7 9v8m5-8v8m5-8v8M4 20h16M6 17h12" /></>,
    time: <><Circle {...common} cx="12" cy="12" r="8.5" /><Path {...common} d="M12 7v5l3.3 2" /></>,
    trash: <><Path {...common} d="M4 7h16M10 11v5m4-5v5M9 7V4h6v3m-9 0 1 13h10l1-13" /></>,
    swap: <><Path {...common} d="M7 7h11l-3-3m3 3-3 3M17 17H6l3 3m-3-3 3-3" /></>,
    torii: <><Path {...common} d="M5 5h14M3 8h18M7 8v12m10-12v12M5 20h14M9 8v12m6-12v12" /><Path {...common} d="M8 5c.8-1.5 2-2.2 4-2.2S15.2 3.5 16 5" /></>,
    user: <><Circle {...common} cx="12" cy="8" r="3.5" /><Path {...common} d="M4.5 21a7.5 7.5 0 0 1 15 0" /></>,
    whatsapp: <><Path {...common} d="M20.2 11.4a8.2 8.2 0 0 1-12.1 7.2L4 20l1.4-4A8.2 8.2 0 1 1 20.2 11.4Z" /><Path {...common} d="M8.4 8.7c.2-.5.4-.7.8-.7h.6c.2 0 .4.1.5.4l.6 1.3c.1.2.1.4-.1.6l-.4.5c.8 1.3 1.6 2 2.9 2.7l.6-.6c.2-.2.4-.2.6-.1l1.3.6c.3.1.4.3.3.6-.2.8-.9 1.3-1.6 1.4-1.5.1-3.1-.8-4.3-2-1.2-1.2-2.2-2.8-2.1-4.7 0-.1 0-.1.1 0Z" /></>,
  }[name];

  return <Svg width={size} height={size} viewBox="0 0 24 24">{content}</Svg>;
}