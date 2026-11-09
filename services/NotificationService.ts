export class NotificationService {
  static async requestPermission() {
    if (!("Notification" in window)) return false;
    try {
      return (await Notification.requestPermission()) === "granted";
    } catch {
      return false;
    }
  }
  static show(title: string, body: string, tag?: string) {
    if (!("Notification" in window) || Notification.permission !== "granted") return;
    try {
      const notification = new Notification(title, { body, tag, icon: "/icon.svg" });
      notification.onclick = () => {
        window.focus();
        notification.close();
      };
    } catch {
      /* Mobile browsers may refuse page notifications; the Activity panel still has the event. */
    }
  }
}
