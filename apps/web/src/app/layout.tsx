import type { Metadata } from "next";
import { Instrument_Sans, JetBrains_Mono } from "next/font/google";
import "./globals.css";

const instrumentSans = Instrument_Sans({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-instrument-sans",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-jetbrains-mono",
});

export const metadata: Metadata = {
  title: "KEPLAR — Phase 1 S1 Ready",
  description: "KEPLAR Enterprise agentOS — Phase 1 scaffolding (S1).",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}): React.ReactElement {
  // FOUC-prevention script: read the stored theme id from localStorage and
  // apply it to <html data-theme="..."> before first paint. React will
  // warn about a hydration mismatch on the data-theme attribute; suppress
  // it via suppressHydrationWarning (the value is intentionally
  // client-controlled after first paint).
  const themeBootstrapScript = `
(function () {
  try {
    var k = 'keplar.theme';
    var v = window.localStorage.getItem(k);
    var allowed = ['dark-codex','dark-solarized','light-paper','dark-monokai'];
    if (v && allowed.indexOf(v) >= 0) {
      document.documentElement.dataset.theme = v;
    }
  } catch (e) { /* tolerate */ }
})();
`.trim();

  return (
    <html
      lang="zh-CN"
      data-theme="dark"
      suppressHydrationWarning
      className={`${instrumentSans.variable} ${jetbrainsMono.variable}`}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeBootstrapScript }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
