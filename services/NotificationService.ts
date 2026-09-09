export type AlertType = "TRAFFICO" | "IMPREVISTO" | "PAUSA BENZINA";
export class NotificationService {
  static async requestPermission() {
    if (!("Notification" in window)) return false;
    try {
      return (await Notification.requestPermission()) === "granted";
    } catch {
      return false;
    }
  }
  static showNativeNotification(title: string, body: string, tag?: string) {
    if (!("Notification" in window) || Notification.permission !== "granted")
      return;
    try {
      const n = new Notification(title, { body, tag, icon: "/icon.svg" });
      n.onclick = () => {
        window.focus();
        n.close();
      };
    } catch {
      /* The event remains available in the activity panel on mobile browsers. */
    }
  }
}
