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
const NAVY_DEEP = "#061020";

function SpinningEarth() {
  const spin = useRef(new Animated.Value(0)).current;
  const bounce = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.loop(
      Animated.timing(spin, {
        toValue: 1,
        duration: 3000,
        useNativeDriver: false,
      })
    ).start();

    Animated.loop(
      Animated.sequence([
        Animated.timing(bounce, {
          toValue: -6,
          duration: 900,
          useNativeDriver: false,
        }),
        Animated.timing(bounce, {
          toValue: 0,
          duration: 900,
          useNativeDriver: false,
        }),
      ])
    ).start();
  }, []);

  const rotate = spin.interpolate({
    inputRange: [0, 1],
    outputRange: ["0deg", "360deg"],
  });

  return (
    <Animated.View
      style={[
        styles.earthWrapper,
        { transform: [{ rotate }, { translateY: bounce }] },
      ]}
    >
      <View style={styles.earth}>
        <View style={[styles.continent, { top: 14, left: 12, width: 22, height: 14 }]} />
        <View style={[styles.continent, { top: 26, left: 28, width: 16, height: 18 }]} />
        <View style={[styles.continent, { top: 10, right: 10, width: 18, height: 22 }]} />
        <View style={[styles.continent, { bottom: 14, left: 16, width: 20, height: 12 }]} />
        <View style={[styles.continent, { bottom: 10, right: 14, width: 12, height: 10 }]} />
      </View>
      <View style={styles.earthShine} />
    </Animated.View>
  );
}

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
    Animated.spring(btnScale, { toValue: 0.96, useNativeDriver: false }).start();
  };

  const handlePressOut = () => {
    Animated.spring(btnScale, { toValue: 1, useNativeDriver: false }).start();
  };

  return (
    <View style={styles.welcomeContainer}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />

      <ImageBackground
        source={require("../../assets/images/welcome-bg.png")}
        style={styles.backgroundImage}
        resizeMode="cover"
      >
        <View style={styles.topGradient} />
        <View style={styles.bottomGradient} />

        <Animated.View
          style={[
            styles.logoArea,
            { paddingTop: insets.top + 36, opacity: fadeAnim },
          ]}
        >
          <Image
            source={require("../../assets/images/dt-tours-logo-transparent.png")}
            style={styles.welcomeLogo}
            resizeMode="contain"
            tintColor="#FFFFFF"
          />
        </Animated.View>

        <View style={styles.earthArea}>
          <SpinningEarth />
        </View>

        <Animated.View
          style={[
            styles.bottomArea,
            {
              paddingBottom: insets.bottom + 44,
              opacity: fadeAnim,
              transform: [{ translateY: slideAnim }],
            },
          ]}
        >
          <Text style={styles.tagline}>
            Book more &amp; get cashback on{"\n"}every successful booking!
          </Text>
          <Text style={styles.subTagline}>
            Your trusted travel partner since 2015
          </Text>

          <Animated.View style={{ transform: [{ scale: btnScale }], width: "100%" }}>
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

  useEffect(() => {
    const onBackPress = () => {
      if (canGoBack.current && webviewRef.current) {
        webviewRef.current.goBack();
        return true;
      }
      return false;
    };
    const subscription = BackHandler.addEventListener("hardwareBackPress", onBackPress);
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
      {showWeb &&
        (Platform.OS === "web" ? <WebIframeScreen /> : <NativeWebViewScreen />)}

      {showWelcome && (
        <Animated.View style={[StyleSheet.absoluteFill, { opacity: welcomeOpacity }]}>
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
  topGradient: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 220,
    backgroundColor: "rgba(0,0,0,0.45)",
  },
  bottomGradient: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    height: 320,
    backgroundColor: "rgba(0,10,30,0.72)",
  },
  logoArea: {
    alignItems: "center",
    paddingHorizontal: 24,
    zIndex: 10,
  },
  welcomeLogo: {
    width: 320,
    height: 115,
  },
  earthArea: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 5,
  },
  earthWrapper: {
    width: 80,
    height: 80,
    position: "relative",
  },
  earth: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "#1A6FBF",
    overflow: "hidden",
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.3)",
  },
  earthShine: {
    position: "absolute",
    top: 6,
    left: 10,
    width: 22,
    height: 18,
    borderRadius: 12,
    backgroundColor: "rgba(255,255,255,0.18)",
    transform: [{ rotate: "-30deg" }],
  },
  continent: {
    position: "absolute",
    backgroundColor: "#4CAF50",
    borderRadius: 6,
    opacity: 0.85,
  },
  bottomArea: {
    paddingHorizontal: 28,
    alignItems: "center",
    gap: 10,
    zIndex: 10,
  },
  tagline: {
    color: "#FFFFFF",
    fontSize: 22,
    fontFamily: "Inter_700Bold",
    textAlign: "center",
    lineHeight: 32,
    marginBottom: 4,
  },
  subTagline: {
    color: "rgba(255,255,255,0.65)",
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
    marginBottom: 18,
    letterSpacing: 0.5,
  },
  exploreBtn: {
    backgroundColor: "#FFFFFF",
    paddingVertical: 18,
    borderRadius: 50,
    alignItems: "center",
    justifyContent: "center",
    width: "100%",
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
