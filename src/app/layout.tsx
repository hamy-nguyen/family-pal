import type { Metadata, Viewport } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/components/AuthProvider";
import { ServiceWorker } from "@/components/ServiceWorker";

// WHY vietnamese subset: record content (disease names, hospitals) is Vietnamese,
// so the font must carry those diacritics, not just latin.
const jakarta = Plus_Jakarta_Sans({
  subsets: ["latin", "vietnamese"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-jakarta",
});

export const metadata: Metadata = {
  title: "Family Pal",
  description: "Your family's medical history, one tap away.",
  manifest: "/manifest.json",
  icons: {
    icon: "/icon-192.png",
    apple: "/apple-touch-icon.png",
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Family Pal",
  },
};

export const viewport: Viewport = {
  themeColor: "#f4f4f9",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={jakarta.variable}>
      <body className="min-h-dvh bg-[#f4f4f9] text-slate-900 antialiased">
        <div className="mx-auto flex min-h-dvh max-w-md flex-col">
          <AuthProvider>{children}</AuthProvider>
        </div>
        <ServiceWorker />
      </body>
    </html>
  );
}
