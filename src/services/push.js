// Browser side of push reminders: permission, the device's push subscription,
// and telling the server about it. Everything fails soft; a reminder feature
// must never get in the way of making picks.

import * as api from './api';

const PUBLIC_KEY = import.meta.env?.VITE_VAPID_PUBLIC_KEY;

export const pushConfigured = () => Boolean(PUBLIC_KEY);

export const pushSupported = () =>
  typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;

export const isIOS = () => /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
export const isStandalone = () =>
  window.matchMedia?.('(display-mode: standalone)').matches || window.navigator.standalone === true;

function keyBytes(base64) {
  const pad = '='.repeat((4 - (base64.length % 4)) % 4);
  const raw = atob((base64 + pad).replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

async function registration() {
  const reg = await navigator.serviceWorker.register('/sw.js');
  await navigator.serviceWorker.ready;
  return reg;
}

/** True when this device is subscribed AND the server knows it for this login. */
export async function isEnabled(token) {
  try {
    if (!pushSupported() || Notification.permission !== 'granted') return false;
    const reg = await navigator.serviceWorker.getRegistration('/sw.js');
    const sub = await reg?.pushManager.getSubscription();
    return sub ? Boolean(await api.pushStatus(token, sub.endpoint)) : false;
  } catch {
    return false;
  }
}

/** Returns 'enabled' | 'denied' | 'error'. */
export async function enablePush(token) {
  try {
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') return 'denied';
    const reg = await registration();
    const sub = (await reg.pushManager.getSubscription())
      || (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(PUBLIC_KEY) }));
    const json = sub.toJSON();
    await api.pushSave(token, json.endpoint, json.keys.p256dh, json.keys.auth);
    return 'enabled';
  } catch {
    return 'error';
  }
}

export async function disablePush(token) {
  try {
    const reg = await navigator.serviceWorker.getRegistration('/sw.js');
    const sub = await reg?.pushManager.getSubscription();
    if (sub) {
      await api.pushRemove(token, sub.endpoint);
      await sub.unsubscribe();
    }
    return true;
  } catch {
    return false;
  }
}
