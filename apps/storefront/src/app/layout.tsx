import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { ensureStorefrontExtensionsRegistered } from "@/extensions/defaults";
import { renderStorefrontExtensions } from "@/extensions/registry";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Atlas Digital",
  description: "Independent digital goods store",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  ensureStorefrontExtensionsRegistered()

  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col">
        {children}
        {renderStorefrontExtensions("layout.body.end", {}).map((entry) => (
          <div key={entry.key}>{entry.node}</div>
        ))}
      </body>
    </html>
  );
}
