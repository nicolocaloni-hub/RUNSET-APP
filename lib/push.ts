import { actions } from "../services/store";

// The Edge Function hands out the public VAPID key; the private one never leaves Supabase.
const PUBLIC_KEY_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/push`;

export const pushSupported = () =>
  typeof navigator !== "undefined" && "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;

async function currentSubscription() {
  const registration = await navigator.serviceWorker.getRegistration("/sw.js");
  return (await registration?.pushManager.getSubscription()) ?? null;
}

export async function pushEnabled(): Promise<boolean> {
  return pushSupported() && Notification.permission === "granted" && (await currentSubscription()) !== null;
}

function keyBytes(base64url: string): Uint8Array {
  const base64 = (base64url + "=".repeat((4 - (base64url.length % 4)) % 4)).replace(/-/g, "+").replace(/_/g, "/");
  return Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
}

/** Asks permission, subscribes this browser and saves the subscription for the signed-in producer. */
export async function enablePush(language: string): Promise<"on" | "denied" | "unsupported"> {
  if (!pushSupported()) return "unsupported";
  if ((await Notification.requestPermission()) !== "granted") return "denied";
  await navigator.serviceWorker.register("/sw.js");
  const registration = await navigator.serviceWorker.ready;
  let subscription = await registration.pushManager.getSubscription();
  if (!subscription) {
    const { publicKey } = (await (await fetch(PUBLIC_KEY_URL)).json()) as { publicKey?: string };
    if (!publicKey) throw new Error("network");
    subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: keyBytes(publicKey) as BufferSource,
    });
  }
  const { keys } = subscription.toJSON();
  await actions.savePushSubscription(subscription.endpoint, keys?.p256dh ?? "", keys?.auth ?? "", language);
  return "on";
}

export async function disablePush() {
  const subscription = await currentSubscription();
  if (!subscription) return;
  await actions.deletePushSubscription(subscription.endpoint).catch(() => undefined);
  await subscription.unsubscribe();
}
