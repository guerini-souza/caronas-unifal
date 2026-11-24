import type { Metadata, Viewport } from "next";
import { Geist } from "next/font/google";
import { InstallPrompt } from "@/components/InstallPrompt";
import { ServiceWorkerRegister } from "@/components/ServiceWorkerRegister";
import { SITE_URL } from "@/lib/env";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: { default: "Caronas", template: "%s · Caronas" },
  description: "Caronas universitárias: ofereça, pegue e descubra os pontos de carona.",
  applicationName: "Caronas",
  appleWebApp: { capable: true, title: "Caronas", statusBarStyle: "default" },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  themeColor: "#1d4ed8",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="pt-BR" className={`${geistSans.variable} h-full antialiased`}>
      <body className="min-h-dvh">
        <div className="mx-auto min-h-dvh w-full max-w-md bg-background">{children}</div>
        <ServiceWorkerRegister />
        <InstallPrompt />
      </body>
    </html>
  );
}
