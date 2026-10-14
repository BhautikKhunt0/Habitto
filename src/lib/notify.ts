/**
 * Desktop notifications for the focus timer.
 *
 * A timer that finishes in a background tab has no way to tell you through the
 * page itself — the browser notification is the only channel that reaches the
 * user when they're somewhere else. Permission can only be requested from a real
 * user gesture, so `request()` is called from a button, never on mount.
 */

export type NotifyPermission = "unsupported" | "default" | "granted" | "denied";

function supported(): boolean {
  return typeof window !== "undefined" && "Notification" in window;
}

export function notificationPermission(): NotifyPermission {
  if (!supported()) return "unsupported";
  return Notification.permission as NotifyPermission;
}

/** Must be called from a click handler or it will be silently rejected. */
export async function requestNotificationPermission(): Promise<NotifyPermission> {
  if (!supported()) return "unsupported";
  try {
    return (await Notification.requestPermission()) as NotifyPermission;
  } catch {
    return notificationPermission();
  }
}

/**
 * Fire a desktop alert. Returns whether one was actually shown, so callers can
 * fall back to in-page messaging when alerts are off or blocked.
 */
export function notify(title: string, body?: string, tag = "habitto-focus"): boolean {
  if (notificationPermission() !== "granted") return false;
  try {
    // A stable tag means a repeat replaces the old alert instead of stacking.
    new Notification(title, { body, tag });
    return true;
  } catch {
    return false;
  }
}