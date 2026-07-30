import React, { useState } from 'react';
import { LayoutTemplate, Plus, Edit3, Check, Trash2, Tag, Sparkles, Copy, X } from 'lucide-react';
import { CopyTemplate } from '../types';

interface TemplateSelectorProps {
  templates: CopyTemplate[];
  selectedTemplateId: string;
  setSelectedTemplateId: (id: string) => void;
  customTemplates: CopyTemplate[];
  onAddCustomTemplate: (template: CopyTemplate) => void;
  onDeleteCustomTemplate: (id: string) => void;
}

const PLACEHOLDERS = [
  { tag: '{titulo}', label: 'Título', desc: 'Nome do produto' },
  { tag: '{preco}', label: 'Preço', desc: 'Preço atual' },
  { tag: '{precoPix}', label: 'Preço Pix', desc: 'Preço Pix ou atual' },
  { tag: '{precoCartao}', label: 'Preço Cartão', desc: 'Preço parcelado ou atual' },
  { tag: '{precoAntigo}', label: 'Preço Riscado', desc: 'Preço de tabela' },
  { tag: '{desconto}', label: 'Desconto %', desc: 'Porcentagem calculada' },
  { tag: '{parcelamento}', label: 'Parcelas', desc: 'Ex: "10x de R$ 50"' },
  { tag: '{cupom}', label: 'Cupom', desc: 'Ex: "Cupom: 10OFF"' },
  { tag: '{frete}', label: 'Frete', desc: 'Ex: "Frete GRÁTIS"' },
  { tag: '{descricao}', label: 'Descrição', desc: 'Resumo (primeiros 200 caracteres)' },
  { tag: '{linkAfiliado}', label: 'Link', desc: 'Seu link de afiliado oficial' },
  { tag: '{plataforma}', label: 'Plataforma', desc: 'Ex: "Mercado Livre"' },
  { tag: '{estrelas}', label: 'Estrelas ⭐', desc: 'Avaliação média' },
  { tag: '{vendas}', label: 'Vendas 📦', desc: 'Ex: "100+ vendas"' },
  { tag: '{comissao}', label: 'Comissão R$', desc: 'Comissão estimada em R$' },
  { tag: '{comissaoPct}', label: 'Comissão %', desc: 'Taxa estimada em %' },
];

export const TemplateSelector: React.FC<TemplateSelectorProps> = ({
  templates,
  selectedTemplateId,
  setSelectedTemplateId,
  customTemplates,
  onAddCustomTemplate,
  onDeleteCustomTemplate,
}) => {
  const [isCreating, setIsCreating] = useState(false);
  const [newTemplateName, setNewTemplateName] = useState('');
  const [newTemplateBody, setNewTemplateBody] = useState('');
  const [newTemplateDesc, setNewTemplateDesc] = useState('');

  const [isEditingId, setIsEditingId] = useState<string | null>(null);
  const [editTemplateName, setEditTemplateName] = useState('');
  const [editTemplateBody, setEditTemplateBody] = useState('');
  const [editTemplateDesc, setEditTemplateDesc] = useState('');

  const allTemplates = [...templates, ...customTemplates];
  const activeTemplate = allTemplates.find((t) => t.id === selectedTemplateId) || templates[0];

  const handleSaveNewTemplate = () => {
    if (!newTemplateName.trim() || !newTemplateBody.trim()) return;
    const newT: CopyTemplate = {
      id: 'custom_' + Date.now(),
      name: '✏️ ' + newTemplateName.trim(),
      category: 'custom',
      description: newTemplateDesc.trim() || 'Template personalizado',
      template: newTemplateBody.trim(),
    };
    onAddCustomTemplate(newT);
    setSelectedTemplateId(newT.id);
    setIsCreating(false);
    setNewTemplateName('');
    setNewTemplateBody('');
    setNewTemplateDesc('');
  };

  const handleStartEdit = (tmpl: CopyTemplate) => {
    setIsEditingId(tmpl.id);
    setEditTemplateName(tmpl.name.replace(/^✏️\s*/, ''));
    setEditTemplateBody(tmpl.template);
    setEditTemplateDesc(tmpl.description || '');
    setIsCreating(false);
  };

  const handleSaveEditTemplate = () => {
    if (!isEditingId || !editTemplateName.trim() || !editTemplateBody.trim()) return;
    const updatedT: CopyTemplate = {
      id: isEditingId,
      name: '✏️ ' + editTemplateName.trim(),
      category: 'custom',
      description: editTemplateDesc.trim() || 'Template personalizado',
      template: editTemplateBody.trim(),
    };
    onAddCustomTemplate(updatedT); // overwrites/saves the template in collection
    setIsEditingId(null);
  };

  const handleDuplicateTemplate = (tmpl: CopyTemplate) => {
    const rawName = tmpl.name.replace(/^✏️\s*/, '');
    setNewTemplateName(`Cópia de ${rawName}`);
    setNewTemplateBody(tmpl.template);
    setNewTemplateDesc(`Cópia baseada no modelo: ${tmpl.name}`);
    setIsCreating(true);
    setIsEditingId(null);
    // Scroll editor to view
    setTimeout(() => {
      document.getElementById('template-editor-anchor')?.scrollIntoView({ behavior: 'smooth' });
    }, 100);
  };

  const insertTag = (tag: string, isEdit: boolean) => {
    const elementId = isEdit ? 'edit-template-textarea' : 'new-template-textarea';
    const textarea = document.getElementById(elementId) as HTMLTextAreaElement;
    if (textarea) {
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const text = textarea.value;
      const before = text.substring(0, start);
      const after = text.substring(end, text.length);
      const updatedText = before + tag + after;
      if (isEdit) {
        setEditTemplateBody(updatedText);
      } else {
        setNewTemplateBody(updatedText);
      }
      setTimeout(() => {
        textarea.focus();
        textarea.setSelectionRange(start + tag.length, start + tag.length);
      }, 0);
    } else {
      if (isEdit) {
        setEditTemplateBody((prev) => prev + tag);
      } else {
        setNewTemplateBody((prev) => prev + tag);
      }
    }
  };

  return (
    <div className="bg-stone-900 border border-stone-800 rounded-2xl p-5 sm:p-6 shadow-xl space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 border-b border-stone-800/60 pb-3">
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400">
            <LayoutTemplate className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-sm sm:text-base font-bold text-white">Modelo de Copy (Template)</h2>
            <p className="text-[10px] text-stone-400">Escolha ou crie modelos de mensagens para divulgar</p>
          </div>
        </div>

        <button
          onClick={() => {
            setIsCreating(!isCreating);
            setIsEditingId(null);
          }}
          className="px-3 py-1.5 bg-emerald-600/10 hover:bg-emerald-600/20 text-emerald-400 hover:text-emerald-300 text-xs font-bold rounded-lg border border-emerald-500/20 flex items-center gap-1.5 transition-all shrink-0"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Novo Modelo</span>
        </button>
      </div>

      {/* Template Badges Selector Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-[190px] overflow-y-auto pr-1 scrollbar-thin scrollbar-thumb-stone-800">
        {allTemplates.map((tmpl) => {
          const isSelected = tmpl.id === selectedTemplateId;
          const isCustom = tmpl.category === 'custom';
          return (
            <div
              key={tmpl.id}
              className={`group flex items-center justify-between p-2.5 rounded-xl border text-xs transition-all relative ${
                isSelected
                  ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-300 font-bold'
                  : 'bg-stone-950/60 border-stone-800 hover:border-stone-700 text-stone-300'
              }`}
            >
              <button
                type="button"
                onClick={() => setSelectedTemplateId(tmpl.id)}
                className="flex-1 text-left truncate flex items-center gap-1.5 mr-2"
                title={tmpl.description || tmpl.name}
              >
                {isSelected ? (
                  <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                ) : (
                  <LayoutTemplate className="w-3.5 h-3.5 text-stone-500 shrink-0" />
                )}
                <span className="truncate">{tmpl.name}</span>
              </button>

              {/* Action buttons (inline) */}
              <div className="flex items-center gap-1 shrink-0">
                <button
                  type="button"
                  onClick={() => handleDuplicateTemplate(tmpl)}
                  title="Duplicar este modelo"
                  className="p-1 text-stone-400 hover:text-emerald-400 hover:bg-stone-800 rounded transition-colors"
                >
                  <Copy className="w-3 h-3" />
                </button>

                {isCustom && (
                  <>
                    <button
                      type="button"
                      onClick={() => handleStartEdit(tmpl)}
                      title="Editar modelo"
                      className="p-1 text-stone-400 hover:text-amber-400 hover:bg-stone-800 rounded transition-colors"
                    >
                      <Edit3 className="w-3 h-3" />
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        if (confirm('Tem certeza que deseja excluir seu template personalizado?')) {
                          onDeleteCustomTemplate(tmpl.id);
                          if (selectedTemplateId === tmpl.id) {
                            setSelectedTemplateId(templates[0].id);
                          }
                        }
                      }}
                      title="Excluir modelo"
                      className="p-1 text-stone-400 hover:text-red-400 hover:bg-stone-800 rounded transition-colors"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <div id="template-editor-anchor" />

      {/* Create New Custom Template Drawer */}
      {isCreating && (
        <div className="p-4 bg-stone-950 border border-stone-800/80 rounded-xl space-y-3.5 animate-fadeIn">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold text-emerald-400 uppercase tracking-wider flex items-center gap-1">
              <Plus className="w-3.5 h-3.5" />
              Criar Novo Template
            </h3>
            <button
              onClick={() => {
                setIsCreating(false);
                setNewTemplateName('');
                setNewTemplateBody('');
                setNewTemplateDesc('');
              }}
              className="text-stone-500 hover:text-stone-300 p-0.5"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="space-y-3">
            <div>
              <label className="text-[10px] text-stone-400 uppercase font-semibold mb-1 block">Nome do Modelo</label>
              <input
                type="text"
                placeholder="Ex: Oferta Relâmpago, Grupo VIP, Meu Estilo..."
                value={newTemplateName}
                onChange={(e) => setNewTemplateName(e.target.value)}
                className="w-full px-3 py-2 bg-stone-900 border border-stone-800 rounded-lg text-xs text-stone-100 focus:outline-none focus:border-emerald-500 transition-colors"
              />
            </div>

            <div>
              <label className="text-[10px] text-stone-400 uppercase font-semibold mb-1 block">Descrição Curta</label>
              <input
                type="text"
                placeholder="Ex: Ideal para lançamentos rápidos no WhatsApp..."
                value={newTemplateDesc}
                onChange={(e) => setNewTemplateDesc(e.target.value)}
                className="w-full px-3 py-2 bg-stone-900 border border-stone-800 rounded-lg text-xs text-stone-100 focus:outline-none focus:border-emerald-500 transition-colors"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-[10px] text-stone-400 uppercase font-semibold block">Corpo do Template (Tags clicáveis)</label>
              </div>

              {/* Tag Injector Grid */}
              <div className="flex flex-wrap gap-1 bg-stone-900/50 p-2 rounded-lg border border-stone-800/80 mb-2 max-h-[110px] overflow-y-auto">
                {PLACEHOLDERS.map((ph) => (
                  <button
                    key={ph.tag}
                    type="button"
                    onClick={() => insertTag(ph.tag, false)}
                    className="px-1.5 py-0.5 bg-stone-800 hover:bg-emerald-950/40 hover:text-emerald-300 text-stone-300 hover:border-emerald-500/30 text-[10px] rounded font-mono border border-stone-700 transition-all flex flex-col items-start text-left shrink-0"
                    title={ph.desc}
                  >
                    <span className="font-bold text-emerald-400">{ph.tag}</span>
                    <span className="text-[8px] text-stone-400">{ph.label}</span>
                  </button>
                ))}
              </div>

              <textarea
                id="new-template-textarea"
                rows={5}
                value={newTemplateBody}
                onChange={(e) => setNewTemplateBody(e.target.value)}
                placeholder="Insira as tags clicáveis acima para preencher os dados do produto automaticamente. Exemplo: &#10;🔥 *OFERTA* &#10;{titulo} &#10;De: {precoAntigo} por {preco} &#10;🛒 Compre aqui: {linkAfiliado}"
                className="w-full px-3 py-2 bg-stone-900 border border-stone-800 rounded-lg text-xs text-stone-100 font-mono focus:outline-none focus:border-emerald-500 leading-relaxed transition-colors"
              />
            </div>
          </div>

          <button
            onClick={handleSaveNewTemplate}
            disabled={!newTemplateName.trim() || !newTemplateBody.trim()}
            className="w-full py-2 bg-emerald-500 hover:bg-emerald-400 disabled:bg-stone-800 disabled:text-stone-500 text-stone-950 font-bold text-xs rounded-lg transition-all"
          >
            Salvar Template
          </button>
        </div>
      )}

      {/* Edit Custom Template Drawer */}
      {isEditingId !== null && (
        <div className="p-4 bg-stone-950 border border-amber-500/30 rounded-xl space-y-3.5 animate-fadeIn">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold text-amber-400 uppercase tracking-wider flex items-center gap-1">
              <Edit3 className="w-3.5 h-3.5" />
              Editar Template Personalizado
            </h3>
            <button
              onClick={() => {
                setIsEditingId(null);
              }}
              className="text-stone-500 hover:text-stone-300 p-0.5"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="space-y-3">
            <div>
              <label className="text-[10px] text-stone-400 uppercase font-semibold mb-1 block">Nome do Modelo</label>
              <input
                type="text"
                value={editTemplateName}
                onChange={(e) => setEditTemplateName(e.target.value)}
                className="w-full px-3 py-2 bg-stone-900 border border-stone-800 rounded-lg text-xs text-stone-100 focus:outline-none focus:border-amber-500 transition-colors"
              />
            </div>

            <div>
              <label className="text-[10px] text-stone-400 uppercase font-semibold mb-1 block">Descrição Curta</label>
              <input
                type="text"
                value={editTemplateDesc}
                onChange={(e) => setEditTemplateDesc(e.target.value)}
                className="w-full px-3 py-2 bg-stone-900 border border-stone-800 rounded-lg text-xs text-stone-100 focus:outline-none focus:border-amber-500 transition-colors"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-[10px] text-stone-400 uppercase font-semibold block">Corpo do Template (Tags clicáveis)</label>
              </div>

              {/* Tag Injector Grid */}
              <div className="flex flex-wrap gap-1 bg-stone-900/50 p-2 rounded-lg border border-stone-800/80 mb-2 max-h-[110px] overflow-y-auto">
                {PLACEHOLDERS.map((ph) => (
                  <button
                    key={ph.tag}
                    type="button"
                    onClick={() => insertTag(ph.tag, true)}
                    className="px-1.5 py-0.5 bg-stone-800 hover:bg-amber-950/40 hover:text-amber-300 text-stone-300 hover:border-amber-500/30 text-[10px] rounded font-mono border border-stone-700 transition-all flex flex-col items-start text-left shrink-0"
                    title={ph.desc}
                  >
                    <span className="font-bold text-amber-400">{ph.tag}</span>
                    <span className="text-[8px] text-stone-400">{ph.label}</span>
                  </button>
                ))}
              </div>

              <textarea
                id="edit-template-textarea"
                rows={5}
                value={editTemplateBody}
                onChange={(e) => setEditTemplateBody(e.target.value)}
                className="w-full px-3 py-2 bg-stone-900 border border-stone-800 rounded-lg text-xs text-stone-100 font-mono focus:outline-none focus:border-amber-500 leading-relaxed transition-colors"
              />
            </div>
          </div>

          <button
            onClick={handleSaveEditTemplate}
            disabled={!editTemplateName.trim() || !editTemplateBody.trim()}
            className="w-full py-2 bg-amber-500 hover:bg-amber-400 disabled:bg-stone-800 disabled:text-stone-500 text-stone-950 font-bold text-xs rounded-lg transition-all"
          >
            Salvar Alterações
          </button>
        </div>
      )}

      {/* Selected Template Details/Description */}
      {activeTemplate && !isCreating && isEditingId === null && (
        <div className="bg-stone-950 p-3 rounded-xl border border-stone-850 flex items-start gap-2 animate-fadeIn text-[11px] text-stone-400">
          <Sparkles className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
          <div>
            <span className="font-bold text-stone-200">Modelo Selecionado: </span>
            {activeTemplate.description || 'Nenhuma descrição fornecida.'}
          </div>
        </div>
      )}
    </div>
  );
};
