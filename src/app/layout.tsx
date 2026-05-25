import type { Metadata } from "next";
import { Outfit, DM_Sans } from "next/font/google";
import "./globals.css";
import { AppProvider } from "@/lib/store";
import { Notif } from "@/components/Notif";

const outfit = Outfit({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700", "800"],
  variable: "--font-outfit",
});

const dmSans = DM_Sans({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600"],
  variable: "--font-dm-sans",
});

export const metadata: Metadata = {
  title: "Vama Retreats — Back Office",
  description: "Vama Retreats internal back office",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en"
      className={`${outfit.variable} ${dmSans.variable}`}
      suppressHydrationWarning
    >
      <body suppressHydrationWarning>
        <AppProvider>
          {children}
          <Notif />
        </AppProvider>
      </body>
    </html>
  );
}
