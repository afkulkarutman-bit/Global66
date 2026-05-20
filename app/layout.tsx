import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Global66 People",
  description: "Plataforma de Recursos Humanos Global66",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" className="h-full">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
