import type { Metadata } from "next";
import { Sora, Space_Grotesk } from "next/font/google";
import "./globals.css";

const titleFont = Sora({
  variable: "--font-title",
  subsets: ["latin"],
});

const bodyFont = Space_Grotesk({
  variable: "--font-body",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "MiniMarket Escrow",
  applicationName: "MiniMarket Escrow",
  description: "Colorful Celo escrow desk with live TVL and total volume analytics.",
  icons: {
    icon: "/minimarket-logo.svg",
  },
  other: {
    "talentapp:project_verification":
      "c34f7e921fc53c00aec5e8716d278beb0cdbfeb62b568ea7b70ef26119e17ad4055a2d56cdf1d3264492e937370cb057aa3215efb27777b279b67cfe7bda8bcd",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${titleFont.variable} ${bodyFont.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
