import type { Metadata } from "next";
import { Cinzel, Geist, Geist_Mono, VT323 } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import "./globals.css";

const cinzel = Cinzel({
  variable: "--font-cinzel",
  subsets: ["latin"],
});

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// Pixel font for the Minecraft-styled inventory slots, counts, and tooltips.
const pixel = VT323({
  variable: "--font-pixel",
  weight: "400",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "Königsburg",
    template: "%s - Königsburg",
  },
  description:
    "The gates of Königsburg - citizenship portal of the nation. Apply, be approved, and build within the walls.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${cinzel.variable} ${geistSans.variable} ${geistMono.variable} ${pixel.variable} h-full antialiased`}
    >
      <head>
        {/*
          Applies the saved theme before first paint. Without this, a light-mode
          visitor gets a flash of the dark palette on every navigation. Dark is
          the default, so only "light" needs an attribute.
        */}
        <script
          dangerouslySetInnerHTML={{
            __html: `try{if(localStorage.getItem('kbg-theme')==='light'){document.documentElement.dataset.theme='light'}}catch(e){}`,
          }}
        />
      </head>
      <body className="flex min-h-full flex-col font-sans text-slate-200">
        {children}
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
