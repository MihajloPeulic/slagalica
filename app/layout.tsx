import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

// Existing authenticated routes still render request data directly.
// Cache Components is adopted for data functions first.
export const instant = false;

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Slagalica",
  description: "Slagalica — kviz, mozgalice i igra s prijateljima.",
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  
  return (
    <html
      lang="bs"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
            {children}
      </body>
    </html>
  );
}
