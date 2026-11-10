import type { Metadata, Viewport } from "next";
import { Inter, Noto_Sans_Ethiopic } from "next/font/google";
import { THEME_STORAGE_KEY } from "@/lib/theme";
import "./globals.css";

const inter = Inter({ variable: "--font-inter", subsets: ["latin"], display: "swap" });
// Amharic (Ge'ez script) glyphs — used automatically wherever Ethiopic characters appear.
const ethiopic = Noto_Sans_Ethiopic({ variable: "--font-ethiopic", subsets: ["ethiopic"], display: "swap", preload: false });

export const metadata: Metadata = {
  title: { default: "Looso — Your Skills. Your Opportunities.", template: "%s · Looso" },
  description: "Find skilled workers, discover jobs and grow your future. Connecting people, skills, and opportunities across Hawassa.",
  applicationName: "Looso",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#182B43" },
    { media: "(prefers-color-scheme: dark)", color: "#0F1F35" },
  ],
};

/**
 * Runs before first paint: applies the saved theme (or the OS preference) so dark-mode users
 * never see a white flash, and marks JS as available for scroll-reveal animations.
 * Static string with no user input.
 */
const themeScript = `(function(){try{var d=document.documentElement;d.classList.add('js');var p=localStorage.getItem('${THEME_STORAGE_KEY}');var dark=p==='dark'||((!p||p==='system')&&window.matchMedia('(prefers-color-scheme: dark)').matches);d.dataset.theme=dark?'dark':'light';}catch(e){document.documentElement.dataset.theme='light';}})();`;

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" data-theme="light" suppressHydrationWarning className={`${inter.variable} ${ethiopic.variable} h-full antialiased`}>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="flex min-h-full flex-col">
        <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded focus:bg-card focus:px-3 focus:py-2">
          Skip to content
        </a>
        {children}
      </body>
    </html>
  );
}
