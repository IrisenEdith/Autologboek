import "./globals.css";

export const metadata = {
  title: "Vehicle Log Online",
  description: "Importeer en beheer voertuigkosten online.",
  icons: {
    icon: "/icon.svg",
    apple: "/icon.svg",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="nl">
      <body suppressHydrationWarning>{children}</body>
    </html>
  );
}
