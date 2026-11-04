import { ClerkProvider } from "@clerk/nextjs";
import type { Metadata } from "next";
import { Fraunces, Inter, JetBrains_Mono } from "next/font/google";
import { clerkEnabled } from "@/lib/clerk";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });
const fraunces = Fraunces({ subsets: ["latin"], weight: "600", variable: "--font-fraunces" });
const mono = JetBrains_Mono({ subsets: ["latin"], variable: "--font-jetbrains" });

// Runs before paint so a saved Light or Dark choice never flashes the other theme.
const THEME = `try{var t=localStorage.getItem("relib:theme");if(t==="light"||t==="dark")document.documentElement.dataset.theme=t}catch(e){}`;

export const metadata: Metadata = {
  title: "relib",
  description: "A study and research workspace: your notes, lecture material and sources in one place.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const page = (
    <html lang="en" className={`${inter.variable} ${fraunces.variable} ${mono.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME }} />
      </head>
      <body>{children}</body>
    </html>
  );
  return clerkEnabled ? <ClerkProvider>{page}</ClerkProvider> : page;
}
