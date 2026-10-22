import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "Rate My Lecturer NG",
  description: "Anonymous, verified reviews of lecturers and staff at Nigerian tertiary institutions.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">
        <nav className="mx-auto flex max-w-3xl items-center justify-between px-4 pt-4 text-sm">
          <Link href="/" className="font-semibold">Rate My Lecturer NG</Link>
          <Link href="/verify" className="underline">Sign in / verify</Link>
        </nav>
        {children}
      </body>
    </html>
  );
}
