import React, { useCallback, useEffect, useState } from "react";
import { UserPlus, X } from "lucide-react";
import { usePrefs } from "../lib/preferences";
import { actions, errorCode } from "../services/store";
import { field, fieldLabel, secondaryButton } from "./ui";

/** Production assistants: invite by email, see who has access, remove them. */
export default function StaffSection({ productionId }: { productionId: string }) {
  const { t, tError } = usePrefs();
  const [staff, setStaff] = useState<{ user_id: string; email: string; is_owner: boolean }[]>([]);
  const [pending, setPending] = useState<{ id: string; email: string }[]>([]);
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const [members, invites] = await Promise.all([actions.listStaff(productionId), actions.pendingStaff(productionId)]);
    setStaff(members);
    setPending(invites);
  }, [productionId]);

  useEffect(() => {
    load().catch((cause) => setStatus(tError(errorCode(cause))));
  }, [load, tError]);

  async function attempt(action: () => Promise<unknown>, success = "") {
    setBusy(true);
    setStatus("");
    try {
      await action();
      await load();
      setStatus(success);
    } catch (cause) {
      setStatus(tError(errorCode(cause)));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="space-y-3">
      <h3 className="font-mono text-[11px] font-semibold uppercase tracking-wider text-muted">{t("staff_title")}</h3>
      <p className="text-xs leading-relaxed text-muted">{t("staff_help")}</p>
      <ul className="space-y-1.5">
        {staff.map((member) => (
          <li key={member.user_id} className="flex items-center gap-2 rounded-xl bg-ground px-3 py-2.5 text-sm">
            <span className="min-w-0 flex-1 truncate">{member.email}</span>
            {member.is_owner ? (
              <span className="font-mono text-[11px] text-muted">{t("staff_owner")}</span>
            ) : (
              <button
                type="button"
                disabled={busy}
                onClick={() => void attempt(() => actions.removeStaff(productionId, member.user_id))}
                className="text-xs font-semibold text-red-700"
              >
                {t("staff_remove")}
              </button>
            )}
          </li>
        ))}
        {pending.map((invite) => (
          <li key={invite.id} className="flex items-center gap-2 rounded-xl border border-dashed border-line2 px-3 py-2.5 text-sm">
            <span className="min-w-0 flex-1">
              <span className="block truncate">{invite.email}</span>
              <span className="block text-[11px] text-muted">{t("staff_pending")}</span>
            </span>
            <button
              type="button"
              aria-label={t("staff_remove")}
              disabled={busy}
              onClick={() => void attempt(() => actions.cancelStaffInvite(invite.id))}
              className="rounded-lg p-1.5 text-muted hover:bg-ground"
            >
              <X size={16} />
            </button>
          </li>
        ))}
      </ul>
      <form
        className="flex items-end gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          const value = email.trim();
          if (!value) return;
          void attempt(async () => {
            await actions.inviteStaff(productionId, value);
            setEmail("");
          }, t("staff_invited", { email: value }));
        }}
      >
        <label className={fieldLabel + " flex-1"}>
          {t("staff_email")}
          <input
            type="email"
            required
            maxLength={254}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="off"
            className={field}
          />
        </label>
        <button type="submit" disabled={busy} className={secondaryButton}>
          <UserPlus size={18} />
          {t("staff_invite")}
        </button>
      </form>
      {status && (
        <p role="status" className="text-xs text-ink2">
          {status}
        </p>
      )}
    </section>
  );
}
