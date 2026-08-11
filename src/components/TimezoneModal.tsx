import React, { useState, useEffect } from 'react';
import { Clock, Globe, Check, X, Search, MapPin, Sparkles } from 'lucide-react';
import {
  TIMEZONE_OPTIONS,
  TimezoneOption,
  formatCurrentTimeInTimezone,
  getTimezoneInfo,
} from '../utils/timezoneUtils';

interface TimezoneModalProps {
  currentTimezone: string;
  onSelectTimezone: (tzId: string) => void;
  onClose: () => void;
}

export const TimezoneModal: React.FC<TimezoneModalProps> = ({
  currentTimezone,
  onSelectTimezone,
  onClose,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [liveTimes, setLiveTimes] = useState<Record<string, string>>({});

  // Atualizar relógio em tempo real a cada segundo
  useEffect(() => {
    const updateTimes = () => {
      const times: Record<string, string> = {};
      TIMEZONE_OPTIONS.forEach((tz) => {
        times[tz.id] = formatCurrentTimeInTimezone(tz.id);
      });
      setLiveTimes(times);
    };

    updateTimes();
    const interval = setInterval(updateTimes, 1000);
    return () => clearInterval(interval);
  }, []);

  const filteredOptions = TIMEZONE_OPTIONS.filter((tz) => {
    const term = searchTerm.toLowerCase();
    return (
      tz.name.toLowerCase().includes(term) ||
      tz.location.toLowerCase().includes(term) ||
      tz.offset.toLowerCase().includes(term) ||
      tz.id.toLowerCase().includes(term)
    );
  });

  const selectedInfo = getTimezoneInfo(currentTimezone);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
      <div className="relative w-full max-w-lg bg-[#0e1119] border border-[#1e2636] rounded-2xl p-6 space-y-5 shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#1e2636] pb-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-blue-600/20 text-blue-400 border border-blue-500/30 rounded-xl">
              <Globe className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-base font-extrabold text-white">Selecionar Fuso Horário</h3>
              <p className="text-xs text-[#93a0b5]">
                Escolha o fuso horário da sua região para agendamentos e automação
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 text-stone-400 hover:text-white bg-[#151a26] hover:bg-stone-800 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Selected Timezone Card Status */}
        <div className="p-4 bg-blue-500/10 border border-blue-500/30 rounded-xl flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="text-2xl">{selectedInfo.flag}</span>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-extrabold text-white">{selectedInfo.name}</span>
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-500/20 text-blue-300 border border-blue-500/30">
                  {selectedInfo.offset}
                </span>
              </div>
              <p className="text-[11px] text-[#93a0b5] mt-0.5">{selectedInfo.location}</p>
            </div>
          </div>

          <div className="text-right shrink-0">
            <span className="text-xs font-mono font-bold text-emerald-400 block">
              {liveTimes[currentTimezone] || formatCurrentTimeInTimezone(currentTimezone)}
            </span>
            <span className="text-[10px] text-[#93a0b5]">Ativo Agora</span>
          </div>
        </div>

        {/* Input de Busca */}
        <div className="relative">
          <Search className="w-4 h-4 text-stone-400 absolute left-3.5 top-3" />
          <input
            type="text"
            placeholder="Buscar cidade, estado ou fuso (ex: Manaus, UTC-4, Lisboa)..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-[#151a26] border border-[#1e2636] rounded-xl text-xs text-white placeholder-stone-500 focus:outline-none focus:border-blue-500"
          />
        </div>

        {/* Lista de Fusos Horários */}
        <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
          {filteredOptions.length === 0 ? (
            <div className="p-8 text-center text-xs text-stone-500">
              Nenhum fuso horário encontrado para "{searchTerm}"
            </div>
          ) : (
            filteredOptions.map((tz) => {
              const isSelected = tz.id === currentTimezone;
              const liveTime = liveTimes[tz.id] || formatCurrentTimeInTimezone(tz.id);

              return (
                <button
                  key={tz.id}
                  onClick={() => {
                    onSelectTimezone(tz.id);
                    onClose();
                  }}
                  className={`w-full p-3.5 rounded-xl border flex items-center justify-between gap-3 text-left transition-all ${
                    isSelected
                      ? 'bg-blue-600/20 border-blue-500/50 shadow-md shadow-blue-950/40'
                      : 'bg-[#151a26] border-[#1e2636] hover:border-stone-600 hover:bg-[#1a2130]'
                  }`}
                >
                  <div className="flex items-center gap-3 overflow-hidden">
                    <span className="text-xl shrink-0">{tz.flag}</span>
                    <div className="truncate">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-extrabold text-white truncate">{tz.name}</span>
                        <span className="px-1.5 py-0.5 bg-[#0e1119] text-[#93a0b5] border border-[#1e2636] rounded text-[10px] font-mono font-bold shrink-0">
                          {tz.offset}
                        </span>
                      </div>
                      <p className="text-[11px] text-[#93a0b5] truncate mt-0.5">{tz.location}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 shrink-0">
                    <span className="text-xs font-mono font-bold text-stone-300 bg-[#0e1119] px-2.5 py-1 rounded-lg border border-[#1e2636]">
                      {liveTime}
                    </span>
                    {isSelected ? (
                      <div className="p-1.5 bg-blue-500 text-white rounded-lg">
                        <Check className="w-3.5 h-3.5" />
                      </div>
                    ) : (
                      <div className="w-6 h-6 border border-[#1e2636] rounded-lg" />
                    )}
                  </div>
                </button>
              );
            })
          )}
        </div>

        {/* Footer info */}
        <div className="pt-3 border-t border-[#1e2636] flex items-center justify-between text-[11px] text-[#93a0b5]">
          <div className="flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-blue-400" />
            <span>O fuso escolhido afeta o disparo de mensagens automáticas</span>
          </div>

          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-[#151a26] hover:bg-stone-800 text-stone-300 rounded-xl font-bold transition-all"
          >
            Concluir
          </button>
        </div>
      </div>
    </div>
  );
};
