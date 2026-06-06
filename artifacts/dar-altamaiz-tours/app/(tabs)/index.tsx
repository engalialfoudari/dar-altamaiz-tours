import React, { useEffect, useRef, useState } from "react";
import {
  Animated,
  BackHandler,
  Image,
  ImageBackground,
  Platform,
  Pressable,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const WEBSITE_URL = "https://dt-tours.com";
const NAVY = "#0A1628";

function WelcomeScreen({ onExplore }: { onExplore: () => void }) {
  const insets = useSafeAreaInsets();
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(40)).current;
  const btnScale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 900,
        useNativeDriver: false,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 800,
        useNativeDriver: false,
      }),
    ]).start();
  }, []);

  const handlePressIn = () => {
    Animated.spring(btnScale, {
      toValue: 0.96,
      useNativeDriver: false,
    }).start();
  };

  const handlePressOut = () => {
    Animated.spring(btnScale, {
      toValue: 1,
      useNativeDriver: false,
    }).start();
  };

  return (
    <View style={styles.welcomeContainer}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />

      <ImageBackground
        source={require("../../assets/images/welcome-bg.png")}
        style={styles.backgroundImage}
        resizeMode="cover"
      >
        <View style={styles.overlay} />

        <Animated.View
          style={[
            styles.logoArea,
            { paddingTop: insets.top + 48, opacity: fadeAnim },
          ]}
        >
          <Image
            source={require("../../assets/images/dt-tours-logo-transparent.png")}
            style={styles.welcomeLogo}
            resizeMode="contain"
            tintColor="#FFFFFF"
          />
        </Animated.View>

        <Animated.View
          style={[
            styles.bottomArea,
            {
              paddingBottom: insets.bottom + 40,
              opacity: fadeAnim,
              transform: [{ translateY: slideAnim }],
            },
          ]}
        >
          <Text style={styles.tagline}>
            An easy way to book your{"\n"}holiday packages
          </Text>

          <Animated.View style={{ transform: [{ scale: btnScale }] }}>
            <Pressable
              style={styles.exploreBtn}
              onPress={onExplore}
              onPressIn={handlePressIn}
              onPressOut={handlePressOut}
            >
              <Text style={styles.exploreBtnText}>Explore</Text>
            </Pressable>
          </Animated.View>
        </Animated.View>
      </ImageBackground>
    </View>
  );
}

function NativeWebViewScreen() {
  const WebView = require("react-native-webview").WebView;
  const webviewRef = useRef<any>(null);
  const canGoBack = useRef(false);
  const insets = useSafeAreaInsets();

  useEffect(() => {
    const onBackPress = () => {
      if (canGoBack.current && webviewRef.current) {
        webviewRef.current.goBack();
        return true;
      }
      return false;
    };
    const subscription = BackHandler.addEventListener(
      "hardwareBackPress",
      onBackPress
    );
    return () => subscription.remove();
  }, []);

  return (
    <View style={styles.webContainer}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" translucent={false} />
      <WebView
        ref={webviewRef}
        source={{ uri: WEBSITE_URL }}
        style={StyleSheet.absoluteFill}
        javaScriptEnabled
        domStorageEnabled
        startInLoadingState={false}
        scalesPageToFit
        allowsInlineMediaPlayback
        mediaPlaybackRequiresUserAction={false}
        onNavigationStateChange={(navState: any) => {
          canGoBack.current = navState.canGoBack;
        }}
        contentInsetAdjustmentBehavior="never"
        bounces={false}
        overScrollMode="never"
        showsHorizontalScrollIndicator={false}
        showsVerticalScrollIndicator={false}
      />
    </View>
  );
}

function WebIframeScreen() {
  return (
    <View style={styles.webContainer}>
      <iframe
        src={WEBSITE_URL}
        style={{ flex: 1, width: "100%", height: "100%", border: "none" }}
        title="Dar AlTamaiz Tours"
      />
    </View>
  );
}

export default function HomeScreen() {
  const [showWelcome, setShowWelcome] = useState(true);
  const [showWeb, setShowWeb] = useState(false);
  const welcomeOpacity = useRef(new Animated.Value(1)).current;

  const handleExplore = () => {
    setShowWeb(true);
    Animated.timing(welcomeOpacity, {
      toValue: 0,
      duration: 500,
      useNativeDriver: false,
    }).start(() => setShowWelcome(false));
  };

  return (
    <View style={styles.root}>
      {showWeb && (
        Platform.OS === "web"
          ? <WebIframeScreen />
          : <NativeWebViewScreen />
      )}

      {showWelcome && (
        <Animated.View
          style={[StyleSheet.absoluteFill, { opacity: welcomeOpacity }]}
        >
          <WelcomeScreen onExplore={handleExplore} />
        </Animated.View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: NAVY,
  },
  welcomeContainer: {
    flex: 1,
    backgroundColor: NAVY,
  },
  backgroundImage: {
    flex: 1,
    width: "100%",
    height: "100%",
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.25)",
  },
  logoArea: {
    alignItems: "center",
    flex: 1,
  },
  welcomeLogo: {
    width: 260,
    height: 90,
  },
  bottomArea: {
    paddingHorizontal: 32,
    alignItems: "center",
    gap: 28,
  },
  tagline: {
    color: "#FFFFFF",
    fontSize: 22,
    fontFamily: "Inter_600SemiBold",
    textAlign: "center",
    lineHeight: 32,
    textShadowColor: "rgba(0,0,0,0.6)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  exploreBtn: {
    backgroundColor: "#FFFFFF",
    paddingVertical: 18,
    paddingHorizontal: 120,
    borderRadius: 50,
    alignItems: "center",
    justifyContent: "center",
  },
  exploreBtnText: {
    color: "#0D2C6E",
    fontSize: 18,
    fontFamily: "Inter_700Bold",
    letterSpacing: 0.5,
  },
  webContainer: {
    flex: 1,
    backgroundColor: "#FFFFFF",
  },
});
