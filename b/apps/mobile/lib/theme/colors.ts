/**
 * TrustKeyper color tokens — Figma Colors collection (file b6tSh97xlGwNp8BC96EweJ).
 * Alphas are the brand base color at the stated opacity (not separate solid swatches).
 *
 * No error/red family exists in Figma Colors — see docs/open-items.md.
 */

export const azure = {
  50: "#F5F8FF",
  100: "#D8E4FD",
  200: "#B4CDFD",
  300: "#75A3FF",
  400: "#4D7FFF",
  500: "#305EFF",
  600: "#2950DA",
  700: "#2243B6",
  800: "#1B3591",
  900: "#14286D",
  1000: "#0D1A48",
  /** 9% of #305EFF */
  a50: "rgba(48, 94, 255, 0.09)",
  /** 18% of #305EFF */
  a100: "rgba(48, 94, 255, 0.18)",
  /** 24% of #305EFF */
  a150: "rgba(48, 94, 255, 0.24)",
  /** 32% of #305EFF */
  a200: "rgba(48, 94, 255, 0.32)",
} as const;

/** Figma: Primary/Emerald — success / secondary brand green */
export const emerald = {
  50: "#EBFAF3",
  100: "#DAF5E8",
  200: "#B6ECD1",
  300: "#91E3BA",
  400: "#48D08C",
} as const;

export const sapphire = {
  50: "#E7F6FE",
  100: "#CFEDFC",
  200: "#A8DFFA",
  300: "#79CEF8",
  400: "#57C1F6",
  500: "#15B0F3",
  600: "#1291D0",
  700: "#0F78AD",
  800: "#0C608A",
  900: "#094868",
  1000: "#063145",
  /** 9% of #1291D0 */
  a50: "rgba(18, 145, 208, 0.09)",
  /** 18% of #1291D0 */
  a100: "rgba(18, 145, 208, 0.18)",
  /** 24% of #1291D0 */
  a150: "rgba(18, 145, 208, 0.24)",
  /** 32% of #1291D0 */
  a200: "rgba(18, 145, 208, 0.32)",
} as const;

export const cloud = {
  50: "#EDF4F7",
  100: "#E6EFF4",
  200: "#CBDDE6",
  300: "#97BBCD",
  400: "#6091A9",
  500: "#387594",
  600: "#1F5C7A",
  700: "#1D4B63",
  800: "#143D52",
  900: "#032A3E",
  1000: "#021C29",
  /** 9% of #1F5C7A */
  a50: "rgba(31, 92, 122, 0.09)",
  /** 18% of #1F5C7A */
  a100: "rgba(31, 92, 122, 0.18)",
  /** 24% of #1F5C7A */
  a150: "rgba(31, 92, 122, 0.24)",
  /** 32% of #1F5C7A */
  a200: "rgba(31, 92, 122, 0.32)",
} as const;

export const sea = {
  50: "#EDF7F7",
  100: "#E2F3F3",
  200: "#C2E0E0",
  300: "#97CDCD",
  400: "#60A9A9",
  500: "#389494",
  600: "#1F7A7A",
  700: "#1D6363",
  800: "#145252",
  900: "#033E3E",
  1000: "#022929",
  /** 9% of #1F7A7A */
  a50: "rgba(31, 122, 122, 0.09)",
  /** 18% of #1F7A7A */
  a100: "rgba(31, 122, 122, 0.18)",
  /** 24% of #1F7A7A */
  a150: "rgba(31, 122, 122, 0.24)",
  /** 32% of #1F7A7A */
  a200: "rgba(31, 122, 122, 0.32)",
} as const;

/**
 * Figma Neutral/Light — source for background, body, muted, heading.
 * Included so semantic text colors stay tied to the design system.
 */
export const neutralLight = {
  0: "#FFFFFF",
  50: "#F8FAFC",
  100: "#F1F5FA",
  200: "#E3EAF3",
  300: "#CBD5E2",
  400: "#B1C1D2",
  500: "#90A5BB",
  600: "#768EA7",
  700: "#6C849D",
  800: "#58728D",
  900: "#40566D",
  1000: "#2F4256",
  1100: "#243547",
  1200: "#192839",
  1300: "#0C1927",
  a25: "rgba(108, 132, 157, 0.09)",
  a50: "rgba(108, 132, 157, 0.09)",
  a100: "rgba(108, 132, 157, 0.18)",
  a200: "rgba(108, 132, 157, 0.32)",
} as const;

export const neutralDark = {
  0: "#FCFCFD",
  50: "#F8FAFC",
  100: "#F1F5FA",
  200: "#E3EAF3",
  300: "#CBD5E2",
  400: "#B1C1D2",
  500: "#90A5BB",
  600: "#768EA7",
  700: "#6C849D",
  800: "#58728D",
  900: "#40566D",
  1000: "#2F4256",
  1100: "#243547",
  1200: "#192839",
  1300: "#0C1927",
  a25: "rgba(227, 234, 243, 0.09)",
  a50: "rgba(227, 234, 243, 0.09)",
  a100: "rgba(227, 234, 243, 0.18)",
  a200: "rgba(227, 234, 243, 0.32)",
} as const;

export const neutral = {
  black: "#000000",
  white: "#FFFFFF",
  light: neutralLight,
  dark: neutralDark,
} as const;

/**
 * MD3 reference error (kept until Figma defines a brand red).
 * See docs/open-items.md.
 */
export const md3Error = {
  error: "#B3261E",
  errorContainer: "#F9DEDC",
  onError: "#FFFFFF",
  onErrorContainer: "#410E0B",
} as const;

/**
 * Interim warning / amber (not in Figma Colors).
 * Currently unused by app chrome — "needs attention" cards use primary azure
 * instead (thin amber borders read as error). Kept for a future brand warning
 * family; Alert "notice" still uses its own provisional hexes.
 * See docs/open-items.md.
 */
export const interimWarning = {
  warning: "#B45309",
  warningContainer: "#FEF3C7",
  onWarning: "#192839",
  onWarningContainer: "#78350F",
} as const;

/**
 * Semantic roles used by the app theme and UI wrappers.
 *
 * Accessibility notes (WCAG AA vs white / #F8FAFC):
 * - bodyText (#40566D): passes 4.5:1
 * - mutedText (#768EA7 / Light-600): FAILS body (≈3.4:1); passes large text (3:1).
 *   Use mutedTextAccessible (Light-800 #58728D) for body-sized muted copy.
 * - azure-300 / sapphire-300 as text on white: fail even large text — use 600+ for links.
 * - emerald-400 as text on white: fails — use as fill only.
 * - onSuccess (text/icons on emerald-400 fill): navy #192839 passes 7.60:1;
 *   white fails at 1.97:1 — never use white on success fills.
 */
export const semantic = {
  primary: azure[500],
  primaryHover: azure[400],
  success: emerald[400],
  successContainer: emerald[50],
  /** Text/icons on emerald-400 fills — navy (headingText), not white. */
  onSuccess: neutralLight[1200],
  headingText: neutralLight[1200],
  bodyText: neutralLight[900],
  /** Figma Neutral/Light/600 — large/decorative muted only */
  mutedText: neutralLight[600],
  /** Nearest same-family body-compliant muted (Light/800) */
  mutedTextAccessible: neutralLight[800],
  background: neutral.white,
  surface: neutral.white,
  /**
   * Marketing/border token (#E5E5E5). Not in Figma Colors Neutrals
   * (nearest Neutral Light/200 is #E3EAF3).
   */
  border: "#E5E5E5",
  /** Review-page key-term highlight — azure-a50 */
  highlight: azure.a50,
  error: md3Error.error,
  errorContainer: md3Error.errorContainer,
  onError: md3Error.onError,
  onErrorContainer: md3Error.onErrorContainer,
} as const;

export const palette = {
  azure,
  emerald,
  sapphire,
  cloud,
  sea,
  neutral,
  md3Error,
  interimWarning,
  semantic,
} as const;
