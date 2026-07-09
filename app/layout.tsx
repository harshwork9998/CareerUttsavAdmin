import type { Metadata } from "next";
import { Inter } from "next/font/google";

import { BRAND } from "@/constants";
import {
  QueryProvider,
  ThemeProvider,
  ToastProvider,
} from "@/components/providers";

import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: `${BRAND.name} Admin`,
    template: `%s | ${BRAND.name} Admin`,
  },
  description: `${BRAND.name} admin panel by ${BRAND.org}`,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${inter.variable} font-sans antialiased`}>
        <QueryProvider>
          <ThemeProvider>
            {children}
            <ToastProvider />
          </ThemeProvider>
        </QueryProvider>
      </body>
    </html>
  );
}
