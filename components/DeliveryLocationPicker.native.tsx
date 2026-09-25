import React, { useRef, useState } from "react";
import { Alert, Modal, Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { WebView, WebViewMessageEvent } from "react-native-webview";
import * as Location from "expo-location";
import { HotelPortalIcon } from "@/components/HotelPortalIcon";

export type DeliveryLocation = { latitude: number; longitude: number };
const KUWAIT_CENTER: DeliveryLocation = { latitude: 29.3117, longitude: 47.4818 };

function createMapHtml(initial: DeliveryLocation) {
  return `<!doctype html>
<html>
  <head>
    <meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no">
    <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css">
    <style>
      html,body,#map{height:100%;width:100%;margin:0;background:#eef2f6}
      .leaflet-control-attribution{font-size:9px}
    </style>
  </head>
  <body>
    <div id="map"></div>
    <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
    <script>
      const initial = [${initial.latitude}, ${initial.longitude}];
      const map = L.map("map", { zoomControl: true }).setView(initial, 16);
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
        attribution: "&copy; OpenStreetMap contributors"
      }).addTo(map);
      const marker = L.marker(initial, { draggable: true }).addTo(map);
      function send(latlng) {
        window.ReactNativeWebView.postMessage(JSON.stringify({
          latitude: latlng.lat,
          longitude: latlng.lng
        }));
      }
      function setPin(latitude, longitude, recenter) {
        const point = L.latLng(latitude, longitude);
        marker.setLatLng(point);
        if (recenter) map.setView(point, 17);
      }
      map.on("click", event => {
        setPin(event.latlng.lat, event.latlng.lng, false);
        send(event.latlng);
      });
      marker.on("dragend", event => send(event.target.getLatLng()));
      window.setPin = setPin;
    </script>
  </body>
</html>`;
}

export function DeliveryLocationPicker({ value, lang, onChange }: { value: DeliveryLocation | null; lang: "en" | "ar"; onChange: (location: DeliveryLocation) => void }) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<DeliveryLocation>(value ?? KUWAIT_CENTER);
  const [mapHtml, setMapHtml] = useState(() => createMapHtml(value ?? KUWAIT_CENTER));
  const mapRef = useRef<WebView>(null);
  const insets = useSafeAreaInsets();
  const rtl = lang === "ar";

  const useMyLocation = async () => {
    try {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (!permission.granted) {
        Alert.alert(rtl ? "الموقع غير متاح" : "Location unavailable", rtl ? "اسمح للتطبيق باستخدام موقعك، أو ضع الدبوس يدوياً." : "Allow location access, or place the pin manually.");
        return;
      }
      const current = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      const next = { latitude: current.coords.latitude, longitude: current.coords.longitude };
      setDraft(next);
      mapRef.current?.injectJavaScript(`window.setPin(${next.latitude}, ${next.longitude}, true); true;`);
    } catch {
      Alert.alert(rtl ? "تعذر تحديد الموقع" : "Could not get location", rtl ? "ضع الدبوس يدوياً على الخريطة." : "Please place the pin manually on the map.");
    }
  };

  const openMap = () => {
    const initial = value ?? draft;
    setDraft(initial);
    setMapHtml(createMapHtml(initial));
    setOpen(true);
  };

  const handleMapMessage = (event: WebViewMessageEvent) => {
    try {
      const coordinate = JSON.parse(event.nativeEvent.data) as DeliveryLocation;
      if (Number.isFinite(coordinate.latitude) && Number.isFinite(coordinate.longitude)) {
        setDraft(coordinate);
      }
    } catch {
      // Ignore malformed messages from map content.
    }
  };

  return (
    <>
      <Pressable style={[styles.selector, value && styles.selectorComplete, rtl && styles.rowRtl]} onPress={openMap}>
        <HotelPortalIcon name="location" size={20} color="#003580" />
        <View style={styles.selectorCopy}>
          <Text style={[styles.selectorTitle, rtl && styles.rtl]}>{rtl ? "حدد موقع التوصيل على الخريطة" : "Pin delivery location on map"}</Text>
          <Text style={[styles.selectorSub, rtl && styles.rtl]}>
            {value ? (rtl ? "تم حفظ الموقع الدقيق" : "Accurate location saved") : (rtl ? "مطلوب لمساعدة السائق في الوصول إليك" : "Required so the driver can find you")}
          </Text>
        </View>
        <HotelPortalIcon name={value ? "check" : "chevron-forward"} size={20} color={value ? "#16803C" : "#64748B"} />
      </Pressable>
      <Modal visible={open} animationType="slide" onRequestClose={() => setOpen(false)}>
        <View style={[styles.modal, { paddingTop: Math.max(insets.top, 20) }]}>
          <View style={[styles.header, rtl && styles.rowRtl]}>
            <Pressable style={styles.iconButton} onPress={() => setOpen(false)}><HotelPortalIcon name="close" size={23} color="#003580" /></Pressable>
            <Text style={[styles.headerTitle, rtl && styles.rtl]}>{rtl ? "حدد موقعك الدقيق" : "Set your exact location"}</Text>
            <View style={styles.iconButton} />
          </View>
          <Text style={[styles.help, rtl && styles.rtl]}>{rtl ? "اضغط على الخريطة أو اسحب الدبوس إلى مدخل المبنى." : "Tap the map or drag the pin to your building entrance."}</Text>
          <WebView
            ref={mapRef}
            style={styles.map}
            source={{ html: mapHtml, baseUrl: "https://unpkg.com" }}
            originWhitelist={["https://*", "http://*"]}
            javaScriptEnabled
            domStorageEnabled
            onMessage={handleMapMessage}
          />
          <View
            style={[
              styles.actions,
              { paddingBottom: Platform.OS === "android" ? Math.max(insets.bottom, 48) : Math.max(insets.bottom, 14) },
              rtl && styles.rowRtl,
            ]}
          >
            <Pressable style={styles.locationButton} onPress={useMyLocation}>
              <HotelPortalIcon name="location" size={18} color="#003580" />
              <Text style={styles.locationText}>{rtl ? "موقعي الحالي" : "Use my location"}</Text>
            </Pressable>
            <Pressable style={styles.confirmButton} onPress={() => { onChange(draft); setOpen(false); }}>
              <Text style={styles.confirmText}>{rtl ? "تأكيد الموقع" : "Confirm pin"}</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  selector: { minHeight: 64, borderWidth: 1, borderColor: "#D8E0EC", borderRadius: 10, padding: 10, marginBottom: 12, flexDirection: "row", alignItems: "center", gap: 9, backgroundColor: "#FFF" },
  selectorComplete: { borderColor: "#78B88A", backgroundColor: "#F4FBF6" },
  selectorCopy: { flex: 1 },
  selectorTitle: { color: "#003580", fontSize: 13, fontWeight: "800" },
  selectorSub: { color: "#64748B", fontSize: 11, marginTop: 2 },
  modal: { flex: 1, backgroundColor: "#FFF" },
  header: { height: 54, paddingHorizontal: 8, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  iconButton: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
  headerTitle: { color: "#003580", fontSize: 18, fontWeight: "800" },
  help: { color: "#475569", fontSize: 13, paddingHorizontal: 16, paddingBottom: 10 },
  map: { flex: 1 },
  actions: { flexDirection: "row", gap: 10, padding: 14 },
  locationButton: { flex: 1, minHeight: 48, borderWidth: 1, borderColor: "#CBD5E1", borderRadius: 10, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6 },
  locationText: { color: "#003580", fontSize: 13, fontWeight: "700" },
  confirmButton: { flex: 1, minHeight: 48, backgroundColor: "#003580", borderRadius: 10, alignItems: "center", justifyContent: "center" },
  confirmText: { color: "#FFF", fontSize: 14, fontWeight: "800" },
  rowRtl: { flexDirection: "row-reverse" },
  rtl: { textAlign: "right", writingDirection: "rtl" },
});