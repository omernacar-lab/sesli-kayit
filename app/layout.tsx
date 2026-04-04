import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Sesli Kayıt - Müşteri Takip",
  description: "Sesle müşteri kaydı yap, Google Sheets'e otomatik yaz",
  viewport: "width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no",
  themeColor: "#C17E4A",
  manifest: "/manifest.json",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="tr">
      <head>
        <link
          href="https://fonts.googleapis.com/css2?family=Nunito:wght@400;500;600;700;800&display=swap"
          rel="stylesheet"
        />
      </head>
      <body style={{ margin: 0, padding: 0, background: "#FAF7F4" }}>{children}</body>
    </html>
  );
}
