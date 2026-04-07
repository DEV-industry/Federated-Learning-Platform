import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "FL Node Dashboard — Local Operator View",
  description: "Local monitoring dashboard for your Federated Learning node. View training status, resource usage, and data privacy posture.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-node-bg grid-pattern">
        {children}
      </body>
    </html>
  );
}
