"use client";

import { useEffect } from "react";
import SafetyOracle from "../../src/components/safety-oracle";

/**
 * Telegram Mini App client. Boots the Telegram WebApp SDK (expand, theme,
 * ready) and renders a focused mobile audit view around the live safety
 * oracle. Works as a normal web page too if opened outside Telegram.
 */
interface TelegramWebApp {
  ready: () => void;
  expand: () => void;
  setHeaderColor?: (c: string) => void;
  setBackgroundColor?: (c: string) => void;
  colorScheme?: string;
}

export default function MiniAppClient() {
  useEffect(() => {
    const tg = (window as unknown as { Telegram?: { WebApp?: TelegramWebApp } }).Telegram?.WebApp;
    if (tg) {
      tg.ready();
      tg.expand();
      tg.setHeaderColor?.("#161616");
      tg.setBackgroundColor?.("#161616");
    }
  }, []);

  return (
    <main
      className="min-h-screen flex flex-col items-center px-4 py-8"
      style={{ background: "var(--color-deep-space)" }}
    >
      <div className="w-full max-w-2xl flex flex-col items-center text-center">
        <div className="flex items-center gap-2 mb-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/icon.svg" alt="TryAnneal" width={28} height={28} />
          <span className="font-mono text-cloud-white" style={{ fontSize: "18px", letterSpacing: "-0.01em" }}>
            TryAnneal
          </span>
        </div>
        <p className="font-mono text-subtle-ash mb-1" style={{ fontSize: "13px" }}>
          is_this_safe() — live on Mantle
        </p>
        <p className="font-mono text-subtle-ash mb-6" style={{ fontSize: "11px", maxWidth: 360, lineHeight: 1.5 }}>
          Read a smart-contract verdict straight from the on-chain registry. Pick an example or paste a code hash.
        </p>

        <SafetyOracle />

        <div className="mt-8 flex flex-col items-center gap-1">
          <span className="font-mono text-subtle-ash" style={{ fontSize: "11px" }}>
            Audited against 98 exploit patterns · $7.1B losses · 2020-2026
          </span>
          <a
            href="https://tryanneal.xyz"
            target="_blank"
            rel="noreferrer"
            className="font-mono underline"
            style={{ fontSize: "11px", color: "var(--color-ultraviolet-blue)" }}
          >
            tryanneal.xyz ↗
          </a>
        </div>
      </div>
    </main>
  );
}
