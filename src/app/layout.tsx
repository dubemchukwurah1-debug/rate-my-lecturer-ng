import type { Metadata } from "next";
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
      <body className="antialiased">{children}</body>
    </html>
  );
}
