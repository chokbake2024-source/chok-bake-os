import type { Metadata } from "next";
import { Italiana, DM_Sans, DM_Mono, Crimson_Pro } from "next/font/google";
import "./globals.css";

const italiana = Italiana({
  variable: "--font-italiana",
  subsets: ["latin"],
  weight: "400",
});

const dmSans = DM_Sans({
  variable: "--font-dm-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});

const dmMono = DM_Mono({
  variable: "--font-dm-mono",
  subsets: ["latin"],
  weight: ["400", "500"],
});

const crimson = Crimson_Pro({
  variable: "--font-crimson",
  subsets: ["latin"],
  weight: ["400"],
  style: ["italic"],
});

const SITIO = "https://sistemachok.vercel.app";

export const metadata: Metadata = {
  metadataBase: new URL(SITIO),
  title: "Chok Bake — Postres artesanales",
  description:
    "Cuchareables, tortas personalizadas y mesas frías de postres en Cúcuta. Pide en línea.",
  openGraph: {
    title: "Chok Bake — Postres artesanales",
    description: "Cuchareables, mesas frías y tortas en Cúcuta. Pedí en línea.",
    url: SITIO,
    siteName: "Chok Bake",
    locale: "es_CO",
    type: "website",
  },
};

export const viewport = {
  themeColor: "#5a1226",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="es"
      className={`${italiana.variable} ${dmSans.variable} ${dmMono.variable} ${crimson.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
