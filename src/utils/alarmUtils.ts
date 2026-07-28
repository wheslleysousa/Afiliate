// Utilitário para gerenciamento do Alarme e Lembretes de Divulgação
// Suporta Web Audio API Beep, Notificações do Navegador e Validação de Janela de Horário

export interface AlarmSettings {
  enabled: boolean;
  intervalMinutes: number; // 5, 10, 15, 30, 60
  startHour: string;       // "08:00"
  endHour: string;         // "22:00"
  soundEnabled: boolean;
  lastTriggeredAt?: number;
}

const ALARM_STORAGE_KEY = 'affiliate_alarm_settings_v1';

export const DEFAULT_ALARM_SETTINGS: AlarmSettings = {
  enabled: false,
  intervalMinutes: 15,
  startHour: '08:00',
  endHour: '22:00',
  soundEnabled: true,
  lastTriggeredAt: 0,
};

/**
 * Lê as configurações de alarme do localStorage
 */
export function getAlarmSettings(): AlarmSettings {
  try {
    const raw = localStorage.getItem(ALARM_STORAGE_KEY);
    if (!raw) return DEFAULT_ALARM_SETTINGS;
    const parsed = JSON.parse(raw);
    return { ...DEFAULT_ALARM_SETTINGS, ...parsed };
  } catch (e) {
    console.error('Erro ao ler configurações de alarme:', e);
    return DEFAULT_ALARM_SETTINGS;
  }
}

/**
 * Salva as configurações de alarme no localStorage
 */
export function saveAlarmSettings(settings: AlarmSettings): AlarmSettings {
  try {
    localStorage.setItem(ALARM_STORAGE_KEY, JSON.stringify(settings));
  } catch (e) {
    console.error('Erro ao salvar configurações de alarme:', e);
  }
  return settings;
}

/**
 * Toca um som de alarme agradável usando a Web Audio API nativa
 */
export function playAlarmSound() {
  try {
    const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContext) return;

    const ctx = new AudioContext();
    const now = ctx.currentTime;

    // Tocar uma sequência de 3 bips ascendentes
    const notes = [523.25, 659.25, 783.99, 1046.5]; // C5, E5, G5, C6
    notes.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now + idx * 0.15);

      gain.gain.setValueAtTime(0.3, now + idx * 0.15);
      gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.15 + 0.2);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now + idx * 0.15);
      osc.stop(now + idx * 0.15 + 0.25);
    });
  } catch (e) {
    console.warn('Não foi possível reproduzir o áudio do alarme:', e);
  }
}

/**
 * Solicita permissão para Notificações do Navegador
 */
export async function requestNotificationPermission(): Promise<boolean> {
  if (!('Notification' in window)) return false;
  if (Notification.permission === 'granted') return true;
  if (Notification.permission !== 'denied') {
    const permission = await Notification.requestPermission();
    return permission === 'granted';
  }
  return false;
}

/**
 * Dispara uma notificação nativa do navegador se suportada e permitida
 */
export function sendBrowserNotification(title: string, body: string) {
  if ('Notification' in window && Notification.permission === 'granted') {
    try {
      new Notification(title, {
        body,
        icon: '/favicon.ico',
        tag: 'disclosure-alarm',
      });
    } catch (e) {
      console.warn('Erro ao enviar notificação do navegador:', e);
    }
  }
}

/**
 * Verifica se a hora atual está dentro da janela configurada (ex: 08:00 às 22:00)
 */
export function isWithinAlarmTimeWindow(startHourStr: string, endHourStr: string): boolean {
  const now = new Date();
  const currentMinutes = now.getHours() * 60 + now.getMinutes();

  const [startH, startM] = startHourStr.split(':').map(Number);
  const [endH, endM] = endHourStr.split(':').map(Number);

  const startTotalMinutes = (startH || 8) * 60 + (startM || 0);
  const endTotalMinutes = (endH || 22) * 60 + (endM || 0);

  if (startTotalMinutes <= endTotalMinutes) {
    return currentMinutes >= startTotalMinutes && currentMinutes <= endTotalMinutes;
  } else {
    // Caso atravesse a meia-noite (ex: 22:00 às 06:00)
    return currentMinutes >= startTotalMinutes || currentMinutes <= endTotalMinutes;
  }
}

/**
 * Verifica se o alarme deve disparar agora
 */
export function shouldTriggerAlarm(settings: AlarmSettings): boolean {
  if (!settings.enabled) return false;

  // 1. Verificar horário
  if (!isWithinAlarmTimeWindow(settings.startHour, settings.endHour)) {
    return false;
  }

  // 2. Verificar tempo desde o último disparo
  const last = settings.lastTriggeredAt || 0;
  const intervalMs = settings.intervalMinutes * 60 * 1000;
  const elapsed = Date.now() - last;

  return elapsed >= intervalMs;
}
