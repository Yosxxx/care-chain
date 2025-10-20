import "./globals.css";
import { AnimatedThemeToggler } from "@/components/ui/animated-theme-toggler";
export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        <div className="fixed top-5 right-5 z-100">
          <AnimatedThemeToggler />
        </div>
        {children}
      </body>
    </html>
  );
}
