/**
 * Utility functions for campaign scheduling and live countdown calculations with timezone support.
 */

export interface ScheduleStatus {
  status: 'active' | 'waiting' | 'ended_today' | 'off_day' | 'paused';
  badgeColor: string;
  badgeText: string;
  subtext: string;
  countdownFormatted: string | null;
  secondsUntilStart: number | null;
  timezone: string;
  currentTimeInTz: string;
}

/**
 * Gets the user's local browser timezone (e.g., "America/Sao_Paulo")
 */
export function getUserLocalTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'America/Sao_Paulo';
  } catch {
    return 'America/Sao_Paulo';
  }
}

/**
 * Common Brazilian and Latin American timezones for convenience
 */
export const COMMON_TIMEZONES = [
  { value: 'America/Sao_Paulo', label: 'Brasília / São Paulo (GMT-3)' },
  { value: 'America/Fortaleza', label: 'Nordeste / Fortaleza (GMT-3)' },
  { value: 'America/Manaus', label: 'Amazonas / Manaus (GMT-4)' },
  { value: 'America/Cuiaba', label: 'Mato Grosso / Cuiabá (GMT-4)' },
  { value: 'America/Rio_Branco', label: 'Acre / Rio Branco (GMT-5)' },
  { value: 'America/Noronha', label: 'Fernando de Noronha (GMT-2)' },
  { value: 'UTC', label: 'UTC (Universal / Termux Default)' },
];

/**
 * Calculates real-time schedule status and exact countdown until campaign start.
 */
export function calculateCampaignScheduleStatus(
  schedule: { startHour?: string; endHour?: string; days?: number[]; timezone?: string } | undefined,
  enabled: boolean
): ScheduleStatus {
  const userTz = getUserLocalTimezone();
  const tz = schedule?.timezone || userTz;

  if (!enabled) {
    return {
      status: 'paused',
      badgeColor: 'bg-stone-800 text-stone-400 border-stone-700',
      badgeText: '⏸️ Pausada',
      subtext: 'Esta campanha está pausada e não realizará disparos.',
      countdownFormatted: null,
      secondsUntilStart: null,
      timezone: tz,
      currentTimeInTz: getCurrentTimeInTimezone(tz),
    };
  }

  const startHourStr = schedule?.startHour || '09:00';
  const endHourStr = schedule?.endHour || '21:00';
  const allowedDays = schedule?.days && schedule.days.length > 0 ? schedule.days : [0, 1, 2, 3, 4, 5, 6];

  const now = new Date();

  // Get current time components in the specified timezone
  let parts: Record<string, string> = {};
  try {
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: tz,
      year: 'numeric',
      month: 'numeric',
      day: 'numeric',
      hour: 'numeric',
      minute: 'numeric',
      second: 'numeric',
      weekday: 'short',
      hour12: false,
    });
    formatter.formatToParts(now).forEach((p) => {
      parts[p.type] = p.value;
    });
  } catch {
    // Fallback if timezone string is invalid
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/Sao_Paulo',
      year: 'numeric',
      month: 'numeric',
      day: 'numeric',
      hour: 'numeric',
      minute: 'numeric',
      second: 'numeric',
      weekday: 'short',
      hour12: false,
    });
    formatter.formatToParts(now).forEach((p) => {
      parts[p.type] = p.value;
    });
  }

  const currentHour = parseInt(parts.hour || '0', 10) % 24;
  const currentMinute = parseInt(parts.minute || '0', 10);
  const currentSecond = parseInt(parts.second || '0', 10);

  // Parse start & end times
  const [startH, startM] = startHourStr.split(':').map(Number);
  const [endH, endM] = endHourStr.split(':').map(Number);

  const currentSecsOfDay = currentHour * 3600 + currentMinute * 60 + currentSecond;
  const startSecsOfDay = startH * 3600 + (startM || 0) * 60;
  const endSecsOfDay = endH * 3600 + (endM || 0) * 60;

  // Day of week in target timezone
  // We can convert date string in target timezone to day index
  const dayOfWeekMap: Record<string, number> = {
    Sun: 0,
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6,
  };
  const currentDayIndex = dayOfWeekMap[parts.weekday] ?? now.getDay();
  const isTodayAllowed = allowedDays.includes(currentDayIndex);

  // Check if currently inside active window
  if (isTodayAllowed && currentSecsOfDay >= startSecsOfDay && currentSecsOfDay < endSecsOfDay) {
    const secsRemainingInWindow = endSecsOfDay - currentSecsOfDay;
    const h = Math.floor(secsRemainingInWindow / 3600);
    const m = Math.floor((secsRemainingInWindow % 3600) / 60);
    const s = secsRemainingInWindow % 60;

    const pad = (n: number) => String(n).padStart(2, '0');
    const remainingStr = h > 0 ? `${h}h ${pad(m)}m ${pad(s)}s` : `${pad(m)}m ${pad(s)}s`;

    return {
      status: 'active',
      badgeColor: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40 animate-pulse',
      badgeText: '🟢 Disparando Agora',
      subtext: `Janela ativa! Encerra às ${endHourStr} (restam ${remainingStr})`,
      countdownFormatted: null,
      secondsUntilStart: 0,
      timezone: tz,
      currentTimeInTz: `${pad(currentHour)}:${pad(currentMinute)}:${pad(currentSecond)}`,
    };
  }

  // Calculate seconds until next start
  let secondsUntilStart = 0;
  let nextStartLabel = '';

  if (isTodayAllowed && currentSecsOfDay < startSecsOfDay) {
    // Starts later today
    secondsUntilStart = startSecsOfDay - currentSecsOfDay;
    nextStartLabel = `Hoje às ${startHourStr}`;
  } else {
    // Find next allowed day
    let daysAhead = 1;
    while (daysAhead <= 7) {
      const candidateDayIndex = (currentDayIndex + daysAhead) % 7;
      if (allowedDays.includes(candidateDayIndex)) {
        break;
      }
      daysAhead++;
    }

    const dayNames = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
    const nextDayIndex = (currentDayIndex + daysAhead) % 7;
    const nextDayName = daysAhead === 1 ? 'Amanhã' : dayNames[nextDayIndex];

    const secondsLeftToday = 86400 - currentSecsOfDay;
    secondsUntilStart = secondsLeftToday + (daysAhead - 1) * 86400 + startSecsOfDay;
    nextStartLabel = `${nextDayName} às ${startHourStr}`;
  }

  // Format countdown hh:mm:ss or days
  const hours = Math.floor(secondsUntilStart / 3600);
  const minutes = Math.floor((secondsUntilStart % 3600) / 60);
  const seconds = secondsUntilStart % 60;

  const pad = (n: number) => String(n).padStart(2, '0');
  const countdownFormatted =
    hours >= 24
      ? `${Math.floor(hours / 24)}d ${pad(hours % 24)}h ${pad(minutes)}m`
      : `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;

  const isOffDay = !isTodayAllowed;
  const isEndedToday = isTodayAllowed && currentSecsOfDay >= endSecsOfDay;

  let badgeText = `⏰ Inicia em ${countdownFormatted}`;
  let badgeColor = 'bg-amber-500/20 text-amber-300 border-amber-500/40';

  if (isOffDay) {
    badgeColor = 'bg-blue-500/20 text-blue-300 border-blue-500/40';
  } else if (isEndedToday) {
    badgeColor = 'bg-blue-500/20 text-blue-300 border-blue-500/40';
  }

  return {
    status: isOffDay ? 'off_day' : isEndedToday ? 'ended_today' : 'waiting',
    badgeColor,
    badgeText,
    subtext: `Próximo disparo: ${nextStartLabel} (Fuso: ${tz})`,
    countdownFormatted,
    secondsUntilStart,
    timezone: tz,
    currentTimeInTz: `${pad(currentHour)}:${pad(currentMinute)}:${pad(currentSecond)}`,
  };
}

/**
 * Returns formatted time string HH:MM:SS for a given timezone
 */
export function getCurrentTimeInTimezone(tz: string): string {
  try {
    const now = new Date();
    return now.toLocaleTimeString('pt-BR', { timeZone: tz, hour12: false });
  } catch {
    return new Date().toLocaleTimeString('pt-BR', { hour12: false });
  }
}
