import type { Metadata } from "next";
import { Poppins, Geist_Mono } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/components/ThemeProvider";
import AccountStatusGuard from "@/components/AccountStatusGuard";
import SupportNotificationBanner from "@/components/SupportNotificationBanner";
import UnreadMessageToast from "@/components/UnreadMessageToast";
import { Toaster } from "@/components/ui/sonner";

const siteUrl = "https://josealo.com";
const siteTitle = "Josealo | Compra y vende en República Dominicana";
const siteDescription =
  "Marketplace para comprar, vender y negociar artículos en República Dominicana. Encuentra vehículos, celulares, tecnología, moda, hogar y más.";

const poppins = Poppins({
  variable: "--font-geist-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  applicationName: "Josealo",
  title: {
    default: siteTitle,
    template: "%s | Josealo",
  },
  description: siteDescription,
  keywords: [
    "Josealo",
    "marketplace República Dominicana",
    "comprar y vender RD",
    "artículos usados República Dominicana",
    "vehículos RD",
    "celulares RD",
    "bazar RD",
    "comprar en Santo Domingo",
  ],
  authors: [{ name: "Josealo" }],
  creator: "Josealo",
  publisher: "Josealo",
  alternates: {
    canonical: "/",
  },
  openGraph: {
    type: "website",
    locale: "es_DO",
    url: siteUrl,
    siteName: "Josealo",
    title: siteTitle,
    description: siteDescription,
    images: [
      {
        url: "/logo.png",
        width: 1200,
        height: 630,
        alt: "Josealo",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: siteTitle,
    description: siteDescription,
    images: ["/logo.png"],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
      "max-video-preview": -1,
    },
  },
  icons: {
    icon: "/favicon.ico",
    shortcut: "/favicon.ico",
    apple: "/favicon.ico",
  },
};

const structuredData = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Organization",
      "@id": `${siteUrl}/#organization`,
      name: "Josealo",
      url: siteUrl,
      logo: `${siteUrl}/logo.png`,
      sameAs: [],
    },
    {
      "@type": "WebSite",
      "@id": `${siteUrl}/#website`,
      url: siteUrl,
      name: "Josealo",
      description: siteDescription,
      inLanguage: "es-DO",
      publisher: {
        "@id": `${siteUrl}/#organization`,
      },
      potentialAction: {
        "@type": "SearchAction",
        target: `${siteUrl}/search?q={search_term_string}`,
        "query-input": "required name=search_term_string",
      },
    },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es-DO" suppressHydrationWarning>
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
        />
      </head>
      <body className={`${poppins.variable} ${geistMono.variable} antialiased`}>
        <ThemeProvider>
          <AccountStatusGuard />
          <SupportNotificationBanner />
          <UnreadMessageToast />
          {children}
          <Toaster />
        </ThemeProvider>
      </body>
    </html>
  );
}
