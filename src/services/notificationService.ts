export const NOTIFICATION_KEY = 'catatuang_notifications_enabled';

export const requestNotificationPermission = async (): Promise<boolean> => {
  if (!('Notification' in window)) {
    console.error('Browser ini tidak mendukung notifikasi.');
    return false;
  }

  if (Notification.permission === 'granted') {
    return true;
  }

  if (Notification.permission !== 'denied') {
    const permission = await Notification.requestPermission();
    return permission === 'granted';
  }

  return false;
};

export const sendLocalNotification = (title: string, body: string) => {
  if (Notification.permission === 'granted') {
    const notification = new Notification(title, {
      body,
      icon: '/favicon.ico', // Pastikan icon tersedia
    });

    notification.onclick = () => {
      window.focus();
      notification.close();
    };
  }
};

export const checkAndNotify = (lastTransactionDate: Date | null) => {
  const isEnabled = localStorage.getItem(NOTIFICATION_KEY) === 'true';
  if (!isEnabled) return;

  if (!lastTransactionDate) {
    sendLocalNotification(
      'Ayo Mulai Mencatat!',
      'Anda belum pernah mencatat transaksi. Yuk mulai kelola keuangan Anda!'
    );
    return;
  }

  const now = new Date();
  const diffInHours = (now.getTime() - lastTransactionDate.getTime()) / (1000 * 60 * 60);

  if (diffInHours >= 24) {
    sendLocalNotification(
      'Pengingat CatatUang',
      'Sudah 24 jam Anda tidak mencatat transaksi. Jangan lupa catat pengeluaran hari ini ya!'
    );
  }
};
