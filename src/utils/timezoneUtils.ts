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
    name: 'Horário Oficial de Brasília (SP, RJ, MG, Sul, Nordeste, DF)',
    location: 'Atende a maioria dos estados do Brasil (DF, SP, RJ, MG, PR, SC, RS, GO, ES, BA, SE, AL, PE, PB, RN, CE, MA, PI, TO)',
    offset: 'Horário Normal',
    flag: '🇧🇷',
  },
  {
    id: 'America/Manaus',
    name: 'Horário do Amazonas (1h a menos de Brasília)',
    location: 'Manaus, Amazonas, Roraima, Rondônia',
    offset: '-1 Hora',
    flag: '🇧🇷',
  },
  {
    id: 'America/Cuiaba',
    name: 'Horário do Mato Grosso e MS (1h a menos de Brasília)',
    location: 'Cuiabá, Campo Grande, Pantanal',
    offset: '-1 Hora',
    flag: '🇧🇷',
  },
  {
    id: 'America/Rio_Branco',
    name: 'Horário do Acre (2h a menos de Brasília)',
    location: 'Rio Branco, Acre, Oeste do Amazonas',
    offset: '-2 Horas',
    flag: '🇧🇷',
  },
  {
    id: 'America/Noronha',
    name: 'Fernando de Noronha (1h a mais de Brasília)',
    location: 'Fernando de Noronha, Arquipélagos de São Pedro e São Paulo',
    offset: '+1 Hora',
    flag: '🇧🇷',
  },
  {
    id: 'America/Belem',
    name: 'Pará e Amapá (Horário de Brasília)',
    location: 'Belém, Macapá, Santarém',
    offset: 'Horário Normal',
    flag: '🇧🇷',
  },
  {
    id: 'Europe/Lisbon',
    name: 'Portugal (Lisboa / Porto)',
    location: 'Portugal, Europa Ocidental',
    offset: '+3 a +4 Horas',
    flag: '🇵🇹',
  },
  {
    id: 'America/New_York',
    name: 'Estados Unidos (Nova York / Flórida)',
    location: 'Costa Leste dos EUA',
    offset: '-1 a -2 Horas',
    flag: '🇺🇸',
  },
  {
    id: 'America/Mexico_City',
    name: 'México / América Central',
    location: 'Cidade do México, Guadalajara',
    offset: '-2 a -3 Horas',
    flag: '🇲🇽',
  },
];

const LOCAL_STORAGE_KEY = 'afiliacopy_user_timezone';

export const getSavedTimezone = (): string => {
  if (typeof window === 'undefined') return 'America/Sao_Paulo';
  try {
    const saved = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (saved) return saved;
  } catch (e) {
    // Ignore localStorage access errors
  }

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
    try {
      localStorage.setItem(LOCAL_STORAGE_KEY, tz);
    } catch (e) {
      console.warn('Could not save timezone to localStorage:', e);
    }
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
