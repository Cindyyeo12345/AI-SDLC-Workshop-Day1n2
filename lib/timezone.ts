export const SINGAPORE_TIMEZONE = 'Asia/Singapore';

export function getSingaporeNow(): Date {
  return new Date(new Date().toLocaleString('en-US', { timeZone: SINGAPORE_TIMEZONE }));
}

export function formatSingaporeDate(date: Date | string, fmt?: string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  const options: Intl.DateTimeFormatOptions = fmt === 'dd MMM yyyy'
    ? { day: '2-digit', month: 'short', year: 'numeric', timeZone: SINGAPORE_TIMEZONE }
    : { day: '2-digit', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true, timeZone: SINGAPORE_TIMEZONE };
  return d.toLocaleString('en-SG', options);
}

export function isOverdue(dueDate: string): boolean {
  return new Date(dueDate) < getSingaporeNow();
}

export function isDueToday(dueDate: string): boolean {
  const due = new Date(new Date(dueDate).toLocaleString('en-US', { timeZone: SINGAPORE_TIMEZONE }));
  const now = getSingaporeNow();
  return due.getFullYear() === now.getFullYear()
    && due.getMonth() === now.getMonth()
    && due.getDate() === now.getDate();
}

export function isDueThisWeek(dueDate: string): boolean {
  const due = new Date(dueDate);
  const now = getSingaporeNow();
  const weekFromNow = new Date(now);
  weekFromNow.setDate(now.getDate() + 7);
  return due > now && due <= weekFromNow;
}
