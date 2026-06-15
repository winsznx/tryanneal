import Script from "next/script";
import MiniAppClient from "./miniapp-client";

export const metadata = {
  title: "TryAnneal — Mini App",
  description: "is_this_safe() for Mantle, inside Telegram.",
};

export default function MiniAppPage() {
  return (
    <>
      {/* Telegram WebApp SDK — provides theme + viewport controls inside Telegram. */}
      <Script src="https://telegram.org/js/telegram-web-app.js" strategy="beforeInteractive" />
      <MiniAppClient />
    </>
  );
}
