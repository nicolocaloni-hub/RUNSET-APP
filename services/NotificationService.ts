
import { SetPoint, Location } from '../types';

const CHANNEL_NAME = 'runset_notifications';

export type AlertType = 'TRAFFICO' | 'IMPREVISTO' | 'PAUSA BENZINA';

export interface RunnerAlert {
  runnerName: string;
  type: AlertType;
  timestamp: number;
}

export interface LocationUpdate {
  runnerId: string;
  location: Location;
}

export class NotificationService {
  private static channel = new BroadcastChannel(CHANNEL_NAME);

  static async requestPermission(): Promise<boolean> {
    if (!('Notification' in window)) {
      console.warn('Questo browser non supporta le notifiche desktop');
      return false;
    }

    if (Notification.permission === 'granted') return true;
    
    const permission = await Notification.requestPermission();
    return permission === 'granted';
  }

  static sendSetNotification(set: SetPoint) {
    this.channel.postMessage({
      type: 'NEW_SET',
      set: set
    });
    this.showNativeNotification(`Nuovo Set: ${set.name}`, `Location: ${set.address}`);
  }

  static sendRunnerAlert(runnerName: string, alertType: AlertType) {
    const alert: RunnerAlert = {
      runnerName,
      type: alertType,
      timestamp: Date.now()
    };

    this.channel.postMessage({
      type: 'RUNNER_ALERT',
      alert: alert
    });
  }

  static sendLocationUpdate(runnerId: string, location: Location) {
    this.channel.postMessage({
      type: 'LOCATION_UPDATE',
      update: { runnerId, location }
    });
  }

  static showNativeNotification(title: string, body: string, tag?: string) {
    if (Notification.permission !== 'granted') return;

    const notification = new Notification(title, {
      body,
      icon: '/favicon.ico',
      tag: tag || 'runset-notif',
      badge: 'https://cdn-icons-png.flaticon.com/512/3710/3710274.png'
    });

    notification.onclick = () => {
      window.focus();
      notification.close();
    };
  }

  static listenForMessages(
    onNewSet: (set: SetPoint) => void,
    onAlert: (alert: RunnerAlert) => void,
    onLocationUpdate: (update: LocationUpdate) => void
  ) {
    this.channel.onmessage = (event) => {
      const { type, set, alert, update } = event.data;

      switch (type) {
        case 'NEW_SET':
          this.showNativeNotification(`Nuovo Set: ${set.name}`, `Location: ${set.address}`);
          onNewSet(set);
          break;
        case 'RUNNER_ALERT':
          const icon = alert.type === 'TRAFFICO' ? '🚦' : alert.type === 'IMPREVISTO' ? '❗' : '⛽';
          this.showNativeNotification(`${icon} ${alert.type} - ${alert.runnerName}`, `Ricevuto alert da ${alert.runnerName}`, 'runner-alert');
          onAlert(alert);
          break;
        case 'LOCATION_UPDATE':
          onLocationUpdate(update);
          break;
      }
    };
  }
}
