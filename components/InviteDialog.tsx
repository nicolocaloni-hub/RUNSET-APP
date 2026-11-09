import React, { useState } from "react";
import { Copy, MessageCircle, Share2, X } from "lucide-react";
import { usePrefs } from "../lib/preferences";
import { primaryButton, secondaryButton } from "./ui";

/** Shown once after creating an invite: the token is never stored in clear. */
export default function InviteDialog({
  name,
  token,
  productionName,
  onClose,
}: {
  name: string;
  token: string;
  productionName: string;
  onClose: () => void;
}) {
  const { t } = usePrefs();
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState("");
  // The token travels in the URL fragment, which browsers never send to servers or in Referer.
  const link = `${window.location.origin}/#invito=${token}`;
  const message = t("invite_message", { name, production: productionName, link });
  const canShare = typeof navigator.share === "function";

  return (
    <div className="fixed inset-0 z-[4000] flex items-center justify-center bg-ink/40 p-5">
      <section
        role="dialog"
        aria-modal="true"
        aria-label={t("invite_title", { name })}
        className="w-full max-w-md space-y-4 rounded-2xl border border-line2 bg-ground p-5"
      >
        <div className="flex justify-between gap-3">
          <h2 className="text-xl font-bold">{t("invite_title", { name })}</h2>
          <button type="button" aria-label={t("close")} onClick={onClose}>
            <X size={22} />
          </button>
        </div>
        <p className="text-sm text-muted">{t("invite_text", { name })}</p>
        <input
          readOnly
          value={link}
          onFocus={(e) => e.currentTarget.select()}
          aria-label={t("invite_copy")}
          className="w-full rounded-xl border border-line2 bg-white px-3 py-2.5 font-mono text-xs"
        />
        <div className="grid gap-2">
          {canShare && (
            <button
              type="button"
              onClick={() => void navigator.share({ text: message }).catch(() => {})}
              className={primaryButton}
            >
              <Share2 size={18} />
              {t("invite_share")}
            </button>
          )}
          <a
            href={`https://wa.me/?text=${encodeURIComponent(message)}`}
            target="_blank"
            rel="noopener noreferrer"
            className={canShare ? secondaryButton : primaryButton}
          >
            <MessageCircle size={18} />
            {t("invite_whatsapp")}
          </a>
          <button
            type="button"
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(message);
                setCopied(true);
              } catch {
                setError(t("copy_manual"));
              }
            }}
            className={secondaryButton}
          >
            <Copy size={18} />
            {copied ? t("copied") : t("invite_copy")}
          </button>
        </div>
        {error && <p className="text-xs text-red-700">{error}</p>}
        <p className="text-xs text-muted">{t("invite_once")}</p>
      </section>
    </div>
  );
}
