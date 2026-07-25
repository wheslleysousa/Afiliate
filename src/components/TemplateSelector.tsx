import React, { useState } from 'react';
import { LayoutTemplate, Plus, Edit3, Check, Trash2, Tag, Sparkles } from 'lucide-react';
import { CopyTemplate } from '../types';

interface TemplateSelectorProps {
  templates: CopyTemplate[];
  selectedTemplateId: string;
  setSelectedTemplateId: (id: string) => void;
  customTemplates: CopyTemplate[];
  onAddCustomTemplate: (template: CopyTemplate) => void;
  onDeleteCustomTemplate: (id: string) => void;
  customTextOverride: string | null;
  setCustomTextOverride: (text: string | null) => void;
}

export const TemplateSelector: React.FC<TemplateSelectorProps> = ({
  templates,
  selectedTemplateId,
  setSelectedTemplateId,
  customTemplates,
  onAddCustomTemplate,
  onDeleteCustomTemplate,
  customTextOverride,
  setCustomTextOverride,
}) => {
  const [isCreating, setIsCreating] = useState(false);
  const [newTemplateName, setNewTemplateName] = useState('');
  const [newTemplateBody, setNewTemplateBody] = useState('');

  const allTemplates = [...templates, ...customTemplates];
  const activeTemplate = allTemplates.find((t) => t.id === selectedTemplateId) || templates[0];

  const handleSaveNewTemplate = () => {
    if (!newTemplateName.trim() || !newTemplateBody.trim()) return;
    const newT: CopyTemplate = {
      id: 'custom_' + Date.now(),
      name: '✏️ ' + newTemplateName.trim(),
      category: 'custom',
      description: 'Template personalizado',
      template: newTemplateBody.trim(),
    };
    onAddCustomTemplate(newT);
    setSelectedTemplateId(newT.id);
    setIsCreating(false);
    setNewTemplateName('');
    setNewTemplateBody('');
  };

  const insertTagIntoNewTemplate = (tag: string) => {
    setNewTemplateBody((prev) => prev + tag);
  };

  return (
    <div className="bg-stone-900 border border-stone-800 rounded-2xl p-5 sm:p-6 shadow-xl">
      <div className="flex items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400">
            <LayoutTemplate className="w-5 h-5" />
          </div>
          <h2 className="text-base sm:text-lg font-semibold text-white">3. Modelo de Copy (Template)</h2>
        </div>

        <button
          onClick={() => setIsCreating(!isCreating)}
          className="px-3 py-1.5 bg-stone-800 hover:bg-stone-750 text-stone-200 text-xs font-semibold rounded-lg border border-stone-700 flex items-center gap-1.5 transition-all"
        >
          <Plus className="w-3.5 h-3.5 text-emerald-400" />
          <span>Novo Modelo</span>
        </button>
      </div>

      {/* Template Badges Selector */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-thin scrollbar-thumb-stone-800">
        {allTemplates.map((tmpl) => {
          const isSelected = tmpl.id === selectedTemplateId && !customTextOverride;
          return (
            <div key={tmpl.id} className="relative group shrink-0">
              <button
                onClick={() => {
                  setSelectedTemplateId(tmpl.id);
                  setCustomTextOverride(null);
                }}
                className={`px-3.5 py-2 rounded-xl text-xs font-semibold transition-all flex items-center gap-1.5 border ${
                  isSelected
                    ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/50 shadow-sm'
                    : 'bg-stone-950 text-stone-400 border-stone-800 hover:text-stone-200 hover:bg-stone-800/80'
                }`}
              >
                {isSelected && <Check className="w-3.5 h-3.5 text-emerald-400" />}
                <span>{tmpl.name}</span>
              </button>

              {tmpl.category === 'custom' && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onDeleteCustomTemplate(tmpl.id);
                    if (selectedTemplateId === tmpl.id) {
                      setSelectedTemplateId(templates[0].id);
                    }
                  }}
                  title="Excluir modelo"
                  className="absolute -top-1 -right-1 p-1 bg-red-900 text-red-200 rounded-full opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-800"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              )}
            </div>
          );
        })}
      </div>

      {/* Create New Custom Template Drawer */}
      {isCreating && (
        <div className="mt-4 p-4 bg-stone-950 border border-stone-800 rounded-xl space-y-3 animate-fadeIn">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold text-stone-200 uppercase tracking-wider flex items-center gap-1">
              <Edit3 className="w-3.5 h-3.5 text-emerald-400" />
              Criar Novo Template
            </h3>
            <button
              onClick={() => setIsCreating(false)}
              className="text-xs text-stone-500 hover:text-stone-300"
            >
              Cancelar
            </button>
          </div>

          <input
            type="text"
            placeholder="Nome do Modelo (ex: Grupo Tech, Promoção Flash...)"
            value={newTemplateName}
            onChange={(e) => setNewTemplateName(e.target.value)}
            className="w-full px-3 py-2 bg-stone-900 border border-stone-800 rounded-lg text-xs text-stone-100 focus:outline-none focus:border-emerald-500"
          />

          <div>
            <div className="flex items-center gap-1 flex-wrap mb-1.5 text-[11px] text-stone-400">
              <span>Inserir tag:</span>
              {['{titulo}', '{preco}', '{precoAntigo}', '{parcelamento}', '{cupom}', '{frete}', '{descricao}', '{linkAfiliado}'].map((tag) => (
                <button
                  key={tag}
                  type="button"
                  onClick={() => insertTagIntoNewTemplate(tag)}
                  className="px-2 py-0.5 bg-stone-800 hover:bg-emerald-900/50 hover:text-emerald-300 text-stone-300 rounded font-mono border border-stone-700"
                >
                  {tag}
                </button>
              ))}
            </div>

            <textarea
              rows={4}
              value={newTemplateBody}
              onChange={(e) => setNewTemplateBody(e.target.value)}
              placeholder="Digite o texto do template usando as tags acima..."
              className="w-full px-3 py-2 bg-stone-900 border border-stone-800 rounded-lg text-xs text-stone-100 font-mono focus:outline-none focus:border-emerald-500"
            />
          </div>

          <button
            onClick={handleSaveNewTemplate}
            disabled={!newTemplateName.trim() || !newTemplateBody.trim()}
            className="w-full py-2 bg-emerald-500 hover:bg-emerald-400 text-stone-950 font-bold text-xs rounded-lg transition-all disabled:opacity-40"
          >
            Salvar Template
          </button>
        </div>
      )}

      {/* Description */}
      {activeTemplate.description && !isCreating && (
        <p className="text-xs text-stone-400 mt-2 italic flex items-center gap-1.5">
          <Sparkles className="w-3.5 h-3.5 text-amber-400" />
          {activeTemplate.description}
        </p>
      )}
    </div>
  );
};
