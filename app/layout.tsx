import "@mysten/dapp-kit/dist/index.css";
import "./globals.css";
import { Providers } from "./providers";
import Navbar from "./components/Navbar";
import { BackgroundVideo } from "./components/BackgroundVideo";

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="scroll-snap-container">
      <head>
        <meta charSet="UTF-8" />
        <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>SUI Patreon</title>
      </head>
      <body className="relative">
        <BackgroundVideo />
        <Providers>
          <Navbar />
          {children}
        </Providers>
      </body>
    </html>
  );
}
