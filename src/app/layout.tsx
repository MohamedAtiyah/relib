import { ClerkProvider } from "@clerk/nextjs";
import type { Metadata } from "next";
import { Fraunces, Inter } from "next/font/google";
import { clerkEnabled } from "@/lib/clerk";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });
const fraunces = Fraunces({ subsets: ["latin"], weight: "600", variable: "--font-fraunces" });

export const metadata: Metadata = {
  title: "relib",
  description: "A workspace where the right information finds you.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const page = (
    <html lang="en" className={`${inter.variable} ${fraunces.variable}`}>
      <body>{children}</body>
    </html>
  );
  return clerkEnabled ? <ClerkProvider>{page}</ClerkProvider> : page;
}
