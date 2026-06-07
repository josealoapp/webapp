import type { Metadata } from "next";
import { Poppins, Geist_Mono } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/components/ThemeProvider";
import AccountStatusGuard from "@/components/AccountStatusGuard";
import SupportNotificationBanner from "@/components/SupportNotificationBanner";
import UnreadMessageToast from "@/components/UnreadMessageToast";
import { Toaster } from "@/components/ui/sonner";

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
  title: "Josealo",
  description: "NextGen Marketplace",
  icons: {
    icon: "/favicon.ico",
    shortcut: "/favicon.ico",
    apple: "/favicon.ico",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
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
