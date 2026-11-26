import type { Metadata, Viewport } from "next";
import { Plus_Jakarta_Sans, JetBrains_Mono } from "next/font/google";
import { Toaster } from "react-hot-toast";
import "./globals.css";

// One friendly geometric sans for the whole product (matches the reference
// screens' rounded, bold headings). Mono is reserved for tokens/IDs only.
const jakarta = Plus_Jakarta_Sans({
  subsets: ["latin", "latin-ext"],
  variable: "--font-jakarta",
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono-face",
  display: "swap",
});

export const metadata: Metadata = {
  title: "PGPass — Smart PG Management, Made Easy",
  description:
    "A complete solution for PG owners and residents to manage hostels, rooms, rent, maintenance and notices — all in one place.",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "PGPass",
  },
};

export const viewport: Viewport = {
  themeColor: "#EEE8FE",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${jakarta.variable} ${jetbrainsMono.variable} h-full`}>
      <head>
        <link rel="icon" href="/icon.svg" type="image/svg+xml" />
        <link rel="apple-touch-icon" href="/icon.svg" />
      </head>
      <body className="min-h-full antialiased font-sans text-ink">
        {children}
        <Toaster
          position="top-center"
          toastOptions={{
            duration: 3500,
            style: {
              background: "rgba(255,255,255,0.96)",
              color: "#1A1870",
              border: "1px solid #EDE7FD",
              borderRadius: "16px",
              padding: "10px 14px",
              boxShadow: "0 18px 40px -14px rgba(70, 40, 160, 0.35)",
              fontSize: "13px",
              fontWeight: 600,
            },
            success: { iconTheme: { primary: "#17A06B", secondary: "#FFFFFF" } },
            error: { iconTheme: { primary: "#E5484D", secondary: "#FFFFFF" } },
          }}
        />
      </body>
    </html>
  );
}
