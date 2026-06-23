import type { Metadata } from "next";
import VendorSessionProvider from "@/components/vendor/VendorSessionProvider";
import "./globals.css";

export const metadata: Metadata = {
  title: "Vendor Portal · P4U",
  description: "Manage your store, orders and settlements",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen font-sans antialiased">
        <VendorSessionProvider>{children}</VendorSessionProvider>
      </body>
    </html>
  );
}
