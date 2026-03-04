import type { Metadata } from "next";
import "./globals.css";
import { UserHeader } from "@/components/UserHeader";

export const metadata: Metadata = {
  title: "Health Tracker",
  description: "Track your health data in one place",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased min-h-screen bg-slate-50">
        <UserHeader />
        {children}
      </body>
    </html>
  );
}
