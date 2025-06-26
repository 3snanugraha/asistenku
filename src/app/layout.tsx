import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Asistenqu Voice AI - AI Voice Assistant",
  description:
    "Aplikasi voice call dengan AI menggunakan Ollama. Berbicara langsung dengan asisten AI menggunakan speech recognition dan text-to-speech.",
  keywords: [
    "AI",
    "Voice Assistant",
    "Speech Recognition",
    "Ollama",
    "Text-to-Speech",
    "Voice Call",
  ],
  authors: [{ name: "Asistenqu Voice AI" }],
  creator: "Asistenqu Voice AI",
  publisher: "Asistenqu Voice AI",
  formatDetection: {
    email: false,
    address: false,
    telephone: false,
  },
  icons: {
    icon: [
      { url: "/favicon.ico" },
      { url: "/icon-16x16.png", sizes: "16x16", type: "image/png" },
      { url: "/icon-32x32.png", sizes: "32x32", type: "image/png" },
    ],
    apple: [
      { url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" },
    ],
  },
  manifest: "/site.webmanifest",
  viewport: {
    width: "device-width",
    initialScale: 1,
    maximumScale: 1,
    userScalable: false,
  },
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#3b82f6" },
    { media: "(prefers-color-scheme: dark)", color: "#1e40af" },
  ],
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Asistenqu Voice AI",
  },
  openGraph: {
    type: "website",
    siteName: "Asistenqu Voice AI",
    title: "Asistenqu Voice AI - AI Voice Assistant",
    description:
      "Berbicara langsung dengan AI menggunakan voice recognition dan text-to-speech",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "Asistenqu Voice AI",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Asistenqu Voice AI - AI Voice Assistant",
    description:
      "Berbicara langsung dengan AI menggunakan voice recognition dan text-to-speech",
    images: ["/og-image.png"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="id" suppressHydrationWarning>
      <head>
        {/* PWA Meta Tags */}
        <meta name="application-name" content="Asistenqu Voice AI" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content="Asistenqu Voice AI" />
        <meta name="format-detection" content="telephone=no" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="msapplication-config" content="/browserconfig.xml" />
        <meta name="msapplication-TileColor" content="#3b82f6" />
        <meta name="msapplication-tap-highlight" content="no" />

        {/* Preconnect to improve performance */}
        <link rel="preconnect" href="http://localhost:11434" />
        <link rel="dns-prefetch" href="http://localhost:11434" />

        {/* Disable zoom on mobile to prevent issues with voice interface */}
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no"
        />

        {/* Permissions Policy - Allow microphone access */}
        <meta httpEquiv="Permissions-Policy" content="microphone=*" />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
        suppressHydrationWarning
      >
        {/* Global App Container */}
        <div id="app-root" className="min-h-screen">
          {children}
        </div>

        {/* Service Worker Registration */}
        <script
          dangerouslySetInnerHTML={{
            __html: `
              if ('serviceWorker' in navigator) {
                window.addEventListener('load', function() {
                  navigator.serviceWorker.register('/sw.js')
                    .then(function(registration) {
                      console.log('SW registered: ', registration);
                    })
                    .catch(function(registrationError) {
                      console.log('SW registration failed: ', registrationError);
                    });
                });
              }
            `,
          }}
        />

        {/* Microphone Permission Check */}
        <script
          dangerouslySetInnerHTML={{
            __html: `
              // Check microphone permission on app load
              if ('navigator' in window && 'permissions' in navigator) {
                navigator.permissions.query({ name: 'microphone' })
                  .then(function(result) {
                    console.log('Microphone permission:', result.state);
                    if (result.state === 'denied') {
                      console.warn('Microphone access denied. Voice features may not work.');
                    }
                  })
                  .catch(function(error) {
                    console.log('Permission query failed:', error);
                  });
              }
            `,
          }}
        />
      </body>
    </html>
  );
}
