export const naira = (n: number) => `₦${n.toLocaleString("en-US")}`;

// Spending shows as −₦800, money in as +₦500 (a real minus sign, not a hyphen)
export const signedNaira = (n: number) => `${n < 0 ? "−" : "+"}${naira(Math.abs(n))}`;

export function formatData(mb: number): string {
  if (mb >= 1024) return `${Number((mb / 1024).toFixed(2))} GB`;
  return `${mb} MB`;
}

// The database stores UTC times like "2026-10-29 11:32:55" (or ISO strings with a T)
export function parseDbTime(s: string): Date {
  return new Date(s.includes("T") ? s : s.replace(" ", "T") + "Z");
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

// plan_expires_at looks like "05 Nov 2026, 13:07 UTC"
export function parsePlanExpiry(s: string | null): Date | null {
  if (!s) return null;
  const m = /^(\d{1,2}) ([A-Za-z]{3}) (\d{4}), (\d{2}):(\d{2}) UTC$/.exec(s.trim());
  if (!m) return null;
  const month = MONTHS.indexOf(m[2]);
  if (month < 0) return null;
  return new Date(Date.UTC(Number(m[3]), month, Number(m[1]), Number(m[4]), Number(m[5])));
}

export function timeLeft(expires: Date, now: Date) {
  const ms = expires.getTime() - now.getTime();
  if (ms <= 0) return { expired: true, ms: 0, days: 0, hours: 0 };
  const totalHours = Math.floor(ms / 3_600_000);
  return { expired: false, ms, days: Math.floor(totalHours / 24), hours: totalHours % 24 };
}

export function describeTimeLeft(t: ReturnType<typeof timeLeft>): string {
  if (t.expired) return "Expired";
  if (t.days > 0) return `${t.days} day${t.days > 1 ? "s" : ""} ${t.hours} hr left`;
  if (t.hours > 0) return `${t.hours} hr left`;
  return "Less than an hour left";
}

export function formatStamp(d: Date): string {
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", hour12: false,
  }).format(d);
}

export function formatExpiry(d: Date): string {
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", hour12: false,
  }).format(d);
}

export function formatDay(d: Date, now: Date): string {
  const sameDay = (a: Date, b: Date) =>
    a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (sameDay(d, now)) return "Today";
  if (sameDay(d, yesterday)) return "Yesterday";
  return new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "long" }).format(d);
}

export function greeting(now: Date | null): string {
  if (!now) return "Welcome back";
  const h = now.getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

export function mmss(total: number): string {
  const s = Math.max(0, Math.floor(total));
  return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
}

export function initialFor(email: string): string {
  return (email.trim()[0] ?? "?").toUpperCase();
}
