import "./globals.css";
import { Inter } from "next/font/google";
import { AnimatedThemeToggler } from "@/components/ui/animated-theme-toggler";

// Load Inter with default weight/style configuration
const inter = Inter({
  subsets: ["latin"],
  display: "swap",
});

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <div className="fixed top-5 right-5 z-100">
          <AnimatedThemeToggler />
        </div>
        {children}
      </body>
    </html>
  );
}
