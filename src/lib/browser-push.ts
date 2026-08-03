export type BrowserPushState =
  | "unsupported"
  | "permission-required"
  | "permission-denied"
  | "ready"
  | "subscribed"
  | "unconfigured"
  | "signed-out"
  | "failed";

const BROWSER_PUSH_OPT_OUT_KEY = "fantasy-golf-push-opted-out";

function browserPushOptedOut() {
  try {
    return window.localStorage.getItem(BROWSER_PUSH_OPT_OUT_KEY) === "1";
  } catch {
    return false;
  }
}

function setBrowserPushOptedOut(value: boolean) {
  try {
    if (value) window.localStorage.setItem(BROWSER_PUSH_OPT_OUT_KEY, "1");
    else window.localStorage.removeItem(BROWSER_PUSH_OPT_OUT_KEY);
  } catch {
    // The subscription remains usable even when private storage is unavailable.
  }
}

export function browserPushSupported() {
  return (
    typeof window !== "undefined" &&
    "Notification" in window &&
    "serviceWorker" in navigator &&
    "PushManager" in window
  );
}

export async function readCurrentBrowserPushState(): Promise<BrowserPushState> {
  if (!browserPushSupported()) return "unsupported";
  if (window.Notification.permission === "denied") return "permission-denied";
  if (window.Notification.permission !== "granted") {
    return "permission-required";
  }
  if (browserPushOptedOut()) {
    return "ready";
  }

  try {
    const registration = await navigator.serviceWorker.getRegistration("/");
    const subscription = await registration?.pushManager.getSubscription();
    return subscription ? "subscribed" : "ready";
  } catch {
    return "failed";
  }
}

export async function syncCurrentBrowserPush(input?: {
  explicit?: boolean;
}): Promise<BrowserPushState> {
  if (!browserPushSupported()) return "unsupported";
  if (window.Notification.permission === "denied") return "permission-denied";
  if (window.Notification.permission !== "granted") {
    return "permission-required";
  }
  if (
    !input?.explicit &&
    browserPushOptedOut()
  ) {
    return "ready";
  }
  if (input?.explicit) {
    setBrowserPushOptedOut(false);
  }

  try {
    const registration = await navigator.serviceWorker.register("/sw-push.js", {
      scope: "/",
    });
    await navigator.serviceWorker.ready;

    let subscription = await registration.pushManager.getSubscription();
    if (!subscription) {
      const vapidResponse = await fetch("/api/push/vapid-key", {
        credentials: "same-origin",
      });
      if (vapidResponse.status === 404) return "unconfigured";
      if (!vapidResponse.ok) return "failed";
      const vapid = (await vapidResponse.json()) as { publicKey?: string };
      if (!vapid.publicKey) return "unconfigured";

      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: vapid.publicKey,
      });
    }

    const json = subscription.toJSON();
    if (!json.endpoint || !json.keys?.p256dh || !json.keys.auth) {
      return "failed";
    }

    const response = await fetch("/api/push/subscribe", {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        endpoint: json.endpoint,
        keys: {
          p256dh: json.keys.p256dh,
          auth: json.keys.auth,
        },
      }),
    });
    if (response.status === 401) return "signed-out";
    return response.ok ? "subscribed" : "failed";
  } catch {
    return "failed";
  }
}

export async function unsubscribeCurrentBrowserPush(): Promise<BrowserPushState> {
  if (!browserPushSupported()) return "unsupported";

  try {
    const registration = await navigator.serviceWorker.getRegistration("/");
    const subscription = await registration?.pushManager.getSubscription();
    if (!subscription) return "ready";

    const response = await fetch("/api/push/unsubscribe", {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ endpoint: subscription.endpoint }),
    });
    if (response.status === 401) return "signed-out";
    if (!response.ok) return "failed";

    await subscription.unsubscribe();
    setBrowserPushOptedOut(true);
    return "ready";
  } catch {
    return "failed";
  }
}
