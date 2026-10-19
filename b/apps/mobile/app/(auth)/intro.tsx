import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  Animated,
  AppState,
  type AppStateStatus,
  Easing,
  Image,
  NativeSyntheticEvent,
  useWindowDimensions,
  View,
} from "react-native";
import { Icon, Text as PaperText } from "react-native-paper";
import PagerView, {
  type PagerViewOnPageSelectedEventData,
} from "react-native-pager-view";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  INTRO_AUTO_ADVANCE_MS,
  INTRO_ILLUSTRATION_HEIGHT,
  type IntroSlideVisual,
  introUsesImage,
  nextIntroPage,
} from "@/lib/auth/introCarousel";
import { markIntroSeen } from "@/lib/auth/introSeen";
import { azure } from "@/lib/theme/colors";
import { fontFamilies } from "@/lib/theme/fonts";
import { useAppTheme } from "@/lib/theme/useAppTheme";
import { Button } from "@/lib/ui/Button";

type Slide = IntroSlideVisual & {
  title: string;
  body: string;
};

/**
 * Placeholder photography slots — solid-color PNGs until Bharat drops real
 * assets at the same paths (`slide-1.png` … `slide-3.png`). Omit `image` on a
 * slide to keep the Material icon tile fallback.
 */
const SLIDES: readonly Slide[] = [
  {
    title: "Create agreements in minutes",
    body: "Fill in property and party details — get a ready-to-send lease agreement, instantly.",
    icon: "file-document-edit-outline",
    image: require("../../assets/onboarding/slide-1.png"),
  },
  {
    title: "Send for review, right from your phone",
    body: "Owners and tenants review and respond — no app, no account needed.",
    icon: "share-variant-outline",
    image: require("../../assets/onboarding/slide-2.png"),
  },
  {
    title: "Track everything in one place",
    body: "See who's approved, who hasn't, and move straight to signing.",
    icon: "home-city-outline",
    image: require("../../assets/onboarding/slide-3.png"),
  },
] as const;

const TRACK_HEIGHT = 3;
const TRACK_GAP = 4;
/** Unfilled / upcoming segment track. */
const TRACK_EMPTY_OPACITY = 0.35;

/**
 * Intro carousel.
 *
 * Bug: finishIntro left `isFinishing=true` after router.push(phone). Intro stays
 * mounted under Phone, so Back returned with CTAs still disabled={isFinishing}
 * (dimmed + non-pressable). Focus resets that lock.
 */
export default function IntroCarouselScreen() {
  const theme = useAppTheme();
  const router = useRouter();
  const pagerRef = useRef<PagerView>(null);
  const pageRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const progressAnim = useRef(new Animated.Value(0)).current;
  const progressRunRef = useRef<Animated.CompositeAnimation | null>(null);
  const appActiveRef = useRef(AppState.currentState === "active");
  const screenFocusedRef = useRef(true);
  const finishingRef = useRef(false);
  const { width } = useWindowDimensions();
  const [page, setPage] = useState(0);
  const [isFinishing, setIsFinishing] = useState(false);

  const clearAdvanceTimer = useCallback(() => {
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const stopProgressFill = useCallback(() => {
    progressRunRef.current?.stop();
    progressRunRef.current = null;
  }, []);

  const startProgressFill = useCallback(() => {
    stopProgressFill();
    progressAnim.setValue(0);
    const run = Animated.timing(progressAnim, {
      toValue: 1,
      duration: INTRO_AUTO_ADVANCE_MS,
      easing: Easing.linear,
      useNativeDriver: false,
    });
    progressRunRef.current = run;
    run.start(({ finished }) => {
      if (finished) progressRunRef.current = null;
    });
  }, [progressAnim, stopProgressFill]);

  const scheduleAdvance = useCallback(() => {
    clearAdvanceTimer();
    stopProgressFill();
    if (finishingRef.current) return;
    if (!screenFocusedRef.current || !appActiveRef.current) return;

    startProgressFill();
    timerRef.current = setTimeout(() => {
      const next = nextIntroPage(pageRef.current, SLIDES.length);
      pageRef.current = next;
      setPage(next);
      pagerRef.current?.setPage(next);
    }, INTRO_AUTO_ADVANCE_MS);
  }, [clearAdvanceTimer, startProgressFill, stopProgressFill]);

  useFocusEffect(
    useCallback(() => {
      screenFocusedRef.current = true;
      // Unlock CTAs after Phone Back — push keeps this screen mounted with
      // isFinishing still true from the prior Get started.
      finishingRef.current = false;
      setIsFinishing(false);
      scheduleAdvance();
      return () => {
        screenFocusedRef.current = false;
        clearAdvanceTimer();
        stopProgressFill();
      };
    }, [scheduleAdvance, clearAdvanceTimer, stopProgressFill]),
  );

  useEffect(() => {
    const onAppState = (next: AppStateStatus) => {
      appActiveRef.current = next === "active";
      if (next === "active") scheduleAdvance();
      else {
        clearAdvanceTimer();
        stopProgressFill();
      }
    };
    const sub = AppState.addEventListener("change", onAppState);
    return () => sub.remove();
  }, [scheduleAdvance, clearAdvanceTimer, stopProgressFill]);

  useEffect(() => {
    pageRef.current = page;
    scheduleAdvance();
  }, [page, scheduleAdvance]);

  async function finishIntro(): Promise<void> {
    if (finishingRef.current) return;
    finishingRef.current = true;
    setIsFinishing(true);
    clearAdvanceTimer();
    stopProgressFill();
    try {
      await markIntroSeen();
      // push so Phone Back can pop to the carousel while onboarding is incomplete
      router.push("/(auth)/phone");
    } catch {
      finishingRef.current = false;
      setIsFinishing(false);
      scheduleAdvance();
    }
  }

  function onPageSelected(
    event: NativeSyntheticEvent<PagerViewOnPageSelectedEventData>,
  ): void {
    const next = event.nativeEvent.position;
    if (next === pageRef.current) return;
    pageRef.current = next;
    setPage(next);
  }

  return (
    <SafeAreaView
      style={{ flex: 1, backgroundColor: theme.colors.background }}
      edges={["top", "left", "right", "bottom"]}
    >
      <View style={{ flex: 1 }}>
        <PagerView
          ref={pagerRef}
          style={{ flex: 1 }}
          initialPage={0}
          onPageSelected={onPageSelected}
          accessibilityLabel="Intro carousel"
        >
          {SLIDES.map((slide) => (
            <View
              key={slide.title}
              style={{ flex: 1, width }}
              accessibilityRole="summary"
              accessibilityLabel={`${slide.title}. ${slide.body}`}
            >
              <View
                style={{
                  height: INTRO_ILLUSTRATION_HEIGHT,
                  borderBottomLeftRadius: 45,
                  borderBottomRightRadius: 45,
                  overflow: "hidden",
                  backgroundColor: azure[500],
                  alignItems: "center",
                  justifyContent: "center",
                }}
                accessibilityElementsHidden
                importantForAccessibility="no-hide-descendants"
              >
                {introUsesImage(slide) && slide.image != null ? (
                  <Image
                    source={slide.image}
                    style={{ width: "100%", height: "100%" }}
                    resizeMode="cover"
                    accessibilityIgnoresInvertColors
                  />
                ) : (
                  <>
                    <View
                      style={{
                        position: "absolute",
                        top: 0,
                        left: 0,
                        right: 0,
                        bottom: 0,
                        backgroundColor: azure[700],
                        opacity: 0.35,
                      }}
                    />
                    <View
                      style={{
                        position: "absolute",
                        top: -40,
                        right: -40,
                        width: 200,
                        height: 200,
                        borderRadius: 100,
                        backgroundColor: azure[300],
                        opacity: 0.35,
                      }}
                    />
                    <View
                      style={{
                        position: "absolute",
                        bottom: -60,
                        left: -30,
                        width: 220,
                        height: 220,
                        borderRadius: 110,
                        backgroundColor: azure[100],
                        opacity: 0.4,
                      }}
                    />
                    <View
                      style={{
                        width: 120,
                        height: 120,
                        borderRadius: 36,
                        backgroundColor: azure.a150,
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <Icon
                        source={slide.icon}
                        size={64}
                        color={theme.colors.onPrimary}
                      />
                    </View>
                  </>
                )}
              </View>

              <View
                style={{
                  flex: 1,
                  paddingHorizontal: 24,
                  paddingTop: 28,
                  alignItems: "center",
                  gap: 12,
                }}
              >
                <PaperText
                  variant="headlineSmall"
                  style={{
                    color: theme.colors.primary,
                    fontFamily: fontFamilies.generalSansSemibold,
                    textAlign: "center",
                  }}
                >
                  {slide.title}
                </PaperText>
                <PaperText
                  variant="bodyMedium"
                  style={{
                    color: theme.colors.onSurfaceVariant,
                    fontFamily: fontFamilies.robotoRegular,
                    textAlign: "center",
                  }}
                >
                  {slide.body}
                </PaperText>
              </View>
            </View>
          ))}
        </PagerView>

        <View
          pointerEvents="none"
          accessibilityRole="progressbar"
          accessibilityLabel={`Slide ${page + 1} of ${SLIDES.length}`}
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            paddingHorizontal: 16,
            paddingTop: 10,
            flexDirection: "row",
            gap: TRACK_GAP,
            zIndex: 2,
          }}
        >
          {SLIDES.map((slide, index) => (
            <View
              key={slide.title}
              style={{
                flex: 1,
                height: TRACK_HEIGHT,
                borderRadius: TRACK_HEIGHT,
                overflow: "hidden",
              }}
            >
              <View
                style={{
                  position: "absolute",
                  top: 0,
                  left: 0,
                  right: 0,
                  bottom: 0,
                  backgroundColor: theme.colors.surface,
                  opacity: TRACK_EMPTY_OPACITY,
                }}
              />
              {index < page ? (
                <View
                  style={{
                    height: "100%",
                    width: "100%",
                    backgroundColor: theme.colors.surface,
                  }}
                />
              ) : null}
              {index === page ? (
                <Animated.View
                  style={{
                    height: "100%",
                    width: progressAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: ["0%", "100%"],
                    }),
                    backgroundColor: theme.colors.surface,
                  }}
                />
              ) : null}
            </View>
          ))}
        </View>
      </View>

      <View
        style={{
          paddingHorizontal: 16,
          paddingBottom: 16,
          paddingTop: 8,
        }}
      >
        <Button
          title="Get started"
          onPress={() => void finishIntro()}
          isDisabled={isFinishing}
          isLoading={isFinishing}
        />
      </View>
    </SafeAreaView>
  );
}
