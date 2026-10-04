import React, { useEffect, useRef, useState } from "react";
import { AppState, Modal, Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { WebView as WebViewType } from "react-native-webview";

export const ESIM_GUIDE_COPY = {
  en: { watch: "Watch guide", narration: "Arabic narration", close: "Close", mute: "Mute", unmute: "Sound on", error: "The guide could not load. Check your internet connection and try again.", retry: "Try again" },
  ar: { watch: "شاهد الدليل", narration: "الشرح الصوتي باللغة العربية", close: "إغلاق", mute: "كتم الصوت", unmute: "تشغيل الصوت", error: "تعذّر تحميل الدليل. تحقق من اتصال الإنترنت وحاول مجدداً.", retry: "حاول مجدداً" },
  tr: { watch: "Rehberi izle", narration: "Arapça sesli anlatım", close: "Kapat", mute: "Sesi kapat", unmute: "Sesi aç", error: "Rehber yüklenemedi. İnternet bağlantınızı kontrol edip tekrar deneyin.", retry: "Tekrar dene" },
};

const GUIDE_URL = `${(process.env.EXPO_PUBLIC_API_BASE ?? "https://dt-tour.com/api").replace(/\/$/, "")}/esim/guide/ar.mp4`;
const escapeHtml = (value: string) => value.replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]!);

export function esimGuideHtml(url: string): string {
  return `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1"><style>html,body{margin:0;width:100%;height:100%;background:#000}video{width:100%;height:100%;object-fit:contain}video:fullscreen{object-fit:contain}</style></head><body><video controls playsinline webkit-playsinline preload="metadata" src="${escapeHtml(url)}"></video><script>
var video=document.querySelector('video');
video.addEventListener('error',function(){window.ReactNativeWebView.postMessage('esim-guide-error')});
video.addEventListener('volumechange',function(){window.ReactNativeWebView.postMessage(video.muted?'esim-guide-muted':'esim-guide-unmuted')});
document.addEventListener('visibilitychange',function(){if(document.hidden)video.pause()});
</script></body></html>`;
}

/** Uses the WebView already shipped in the store binary, not a new native video module. */
export function EsimGuideModal({ language, onClose }: { language: keyof typeof ESIM_GUIDE_COPY; onClose: () => void }) {
  const copy = ESIM_GUIDE_COPY[language];
  const insets = useSafeAreaInsets();
  const webVideo = useRef<HTMLVideoElement | null>(null);
  const nativeVideo = useRef<WebViewType | null>(null);
  const [failed, setFailed] = useState(false);
  const [muted, setMuted] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const pause = () => {
    webVideo.current?.pause();
    nativeVideo.current?.injectJavaScript("document.querySelector('video')?.pause();true;");
  };
  useEffect(() => {
    const listener = AppState.addEventListener("change", (state) => { if (state !== "active") pause(); });
    const onVisibility = () => { if (document.hidden) pause(); };
    if (Platform.OS === "web") document.addEventListener("visibilitychange", onVisibility);
    return () => {
      listener.remove();
      if (Platform.OS === "web") document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);
  const close = () => { pause(); onClose(); };
  const toggleSound = () => {
    const next = !muted;
    setMuted(next);
    if (webVideo.current) webVideo.current.muted = next;
    nativeVideo.current?.injectJavaScript(`document.querySelector('video').muted=${next};true;`);
  };
  const NativeWebView = Platform.OS === "web" ? null : require("react-native-webview").WebView;
  return <Modal visible animationType="slide" presentationStyle="fullScreen" onRequestClose={close}>
    <View style={[styles.modal, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
      <View style={[styles.header, language === "ar" && styles.reverse]}>
        <View style={styles.heading}>
          <Text style={[styles.title, language === "ar" && styles.rtl]}>{copy.watch}</Text>
          <Text style={[styles.narration, language === "ar" && styles.rtl]}>{copy.narration}</Text>
        </View>
        <Pressable testID="esim-guide-close" accessibilityRole="button" onPress={close} style={styles.button}><Text style={styles.buttonText}>{copy.close}</Text></Pressable>
      </View>
      {failed ? <View style={styles.error}>
        <Text style={[styles.errorText, language === "ar" && styles.rtl]}>{copy.error}</Text>
        <Pressable testID="esim-guide-retry" accessibilityRole="button" style={styles.button} onPress={() => { setMuted(false); setFailed(false); setAttempt(attempt + 1); }}><Text style={styles.buttonText}>{copy.retry}</Text></Pressable>
      </View> : <View style={styles.player}>
        {Platform.OS === "web" ? React.createElement("video", {
          key: attempt, ref: webVideo, src: GUIDE_URL, controls: true, playsInline: true, preload: "metadata",
          "aria-label": `${copy.watch} — ${copy.narration}`, "data-testid": "esim-guide-video",
          muted, onError: () => setFailed(true),
          onVolumeChange: () => setMuted(webVideo.current?.muted ?? false),
          style: { width: "100%", height: "100%", objectFit: "contain", backgroundColor: "#000" },
        }) : NativeWebView && <NativeWebView key={attempt} ref={nativeVideo} testID="esim-guide-webview"
          source={{ html: esimGuideHtml(GUIDE_URL) }} originWhitelist={["*"]}
          style={styles.player} allowsInlineMediaPlayback allowsFullscreenVideo
          mediaPlaybackRequiresUserAction javaScriptEnabled scrollEnabled={false}
          onError={() => setFailed(true)} onHttpError={() => setFailed(true)}
          onMessage={(event: { nativeEvent: { data: string } }) => {
            const message = event.nativeEvent.data;
            if (message === "esim-guide-error") setFailed(true);
            if (message === "esim-guide-muted" || message === "esim-guide-unmuted") setMuted(message === "esim-guide-muted");
          }}
          onLoadEnd={() => nativeVideo.current?.injectJavaScript(`document.querySelector('video').muted=${muted};true;`)}
        />}
      </View>}
      {!failed && <Pressable testID="esim-guide-sound" accessibilityRole="button" accessibilityState={{ selected: !muted }} style={styles.sound} onPress={toggleSound}><Text style={styles.buttonText}>{muted ? copy.unmute : copy.mute}</Text></Pressable>}
    </View>
  </Modal>;
}

const styles = StyleSheet.create({
  modal: { flex: 1, backgroundColor: "#000" },
  header: { flexDirection: "row", alignItems: "center", gap: 12, padding: 16, backgroundColor: "#FFFFFF" },
  reverse: { flexDirection: "row-reverse" },
  heading: { flex: 1 },
  title: { color: "#202A36", fontSize: 18, fontWeight: "800" },
  narration: { color: "#697586", fontSize: 13, marginTop: 4 },
  button: { padding: 12, borderRadius: 12, backgroundColor: "#EAF1FC" },
  buttonText: { color: "#202A36", fontSize: 14, fontWeight: "600" },
  player: { flex: 1, backgroundColor: "#000" },
  error: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24, gap: 16 },
  errorText: { color: "#FFFFFF", fontSize: 16, textAlign: "center" },
  sound: { padding: 14, alignItems: "center", backgroundColor: "#FFFFFF" },
  rtl: { writingDirection: "rtl", textAlign: "right" },
});