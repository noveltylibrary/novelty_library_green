import { supabase } from '@/lib/supabase';

/**
 * Sign-in device tracking (NL_SQL_230). After a sign-in (or the first page load of a browser session) the browser tells the
 * database which device/browser it is; the database decides whether it is new and, only the first time, notifies the reader.
 * Best-effort: any failure (SQL not run, offline) is ignored and never affects sign-in.
 */
const DEVICE_KEY = 'nl_device_id';

async function sha256(text: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

function deviceId(): string {
  try {
    let id = window.localStorage.getItem(DEVICE_KEY);
    if (!id) { id = crypto.randomUUID(); window.localStorage.setItem(DEVICE_KEY, id); }
    return id;
  } catch { return 'session-' + Math.random().toString(36).slice(2); }
}

export interface DeviceInfo { browser: string; os: string; deviceType: 'mobile' | 'tablet' | 'desktop'; label: string }

export function describeDevice(ua = typeof navigator !== 'undefined' ? navigator.userAgent : ''): DeviceInfo {
  const browser = /Edg\//.test(ua) ? 'Edge' : /OPR\/|Opera/.test(ua) ? 'Opera' : /SamsungBrowser/.test(ua) ? 'Samsung Internet' : /Firefox\//.test(ua) ? 'Firefox'
    : /Chrome\/|CriOS/.test(ua) ? 'Chrome' : /Safari\//.test(ua) ? 'Safari' : 'Browser';
  const os = /Windows/.test(ua) ? 'Windows' : /Android/.test(ua) ? 'Android' : /iPhone|iPad|iPod/.test(ua) ? 'iOS' : /Mac OS X|Macintosh/.test(ua) ? 'macOS' : /CrOS/.test(ua) ? 'ChromeOS' : /Linux/.test(ua) ? 'Linux' : 'Unknown OS';
  const deviceType = /iPad|Tablet/.test(ua) || (/Android/.test(ua) && !/Mobile/.test(ua)) ? 'tablet' : /Mobi|iPhone|Android/.test(ua) ? 'mobile' : 'desktop';
  return { browser, os, deviceType, label: `${browser} on ${os}` };
}

/** Call once per browser session per account. */
export async function recordLoginDevice(userId: string): Promise<void> {
  try {
    const flag = `nl_dev_logged_${userId}`;
    if (window.sessionStorage.getItem(flag)) return;
    window.sessionStorage.setItem(flag, '1');
    const d = describeDevice();
    const [hash, uaKey] = await Promise.all([sha256(deviceId()), sha256(`${d.browser}|${d.os}|${d.deviceType}`)]);
    let tz = ''; try { tz = Intl.DateTimeFormat().resolvedOptions().timeZone || ''; } catch { /* ignore */ }
    await supabase.rpc('record_login_device', {
      p_device_hash: hash, p_ua_key: uaKey, p_label: d.label, p_browser: d.browser, p_os: d.os, p_device_type: d.deviceType,
      p_language: navigator.language || '', p_timezone: tz, p_screen: `${window.screen?.width || 0}x${window.screen?.height || 0}`,
    });
  } catch { /* never block sign-in */ }
}

export interface LoginDevice { id: string; label: string | null; browser: string | null; os: string | null; device_type: string | null; country: string | null; first_seen: string; last_seen: string; seen_count: number }

export async function fetchMyLoginDevices(): Promise<LoginDevice[]> {
  const { data, error } = await supabase.from('user_login_devices').select('id,label,browser,os,device_type,country,first_seen,last_seen,seen_count').order('last_seen', { ascending: false }).limit(50);
  if (error) throw error;
  return (data ?? []) as LoginDevice[];
}
export async function removeMyLoginDevice(id: string): Promise<void> {
  const { error } = await supabase.rpc('remove_my_login_device', { p_id: id });
  if (error) throw error;
}
