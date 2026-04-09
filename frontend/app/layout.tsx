import type { Metadata } from "next";
import { Open_Sans } from "next/font/google";
import "./globals.css";
import Sidebar from "./components/Sidebar";

const openSans = Open_Sans({
  subsets: ["latin"],
  weight: ["300", "400", "600", "700", "800"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Federated Learning Platform",
  description: "Dashboard for monitoring federated learning training.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={openSans.className}>
        <div className="min-h-screen bg-argon-bg flex">
          <Sidebar />
          <main className="flex-1 ml-[282px] p-8 pb-20">
            {children}
          </main>
        </div>
      </body>
    </html>
  );
}
