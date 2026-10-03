import React, { forwardRef } from "react";
import * as Native from "react-native";
import { localizeUi, lookupTurkish, getAppLocale, translateUiImmediately } from "./engine";
import { useAppLanguage } from "./provider";

function childrenCopy(children: React.ReactNode): React.ReactNode {
  if (typeof children === "string") return localizeUi(children);
  if (Array.isArray(children)) {
    if (children.every(child => child == null || typeof child === "string" || typeof child === "number")) {
      const combined = children.filter(child => child != null).join("");
      const translated = getAppLocale() === "tr" ? lookupTurkish(combined) : undefined;
      if (translated !== undefined) return translated;
    }
    return children.map(child => childrenCopy(child));
  }
  return children;
}
function propsCopy(props: Record<string, any>) {
  const result = { ...props };
  for (const key of ["placeholder", "accessibilityLabel", "accessibilityHint", "title"]) {
    if (typeof result[key] === "string") result[key] = localizeUi(result[key]);
  }
  return result;
}
type LocalizedTextProps = Native.TextProps & { dtDisplayData?: boolean };
export const Text = forwardRef<Native.Text, LocalizedTextProps>(({ dtDisplayData, ...props }, ref) => {
  useAppLanguage();
  return <Native.Text {...propsCopy(props)} ref={ref}>{dtDisplayData ? props.children : childrenCopy(props.children)}</Native.Text>;
});
Text.displayName = "LocalizedText";
export const TextInput = forwardRef<Native.TextInput, Native.TextInputProps>((props, ref) => {
  useAppLanguage();
  // Never translate the user's editable value, password or account information.
  return <Native.TextInput {...propsCopy(props)} ref={ref} />;
});
TextInput.displayName = "LocalizedTextInput";
Object.assign(TextInput, { State: Native.TextInput.State });
export const Pressable = forwardRef<React.ElementRef<typeof Native.Pressable>, Native.PressableProps>((props, ref) => {
  useAppLanguage();
  return <Native.Pressable {...propsCopy(props)} ref={ref} />;
});
Pressable.displayName = "LocalizedPressable";
export const TouchableOpacity = forwardRef<React.ElementRef<typeof Native.TouchableOpacity>, Native.TouchableOpacityProps>((props, ref) => {
  useAppLanguage();
  return <Native.TouchableOpacity {...propsCopy(props)} ref={ref} />;
});
TouchableOpacity.displayName = "LocalizedTouchableOpacity";
export const Image = forwardRef<React.ElementRef<typeof Native.Image>, Native.ImageProps>((props, ref) => {
  useAppLanguage();
  return <Native.Image {...propsCopy(props)} ref={ref} />;
});
Image.displayName = "LocalizedImage";
for (const key of ["getSize", "getSizeWithHeaders", "prefetch", "prefetchWithMetadata", "abortPrefetch", "queryCache", "resolveAssetSource"]) {
  const descriptor = Object.getOwnPropertyDescriptor(Native.Image, key);
  if (descriptor) Object.defineProperty(Image, key, descriptor);
}
export const AnimatedText = Native.Animated.createAnimatedComponent(Text);
export const Alert = {
  ...Native.Alert,
  alert: (title: string, message?: string, buttons?: Native.AlertButton[], options?: Native.AlertOptions): void => {
    if (getAppLocale() !== "tr") { Native.Alert.alert(title, message, buttons, options); return; }
    const strings = [title, message ?? "", ...(buttons ?? []).map(button => button.text ?? "")];
    const show = (translated: string[]) => Native.Alert.alert(
      translated[0]!, message === undefined ? undefined : translated[1],
      buttons?.map((button, index) => ({ ...button, text: translated[index + 2] })) ?? [{ text: "Tamam" }], options,
    );
    if (strings.every(text => !text || lookupTurkish(text) !== undefined)) {
      show(strings.map(text => text ? lookupTurkish(text)! : text));
    } else {
      void translateUiImmediately(strings.filter(Boolean)).then(() => {
        if (getAppLocale() === "tr") show(strings.map(text => text ? lookupTurkish(text)! : text));
      }).catch(() => {
        Native.Alert.alert("Çeviri kullanılamıyor", "Bu mesaj şu anda Türkçeye çevrilemiyor. Lütfen yeniden deneyin.", [{ text: "Tamam" }]);
      });
    }
  },
};