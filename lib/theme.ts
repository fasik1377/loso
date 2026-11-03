/** Theme preference: an explicit choice, or follow the operating system. */
export type ThemePreference = "light" | "dark" | "system";

export const THEME_STORAGE_KEY = "loso-theme";
export const THEME_PREFERENCES: readonly ThemePreference[] = ["light", "dark", "system"];
