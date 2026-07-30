// Utilitário para gerenciamento do Alarme e Lembretes de Divulgação
// Suporta Web Audio API Beep, Notificações do Navegador e Validação de Janela de Horário

export interface AlarmSettings {
  enabled: boolean;
  intervalMinutes: number; // 5, 10, 15, 30, 60
  startHour: string;       // "08:00"
  endHour: string;         // "22:00"
  soundEnabled: boolean;
  soundType?: string;      // 'chime', 'digital', 'radar', 'gong', 'energetic', 'ping', 'whistle', 'synth'
  lastTriggeredAt?: number;
}

const ALARM_STORAGE_KEY = 'affiliate_alarm_settings_v1';

export const ALARM_SOUND_OPTIONS = [
  { id: 'chime', label: '🔔 Chime Eletrônico', description: 'Sequência harmoniosa de 4 notas ascendentes' },
  { id: 'digital', label: '⏰ Beep Digital', description: 'Som clássico de relógio digital com repetição' },
  { id: 'radar', label: '📡 Pulso Radar', description: 'Sinal duplo pulsante com modulação de frequência' },
  { id: 'gong', label: '🧘 Gong Suave', description: 'Tom grave e ressonante de baixa frequência' },
  { id: 'energetic', label: '⚡ Alerta Energético', description: 'Arpejo rápido e marcante para ação imediata' },
  { id: 'ping', label: '💧 Ping Minimalista', description: 'Nota única cristalina com atenuação suave' },
  { id: 'whistle', label: '🎷 Apito Notificação', description: 'Grito melódico tipo notificação de mensagem' },
  { id: 'synth', label: '🎹 Synth Wave', description: 'Acorde expansivo estilo sintetizador retrô' },
];

export const DEFAULT_ALARM_SETTINGS: AlarmSettings = {
  enabled: false,
  intervalMinutes: 15,
  startHour: '08:00',
  endHour: '22:00',
  soundEnabled: true,
  soundType: 'chime',
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
 * Toca um som de alarme configurado usando a Web Audio API nativa
 */
export function playAlarmSound(typeOverride?: string) {
  try {
    const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContext) return;

    const settings = getAlarmSettings();
    if (!typeOverride && !settings.soundEnabled) return;

    const soundType = typeOverride || settings.soundType || 'chime';
    const ctx = new AudioContext();
    const now = ctx.currentTime;

    switch (soundType) {
      case 'digital': {
        // Double fast beep
        [0, 0.12, 0.24].forEach((timeOffset) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = 'square';
          osc.frequency.setValueAtTime(880, now + timeOffset); // A5
          gain.gain.setValueAtTime(0.2, now + timeOffset);
          gain.gain.exponentialRampToValueAtTime(0.001, now + timeOffset + 0.08);
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start(now + timeOffset);
          osc.stop(now + timeOffset + 0.09);
        });
        break;
      }

      case 'radar': {
        // Radar sweep synth
        [0, 0.25].forEach((offset) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = 'sine';
          osc.frequency.setValueAtTime(1200, now + offset);
          osc.frequency.exponentialRampToValueAtTime(400, now + offset + 0.18);
          gain.gain.setValueAtTime(0.3, now + offset);
          gain.gain.exponentialRampToValueAtTime(0.001, now + offset + 0.18);
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start(now + offset);
          osc.stop(now + offset + 0.2);
        });
        break;
      }

      case 'gong': {
        // Deep resonating gong
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(220, now); // A3
        osc.frequency.exponentialRampToValueAtTime(110, now + 1.2);
        gain.gain.setValueAtTime(0.5, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 1.2);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now);
        osc.stop(now + 1.2);
        break;
      }

      case 'energetic': {
        // Fast energetic tri-tone arpeggio
        const notes = [523.25, 659.25, 783.99, 1046.5, 1318.5];
        notes.forEach((freq, idx) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = 'sawtooth';
          osc.frequency.setValueAtTime(freq, now + idx * 0.07);
          gain.gain.setValueAtTime(0.2, now + idx * 0.07);
          gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.07 + 0.15);
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start(now + idx * 0.07);
          osc.stop(now + idx * 0.07 + 0.16);
        });
        break;
      }

      case 'ping': {
        // Single crystal clear ping
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(1760, now); // A6
        gain.gain.setValueAtTime(0.4, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.8);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now);
        osc.stop(now + 0.85);
        break;
      }

      case 'whistle': {
        // Upward whistle tone
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(600, now);
        osc.frequency.exponentialRampToValueAtTime(1600, now + 0.2);
        gain.gain.setValueAtTime(0.3, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now);
        osc.stop(now + 0.26);
        break;
      }

      case 'synth': {
        // Multi-oscillator chord
        [261.63, 329.63, 392.00, 523.25].forEach((freq) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = 'sine';
          osc.frequency.setValueAtTime(freq, now);
          gain.gain.setValueAtTime(0.15, now);
          gain.gain.exponentialRampToValueAtTime(0.001, now + 0.9);
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start(now);
          osc.stop(now + 0.95);
        });
        break;
      }

      case 'chime':
      default: {
        // 4 Ascending sine notes
        const notes = [523.25, 659.25, 783.99, 1046.5]; // C5, E5, G5, C6
        notes.forEach((freq, idx) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = 'sine';
          osc.frequency.setValueAtTime(freq, now + idx * 0.12);
          gain.gain.setValueAtTime(0.25, now + idx * 0.12);
          gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.12 + 0.2);
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start(now + idx * 0.12);
          osc.stop(now + idx * 0.12 + 0.22);
        });
        break;
      }
    }
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
