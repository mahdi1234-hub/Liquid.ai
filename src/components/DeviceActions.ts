/**
 * Real device actions that the AI agent can execute directly on the user's device
 * via browser Web APIs. No API keys needed -- these run entirely on-device.
 */

export interface ActionResult {
  success: boolean;
  action: string;
  data: string;
}

/**
 * Check if a user message is requesting a device action
 */
export function detectDeviceAction(msg: string): string | null {
  const lmsg = msg.toLowerCase();

  // Battery
  if (/\b(battery|charge|charging)\b/i.test(lmsg) && /\b(check|status|level|show|get|what)\b/i.test(lmsg)) return "battery";

  // Network/connectivity
  if (/\b(network|connection|online|offline|internet|wifi|connectivity)\b/i.test(lmsg) && /\b(check|status|show|get|what|am i)\b/i.test(lmsg)) return "network";

  // Device/system info
  if (/\b(device|system|hardware|specs?|info|computer|phone|tablet)\b/i.test(lmsg) && /\b(info|details|check|show|get|what|my)\b/i.test(lmsg)) return "deviceInfo";

  // Screen info
  if (/\b(screen|display|resolution|monitor)\b/i.test(lmsg) && /\b(info|size|resolution|check|show|get|what)\b/i.test(lmsg)) return "screen";

  // Location/GPS
  if (/\b(location|gps|where\s+am\s+i|my\s+location|coordinates|position)\b/i.test(lmsg)) return "location";

  // Clipboard
  if (/\b(clipboard|copy|paste)\b/i.test(lmsg) && /\b(read|check|show|get|what)\b/i.test(lmsg)) return "clipboard";

  // Notifications
  if (/\b(notification|notify|alert|remind)\b/i.test(lmsg) && /\b(send|show|create|test|push)\b/i.test(lmsg)) return "notification";

  // Dark mode
  if (/\b(dark\s*mode|light\s*mode|theme|color\s*scheme)\b/i.test(lmsg)) return "theme";

  // Storage
  if (/\b(storage|disk|space|memory)\b/i.test(lmsg) && /\b(check|status|how\s+much|available|used|free)\b/i.test(lmsg)) return "storage";

  // Time/date
  if (/\b(time|date|timezone|clock|day|today)\b/i.test(lmsg) && /\b(what|current|check|show|get|now)\b/i.test(lmsg)) return "datetime";

  // Language/locale
  if (/\b(language|locale|region|country)\b/i.test(lmsg) && /\b(what|check|show|get|my|device)\b/i.test(lmsg)) return "locale";

  // Camera
  if (/\b(camera|photo|picture|selfie|webcam)\b/i.test(lmsg) && /\b(take|capture|open|snap|test)\b/i.test(lmsg)) return "camera";

  // Microphone
  if (/\b(microphone|mic|audio|record|voice)\b/i.test(lmsg) && /\b(test|check|record|capture|open)\b/i.test(lmsg)) return "microphone";

  // Speech/TTS
  if (/\b(speak|say|read\s+aloud|text.to.speech|tts|voice)\b/i.test(lmsg) && /\b(this|that|it|out|loud)\b/i.test(lmsg)) return "speak";

  // Vibrate
  if (/\b(vibrate|vibration|haptic)\b/i.test(lmsg)) return "vibrate";

  // Fullscreen
  if (/\b(fullscreen|full\s+screen)\b/i.test(lmsg)) return "fullscreen";

  // Share
  if (/\b(share|send)\b/i.test(lmsg) && /\b(this|page|link|url)\b/i.test(lmsg)) return "share";

  // Download
  if (/\b(download|save|export)\b/i.test(lmsg) && /\b(chat|conversation|history|log)\b/i.test(lmsg)) return "downloadChat";

  return null;
}

/**
 * Execute a device action and return the result
 */
export async function executeDeviceAction(action: string, context?: string): Promise<ActionResult> {
  switch (action) {
    case "battery":
      return await getBatteryStatus();
    case "network":
      return getNetworkStatus();
    case "deviceInfo":
      return getDeviceDetails();
    case "screen":
      return getScreenInfo();
    case "location":
      return await getLocation();
    case "clipboard":
      return await readClipboard();
    case "notification":
      return await sendNotification(context);
    case "theme":
      return getThemeInfo();
    case "storage":
      return await getStorageInfo();
    case "datetime":
      return getDateTime();
    case "locale":
      return getLocaleInfo();
    case "camera":
      return await testCamera();
    case "microphone":
      return await testMicrophone();
    case "speak":
      return speakText(context || "Hello, I am your private assistant.");
    case "vibrate":
      return vibrateDevice();
    case "fullscreen":
      return toggleFullscreen();
    case "share":
      return await shareContent();
    case "downloadChat":
      return { success: true, action: "downloadChat", data: "DOWNLOAD_CHAT" };
    default:
      return { success: false, action, data: "Unknown action" };
  }
}

// --- Action Implementations ---

async function getBatteryStatus(): Promise<ActionResult> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const nav = navigator as any;
    if (nav.getBattery) {
      const battery = await nav.getBattery();
      const level = Math.round(battery.level * 100);
      const charging = battery.charging;
      const chargingTime = battery.chargingTime === Infinity ? "N/A" : `${Math.round(battery.chargingTime / 60)} min`;
      const dischargingTime = battery.dischargingTime === Infinity ? "N/A" : `${Math.round(battery.dischargingTime / 60)} min`;

      return {
        success: true,
        action: "battery",
        data: `**Battery Status (Live from your device)**\n\n- **Level:** ${level}%\n- **Charging:** ${charging ? "Yes" : "No"}\n- **Time to full:** ${chargingTime}\n- **Time remaining:** ${dischargingTime}\n- **Status bar:** ${"#".repeat(Math.round(level / 5))}${"_".repeat(20 - Math.round(level / 5))} ${level}%`
      };
    }
    return { success: false, action: "battery", data: "Battery API not available on this device/browser. Try Chrome on Android or laptop." };
  } catch (e) {
    return { success: false, action: "battery", data: `Battery check failed: ${e}` };
  }
}

function getNetworkStatus(): ActionResult {
  const online = navigator.onLine;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const conn = (navigator as any).connection;

  let details = `**Network Status (Live)**\n\n- **Online:** ${online ? "Yes" : "No"}`;

  if (conn) {
    details += `\n- **Connection Type:** ${conn.effectiveType || "Unknown"}`;
    details += `\n- **Downlink:** ${conn.downlink || "Unknown"} Mbps`;
    details += `\n- **RTT:** ${conn.rtt || "Unknown"} ms`;
    details += `\n- **Save Data:** ${conn.saveData ? "Enabled" : "Disabled"}`;
  }

  return { success: true, action: "network", data: details };
}

function getDeviceDetails(): ActionResult {
  const ua = navigator.userAgent;
  const platform = navigator.platform;
  const language = navigator.language;
  const cores = navigator.hardwareConcurrency || "Unknown";
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const memory = (navigator as any).deviceMemory || "Unknown";
  const touchPoints = navigator.maxTouchPoints;

  let os = "Unknown";
  if (/Windows/i.test(ua)) os = "Windows";
  else if (/Mac/i.test(ua)) os = "macOS";
  else if (/Linux/i.test(ua) && !/Android/i.test(ua)) os = "Linux";
  else if (/Android/i.test(ua)) os = "Android";
  else if (/iPhone|iPad|iPod/i.test(ua)) os = "iOS";
  else if (/CrOS/i.test(ua)) os = "ChromeOS";

  let browser = "Unknown";
  if (/Chrome/i.test(ua) && !/Edge/i.test(ua)) browser = "Chrome";
  else if (/Firefox/i.test(ua)) browser = "Firefox";
  else if (/Safari/i.test(ua) && !/Chrome/i.test(ua)) browser = "Safari";
  else if (/Edge/i.test(ua)) browser = "Edge";

  const deviceType = touchPoints > 0 && window.innerWidth < 768 ? "Mobile" : touchPoints > 0 ? "Tablet/Touchscreen" : "Desktop";

  return {
    success: true,
    action: "deviceInfo",
    data: `**Device Information (Live from your device)**\n\n- **OS:** ${os}\n- **Browser:** ${browser}\n- **Platform:** ${platform}\n- **Device Type:** ${deviceType}\n- **CPU Cores:** ${cores}\n- **RAM:** ${memory !== "Unknown" ? memory + " GB" : "Not reported"}\n- **Touch Points:** ${touchPoints}\n- **Language:** ${language}\n- **Screen:** ${window.screen.width}x${window.screen.height}\n- **Window:** ${window.innerWidth}x${window.innerHeight}\n- **Pixel Ratio:** ${window.devicePixelRatio}x\n- **Cookies Enabled:** ${navigator.cookieEnabled}\n- **Do Not Track:** ${navigator.doNotTrack || "Not set"}`
  };
}

function getScreenInfo(): ActionResult {
  const s = window.screen;
  return {
    success: true,
    action: "screen",
    data: `**Screen Information (Live)**\n\n- **Resolution:** ${s.width}x${s.height}\n- **Available:** ${s.availWidth}x${s.availHeight}\n- **Color Depth:** ${s.colorDepth}-bit\n- **Pixel Ratio:** ${window.devicePixelRatio}x\n- **Orientation:** ${s.orientation?.type || "Unknown"}\n- **Window Size:** ${window.innerWidth}x${window.innerHeight}`
  };
}

async function getLocation(): Promise<ActionResult> {
  return new Promise((resolve) => {
    if (!navigator.geolocation) {
      resolve({ success: false, action: "location", data: "Geolocation not available on this device." });
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        resolve({
          success: true,
          action: "location",
          data: `**Your Location (Live GPS)**\n\n- **Latitude:** ${pos.coords.latitude.toFixed(6)}\n- **Longitude:** ${pos.coords.longitude.toFixed(6)}\n- **Accuracy:** ${Math.round(pos.coords.accuracy)}m\n- **Altitude:** ${pos.coords.altitude ? pos.coords.altitude.toFixed(1) + "m" : "N/A"}\n- **Speed:** ${pos.coords.speed ? pos.coords.speed.toFixed(1) + " m/s" : "N/A"}\n\n[View on Google Maps](https://www.google.com/maps?q=${pos.coords.latitude},${pos.coords.longitude})`
        });
      },
      (err) => {
        resolve({ success: false, action: "location", data: `Location access denied or unavailable: ${err.message}. Please allow location access in your browser settings.` });
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  });
}

async function readClipboard(): Promise<ActionResult> {
  try {
    const text = await navigator.clipboard.readText();
    return {
      success: true,
      action: "clipboard",
      data: `**Clipboard Contents:**\n\n\`\`\`\n${text.substring(0, 500)}${text.length > 500 ? "..." : ""}\n\`\`\`\n\n(${text.length} characters)`
    };
  } catch {
    return { success: false, action: "clipboard", data: "Clipboard access denied. Click on the page first, then try again." };
  }
}

async function sendNotification(text?: string): Promise<ActionResult> {
  try {
    const permission = await Notification.requestPermission();
    if (permission === "granted") {
      new Notification("NOVERA Agent", {
        body: text || "This is a test notification from your AI agent!",
        icon: "/favicon.ico",
      });
      return { success: true, action: "notification", data: "Notification sent successfully! Check your device notifications." };
    }
    return { success: false, action: "notification", data: `Notification permission: ${permission}. Please allow notifications in browser settings.` };
  } catch {
    return { success: false, action: "notification", data: "Notifications not supported on this device/browser." };
  }
}

function getThemeInfo(): ActionResult {
  const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
  const prefersLight = window.matchMedia("(prefers-color-scheme: light)").matches;
  const prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const prefersContrast = window.matchMedia("(prefers-contrast: high)").matches;

  return {
    success: true,
    action: "theme",
    data: `**Device Theme Preferences (Live)**\n\n- **Color Scheme:** ${prefersDark ? "Dark Mode" : prefersLight ? "Light Mode" : "No preference"}\n- **Reduced Motion:** ${prefersReduced ? "Enabled" : "Disabled"}\n- **High Contrast:** ${prefersContrast ? "Enabled" : "Disabled"}`
  };
}

async function getStorageInfo(): Promise<ActionResult> {
  try {
    if (navigator.storage && navigator.storage.estimate) {
      const estimate = await navigator.storage.estimate();
      const used = estimate.usage || 0;
      const total = estimate.quota || 0;
      const free = total - used;

      const fmt = (bytes: number) => {
        if (bytes >= 1_073_741_824) return (bytes / 1_073_741_824).toFixed(2) + " GB";
        if (bytes >= 1_048_576) return (bytes / 1_048_576).toFixed(2) + " MB";
        return (bytes / 1024).toFixed(2) + " KB";
      };

      return {
        success: true,
        action: "storage",
        data: `**Browser Storage Status (Live)**\n\n- **Total Quota:** ${fmt(total)}\n- **Used:** ${fmt(used)}\n- **Available:** ${fmt(free)}\n- **Usage:** ${total > 0 ? Math.round((used / total) * 100) : 0}%\n\n*Note: This shows browser storage quota, not full disk space.*`
      };
    }
    return { success: false, action: "storage", data: "Storage API not available." };
  } catch {
    return { success: false, action: "storage", data: "Storage check failed." };
  }
}

function getDateTime(): ActionResult {
  const now = new Date();
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const locale = navigator.language;

  return {
    success: true,
    action: "datetime",
    data: `**Current Date & Time (Live from your device)**\n\n- **Date:** ${now.toLocaleDateString(locale, { weekday: "long", year: "numeric", month: "long", day: "numeric" })}\n- **Time:** ${now.toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit", second: "2-digit" })}\n- **Timezone:** ${tz}\n- **UTC Offset:** UTC${now.getTimezoneOffset() > 0 ? "-" : "+"}${Math.abs(now.getTimezoneOffset() / 60)}\n- **Unix Timestamp:** ${Math.floor(now.getTime() / 1000)}\n- **ISO 8601:** ${now.toISOString()}`
  };
}

function getLocaleInfo(): ActionResult {
  const locale = navigator.language;
  const languages = navigator.languages.join(", ");
  const rtf = new Intl.RelativeTimeFormat(locale).resolvedOptions();

  return {
    success: true,
    action: "locale",
    data: `**Locale Information (Live)**\n\n- **Primary Language:** ${locale}\n- **All Languages:** ${languages}\n- **Number Format:** ${new Intl.NumberFormat(locale).format(1234567.89)}\n- **Currency (USD):** ${new Intl.NumberFormat(locale, { style: "currency", currency: "USD" }).format(1234.56)}\n- **Date Format:** ${new Intl.DateTimeFormat(locale).format(new Date())}\n- **Numbering System:** ${rtf.numberingSystem}`
  };
}

async function testCamera(): Promise<ActionResult> {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ video: true });
    const tracks = stream.getVideoTracks();
    const info = tracks[0]?.getSettings();
    tracks.forEach(t => t.stop()); // Stop immediately

    return {
      success: true,
      action: "camera",
      data: `**Camera Access (Live)**\n\n- **Status:** Camera accessible\n- **Resolution:** ${info?.width}x${info?.height}\n- **Frame Rate:** ${info?.frameRate} fps\n- **Facing:** ${info?.facingMode || "Unknown"}\n- **Device:** ${tracks[0]?.label || "Default camera"}\n\n*Camera was tested and released. No recording was made.*`
    };
  } catch (e) {
    return { success: false, action: "camera", data: `Camera access denied or unavailable: ${e}. Allow camera permission in browser settings.` };
  }
}

async function testMicrophone(): Promise<ActionResult> {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const tracks = stream.getAudioTracks();
    tracks.forEach(t => t.stop());

    return {
      success: true,
      action: "microphone",
      data: `**Microphone Access (Live)**\n\n- **Status:** Microphone accessible\n- **Device:** ${tracks[0]?.label || "Default microphone"}\n\n*Microphone was tested and released. No recording was made.*`
    };
  } catch (e) {
    return { success: false, action: "microphone", data: `Microphone access denied: ${e}. Allow microphone permission in browser settings.` };
  }
}

function speakText(text: string): ActionResult {
  try {
    if ("speechSynthesis" in window) {
      const utterance = new SpeechSynthesisUtterance(text.substring(0, 500));
      utterance.rate = 1;
      utterance.pitch = 1;
      window.speechSynthesis.speak(utterance);
      return { success: true, action: "speak", data: `Speaking: "${text.substring(0, 100)}${text.length > 100 ? "..." : ""}"` };
    }
    return { success: false, action: "speak", data: "Text-to-speech not available on this device." };
  } catch {
    return { success: false, action: "speak", data: "Speech synthesis failed." };
  }
}

function vibrateDevice(): ActionResult {
  try {
    if ("vibrate" in navigator) {
      navigator.vibrate([200, 100, 200]);
      return { success: true, action: "vibrate", data: "Device vibrated! (200ms - pause - 200ms pattern)" };
    }
    return { success: false, action: "vibrate", data: "Vibration not available on this device (desktop browsers typically don't support it)." };
  } catch {
    return { success: false, action: "vibrate", data: "Vibration failed." };
  }
}

function toggleFullscreen(): ActionResult {
  try {
    if (document.fullscreenElement) {
      document.exitFullscreen();
      return { success: true, action: "fullscreen", data: "Exited fullscreen mode." };
    } else {
      document.documentElement.requestFullscreen();
      return { success: true, action: "fullscreen", data: "Entered fullscreen mode. Press Escape to exit." };
    }
  } catch {
    return { success: false, action: "fullscreen", data: "Fullscreen not available." };
  }
}

async function shareContent(): Promise<ActionResult> {
  try {
    if (navigator.share) {
      await navigator.share({
        title: "NOVERA AI Agent",
        text: "Check out this AI agent!",
        url: window.location.href,
      });
      return { success: true, action: "share", data: "Shared successfully!" };
    }
    // Fallback: copy URL to clipboard
    await navigator.clipboard.writeText(window.location.href);
    return { success: true, action: "share", data: `URL copied to clipboard: ${window.location.href}` };
  } catch {
    return { success: false, action: "share", data: "Share cancelled or not available." };
  }
}
