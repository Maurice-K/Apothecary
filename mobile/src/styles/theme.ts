import { StyleSheet } from "react-native";

export const colors = {
  canvas: "#FAF9F6",
  card: "#FFFFFF",
  surface: "#F3F1EC",

  primary900: "#1B4332",
  primary700: "#2D6A4F",
  primary100: "#D8F3DC",

  stone900: "#1C1917",
  stone700: "#44403C",
  stone500: "#78716C",
  stone400: "#A8A29E",
  stone200: "#E7E5E4",

  terracotta: "#C2703E",
  terracotta100: "#FCEEE4",
  sage: "#E8EFE8",
  lavender: "#EFEDF4",

  error: "#B91C1C",
  errorBg: "#FEE2E2",
} as const;

export const shared = StyleSheet.create({
  screenTitle: {
    fontSize: 28,
    fontWeight: "700",
    color: colors.primary900,
    letterSpacing: -0.5,
  },
  button: {
    backgroundColor: colors.primary700,
    height: 48,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  buttonPressed: {
    transform: [{ scale: 0.98 }],
    opacity: 0.9,
  },
  buttonText: {
    color: "white",
    fontSize: 16,
    fontWeight: "600",
  },
  buttonOutline: {
    height: 48,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.primary700,
    alignItems: "center",
    justifyContent: "center",
  },
  buttonOutlineText: {
    color: colors.primary700,
    fontSize: 16,
    fontWeight: "600",
  },
  card: {
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 1,
  },
  input: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 14,
    fontSize: 16,
    color: colors.stone900,
    height: 48,
  },
  label: {
    fontSize: 13,
    fontWeight: "600",
    color: colors.stone700,
  },
  errorContainer: {
    backgroundColor: colors.errorBg,
    borderRadius: 12,
    padding: 12,
  },
  errorText: {
    color: colors.error,
    fontSize: 14,
  },
  centered: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: colors.canvas,
    padding: 20,
    gap: 6,
  },
  centeredEmoji: {
    fontSize: 48,
    marginBottom: 8,
  },
  centeredTitle: {
    fontSize: 22,
    fontWeight: "700",
    color: colors.primary900,
  },
  centeredSubtitle: {
    fontSize: 15,
    color: colors.stone500,
    textAlign: "center",
    lineHeight: 22,
    marginBottom: 16,
    maxWidth: 280,
  },
});
