export interface TimezoneOption {
  id: string;
  name: string;
  location: string;
  offset: string;
  flag: string;
}

export const TIMEZONE_OPTIONS: TimezoneOption[] = [
  {
    id: 'America/Sao_Paulo',
    name: 'Horário de Brasília (BRT)',
    location: 'São Paulo, Rio, Brasília, Sul/Sudoeste',
    offset: 'UTC-3',
    flag: '🇧🇷',
  },
  {
    id: 'America/Manaus',
    name: 'Horário do Amazonas (AMT)',
    location: 'Manaus, Amazonas',
    offset: 'UTC-4',
    flag: '🇧🇷',
  },
  {
    id: 'America/Noronha',
    name: 'Fernando de Noronha (FNT)',
    location: 'Noronha, Ilhas Oceânicas',
    offset: 'UTC-2',
    flag: '🇧🇷',
  },
  {
    id: 'America/Rio_Branco',
    name: 'Horário do Acre (ACT)',
    location: 'Rio Branco, Acre',
    offset: 'UTC-5',
    flag: '🇧🇷',
  },
  {
    id: 'America/Fortaleza',
    name: 'Nordeste / Ceará',
    location: 'Fortaleza, Ceará, RN, PB, PE',
    offset: 'UTC-3',
    flag: '🇧🇷',
  },
  {
    id: 'America/Cuiaba',
    name: 'Mato Grosso / Pantanal',
    location: 'Cuiabá, Mato Grosso',
    offset: 'UTC-4',
    flag: '🇧🇷',
  },
  {
    id: 'America/Bahia',
    name: 'Bahia (BRT)',
    location: 'Salvador, Bahia',
    offset: 'UTC-3',
    flag: '🇧🇷',
  },
  {
    id: 'America/Belem',
    name: 'Pará / Norte Leste',
    location: 'Belém, Pará, Amapá',
    offset: 'UTC-3',
    flag: '🇧🇷',
  },
  {
    id: 'Europe/Lisbon',
    name: 'Lisboa / Portugal (WET)',
    location: 'Lisboa, Porto, Portugal',
    offset: 'UTC+0 / UTC+1',
    flag: '🇵🇹',
  },
  {
    id: 'America/New_York',
    name: 'Nova York / Leste (EST)',
    location: 'Nova York, Flórida, EUA',
    offset: 'UTC-5',
    flag: '🇺🇸',
  },
  {
    id: 'America/Mexico_City',
    name: 'Cidade do México (CST)',
    location: 'México, América Central',
    offset: 'UTC-6',
    flag: '🇲🇽',
  },
  {
    id: 'UTC',
    name: 'Tempo Universal Coordinated (UTC)',
    location: 'Padrão Internacional UTC',
    offset: 'UTC+0',
    flag: '🌐',
  },
];

const LOCAL_STORAGE_KEY = 'afiliacopy_user_timezone';

export const getSavedTimezone = (): string => {
  if (typeof window === 'undefined') return 'America/Sao_Paulo';
  const saved = localStorage.getItem(LOCAL_STORAGE_KEY);
  if (saved) return saved;

  // Tentar detectar timezone nativo do navegador
  try {
    const detected = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (detected && TIMEZONE_OPTIONS.some((t) => t.id === detected)) {
      return detected;
    }
  } catch (e) {
    // ignore
  }

  return 'America/Sao_Paulo';
};

export const saveTimezoneToStorage = (tz: string): void => {
  if (typeof window !== 'undefined') {
    localStorage.setItem(LOCAL_STORAGE_KEY, tz);
  }
};

export const getTimezoneInfo = (tzId: string): TimezoneOption => {
  return (
    TIMEZONE_OPTIONS.find((t) => t.id === tzId) || {
      id: tzId,
      name: tzId,
      location: 'Fuso Personalizado',
      offset: 'UTC',
      flag: '🌐',
    }
  );
};

export const formatCurrentTimeInTimezone = (tzId: string): string => {
  try {
    return new Intl.DateTimeFormat('pt-BR', {
      timeZone: tzId,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    }).format(new Date());
  } catch (e) {
    return new Date().toLocaleTimeString('pt-BR');
  }
};
