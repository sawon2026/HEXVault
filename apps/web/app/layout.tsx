import type { Metadata } from "next";
import "./globals.css";
import { Shell } from "@/components/Shell";
import { ThemeProvider } from "@/components/ThemeProvider";

export const metadata: Metadata = {
  title: "HEXVault Dashboard",
  description: "Project memory, search, chat, and code analysis",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="font-sans antialiased">
        <ThemeProvider>
          <Shell>{children}</Shell>
        </ThemeProvider>
      </body>
    </html>
  );
}
