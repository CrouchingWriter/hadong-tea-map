import type { Metadata } from "next";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";
import { ToastStateProvider } from "@/components/ui/use-toast";

export const metadata: Metadata = {
  title: "하동 로컬 투어 & 다원 맵",
  description: "카카오 지도와 로컬 API로 탐색하는 하동 다원, 찻집, 명소 지도",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <body>
        <ToastStateProvider>
          {children}
          <Toaster />
        </ToastStateProvider>
      </body>
    </html>
  );
}
