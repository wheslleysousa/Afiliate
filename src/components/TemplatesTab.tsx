import React, { useState, useEffect } from 'react';
import { CopyTemplate, UserApiKeys } from '../types';
import {
  LayoutTemplate,
  Plus,
  Edit3,
  Trash2,
  Copy,
  Save,
  Check,
  Sparkles,
  AlertTriangle,
  Info,
  X,
  Bot,
  Wand2,
  RotateCcw,
  Loader2
} from 'lucide-react';

interface TemplatesTabProps {
  customTemplates: CopyTemplate[];
  onAddCustomTemplate: (template: CopyTemplate) => void;
  onDeleteCustomTemplate: (id: string) => void;
  apiKeys?: UserApiKeys;
  defaultTemplateId?: string;
  onSaveDefaultTemplateId?: (id: string) => void;
}

const TEMPLATE_VARIABLES = [
  { tag: '{{produto}}', label: 'Nome do Produto', desc: 'Substituído pelo título oficial do produto' },
  { tag: '{{preco}}', label: 'Preço Novo (Atual)', desc: 'Preço promocional formatado (ex: R$ 89,90)' },
  { tag: '{{preco_antigo}}', label: 'Preço Antigo (Riscado)', desc: 'Preço original de tabela (ex: R$ 150,00)' },
  { tag: '{{preco_pix}}', label: 'Preço no PIX', desc: 'Valor promocional no PIX' },
  { tag: '{{desconto}}', label: 'Desconto %', desc: 'Porcentagem calculada (ex: -40% ou 40% OFF)' },
  { tag: '{{parcelamento}}', label: 'Parcelas (Geral)', desc: 'Ex: "10x de R$ 8,99"' },
  { tag: '{{parcelas_sem_juros}}', label: 'Parcelas SEM Juros', desc: 'Ex: "10x de R$ 8,99 sem juros"' },
  { tag: '{{frete}}', label: 'Frete / Frete Grátis', desc: 'Ex: "🚚 Frete GRÁTIS" ou valor do frete' },
  { tag: '{{cupom}}', label: 'Cupom de Desconto', desc: 'Ex: "🎟️ Cupom: QUERO10"' },
  { tag: '{{loja}}', label: 'Loja / Marketplace', desc: 'Ex: Mercado Livre, Shopee, Amazon' },
  { tag: '{{link}}', label: 'Link de Afiliado', desc: 'Seu link oficial e rastreado de compra' },
  { tag: '{{estrelas}}', label: 'Avaliação ⭐', desc: 'Nota média do produto (ex: ⭐ 4.8)' },
  { tag: '{{vendas}}', label: 'Vendas 📦', desc: 'Volume de vendas (ex: 📦 1.000+ vendidos)' },
  { tag: '{{comissao}}', label: 'Comissão R$', desc: 'Sua comissão estimada em R$' },
];

const DEFAULT_PRESET_TEMPLATES: CopyTemplate[] = [
  {
    id: 'preset_urgency',
    name: '🚨 Oferta Completa com Urgência & Desconto Riscado',
    category: 'urgency',
    description: 'Exibe preço antigo riscado, desconto %, frete, cupom e parcelas sem juros',
    template: `🚨 *OFERTA IMPERDÍVEL!* 🔥\n\n*{{produto}}*\n\n💰 De ~~{{preco_antigo}}~~ por apenas *{{preco}}* {{desconto}}\n💳 {{parcelas_sem_juros}}\n🎟️ {{cupom}}\n🚚 {{frete}}\n\n👉 *GARANTA O SEU NA {{loja}}:* \n{{link}}\n\n⏰ *Aproveite antes que acabe o estoque!*`,
  },
  {
    id: 'preset_pix',
    name: '💸 Foco no PIX & Frete Grátis',
    category: 'urgency',
    description: 'Destaca preço especial no PIX, parcelas e frete grátis',
    template: `💸 *PAGANDO NO PIX É AINDA MAIS BARATO!* \n\n*{{produto}}*\n\n⚡ *PIX: {{preco_pix}}* {{desconto}}\n💳 Ou {{parcelamento}}\n🚚 {{frete}}\n🎟️ {{cupom}}\n\n🛒 *Compre com desconto aqui:* \n{{link}}`,
  },
  {
    id: 'preset_direct',
    name: '⚡️ Direto e Objetivo para Grupos',
    category: 'direct',
    description: 'Mensagem limpa e rápida com preço, parcelas, frete e link',
    template: `🔥 *{{produto}}*\n\n💰 De ~~{{preco_antigo}}~~ por *{{preco}}*\n💳 {{parcelamento}}\n🚚 {{frete}}\n🎟️ {{cupom}}\n\n🔗 Link oficial: {{link}}`,
  },
  {
    id: 'preset_review',
    name: '⭐️ Recomendação Pessoal / Review com Estrelas',
    category: 'review',
    description: 'Tom pessoal ressaltando avaliação em estrelas, vendas e loja',
    template: `Gente, olhem essa super dica que encontrei! 😍\n\n*{{produto}}*\n{{estrelas}} {{vendas}}\n\nEstá saindo por apenas *{{preco}}*! {{desconto}}\n💳 {{parcelas_sem_juros}}\n🚚 {{frete}}\n\nConfiram no site oficial da {{loja}}: {{link}}`,
  },
];

export const TemplatesTab: React.FC<TemplatesTabProps> = ({
  customTemplates,
  onAddCustomTemplate,
  onDeleteCustomTemplate,
  apiKeys,
  defaultTemplateId,
  onSaveDefaultTemplateId,
}) => {
  const [isCreating, setIsCreating] = useState(false);
  const [newTemplateName, setNewTemplateName] = useState('');
  const [newTemplateBody, setNewTemplateBody] = useState('');

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editBody, setEditBody] = useState('');

  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Pop-up modal de confirmação de exclusão
  const [templateToDelete, setTemplateToDelete] = useState<CopyTemplate | null>(null);

  // Modal de Geração de Template com IA
  const [isAiModalOpen, setIsAiModalOpen] = useState(false);
  const [aiCategory, setAiCategory] = useState('Urgência & Escassez (Estoque Baixo)');
  const [aiNiche, setAiNiche] = useState('Achadinhos & Ofertas Gerais');
  const [aiCustomPrompt, setAiCustomPrompt] = useState('');
  const [isGeneratingAi, setIsGeneratingAi] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [generatedResult, setGeneratedResult] = useState<{
    name: string;
    description: string;
    template: string;
  } | null>(null);

  // Suporte a exclusão de presets mantendo controle em localStorage
  const [deletedPresetIds, setDeletedPresetIds] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('afiliate_deleted_preset_ids');
      return saved ? JSON.parse(saved) : [];
    } catch (e) {
      return [];
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem('afiliate_deleted_preset_ids', JSON.stringify(deletedPresetIds));
    } catch (e) {
      console.error('Erro ao salvar presets excluídos:', e);
    }
  }, [deletedPresetIds]);

  const activePresets = DEFAULT_PRESET_TEMPLATES.filter((p) => !deletedPresetIds.includes(p.id));
  const allTemplates = [...activePresets, ...customTemplates];

  const handleSaveNew = () => {
    if (!newTemplateName.trim() || !newTemplateBody.trim()) return;
    const newT: CopyTemplate = {
      id: 'template_' + Date.now(),
      name: newTemplateName.trim(),
      category: 'custom',
      description: 'Template personalizado',
      template: newTemplateBody.trim(),
    };
    onAddCustomTemplate(newT);
    setIsCreating(false);
    setNewTemplateName('');
    setNewTemplateBody('');
  };

  const handleStartEdit = (tmpl: CopyTemplate) => {
    setEditingId(tmpl.id);
    setEditName(tmpl.name);
    setEditBody(tmpl.template);
  };

  const handleSaveEdit = () => {
    if (!editingId || !editName.trim() || !editBody.trim()) return;
    const updated: CopyTemplate = {
      id: editingId,
      name: editName.trim(),
      category: 'custom',
      description: 'Template atualizado',
      template: editBody.trim(),
    };
    onAddCustomTemplate(updated);
    setEditingId(null);
  };

  const handleDuplicate = (tmpl: CopyTemplate) => {
    const newT: CopyTemplate = {
      id: 'template_' + Date.now(),
      name: `Cópia de ${tmpl.name}`,
      category: 'custom',
      description: `Cópia baseada em ${tmpl.name}`,
      template: tmpl.template,
    };
    onAddCustomTemplate(newT);
  };

  const confirmDeleteTemplate = () => {
    if (!templateToDelete) return;

    if (templateToDelete.id.startsWith('preset_')) {
      setDeletedPresetIds((prev) => [...prev, templateToDelete.id]);
    } else {
      onDeleteCustomTemplate(templateToDelete.id);
    }

    setTemplateToDelete(null);
  };

  const handleRestorePresets = () => {
    setDeletedPresetIds([]);
    try {
      localStorage.removeItem('afiliate_deleted_preset_ids');
    } catch (e) {
      console.error(e);
    }
  };

  const insertVariable = (tag: string, target: 'new' | 'edit') => {
    if (target === 'new') {
      setNewTemplateBody((prev) => prev + ' ' + tag);
    } else {
      setEditBody((prev) => prev + ' ' + tag);
    }
  };

  // Gerar Template com IA usando o backend Gemini
  const handleGenerateTemplateWithAi = async () => {
    setIsGeneratingAi(true);
    setAiError(null);
    try {
      const response = await fetch('/api/gemini/generate-template', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          category: aiCategory,
          niche: aiNiche,
          customPrompt: aiCustomPrompt,
          apiKeys,
        }),
      });

      const data = await response.json();
      if (response.ok && data.template) {
        setGeneratedResult({
          name: data.name || '✨ Template Gerado por IA',
          description: data.description || 'Modelo otimizado com inteligência artificial',
          template: data.template,
        });
      } else {
        setAiError(data.error || 'Não foi possível gerar o template. Tente novamente.');
      }
    } catch (err: any) {
      setAiError('Erro de conexão com a IA. Verifique sua rede e tente novamente.');
    } finally {
      setIsGeneratingAi(false);
    }
  };

  const handleApplyAiResult = () => {
    if (!generatedResult) return;
    const newT: CopyTemplate = {
      id: 'template_ai_' + Date.now(),
      name: generatedResult.name,
      category: 'ai_generated',
      description: generatedResult.description,
      template: generatedResult.template,
    };
    onAddCustomTemplate(newT);
    setIsAiModalOpen(false);
    setGeneratedResult(null);
    setAiCustomPrompt('');
  };

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-6 bg-[#0e1119] border border-[#1e2636] rounded-2xl shadow-xl">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-amber-500/20 text-amber-400 border border-amber-500/30 rounded-xl">
            <LayoutTemplate className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-lg font-extrabold text-white">Gerenciador de Templates</h2>
            <p className="text-xs text-[#93a0b5]">
              Crie, edite e personalize modelos reutilizáveis de mensagens com IA e variáveis dinâmicas
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          <button
            onClick={() => {
              setIsAiModalOpen(true);
              setAiError(null);
            }}
            className="px-4 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-extrabold text-xs flex items-center justify-center gap-2 transition-all shadow-md shadow-purple-600/30 border border-purple-400/30"
          >
            <Sparkles className="w-4 h-4 text-purple-200 animate-pulse" />
            <span>Gerar com IA</span>
          </button>

          <button
            onClick={() => {
              setIsCreating(!isCreating);
              setEditingId(null);
            }}
            className="px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-stone-950 font-extrabold text-xs flex items-center justify-center gap-2 transition-all shadow-md shadow-amber-500/20"
          >
            <Plus className="w-4 h-4" />
            <span>Criar Novo Template</span>
          </button>
        </div>
      </div>

      {/* GUIA DE COMO FUNCIONAM OS TEMPLATES E O QUE É NECESSÁRIO */}
      <div className="p-5 bg-[#0e1119] border border-blue-500/30 rounded-2xl space-y-4 shadow-xl">
        <div className="flex items-center justify-between border-b border-[#1e2636] pb-3 flex-wrap gap-2">
          <div className="flex items-center gap-2.5">
            <Info className="w-5 h-5 text-blue-400 shrink-0" />
            <h3 className="text-sm font-extrabold text-white">
              Como os Templates Funcionam e o que é Necessário
            </h3>
          </div>

          {deletedPresetIds.length > 0 && (
            <button
              onClick={handleRestorePresets}
              className="text-xs font-bold text-amber-400 hover:text-amber-300 flex items-center gap-1 bg-amber-500/10 px-2.5 py-1 rounded-lg border border-amber-500/20"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Restaurar Templates Padrão ({deletedPresetIds.length})</span>
            </button>
          )}
        </div>

        <p className="text-xs text-[#93a0b5] leading-relaxed">
          Para que o template consiga puxar as informações reais dos produtos automaticamente nas campanhas do WhatsApp e nos botões de cópia rápida, basta incluir as <strong className="text-white">tags dinâmicas entre chaves duplas</strong>:
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {TEMPLATE_VARIABLES.map((v) => (
            <div key={v.tag} className="p-3.5 bg-[#151a26] border border-[#1e2636] rounded-xl space-y-1">
              <span className="px-2 py-0.5 bg-amber-500/20 text-amber-300 border border-amber-500/30 rounded-md font-mono text-xs font-bold inline-block">
                {v.tag}
              </span>
              <h4 className="text-xs font-bold text-white pt-1">{v.label}</h4>
              <p className="text-[11px] text-[#93a0b5] leading-tight">{v.desc}</p>
            </div>
          ))}
        </div>

        <div className="p-3 bg-blue-500/10 border border-blue-500/20 rounded-xl text-xs text-blue-300 flex items-start gap-2">
          <Sparkles className="w-4 h-4 shrink-0 text-blue-400 mt-0.5" />
          <span>
            <strong className="text-white">Dica Importante:</strong> Toda vez que você selecionar um produto no Marketplace ou em Meus Produtos e escolher um template, o sistema substituirá <code className="text-amber-300 font-mono font-bold">{"{{produto}}"}</code>, <code className="text-amber-300 font-mono font-bold">{"{{preco}}"}</code> e <code className="text-amber-300 font-mono font-bold">{"{{link}}"}</code> instantaneamente antes do envio.
          </span>
        </div>
      </div>

      {/* Editor de Criação */}
      {isCreating && (
        <div className="p-5 bg-[#0e1119] border border-amber-500/40 rounded-2xl space-y-4 animate-fadeIn shadow-xl">
          <div className="flex items-center justify-between border-b border-[#1e2636] pb-3">
            <h3 className="text-sm font-extrabold text-amber-300 flex items-center gap-2">
              <Sparkles className="w-4 h-4" /> Novo Template Personalizado
            </h3>
            <button
              onClick={() => setIsCreating(false)}
              className="text-xs text-stone-400 hover:text-white"
            >
              Cancelar ✕
            </button>
          </div>

          <div className="space-y-3">
            <div>
              <label className="text-xs font-bold text-stone-300 block mb-1">Nome do Template</label>
              <input
                type="text"
                placeholder="Ex: Oferta Grupo VIP WhatsApp"
                value={newTemplateName}
                onChange={(e) => setNewTemplateName(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-[#151a26] border border-[#1e2636] rounded-xl text-xs text-white focus:outline-none focus:border-amber-500"
              />
            </div>

            {/* Variáveis Dinâmicas */}
            <div>
              <span className="text-[11px] font-bold text-[#93a0b5] block mb-1.5">
                Clique para Inserir Variável Dinâmica:
              </span>
              <div className="flex flex-wrap gap-2">
                {TEMPLATE_VARIABLES.map((v) => (
                  <button
                    key={v.tag}
                    type="button"
                    onClick={() => insertVariable(v.tag, 'new')}
                    className="px-2.5 py-1 bg-[#151a26] hover:bg-amber-500/20 text-amber-300 border border-[#1e2636] hover:border-amber-500/40 rounded-lg text-xs font-mono font-bold transition-all"
                    title={v.desc}
                  >
                    + {v.tag}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="text-xs font-bold text-stone-300 block mb-1">Conteúdo da Mensagem</label>
              <textarea
                rows={6}
                placeholder="Digite o modelo de mensagem..."
                value={newTemplateBody}
                onChange={(e) => setNewTemplateBody(e.target.value)}
                className="w-full p-3 bg-[#151a26] border border-[#1e2636] rounded-xl text-xs text-white font-mono focus:outline-none focus:border-amber-500 leading-relaxed"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setIsCreating(false)}
                className="px-4 py-2 bg-[#151a26] text-stone-300 rounded-xl text-xs font-bold hover:bg-stone-800"
              >
                Cancelar
              </button>
              <button
                onClick={handleSaveNew}
                className="px-5 py-2 bg-amber-500 hover:bg-amber-400 text-stone-950 rounded-xl text-xs font-extrabold flex items-center gap-1.5"
              >
                <Save className="w-4 h-4" />
                Salvar Template
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Editor de Edição */}
      {editingId && (
        <div className="p-5 bg-[#0e1119] border border-blue-500/40 rounded-2xl space-y-4 animate-fadeIn shadow-xl">
          <div className="flex items-center justify-between border-b border-[#1e2636] pb-3">
            <h3 className="text-sm font-extrabold text-blue-400 flex items-center gap-2">
              <Edit3 className="w-4 h-4" /> Editar Template
            </h3>
            <button onClick={() => setEditingId(null)} className="text-xs text-stone-400 hover:text-white">
              Cancelar ✕
            </button>
          </div>

          <div className="space-y-3">
            <div>
              <label className="text-xs font-bold text-stone-300 block mb-1">Nome do Template</label>
              <input
                type="text"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-[#151a26] border border-[#1e2636] rounded-xl text-xs text-white focus:outline-none focus:border-blue-500"
              />
            </div>

            {/* Variáveis Dinâmicas */}
            <div>
              <span className="text-[11px] font-bold text-[#93a0b5] block mb-1.5">
                Clique para Inserir Variável:
              </span>
              <div className="flex flex-wrap gap-2">
                {TEMPLATE_VARIABLES.map((v) => (
                  <button
                    key={v.tag}
                    type="button"
                    onClick={() => insertVariable(v.tag, 'edit')}
                    className="px-2.5 py-1 bg-[#151a26] hover:bg-blue-500/20 text-blue-300 border border-[#1e2636] hover:border-blue-500/40 rounded-lg text-xs font-mono font-bold transition-all"
                  >
                    + {v.tag}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="text-xs font-bold text-stone-300 block mb-1">Conteúdo da Mensagem</label>
              <textarea
                rows={6}
                value={editBody}
                onChange={(e) => setEditBody(e.target.value)}
                className="w-full p-3 bg-[#151a26] border border-[#1e2636] rounded-xl text-xs text-white font-mono focus:outline-none focus:border-blue-500 leading-relaxed"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setEditingId(null)}
                className="px-4 py-2 bg-[#151a26] text-stone-300 rounded-xl text-xs font-bold"
              >
                Cancelar
              </button>
              <button
                onClick={handleSaveEdit}
                className="px-5 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-extrabold flex items-center gap-1.5"
              >
                <Save className="w-4 h-4" />
                Salvar Alterações
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Lista de Templates */}
      {allTemplates.length === 0 ? (
        <div className="p-12 text-center bg-[#0e1119] border border-[#1e2636] rounded-2xl space-y-3">
          <LayoutTemplate className="w-10 h-10 text-stone-600 mx-auto" />
          <h3 className="text-sm font-bold text-stone-300">Nenhum template encontrado</h3>
          <p className="text-xs text-[#93a0b5]">Clique em "Criar Novo Template" ou "Gerar com IA" para adicionar um modelo de mensagem.</p>
          {deletedPresetIds.length > 0 && (
            <button
              onClick={handleRestorePresets}
              className="mt-2 px-4 py-2 bg-amber-500/20 text-amber-300 border border-amber-500/30 rounded-xl text-xs font-extrabold hover:bg-amber-500/30 inline-flex items-center gap-2"
            >
              <RotateCcw className="w-4 h-4" />
              Restaurar Templates Padrão
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {allTemplates.map((tmpl) => {
            const isPreset = tmpl.id.startsWith('preset_');
            const isAi = tmpl.id.includes('ai_');
            return (
              <div
                key={tmpl.id}
                className="p-5 bg-[#0e1119] border border-[#1e2636] hover:border-stone-700 rounded-2xl flex flex-col justify-between gap-4 transition-all shadow-lg"
              >
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-extrabold text-white truncate max-w-[200px]">
                      {tmpl.name}
                    </span>
                    {isPreset ? (
                      <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-blue-500/20 text-blue-300 border border-blue-500/30">
                        Padrão
                      </span>
                    ) : isAi ? (
                      <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/30 flex items-center gap-1">
                        <Sparkles className="w-3 h-3 text-purple-300" />
                        IA
                      </span>
                    ) : (
                      <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30">
                        Personalizado
                      </span>
                    )}
                  </div>

                  {tmpl.description && (
                    <p className="text-[11px] text-[#93a0b5]">{tmpl.description}</p>
                  )}

                  <div className="p-3 bg-[#151a26] border border-[#1e2636] rounded-xl text-xs font-mono text-stone-300 whitespace-pre-line leading-relaxed max-h-36 overflow-y-auto">
                    {tmpl.template}
                  </div>
                </div>

                {/* Botões de Ação */}
                <div className="flex items-center justify-between pt-2 border-t border-[#1e2636] text-xs">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(tmpl.template);
                        setCopiedId(tmpl.id);
                        setTimeout(() => setCopiedId(null), 2000);
                      }}
                      className="px-3 py-1.5 bg-[#151a26] hover:bg-stone-800 text-stone-300 rounded-lg font-bold flex items-center gap-1.5 transition-all"
                    >
                      {copiedId === tmpl.id ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5 text-stone-400" />}
                      {copiedId === tmpl.id ? 'Copiado!' : 'Copiar'}
                    </button>

                    {defaultTemplateId === tmpl.id ? (
                      <span className="text-[10px] font-bold px-2.5 py-1.5 bg-amber-400/10 text-amber-300 border border-amber-400/20 rounded-lg flex items-center gap-1">
                        ★ Padrão Ativo
                      </span>
                    ) : (
                      <button
                        onClick={() => onSaveDefaultTemplateId?.(tmpl.id)}
                        className="text-[10px] font-bold px-2.5 py-1.5 bg-[#0e1119] hover:bg-amber-400 hover:text-[#0e1119] text-stone-400 border border-[#1e2636] rounded-lg transition-all flex items-center gap-1"
                      >
                        ☆ Usar como Padrão
                      </button>
                    )}
                  </div>

                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => handleDuplicate(tmpl)}
                      className="p-1.5 text-stone-400 hover:text-white bg-[#151a26] hover:bg-stone-800 rounded-lg transition-colors"
                      title="Duplicar Template"
                    >
                      <Copy className="w-3.5 h-3.5" />
                    </button>

                    <button
                      onClick={() => handleStartEdit(tmpl)}
                      className="p-1.5 text-blue-400 hover:text-blue-300 bg-blue-500/10 hover:bg-blue-500/20 rounded-lg transition-colors"
                      title="Editar Template"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                    </button>

                    <button
                      onClick={() => setTemplateToDelete(tmpl)}
                      className="p-1.5 text-red-400 hover:text-red-300 bg-red-500/10 hover:bg-red-500/20 rounded-lg transition-colors"
                      title="Excluir Template"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* MODAL DE GERAR TEMPLATE COM IA */}
      {isAiModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
          <div className="relative w-full max-w-lg bg-[#0e1119] border border-purple-500/40 rounded-2xl p-6 space-y-5 shadow-2xl">
            <div className="flex items-center justify-between border-b border-[#1e2636] pb-3">
              <div className="flex items-center gap-2 text-purple-300 font-extrabold text-sm">
                <Wand2 className="w-5 h-5 text-purple-400" />
                <span>Gerador de Templates com IA (Gemini)</span>
              </div>
              <button
                onClick={() => {
                  setIsAiModalOpen(false);
                  setGeneratedResult(null);
                }}
                className="text-stone-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="text-xs font-bold text-stone-300 block mb-1">
                  1. Estilo / Objetivo da Mensagem:
                </label>
                <select
                  value={aiCategory}
                  onChange={(e) => setAiCategory(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-[#151a26] border border-[#1e2636] rounded-xl text-xs text-white focus:outline-none focus:border-purple-500"
                >
                  <option value="Urgência & Escassez (Estoque Baixo)">🚨 Urgência & Escassez (Estoque Baixo / Preço caindo)</option>
                  <option value="Recomendação Pessoal / Amigável (UGC)">⭐️ Recomendação Pessoal / Dica de amigo</option>
                  <option value="Direto e Objetivo (Grupo WhatsApp)">⚡️ Direto e Objetivo (Para grupos de disparo)</option>
                  <option value="Cupom Exclusivo & Desconto Secreto">🎟️ Cupom Exclusivo & Desconto Secreto</option>
                  <option value="Achadinho Viral / Curiosidade">🛍️ Achadinho Viral / Curiosidade Shopee & ML</option>
                  <option value="Conversacional para Direct / Venda Individual">💬 Conversacional para Direct / Xat 1x1</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-bold text-stone-300 block mb-1">
                  2. Nicho ou Categoria de Produto:
                </label>
                <select
                  value={aiNiche}
                  onChange={(e) => setAiNiche(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-[#151a26] border border-[#1e2636] rounded-xl text-xs text-white focus:outline-none focus:border-purple-500"
                >
                  <option value="Achadinhos & Ofertas Gerais">🔥 Achadinhos & Ofertas Gerais</option>
                  <option value="Eletrônicos & Tecnologia">📱 Eletrônicos & Tecnologia</option>
                  <option value="Moda, Beleza & Cuidados Pessoais">💄 Moda, Beleza & Cuidados Pessoais</option>
                  <option value="Casa, Cozinha & Utilidades Domésticas">🏠 Casa, Cozinha & Utilidades</option>
                  <option value="Ferramentas & Acessórios Automotivos">🚗 Ferramentas & Automotivo</option>
                  <option value="Infantil & Brinquedos">🧸 Infantil & Brinquedos</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-bold text-stone-300 block mb-1">
                  3. Instrução Personalizada (Opcional):
                </label>
                <input
                  type="text"
                  placeholder="Ex: Use emojis de fogo e destaque que tem frete grátis liberado"
                  value={aiCustomPrompt}
                  onChange={(e) => setAiCustomPrompt(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-[#151a26] border border-[#1e2636] rounded-xl text-xs text-white focus:outline-none focus:border-purple-500"
                />
              </div>

              {aiError && (
                <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-xs text-red-300">
                  {aiError}
                </div>
              )}

              {/* Resultado Gerado */}
              {generatedResult && (
                <div className="p-4 bg-[#151a26] border border-purple-500/50 rounded-xl space-y-3 animate-fadeIn">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-extrabold text-purple-300 flex items-center gap-1.5">
                      <Sparkles className="w-4 h-4 text-purple-400" />
                      {generatedResult.name}
                    </span>
                    <span className="text-[10px] font-bold text-purple-400 bg-purple-500/20 px-2 py-0.5 rounded-md border border-purple-500/30">
                      Resultado IA
                    </span>
                  </div>
                  <p className="text-[11px] text-[#93a0b5]">{generatedResult.description}</p>
                  <div className="p-3 bg-[#0e1119] border border-[#1e2636] rounded-lg text-xs font-mono text-stone-200 whitespace-pre-line leading-relaxed max-h-40 overflow-y-auto">
                    {generatedResult.template}
                  </div>
                </div>
              )}
            </div>

            <div className="flex items-center justify-between gap-3 pt-3 border-t border-[#1e2636]">
              <button
                onClick={() => {
                  setIsAiModalOpen(false);
                  setGeneratedResult(null);
                }}
                className="px-4 py-2 bg-[#151a26] text-stone-300 hover:bg-stone-800 rounded-xl text-xs font-bold transition-all"
              >
                Cancelar
              </button>

              <div className="flex items-center gap-2">
                {generatedResult ? (
                  <>
                    <button
                      onClick={handleGenerateTemplateWithAi}
                      disabled={isGeneratingAi}
                      className="px-3.5 py-2 bg-[#151a26] hover:bg-stone-800 text-purple-300 rounded-xl text-xs font-bold transition-all border border-purple-500/30 flex items-center gap-1.5"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      <span>Gerar Outro</span>
                    </button>
                    <button
                      onClick={handleApplyAiResult}
                      className="px-5 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-xl text-xs font-extrabold flex items-center gap-1.5 transition-all shadow-lg shadow-purple-950/50"
                    >
                      <Check className="w-4 h-4" />
                      Salvar este Template
                    </button>
                  </>
                ) : (
                  <button
                    onClick={handleGenerateTemplateWithAi}
                    disabled={isGeneratingAi}
                    className="px-5 py-2 bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white rounded-xl text-xs font-extrabold flex items-center gap-2 transition-all shadow-lg shadow-purple-950/50"
                  >
                    {isGeneratingAi ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>Gerando modelo com IA...</span>
                      </>
                    ) : (
                      <>
                        <Wand2 className="w-4 h-4" />
                        <span>Gerar Modelo Agora</span>
                      </>
                    )}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* POP-UP MODAL DE CONFIRMAÇÃO DE EXCLUSÃO DE TEMPLATE */}
      {templateToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
          <div className="relative w-full max-w-md bg-[#0e1119] border border-[#1e2636] rounded-2xl p-6 space-y-5 shadow-2xl">
            <div className="flex items-center justify-between border-b border-[#1e2636] pb-3">
              <div className="flex items-center gap-2 text-red-400 font-extrabold text-sm">
                <AlertTriangle className="w-5 h-5 shrink-0" />
                <span>Confirmar Exclusão de Template</span>
              </div>
              <button
                onClick={() => setTemplateToDelete(null)}
                className="text-stone-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3">
              <p className="text-xs text-stone-300 leading-relaxed">
                Tem certeza de que deseja excluir o template <strong className="text-white">"{templateToDelete.name}"</strong>?
              </p>

              <div className="p-3 bg-[#151a26] border border-[#1e2636] rounded-xl text-xs font-mono text-stone-400 line-clamp-3">
                {templateToDelete.template}
              </div>

              <p className="text-[11px] text-red-400/90 font-semibold">
                Esta ação removerá o modelo da sua lista de opções.
              </p>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2 border-t border-[#1e2636]">
              <button
                onClick={() => setTemplateToDelete(null)}
                className="px-4 py-2 bg-[#151a26] text-stone-300 hover:bg-stone-800 rounded-xl text-xs font-bold transition-all"
              >
                Cancelar
              </button>
              <button
                onClick={confirmDeleteTemplate}
                className="px-5 py-2 bg-red-600 hover:bg-red-500 text-white rounded-xl text-xs font-extrabold flex items-center gap-1.5 transition-all shadow-lg shadow-red-950/50"
              >
                <Trash2 className="w-4 h-4" />
                Excluir Definitivamente
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
