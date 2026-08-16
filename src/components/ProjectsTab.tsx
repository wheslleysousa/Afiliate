import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  collection,
  doc,
  setDoc,
  deleteDoc,
  onSnapshot,
  query,
  orderBy,
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { apiFetch } from '../utils/apiBase';
import type {
  VideoProject,
  VideoScriptScene,
  ApiKeysConfig,
  GlobalProduct,
  VideoProjectExtraProduct,
  VideoProjectStyleContext,
} from '../types';
import {
  Film,
  PlusCircle,
  Clock,
  CheckCircle2,
  Copy,
  Check,
  Trash2,
  ArrowRight,
  ArrowLeft,
  Eye,
  FileText,
  ChevronLeft,
  Video,
  Instagram,
  Sparkles,
  AlertTriangle,
  ChevronRight,
  Loader2,
  RefreshCw,
  Edit3,
  AlignLeft,
  Hash,
  Layers,
  Upload,
  UploadCloud,
  Play,
  FileVideo,
  Image as ImageIcon,
  Plus,
  X,
  Link as LinkIcon,
  HelpCircle,
  Sliders,
  ShoppingBag,
  Flame,
} from 'lucide-react';

// Sanitizador recursivo para remover valores undefined antes de enviar para o Firestore
function sanitizeForFirestore<T>(data: T): T {
  if (data === null || data === undefined) {
    return null as unknown as T;
  }
  if (Array.isArray(data)) {
    return data.map((item) => sanitizeForFirestore(item)) as unknown as T;
  }
  if (typeof data === 'object') {
    const clean: Record<string, any> = {};
    for (const [key, value] of Object.entries(data as Record<string, any>)) {
      if (value !== undefined) {
        clean[key] = sanitizeForFirestore(value);
      }
    }
    return clean as T;
  }
  return data;
}

export interface VideoStyleDefinition {
  id: string;
  name: string;
  desc: string;
  example: string;
  tag: string;
}

// ════════════════════════════════════════════════════════════════════════
// 15 ESTILOS VIRALIZÁVEIS PARA TIKTOK
// ════════════════════════════════════════════════════════════════════════
export const TIKTOK_VIDEO_STYLES: VideoStyleDefinition[] = [
  {
    id: 'tk_achadinho_secreto',
    name: '1. Achadinho Secreto do TikTok',
    desc: 'Formato de descoberta irresistível no estilo "Comprei no TikTok e olha o que chegou".',
    example: 'Mostre o pacote sendo aberto com empolgação e teste imediato do produto.',
    tag: 'Viralidade',
  },
  {
    id: 'tk_pare_usar_errado',
    name: '2. "Pare de Usar Isso do Jeito Errado"',
    desc: 'Gancho educativo que corrige um hábito comum e apresenta o produto como solução instantânea.',
    example: 'Você passou a vida toda usando o método tradicional que não funciona direito.',
    tag: 'Retenção Máxima',
  },
  {
    id: 'tk_testando_virais',
    name: '3. Testando Produtos Virais da Internet',
    desc: 'Formato de teste sincero e sem filtro para checar se o produto é mito ou verdade.',
    example: 'Gastei meu dinheiro pra você não gastar o seu: será que funciona mesmo na prática?',
    tag: 'Prova Real',
  },
  {
    id: 'tk_antes_depois',
    name: '4. Antes vs. Depois Instantâneo',
    desc: 'Impacto visual chocante nos primeiros 2 segundos demonstrando a transformação.',
    example: 'Corte seco direto do estado caótico inicial para o resultado perfeito.',
    tag: 'Impacto Visual',
  },
  {
    id: 'tk_top3_achados',
    name: '5. Top 3 Achados Baratinhos',
    desc: 'Lista dinâmica de itens que parecem muito caros mas custam quase nada.',
    example: '3 coisas baratas da internet que facilitaram meu dia a dia.',
    tag: 'Alta Retenção',
  },
  {
    id: 'tk_asmr_demonstracao',
    name: '6. ASMR & Demonstração Hipnótica',
    desc: 'Foco em sons satisfatórios, close-ups e no prazer visual de ver o item funcionando.',
    example: 'Áudio nítido com foco nos cliques, embalagem e encaixes do produto.',
    tag: 'Satisfatório',
  },
  {
    id: 'tk_dilema_cotidiano',
    name: '7. Dilema do Cotidiano (Storytelling)',
    desc: 'História rápida de um problema diário comum com o qual qualquer pessoa se identifica.',
    example: 'Eu sempre passava raiva com isso até encontrar esse produto por acaso.',
    tag: 'Conexão Emocional',
  },
  {
    id: 'tk_review_sincero',
    name: '8. Review Sincero Sem Filtro',
    desc: 'Análise transparente destacando pontos fortes e como o produto resolve a dor.',
    example: 'Vou contar a verdade que ninguém fala sobre esse produto depois de testar.',
    tag: 'Autoridade',
  },
  {
    id: 'tk_preco_chocante',
    name: '9. Preço Chocante (Expectativa vs. Realidade)',
    desc: 'Contraste forte entre a alta qualidade aparente e o preço surpreendentemente baixo.',
    example: 'Parece que paguei 300 reais mas custou menos de 50.',
    tag: 'Custo-Benefício',
  },
  {
    id: 'tk_funcao_oculta',
    name: '10. Função Oculta / Truque Secreto',
    desc: 'Revelação de uma utilidade pouco conhecida do item que desperta curiosidade.',
    example: 'Quase ninguém sabe que esse item tem esse modo de uso escondido.',
    tag: 'Curiosidade',
  },
  {
    id: 'tk_desafio_7dias',
    name: '11. Desafio / Prova dos 7 Dias',
    desc: 'Formato cronológico curto mostrando o impacto do produto ao longo da semana.',
    example: 'Testei isso durante 7 dias seguidos e veja o resultado real.',
    tag: 'Prova Social',
  },
  {
    id: 'tk_reacao_genuina',
    name: '12. Reação Genuína & Espanto',
    desc: 'Expressão de surpresa espontânea com a facilidade ou potência do produto.',
    example: 'Minha reação real usando esse produto pela primeira vez.',
    tag: 'Autenticidade',
  },
  {
    id: 'tk_comparativo_lado_a_lado',
    name: '13. Comparativo Lado a Lado',
    desc: 'Comparação visual entre o método tradicional demorado e a solução do produto.',
    example: 'O jeito antigo que demora 30 minutos vs. 15 segundos com esse item.',
    tag: 'Praticidade',
  },
  {
    id: 'tk_unboxing_express',
    name: '14. Unboxing Express & Primeiras Impressões',
    desc: 'Abertura rápida com cortes dinâmicos e entusiasmo pelo item recebido.',
    example: 'Chegou minha encomenda mais esperada do mês e superou as expectativas.',
    tag: 'Descoberta',
  },
  {
    id: 'tk_alerta_achadinho',
    name: '15. Alerta de Achadinho Relâmpago',
    desc: 'Senso de novidade e oportunidade rápida para prender a atenção no feed.',
    example: 'Se você gosta de achadinhos úteis para o seu dia a dia, não passa esse vídeo.',
    tag: 'Oportunidade',
  },
];

// ════════════════════════════════════════════════════════════════════════
// 15 ESTILOS DE ENGAJAMENTO & ESTÉTICA PARA INSTAGRAM REELS
// ════════════════════════════════════════════════════════════════════════
export const INSTAGRAM_VIDEO_STYLES: VideoStyleDefinition[] = [
  {
    id: 'ig_estetica_rotina',
    name: '1. Estética & Rotina Elegante (Aesthetic)',
    desc: 'Integração do produto em um cenário agradável, iluminado e harmonioso.',
    example: 'Mostre o produto integrado com elegância à rotina matinal ou organização da casa.',
    tag: 'Estética & Desejo',
  },
  {
    id: 'ig_guia_tutorial',
    name: '2. Guia Prático / Tutorial em 3 Passos',
    desc: 'Instrução clara e objetiva de como usar o produto em poucos segundos.',
    example: 'Passo 1, 2 e 3 para ter o melhor resultado sem complicação.',
    tag: 'Didático',
  },
  {
    id: 'ig_dica_de_ouro',
    name: '3. Dica de Ouro que Ninguém Conta',
    desc: 'Recomendação valiosa em tom de conselho íntimo para gerar salvamentos.',
    example: 'Salva esse post porque essa dica vai transformar sua rotina.',
    tag: 'Compartilhamentos',
  },
  {
    id: 'ig_transformacao_espaco',
    name: '4. Transformação de Espaço / Visual',
    desc: 'Mudança notável e estética no ambiente ou na aparência pessoal.',
    example: 'Como transformei esse espaço gastando quase nada com um item simples.',
    tag: 'Transformação',
  },
  {
    id: 'ig_review_closeup',
    name: '5. Review Elegante em Close-Up',
    desc: 'Tomadas macro valorizando textura, materiais e acabamento refinado.',
    example: 'Câmera aproximada destacando os detalhes de acabamento e durabilidade.',
    tag: 'Qualidade Premium',
  },
  {
    id: 'ig_achados_valem_centavo',
    name: '6. Achados que Valem Cada Centavo',
    desc: 'Curadoria de itens indispensáveis com alta percepção de valor.',
    example: 'Se você pudesse comprar apenas uma coisa este mês, seria essa.',
    tag: 'Indispensável',
  },
  {
    id: 'ig_carrossel_video',
    name: '7. Carrossel em Vídeo (Micro-Tópicos)',
    desc: 'Vídeo estruturado em tópicos curtos e visualmente divididos na tela.',
    example: '3 motivos pelos quais esse produto virou meu favorito.',
    tag: 'Alta Retenção',
  },
  {
    id: 'ig_historia_superacao',
    name: '8. História Real de Solução de um Problema',
    desc: 'Relato empático de como o produto resolveu uma frustração pessoal.',
    example: 'Passei meses procurando algo que realmente funcionasse até achar isso.',
    tag: 'Conexão Pessoal',
  },
  {
    id: 'ig_investimento_inteligente',
    name: '9. Investimento Inteligente (Custo-Benefício)',
    desc: 'Análise racional demonstrando a economia e durabilidade do produto.',
    example: 'Por que comprar isso é muito mais econômico a longo prazo.',
    tag: 'Racionalidade',
  },
  {
    id: 'ig_desafio_rotina',
    name: '10. Desafio Prático na Rotina',
    desc: 'Demonstração do produto sendo colocado à prova no cotidiano real.',
    example: 'Coloquei o produto para rodar na minha rotina e veja o que aconteceu.',
    tag: 'Uso Real',
  },
  {
    id: 'ig_mini_vlog',
    name: '11. Mini Vlog de Experiência',
    desc: 'Narrativa ágil mostrando da chegada do pacote até o uso no dia a dia.',
    example: 'Um dia comigo testando esse novo achado para a casa.',
    tag: 'Storytelling',
  },
  {
    id: 'ig_duvidas_frequentes',
    name: '12. Respondendo Dúvidas Frequentes',
    desc: 'Esclarecimento direto das principais dúvidas da audiência sobre o item.',
    example: 'Respondendo as perguntas que mais recebi sobre esse produto.',
    tag: 'Quebra de Dúvidas',
  },
  {
    id: 'ig_comparativo_elegante',
    name: '13. Comparativo Visual Sofisticado',
    desc: 'Comparação equilibrada destacando as vantagens claras do produto.',
    example: 'Diferença visível de praticidade e organização com o produto.',
    tag: 'Elegância',
  },
  {
    id: 'ig_diferencial_unico',
    name: '14. Destaque de Funcionalidade Única',
    desc: 'Foco exclusivo no recurso mais impressionante do produto.',
    example: 'O motivo exato pelo qual todo mundo está comentando sobre esse item.',
    tag: 'Destaque',
  },
  {
    id: 'ig_comente_quero',
    name: '15. Chamada para Direct (Comente "QUERO")',
    desc: 'Estrutura otimizada para geração massiva de comentários e envio no direct.',
    example: 'Comente QUERO que te envio o link com cupom direto no direct.',
    tag: 'Geração de Leads',
  },
];

// ════════════════════════════════════════════════════════════════════════
// 15 ESTILOS DE CRIATIVOS / ANÚNCIOS / TRÁFEGO PAGO
// ════════════════════════════════════════════════════════════════════════
export const CREATIVE_VIDEO_STYLES: VideoStyleDefinition[] = [
  {
    id: 'cr_ugc_autentico',
    name: '1. UGC Autêntico em Primeira Pessoa',
    desc: 'Criador falando com a câmera frontal de forma natural, sem parecer anúncio.',
    example: 'Gente, eu precisava vir aqui mostrar o que acabou de chegar pra mim.',
    tag: 'UGC Nativo',
  },
  {
    id: 'cr_dor_solucao',
    name: '2. Problema Latente vs. Alívio Imediato (PAS)',
    desc: 'Exposição da dor nos primeiros 3s e apresentação do produto como alívio definitivo.',
    example: 'Cansado de passar por essa dor de cabeça todos os dias?',
    tag: 'Direct Response',
  },
  {
    id: 'cr_quebra_objecao',
    name: '3. Quebra da Maior Objeção de Compra',
    desc: 'Aborda e destrói a principal dúvida de compra logo nos primeiros segundos.',
    example: 'Se você acha que isso não funciona, veja esse teste agora.',
    tag: 'Quebra de Objeções',
  },
  {
    id: 'cr_demonstracao_hipnotica',
    name: '4. Demonstração Hipnótica de Resultado',
    desc: 'Foco no produto em ação entregando o benefício principal sem rodeios.',
    example: 'Veja em 5 segundos como ele entrega o resultado perfeito.',
    tag: 'Conversão Rápida',
  },
  {
    id: 'cr_react_viral',
    name: '5. React a Vídeo Viral (Anúncio)',
    desc: 'Criador reagindo ao vídeo viral e provando que o produto entrega o mesmo.',
    example: 'Vi esse vídeo viralizar na internet e comprei pra comprovar se é verdade.',
    tag: 'React & Prova',
  },
  {
    id: 'cr_oferta_escassez',
    name: '6. Oferta Relâmpago & Escassez Real',
    desc: 'Foco nas condições de preço, desconto especial e término do lote promocional.',
    example: 'Lote promocional liberado por tempo limitado com desconto especial.',
    tag: 'Urgência',
  },
  {
    id: 'cr_depoimento_real',
    name: '7. Depoimento Real de Cliente',
    desc: 'Estrutura de prova social autêntica baseada na experiência real de uso.',
    example: 'Minha experiência real após usar o produto no dia a dia.',
    tag: 'Prova Social',
  },
  {
    id: 'cr_comparativo_concorrente',
    name: '8. Comparativo com Alternativas Caras',
    desc: 'Demonstração de que o produto entrega a mesma qualidade de marcas caras.',
    example: 'Por que pagar 500 reais se esse produto faz exatamente o mesmo por uma fração?',
    tag: 'Ancoragem de Preço',
  },
  {
    id: 'cr_garantia_risco_zero',
    name: '9. Garantia Blindada & Risco Zero',
    desc: 'Foco na segurança da compra, devolução garantida e entrega rastreada.',
    example: 'Você compra, testa e se não gostar pode devolver sem burocracia.',
    tag: 'Risco Zero',
  },
  {
    id: 'cr_unboxing_comercial',
    name: '10. Unboxing Comercial Focado em Benefícios',
    desc: 'Abertura do pacote destacando a integridade da embalagem e itens inclusos.',
    example: 'Tudo o que vem na caixa e como começar a usar em 1 minuto.',
    tag: 'Clareza Total',
  },
  {
    id: 'cr_teste_extremo',
    name: '11. Teste Extremo de Resistência',
    desc: 'Colocando o produto em situações difíceis para demonstrar durabilidade real.',
    example: 'Testamos no limite para você não ter dúvidas da qualidade e resistência.',
    tag: 'Confiança',
  },
  {
    id: 'cr_antes_depois_tempo',
    name: '12. Antes e Depois Cronometrado',
    desc: 'Demonstração da velocidade em que o produto resolve a tarefa com cronômetro.',
    example: 'Cronometrando o tempo que leva para resolver o problema na prática.',
    tag: 'Rapidez',
  },
  {
    id: 'cr_3razoes_compra',
    name: '13. 3 Razões Para Garantir Hoje',
    desc: 'Formato direto listando 3 argumentos fortes e racionais de compra.',
    example: 'Motivo 1: Praticidade. Motivo 2: Durabilidade. Motivo 3: Preço promocional.',
    tag: 'Racional de Venda',
  },
  {
    id: 'cr_economia_bolso',
    name: '14. Economia Inteligente no Bolso',
    desc: 'Cálculo demonstrando o quanto o comprador economiza ao adquirir o produto.',
    example: 'Veja quanto você gasta sem isso vs. quanto economiza com essa solução.',
    tag: 'Retorno',
  },
  {
    id: 'cr_cta_direta',
    name: '15. Chamada Direta para Ação (Direct Response)',
    desc: 'Roteiro focado 100% em conversão rápida com CTA clara para clique imediato.',
    example: 'Clique no botão "Saiba Mais" abaixo e garanta o seu com desconto especial.',
    tag: 'Conversão Imediata',
  },
];

// Helper para obter os estilos corretos por plataforma
export function getVideoStylesForPlatform(platform: 'tiktok' | 'instagram' | 'creative'): VideoStyleDefinition[] {
  if (platform === 'tiktok') return TIKTOK_VIDEO_STYLES;
  if (platform === 'instagram') return INSTAGRAM_VIDEO_STYLES;
  return CREATIVE_VIDEO_STYLES;
}

const POPULAR_CATEGORIES = [
  'Eletrônicos & Tech',
  'Casa & Cozinha',
  'Beleza & Cuidados',
  'Moda & Acessórios',
  'Ferramentas & Construção',
  'Saúde & Fitness',
  'Brinquedos & Hobbies',
  'Automotivo',
  'Organização & Decoração',
];

interface ProjectsTabProps {
  uid: string;
  apiKeys?: ApiKeysConfig;
  initialProduct?: Partial<GlobalProduct> | null;
  onClearInitialProduct?: () => void;
}

export const ProjectsTab: React.FC<ProjectsTabProps> = ({
  uid,
  apiKeys,
  initialProduct,
  onClearInitialProduct,
}) => {
  // Modo de visualização: 'dashboard' | 'creator' | 'view_ready'
  const [viewMode, setViewMode] = useState<'dashboard' | 'creator' | 'view_ready'>('dashboard');

  const [projects, setProjects] = useState<VideoProject[]>([]);
  const [loadingProjects, setLoadingProjects] = useState(true);

  // Filtros de listagem no Dashboard
  const [showAllDrafts, setShowAllDrafts] = useState(false);
  const [showAllReady, setShowAllReady] = useState(false);

  // Modal de Exclusão
  const [projectToDelete, setProjectToDelete] = useState<VideoProject | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Estado do Quiz Atual (Passos 1 a 11)
  // 1: Nome -> 2: Preço -> 3: Fotos -> 4: Categoria -> 5: Descrição -> 6: Plataforma -> 7: Duração -> 8: Estilo (15 opções) -> 9: Informações & Mídias Específicas do Estilo (Adaptativo) -> 10: Ganchos (15 sob medida) -> 11: CTA & Finalizar
  const TOTAL_STEPS = 11;
  const [currentQuizStep, setCurrentQuizStep] = useState<number>(1);
  const [currentProjectId, setCurrentProjectId] = useState<string>(() => `proj_${Date.now()}`);

  // Campos do Produto Principal
  const [productTitle, setProductTitle] = useState('');
  const [productPriceTo, setProductPriceTo] = useState('');
  const [productPriceFrom, setProductPriceFrom] = useState('');
  const [productCategory, setProductCategory] = useState('');
  const [productDescription, setProductDescription] = useState('');
  const [productImageUrl, setProductImageUrl] = useState('');
  const [productPlatform, setProductPlatform] = useState('mercadolivre');
  const [productOriginalLink, setProductOriginalLink] = useState('');

  // Produtos adicionais (para Top 3 / Lista / Carrossel / Teste Comparativo)
  const [extraProducts, setExtraProducts] = useState<VideoProjectExtraProduct[]>([
    { title: '', price_to: '', highlight: '', image_url: '', video_url: '' },
    { title: '', price_to: '', highlight: '', image_url: '', video_url: '' },
  ]);

  // Contexto e Mídias Específicas do Estilo Selecionado
  const [styleContext, setStyleContext] = useState<VideoProjectStyleContext>({
    productCountMode: 'single',
    testType: '',
    testResult: '',
    testMediaUrl: '',
    reactVideoUrl: '',
    reactVideoName: '',
    reactKeyMoment: '',
    reactResponseAngle: '',
    beforeDescription: '',
    afterDescription: '',
    transformationTime: '',
    beforeMediaUrl: '',
    afterMediaUrl: '',
    competitorName: '',
    competitorPrice: '',
    competitorFlaw: '',
    testimonialUsageTime: '',
    testimonialMainResult: '',
    unboxingItems: '',
    commonMistake: '',
    correctWay: '',
    extraNotes: '',
    uploadedVideos: [],
  });

  // Plataforma do Vídeo
  const [targetPlatform, setTargetPlatform] = useState<'tiktok' | 'instagram' | 'creative'>('tiktok');

  // Configurações do Roteiro
  const [duration, setDuration] = useState<'15s' | '30s' | '60s' | '90s'>('30s');
  const [selectedStyleId, setSelectedStyleId] = useState<string>('tk_achadinho_secreto');

  // Ganchos Gerados Dinamicamente (15 Opções sob medida)
  const [generatedHooks, setGeneratedHooks] = useState<string[]>([]);
  const [loadingHooks, setLoadingHooks] = useState<boolean>(false);
  const [selectedHook, setSelectedHook] = useState<string>('');
  const [isEditingHookCustom, setIsEditingHookCustom] = useState<boolean>(false);

  // CTA
  const [customCta, setCustomCta] = useState<string>('');

  // Roteiro Final Gerado
  const [generatedScript, setGeneratedScript] = useState<{
    title: string;
    hook: string;
    scenes: VideoScriptScene[];
    cta: string;
    fullText: string;
    cleanText?: string;
    suggestedTitles?: string[];
    hashtags?: string[];
  } | null>(null);
  const [generatingScript, setGeneratingScript] = useState(false);

  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Helper para atualizar campos específicos do styleContext
  const updateStyleContext = (key: keyof VideoProjectStyleContext, value: any) => {
    setStyleContext((prev) => ({
      ...prev,
      [key]: value,
    }));
  };

  // Helper para atualizar produto extra
  const updateExtraProduct = (index: number, field: keyof VideoProjectExtraProduct, value: string) => {
    setExtraProducts((prev) => {
      const copy = [...prev];
      if (!copy[index]) {
        copy[index] = { title: '', price_to: '', highlight: '', image_url: '', video_url: '' };
      }
      copy[index] = { ...copy[index], [field]: value };
      return copy;
    });
  };

  // Helper de Upload de Arquivo Local com Leitura em Base64 / Data URL
  const handleFileUpload = (
    e: React.ChangeEvent<HTMLInputElement>,
    targetCallback: (dataUrl: string, fileName: string) => void
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const dataUrl = event.target?.result as string;
      targetCallback(dataUrl, file.name);
    };
    reader.readAsDataURL(file);
  };

  // Obter a lista de 15 estilos correspondentes à plataforma atual
  const availableStyles = useMemo(() => {
    return getVideoStylesForPlatform(targetPlatform);
  }, [targetPlatform]);

  // Se trocar a plataforma, garantir que o estilo selecionado pertença à nova plataforma
  useEffect(() => {
    const currentList = getVideoStylesForPlatform(targetPlatform);
    if (!currentList.some((s) => s.id === selectedStyleId)) {
      setSelectedStyleId(currentList[0].id);
    }
  }, [targetPlatform, selectedStyleId]);

  // Sugestões de CTA inteligentes por plataforma
  const ctaSuggestionsForPlatform = useMemo(() => {
    if (targetPlatform === 'tiktok') {
      return [
        'Comente "QUERO" para receber o link com desconto no seu direct!',
        'Link do produto fixado na Bio ou no primeiro comentário!',
        'Clica no link do meu perfil antes que esse lote com desconto termine!',
        'Comente "EU QUERO" que o link cai direto na sua mensagem!',
      ];
    }
    if (targetPlatform === 'instagram') {
      return [
        'Comente "QUERO" que te envio o link com cupom exclusivo no Direct!',
        'Link disponível nos Stories e no link da Bio!',
        'Salva esse Reels e comenta "QUERO" para garantir o menor preço!',
        'Clica no link da Bio e aproveite enquanto o cupom está ativo!',
      ];
    }
    // Criativo / Tráfego Pago
    return [
      'Clique no botão "Saiba Mais" abaixo e garanta o seu com desconto especial!',
      'Clique no link abaixo agora mesmo para aproveitar o frete grátis!',
      'Toque no botão e garanta o seu antes que o lote promocional encerre!',
      'Clique em "Comprar Agora" e receba na sua casa com garantia total!',
    ];
  }, [targetPlatform]);

  // Atualizar CTA padrão ao mudar plataforma se ainda estiver vazio
  useEffect(() => {
    if (!customCta || ctaSuggestionsForPlatform.includes(customCta)) {
      setCustomCta(ctaSuggestionsForPlatform[0]);
    }
  }, [ctaSuggestionsForPlatform]);

  // Carregar Projetos em tempo real ordenados por data descrescente
  useEffect(() => {
    if (!uid) return;
    setLoadingProjects(true);

    const q = query(
      collection(db, 'users', uid, 'videoProjects'),
      orderBy('updatedAt', 'desc')
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const projs: VideoProject[] = [];
        snapshot.forEach((d) => {
          projs.push({ id: d.id, ...d.data() } as VideoProject);
        });
        projs.sort((a, b) => {
          const timeA = new Date(a.updatedAt || a.createdAt || 0).getTime();
          const timeB = new Date(b.updatedAt || b.createdAt || 0).getTime();
          return timeB - timeA;
        });
        setProjects(projs);
        setLoadingProjects(false);
      },
      (err) => {
        console.error('[ProjectsTab] Erro ao carregar projetos:', err);
        setLoadingProjects(false);
      }
    );

    return () => unsubscribe();
  }, [uid]);

  // Se receber produto inicial (ex: vindo da busca ou modal de produto)
  useEffect(() => {
    if (initialProduct && initialProduct.title) {
      setCurrentProjectId(`proj_${Date.now()}`);
      setProductTitle(initialProduct.title || '');
      setProductPriceTo(initialProduct.price_to || '');
      setProductPriceFrom(initialProduct.price_from || '');
      setProductCategory(initialProduct.category || '');
      setProductDescription(initialProduct.description || '');
      setProductImageUrl(initialProduct.image_url || '');
      setProductPlatform(initialProduct.platform || 'mercadolivre');
      setProductOriginalLink(initialProduct.original_link || '');
      setTargetPlatform('tiktok');
      setSelectedStyleId('tk_achadinho_secreto');
      setExtraProducts([
        { title: '', price_to: '', highlight: '', image_url: '', video_url: '' },
        { title: '', price_to: '', highlight: '', image_url: '', video_url: '' },
      ]);
      setStyleContext({
        productCountMode: 'single',
        testType: '',
        testResult: '',
        testMediaUrl: '',
        reactVideoUrl: '',
        reactVideoName: '',
        reactKeyMoment: '',
        reactResponseAngle: '',
        beforeDescription: '',
        afterDescription: '',
        transformationTime: '',
        beforeMediaUrl: '',
        afterMediaUrl: '',
        competitorName: '',
        competitorPrice: '',
        competitorFlaw: '',
        testimonialUsageTime: '',
        testimonialMainResult: '',
        unboxingItems: '',
        commonMistake: '',
        correctWay: '',
        extraNotes: '',
        uploadedVideos: [],
      });
      setSelectedHook('');
      setGeneratedHooks([]);
      setGeneratedScript(null);
      setCurrentQuizStep(1);
      setViewMode('creator');

      if (onClearInitialProduct) {
        onClearInitialProduct();
      }
    }
  }, [initialProduct, onClearInitialProduct]);

  // Salvar Progresso Atual no Firestore (com sanitização completa)
  const saveProjectProgress = async (
    targetStatus: 'draft' | 'ready' = 'draft',
    stepNumber?: number,
    overrideScript?: any
  ) => {
    if (!uid || !productTitle.trim()) return;

    const stylesList = getVideoStylesForPlatform(targetPlatform);
    const styleObj = stylesList.find((s) => s.id === selectedStyleId) || stylesList[0];

    const rawProjectData = {
      id: currentProjectId,
      userId: uid,
      status: targetStatus,
      step: (stepNumber || currentQuizStep) as any,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      targetPlatform,
      product: {
        title: productTitle.trim(),
        price_to: productPriceTo || '',
        price_from: productPriceFrom || null,
        category: productCategory || null,
        description: productDescription || null,
        image_url: productImageUrl || null,
        platform: productPlatform || 'mercadolivre',
        original_link: productOriginalLink || '',
      },
      extraProducts: extraProducts.filter((p) => p.title.trim()),
      styleContext,
      settings: {
        duration,
        videoStyleId: selectedStyleId,
        videoStyleName: styleObj.name,
        selectedHook: selectedHook || null,
        customCta: customCta || ctaSuggestionsForPlatform[0],
      },
      script: overrideScript || generatedScript || null,
    };

    const projectData = sanitizeForFirestore(rawProjectData);

    try {
      await setDoc(doc(db, 'users', uid, 'videoProjects', currentProjectId), projectData, {
        merge: true,
      });
    } catch (e) {
      console.error('[ProjectsTab] Erro ao salvar projeto:', e);
    }
  };

  // Gerador dinâmico de 15 ganchos sob medida baseado em todo o contexto coletado
  const generateDynamicHooks = useCallback(
    async (forceRegenerate: boolean = false) => {
      if (!productTitle.trim()) return;
      if (generatedHooks.length > 0 && !forceRegenerate) return;

      setLoadingHooks(true);

      const stylesList = getVideoStylesForPlatform(targetPlatform);
      const styleObj = stylesList.find((s) => s.id === selectedStyleId) || stylesList[0];

      try {
        const res = await apiFetch('/api/gemini/generate-hooks', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            product: {
              title: productTitle.trim(),
              price_to: productPriceTo,
              price_from: productPriceFrom,
              category: productCategory,
              description: productDescription,
            },
            targetPlatform,
            selectedStyle: {
              id: styleObj.id,
              name: styleObj.name,
              desc: styleObj.desc,
              example: styleObj.example,
            },
            duration,
            extraProducts: extraProducts.filter((p) => p.title.trim()),
            styleContext,
            geminiApiKey: apiKeys?.geminiApiKey,
            geminiApiKeys: apiKeys?.geminiApiKeys,
          }),
        });

        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data.hooks) && data.hooks.length > 0) {
            setGeneratedHooks(data.hooks);
            if (!selectedHook || forceRegenerate) {
              setSelectedHook(data.hooks[0]);
            }
            setLoadingHooks(false);
            return;
          }
        }
      } catch (err) {
        console.warn('Fallback para gerador de ganchos local:', err);
      }

      // Fallback local robusto gerando exatamente 15 ganchos customizados
      const pTitle = productTitle.trim();
      const pPrice = productPriceTo ? `R$ ${productPriceTo}` : 'esse valor promocional';
      const pCat = productCategory || 'isso';
      const shortTitle = pTitle.length > 35 ? pTitle.slice(0, 32) + '...' : pTitle;

      const fallbackList: string[] = [
        `Eu quase não acreditei quando vi o ${shortTitle} por apenas ${pPrice}.`,
        `Se você sofre com ${pCat}, você precisa ver o que esse produto faz em segundos.`,
        `Pare de gastar dinheiro com coisas caras: esse ${shortTitle} custa só ${pPrice} e resolve tudo.`,
        `O segredo que quase ninguém te conta sobre como resolver ${pCat} gastando apenas ${pPrice}.`,
        `Por que todo mundo na internet está comprando esse ${shortTitle} escondido?`,
        `Testei esse produto que custa ${pPrice} para ver se ele cumpre o que promete na prática.`,
        `Atenção: esse ${shortTitle} baixou para ${pPrice} e o estoque vai encerrar hoje.`,
        `Você provavelmente está usando a forma errada para lidar com ${pCat} todos os dias.`,
        `Comprei esse item de ${pPrice} e o resultado nos primeiros 2 minutos me chocou.`,
        `Se eu pudesse te dar apenas uma dica de compra este mês, seria esse ${shortTitle}.`,
        `Duvido você adivinhar quanto custa isso antes de ver funcionando na prática.`,
        `Mais de 5 mil pessoas compraram esse ${shortTitle} e agora eu entendi o motivo.`,
        `Isso custa só ${pPrice} e entrega a mesma qualidade de produtos que custam 5 vezes mais.`,
        `O maior erro que você comete ao comprar itens para ${pCat} é não conhecer esse achadinho.`,
        `Antes de comprar qualquer outra coisa, veja a transformação que isso aqui faz por apenas ${pPrice}.`,
      ];

      setGeneratedHooks(fallbackList);
      if (!selectedHook || forceRegenerate) {
        setSelectedHook(fallbackList[0]);
      }
      setLoadingHooks(false);
    },
    [
      productTitle,
      productPriceTo,
      productPriceFrom,
      productCategory,
      productDescription,
      targetPlatform,
      selectedStyleId,
      duration,
      extraProducts,
      styleContext,
      apiKeys,
      generatedHooks.length,
      selectedHook,
    ]
  );

  // Iniciar Novo Roteiro do Zero
  const handleStartNewProject = () => {
    setCurrentProjectId(`proj_${Date.now()}`);
    setProductTitle('');
    setProductPriceTo('');
    setProductPriceFrom('');
    setProductCategory('');
    setProductDescription('');
    setProductImageUrl('');
    setProductPlatform('mercadolivre');
    setProductOriginalLink('');
    setTargetPlatform('tiktok');
    setDuration('30s');
    setSelectedStyleId('tk_achadinho_secreto');
    setExtraProducts([
      { title: '', price_to: '', highlight: '', image_url: '', video_url: '' },
      { title: '', price_to: '', highlight: '', image_url: '', video_url: '' },
    ]);
    setStyleContext({
      productCountMode: 'single',
      testType: '',
      testResult: '',
      testMediaUrl: '',
      reactVideoUrl: '',
      reactVideoName: '',
      reactKeyMoment: '',
      reactResponseAngle: '',
      beforeDescription: '',
      afterDescription: '',
      transformationTime: '',
      beforeMediaUrl: '',
      afterMediaUrl: '',
      competitorName: '',
      competitorPrice: '',
      competitorFlaw: '',
      testimonialUsageTime: '',
      testimonialMainResult: '',
      unboxingItems: '',
      commonMistake: '',
      correctWay: '',
      extraNotes: '',
      uploadedVideos: [],
    });
    setGeneratedHooks([]);
    setSelectedHook('');
    setIsEditingHookCustom(false);
    setCustomCta(ctaSuggestionsForPlatform[0]);
    setGeneratedScript(null);
    setCurrentQuizStep(1);
    setViewMode('creator');
  };

  // Abrir Rascunho para Continuar
  const handleContinueDraft = (proj: VideoProject) => {
    setCurrentProjectId(proj.id);
    setProductTitle(proj.product?.title || '');
    setProductPriceTo(proj.product?.price_to || '');
    setProductPriceFrom(proj.product?.price_from || '');
    setProductCategory(proj.product?.category || '');
    setProductDescription(proj.product?.description || '');
    setProductImageUrl(proj.product?.image_url || '');
    setProductPlatform(proj.product?.platform || 'mercadolivre');
    setProductOriginalLink(proj.product?.original_link || '');

    const platform = proj.targetPlatform || 'tiktok';
    setTargetPlatform(platform);

    const platformStyles = getVideoStylesForPlatform(platform);
    if (proj.settings) {
      setDuration(proj.settings.duration || '30s');
      const validStyle = platformStyles.some((s) => s.id === proj.settings.videoStyleId)
        ? proj.settings.videoStyleId
        : platformStyles[0].id;
      setSelectedStyleId(validStyle);
      setSelectedHook(proj.settings.selectedHook || '');
      setCustomCta(proj.settings.customCta || ctaSuggestionsForPlatform[0]);
    }

    if (Array.isArray(proj.extraProducts) && proj.extraProducts.length > 0) {
      setExtraProducts(proj.extraProducts);
    } else {
      setExtraProducts([
        { title: '', price_to: '', highlight: '', image_url: '', video_url: '' },
        { title: '', price_to: '', highlight: '', image_url: '', video_url: '' },
      ]);
    }

    if (proj.styleContext) {
      setStyleContext(proj.styleContext);
    }

    if (proj.script) {
      setGeneratedScript(proj.script);
    }

    setCurrentQuizStep(typeof proj.step === 'number' ? Math.min(proj.step, TOTAL_STEPS) : 1);
    setViewMode('creator');
  };

  // Visualizar Roteiro Pronto
  const handleViewReadyScript = (proj: VideoProject) => {
    setCurrentProjectId(proj.id);
    setProductTitle(proj.product?.title || '');
    setProductPriceTo(proj.product?.price_to || '');
    setProductPriceFrom(proj.product?.price_from || '');
    setProductCategory(proj.product?.category || '');
    setProductDescription(proj.product?.description || '');
    setProductImageUrl(proj.product?.image_url || '');
    setProductPlatform(proj.product?.platform || 'mercadolivre');
    setProductOriginalLink(proj.product?.original_link || '');

    const platform = proj.targetPlatform || 'tiktok';
    setTargetPlatform(platform);

    if (proj.settings) {
      setDuration(proj.settings.duration || '30s');
      setSelectedStyleId(proj.settings.videoStyleId || 'tk_achadinho_secreto');
      setSelectedHook(proj.settings.selectedHook || '');
      setCustomCta(proj.settings.customCta || ctaSuggestionsForPlatform[0]);
    }

    if (Array.isArray(proj.extraProducts) && proj.extraProducts.length > 0) {
      setExtraProducts(proj.extraProducts);
    }

    if (proj.styleContext) {
      setStyleContext(proj.styleContext);
    }

    if (proj.script) {
      setGeneratedScript(proj.script);
      setViewMode('view_ready');
    }
  };

  // Confirmar Exclusão
  const handleConfirmDelete = async () => {
    if (!uid || !projectToDelete) return;
    setDeletingId(projectToDelete.id);
    try {
      await deleteDoc(doc(db, 'users', uid, 'videoProjects', projectToDelete.id));
      setProjectToDelete(null);
    } catch (err) {
      console.error('Erro ao deletar projeto:', err);
    } finally {
      setDeletingId(null);
    }
  };

  // Gerar Roteiro Completo Cena a Cena + Roteiro Limpo + Ideias de Títulos e Hashtags
  const handleGenerateFinalScript = async () => {
    if (!productTitle.trim()) return;
    setGeneratingScript(true);

    const stylesList = getVideoStylesForPlatform(targetPlatform);
    const styleObj = stylesList.find((s) => s.id === selectedStyleId) || stylesList[0];
    const durationSeconds = duration === '15s' ? 15 : duration === '30s' ? 30 : duration === '60s' ? 60 : 90;

    const hookToUse = selectedHook.trim() || `Por que ninguém está falando desse produto que custa só R$ ${productPriceTo || '99'}?`;
    const ctaToUse = customCta.trim() || ctaSuggestionsForPlatform[0];

    const platformLabel =
      targetPlatform === 'tiktok'
        ? 'TikTok'
        : targetPlatform === 'instagram'
        ? 'Instagram Reels'
        : 'Criativo de Alta Conversão';

    try {
      const res = await apiFetch('/api/gemini/generate-full-script', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          product: {
            title: productTitle.trim(),
            price_to: productPriceTo,
            price_from: productPriceFrom,
            category: productCategory,
            description: productDescription,
          },
          targetPlatform,
          selectedStyle: {
            id: styleObj.id,
            name: styleObj.name,
            desc: styleObj.desc,
            example: styleObj.example,
          },
          duration,
          selectedHook: hookToUse,
          customCta: ctaToUse,
          extraProducts: extraProducts.filter((p) => p.title.trim()),
          styleContext,
          geminiApiKey: apiKeys?.geminiApiKey,
          geminiApiKeys: apiKeys?.geminiApiKeys,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        if (data.scenes && Array.isArray(data.scenes)) {
          const scriptPayload = {
            title: data.title || `Roteiro: ${productTitle.slice(0, 45)} (${duration})`,
            hook: data.hook || hookToUse,
            scenes: data.scenes,
            cta: data.cta || ctaToUse,
            fullText: data.fullText,
            cleanText: data.cleanText,
            suggestedTitles: data.suggestedTitles || [],
            hashtags: data.hashtags || [],
          };

          setGeneratedScript(scriptPayload);
          await saveProjectProgress('ready', TOTAL_STEPS, scriptPayload);
          setGeneratingScript(false);
          setViewMode('view_ready');
          return;
        }
      }
    } catch (err) {
      console.warn('Erro ao chamar API Gemini para roteiro completo, usando gerador local:', err);
    }

    // Fallback estruturado local
    const sceneCount = durationSeconds <= 15 ? 3 : durationSeconds <= 30 ? 4 : 6;
    const timeSlice = Math.round(durationSeconds / sceneCount);

    const scenes: VideoScriptScene[] = [
      {
        sceneNumber: 1,
        timeRange: `00:00 - 00:0${Math.min(3, timeSlice)}`,
        visual: 'Segurando o produto na mão com ângulo dinâmico e corte seco nos primeiros 2 segundos para prender a atenção.',
        audio: hookToUse,
        onScreenText: hookToUse.slice(0, 42) + '...',
        actingTip: 'Olhe fixo para a lente da câmera com tom confiante, direto e enérgico.',
      },
      {
        sceneNumber: 2,
        timeRange: `00:0${Math.min(3, timeSlice)} - 00:${String(timeSlice * 2).padStart(2, '0')}`,
        visual: 'Close-up no produto sendo utilizado ou demonstrado, evidenciando acabamento e funcionalidade.',
        audio: `Dá uma olhada nisso aqui. ${
          productPriceFrom ? `Custava R$ ${productPriceFrom} e agora baixou para só R$ ${productPriceTo}!` : `Custa apenas R$ ${productPriceTo}!`
        } É muito mais resistente e prático do que parece.`,
        onScreenText: `R$ ${productPriceTo} 🔥`,
        actingTip: 'Aproxime bem da lente para evidenciar os detalhes e o benefício real.',
      },
      {
        sceneNumber: 3,
        timeRange: `00:${String(timeSlice * 2).padStart(2, '0')} - 00:${String(timeSlice * 3).padStart(2, '0')}`,
        visual: 'Demonstração prática do produto resolvendo o problema e gerando o resultado perfeito.',
        audio: `Ele entrega exatamente ${
          productCategory ? `o que você precisa para ${productCategory}` : 'o que promete'
        } sem complicação nenhuma no seu dia a dia.`,
        onScreenText: 'Prático e Rápido ✅',
        actingTip: 'Sorriso de aprovação genuína mostrando que o resultado foi alcançado.',
      },
    ];

    if (sceneCount >= 4) {
      scenes.push({
        sceneNumber: 4,
        timeRange: `00:${String(timeSlice * 3).padStart(2, '0')} - 00:${String(durationSeconds).padStart(2, '0')}`,
        visual: 'Segurando o produto e apontando para a chamada de ação indicada na tela.',
        audio: ctaToUse,
        onScreenText: ctaToUse.slice(0, 36) + '...',
        actingTip: 'Encerre com entusiasmo e convide a audiência para a ação imediata.',
      });
    }

    // 1. Roteiro Limpo (Apenas a fala contínua para teleprompter / gravação)
    const cleanSpeechLines = scenes.map((s) => s.audio);
    const cleanScriptText = cleanSpeechLines.join('\n\n');

    // 2. Ideias de Títulos de Alta Conversão para Descrição/Postagem
    const suggestedTitles = [
      `Você não vai acreditar no que esse produto faz por R$ ${productPriceTo || '99'}!`,
      `ACHADINHO SECRETO: O melhor ${productCategory || 'produto'} que comprei este mês!`,
      `Pare de gastar dinheiro com coisa cara! Isso custa só R$ ${productPriceTo || '99'}.`,
      `Unboxing & Teste sincero: Vale a pena comprar por R$ ${productPriceTo || '99'}?`,
      `O segredo que ninguém te conta sobre ${productCategory || 'esse achadinho'}!`,
    ];

    // 3. Ideias de Hashtags Virais
    const catClean = (productCategory || 'achadinhos').toLowerCase().replace(/[^a-z0-9]/g, '');
    const hashtags = [
      '#achadinhos',
      '#achados',
      '#mercadolivre',
      '#shopee',
      '#tiktokmademebuyit',
      `#${catClean}`,
      '#dicasuteis',
      '#promocao',
      '#reviewhonesto',
      '#produtoviral',
    ];

    // 4. Roteiro Completo
    const fullScriptText = [
      `ROTEIRO COMPLETO (${platformLabel}) — ${styleObj.name}`,
      `Duração: ${duration} | Formato: Vertical 9:16`,
      `Produto: ${productTitle}`,
      `Preço: R$ ${productPriceTo}`,
      ``,
      `GANCHO INICIAL (Primeiros 3 segundos):`,
      `"${hookToUse}"`,
      ``,
      `ESTRUTURA CENA A CENA:`,
      ...scenes.map(
        (s) =>
          `[Cena ${s.sceneNumber} - ${s.timeRange}]\nVisual: ${s.visual}\nFala: "${s.audio}"\nTexto na Tela: ${s.onScreenText || '—'}\nDica: ${s.actingTip || '—'}\n`
      ),
      `CHAMADA PARA AÇÃO (CTA):`,
      `"${ctaToUse}"`,
      ``,
      `═══════════════════════════════════════════════════════════`,
      `ROTEIRO LIMPO (APENAS A FALA PARA GRAVAÇÃO / TELEPROMPTER):`,
      `═══════════════════════════════════════════════════════════`,
      cleanScriptText,
      ``,
      `═══════════════════════════════════════════════════════════`,
      `SUGESTÕES DE TÍTULOS PARA A DESCRIÇÃO:`,
      `═══════════════════════════════════════════════════════════`,
      ...suggestedTitles.map((t, idx) => `${idx + 1}. ${t}`),
      ``,
      `═══════════════════════════════════════════════════════════`,
      `HASHTAGS RECOMENDADAS:`,
      `═══════════════════════════════════════════════════════════`,
      hashtags.join(' '),
    ].join('\n');

    const scriptPayload = {
      title: `Roteiro: ${productTitle.slice(0, 45)} (${duration})`,
      hook: hookToUse,
      scenes,
      cta: ctaToUse,
      fullText: fullScriptText,
      cleanText: cleanScriptText,
      suggestedTitles,
      hashtags,
    };

    setGeneratedScript(scriptPayload);
    await saveProjectProgress('ready', TOTAL_STEPS, scriptPayload);
    setGeneratingScript(false);
    setViewMode('view_ready');
  };

  // Copiar Texto com Feedback
  const handleCopyText = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2500);
  };

  // Avançar passo com verificação de geração de ganchos
  const handleNextStep = async () => {
    const next = currentQuizStep + 1;
    setCurrentQuizStep(next);
    saveProjectProgress('draft', next);

    // Se estiver entrando na Etapa 10 (Ganchos), disparar a geração dos 15 ganchos contextuais
    if (next === 10) {
      generateDynamicHooks(false);
    }
  };

  const handlePrevStep = () => {
    const prev = Math.max(1, currentQuizStep - 1);
    setCurrentQuizStep(prev);
    saveProjectProgress('draft', prev);
  };

  const draftsList = useMemo(() => projects.filter((p) => p.status === 'draft'), [projects]);
  const readyList = useMemo(() => projects.filter((p) => p.status === 'ready'), [projects]);

  const displayedDrafts = useMemo(() => {
    return showAllDrafts ? draftsList : draftsList.slice(0, 4);
  }, [draftsList, showAllDrafts]);

  const displayedReady = useMemo(() => {
    return showAllReady ? readyList : readyList.slice(0, 4);
  }, [readyList, showAllReady]);

  return (
    <div className="w-full max-w-full overflow-hidden space-y-5 animate-fadeIn">
      {/* ════════════════════════════════════════════════════════════════════════
          MODAL DE CONFIRMAÇÃO DE EXCLUSÃO
         ════════════════════════════════════════════════════════════════════════ */}
      {projectToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs animate-fadeIn">
          <div className="bg-[#0e1119] border border-rose-500/30 rounded-2xl max-w-md w-full p-5 sm:p-6 space-y-4 shadow-2xl animate-scaleUp">
            <div className="flex items-center gap-3 text-rose-400">
              <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-black text-white">Confirmar Exclusão</h3>
                <p className="text-xs text-[#93a0b5]">Esta ação é irreversível.</p>
              </div>
            </div>

            <p className="text-xs text-stone-300 bg-[#151a26] p-3 rounded-xl border border-[#1e2636] leading-relaxed">
              Deseja realmente excluir o projeto{' '}
              <strong className="text-white font-bold">
                "{projectToDelete.product?.title || 'Roteiro sem título'}"
              </strong>
              ?
            </p>

            <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-[#1e2636]">
              <button
                type="button"
                onClick={() => setProjectToDelete(null)}
                className="px-4 py-2 rounded-xl bg-[#151a26] hover:bg-[#1e2636] text-stone-300 text-xs font-bold transition-colors cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                disabled={deletingId === projectToDelete.id}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-black flex items-center gap-1.5 transition-all shadow-lg shadow-rose-600/20 cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>{deletingId === projectToDelete.id ? 'Excluindo...' : 'Sim, Excluir'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════════════════
          1. DASHBOARD PRINCIPAL
         ════════════════════════════════════════════════════════════════════════ */}
      {viewMode === 'dashboard' && (
        <div className="space-y-6">
          {/* Header do Estúdio */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#1e2636] pb-4">
            <div className="min-w-0">
              <h1 className="text-lg sm:text-xl font-extrabold text-white flex items-center gap-2">
                <Film className="w-5 h-5 text-blue-400 shrink-0" /> Estúdio de Projetos & Roteiros
              </h1>
              <p className="text-xs text-[#93a0b5] mt-0.5">
                Crie roteiros virais cena a cena, roteiro limpo para gravação e ganchos persuasivos para TikTok, Instagram Reels e Criativos.
              </p>
            </div>

            <button
              type="button"
              onClick={handleStartNewProject}
              className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-black flex items-center justify-center gap-2 transition-all shadow-lg shadow-blue-600/25 cursor-pointer shrink-0"
            >
              <PlusCircle className="w-4 h-4" />
              <span>+ Criar Novo Roteiro</span>
            </button>
          </div>

          {/* Cards de Métricas */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="bg-[#0e1119] border border-[#1e2636] rounded-2xl p-4 flex items-center justify-between">
              <div className="space-y-1">
                <span className="text-[11px] font-semibold text-[#93a0b5]">Total de Projetos</span>
                <p className="text-xl font-black text-white">{projects.length}</p>
              </div>
              <div className="p-2.5 rounded-xl bg-blue-500/10 text-blue-400 border border-blue-500/20">
                <FileText className="w-5 h-5" />
              </div>
            </div>

            <div className="bg-[#0e1119] border border-[#1e2636] rounded-2xl p-4 flex items-center justify-between">
              <div className="space-y-1">
                <span className="text-[11px] font-semibold text-[#93a0b5]">Em Produção (Rascunhos)</span>
                <p className="text-xl font-black text-amber-400">{draftsList.length}</p>
              </div>
              <div className="p-2.5 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20">
                <Clock className="w-5 h-5" />
              </div>
            </div>

            <div className="bg-[#0e1119] border border-[#1e2636] rounded-2xl p-4 flex items-center justify-between">
              <div className="space-y-1">
                <span className="text-[11px] font-semibold text-[#93a0b5]">Roteiros Prontos</span>
                <p className="text-xl font-black text-emerald-400">{readyList.length}</p>
              </div>
              <div className="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                <CheckCircle2 className="w-5 h-5" />
              </div>
            </div>
          </div>

          {/* ─── SEÇÃO 1: ROTEIROS EM PRODUÇÃO (RASCUNHOS) ─── */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-extrabold text-white flex items-center gap-2">
                <Clock className="w-4 h-4 text-amber-400" /> Roteiros em Produção ({draftsList.length})
              </h2>

              {draftsList.length > 4 && (
                <button
                  type="button"
                  onClick={() => setShowAllDrafts(!showAllDrafts)}
                  className="text-xs font-bold text-amber-400 hover:text-amber-300 flex items-center gap-1 transition-colors cursor-pointer"
                >
                  <span>{showAllDrafts ? 'Ver Menos' : `Ver Todos (${draftsList.length})`}</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {loadingProjects ? (
              <div className="py-8 text-center text-xs text-[#93a0b5] animate-pulse">
                Carregando projetos salvos...
              </div>
            ) : draftsList.length === 0 ? (
              <div className="bg-[#0e1119] border border-[#1e2636] rounded-2xl p-6 text-center space-y-2">
                <Clock className="w-8 h-8 text-[#93a0b5] mx-auto opacity-40" />
                <p className="text-xs font-bold text-white">Nenhum roteiro em andamento</p>
                <p className="text-[11px] text-[#93a0b5] max-w-sm mx-auto">
                  Clique em "+ Criar Novo Roteiro" para iniciar o passo a passo guiado.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                {displayedDrafts.map((proj) => (
                  <div
                    key={proj.id}
                    className="bg-[#0e1119] border border-[#1e2636] hover:border-amber-500/40 rounded-2xl p-4 flex flex-col justify-between gap-3 transition-all group shadow-sm"
                  >
                    <div className="space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <span className="px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20 text-[10px] font-bold">
                          Etapa {proj.step || 1} de {TOTAL_STEPS}
                        </span>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setProjectToDelete(proj);
                          }}
                          className="text-[#93a0b5] hover:text-rose-400 p-1 transition-colors cursor-pointer"
                          title="Excluir rascunho"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      <h3 className="text-xs font-bold text-white line-clamp-2">
                        {proj.product?.title || 'Roteiro sem título'}
                      </h3>

                      {proj.product?.price_to && (
                        <span className="text-xs font-extrabold text-emerald-400 block">
                          R$ {proj.product.price_to}
                        </span>
                      )}
                    </div>

                    <button
                      type="button"
                      onClick={() => handleContinueDraft(proj)}
                      className="w-full py-2 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 font-bold text-xs flex items-center justify-center gap-1.5 transition-all border border-amber-500/30 cursor-pointer"
                    >
                      <span>Continuar Roteiro</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* ─── SEÇÃO 2: ROTEIROS PRONTOS ─── */}
          <div className="space-y-3 pt-2">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-extrabold text-white flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" /> Roteiros Prontos ({readyList.length})
              </h2>

              {readyList.length > 4 && (
                <button
                  type="button"
                  onClick={() => setShowAllReady(!showAllReady)}
                  className="text-xs font-bold text-emerald-400 hover:text-emerald-300 flex items-center gap-1 transition-colors cursor-pointer"
                >
                  <span>{showAllReady ? 'Ver Menos' : `Ver Todos (${readyList.length})`}</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {loadingProjects ? null : readyList.length === 0 ? (
              <div className="bg-[#0e1119] border border-[#1e2636] rounded-2xl p-6 text-center space-y-2">
                <CheckCircle2 className="w-8 h-8 text-[#93a0b5] mx-auto opacity-40" />
                <p className="text-xs font-bold text-white">Nenhum roteiro finalizado ainda</p>
                <p className="text-[11px] text-[#93a0b5] max-w-sm mx-auto">
                  Seus roteiros concluídos aparecerão aqui com acesso rápido ao roteiro cena a cena e roteiro limpo para gravação.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                {displayedReady.map((proj) => (
                  <div
                    key={proj.id}
                    className="bg-[#0e1119] border border-[#1e2636] hover:border-emerald-500/40 rounded-2xl p-4 flex flex-col justify-between gap-3 transition-all group shadow-sm"
                  >
                    <div className="space-y-2.5">
                      <div className="flex items-center justify-between gap-2">
                        <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[10px] font-bold">
                          Pronto ({proj.settings?.duration || '30s'})
                        </span>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setProjectToDelete(proj);
                          }}
                          className="text-[#93a0b5] hover:text-rose-400 p-1 transition-colors cursor-pointer"
                          title="Excluir roteiro"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      <h3 className="text-xs font-bold text-white line-clamp-2">
                        {proj.product?.title || 'Roteiro Finalizado'}
                      </h3>

                      {proj.settings?.selectedHook && (
                        <p className="text-[11px] text-[#93a0b5] line-clamp-2 italic bg-[#151a26] p-2 rounded-lg border border-[#1e2636]">
                          "{proj.settings.selectedHook}"
                        </p>
                      )}
                    </div>

                    <div className="flex items-center gap-2 pt-2 border-t border-[#1e2636]">
                      <button
                        type="button"
                        onClick={() => handleViewReadyScript(proj)}
                        className="flex-1 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs flex items-center justify-center gap-1.5 transition-all shadow-md cursor-pointer"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        <span>Ver Roteiro</span>
                      </button>

                      {proj.script?.cleanText && (
                        <button
                          type="button"
                          onClick={() => handleCopyText(proj.script!.cleanText || proj.script!.fullText, `clean_${proj.id}`)}
                          className="p-2 rounded-xl bg-[#151a26] hover:bg-[#1e2636] text-[#93a0b5] hover:text-white border border-[#1e2636] transition-colors cursor-pointer"
                          title="Copiar apenas a fala para o teleprompter"
                        >
                          {copiedId === `clean_${proj.id}` ? (
                            <Check className="w-3.5 h-3.5 text-emerald-400" />
                          ) : (
                            <AlignLeft className="w-3.5 h-3.5 text-amber-400" />
                          )}
                        </button>
                      )}

                      {proj.script?.fullText && (
                        <button
                          type="button"
                          onClick={() => handleCopyText(proj.script!.fullText, proj.id)}
                          className="p-2 rounded-xl bg-[#151a26] hover:bg-[#1e2636] text-[#93a0b5] hover:text-white border border-[#1e2636] transition-colors cursor-pointer"
                          title="Copiar Roteiro Técnico Completo"
                        >
                          {copiedId === proj.id ? (
                            <Check className="w-3.5 h-3.5 text-emerald-400" />
                          ) : (
                            <Copy className="w-3.5 h-3.5" />
                          )}
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════════════════
          2. MODO CRIADOR DE ROTEIRO (FLUXO PASSO A PASSO GUIADO - 1 PERGUNTA POR VEZ)
         ════════════════════════════════════════════════════════════════════════ */}
      {viewMode === 'creator' && (
        <div className="space-y-5 animate-fadeIn max-w-3xl mx-auto">
          {/* Barra Superior do Wizard */}
          <div className="bg-[#0e1119] border border-[#1e2636] rounded-2xl p-4 space-y-3 shadow-xl">
            <div className="flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={() => {
                  saveProjectProgress('draft', currentQuizStep);
                  setViewMode('dashboard');
                }}
                className="flex items-center gap-1.5 text-xs font-bold text-[#93a0b5] hover:text-white transition-colors cursor-pointer"
              >
                <ChevronLeft className="w-4 h-4" />
                <span>Salvar & Voltar ao Painel</span>
              </button>

              <span className="text-xs font-extrabold text-blue-400 bg-blue-500/10 border border-blue-500/20 px-3 py-1 rounded-full">
                Etapa {currentQuizStep} de {TOTAL_STEPS}
              </span>
            </div>

            {/* Barra de Progresso Visual */}
            <div className="w-full bg-[#151a26] h-2 rounded-full overflow-hidden">
              <div
                className="bg-gradient-to-r from-blue-600 to-emerald-500 h-full transition-all duration-300 rounded-full"
                style={{ width: `${(currentQuizStep / TOTAL_STEPS) * 100}%` }}
              />
            </div>
          </div>

          {/* ─── CARD PRINCIPAL DA PERGUNTA ATUAL ─── */}
          <div className="bg-[#0e1119] border border-[#1e2636] rounded-2xl p-5 sm:p-7 space-y-6 shadow-2xl">
            {/* ════ ETAPA 1: NOME / TÍTULO DO PRODUTO ════ */}
            {currentQuizStep === 1 && (
              <div className="space-y-4 animate-fadeIn">
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2">
                    <span className="w-7 h-7 rounded-xl bg-blue-600/20 text-blue-400 border border-blue-500/30 flex items-center justify-center text-xs font-black">
                      1
                    </span>
                    <h2 className="text-base sm:text-lg font-black text-white">
                      Qual é o nome ou título do produto?
                    </h2>
                  </div>
                  <p className="text-xs text-[#93a0b5] pl-9">
                    Digite o nome exato ou título de divulgação do produto.
                  </p>
                </div>

                <div className="space-y-2 pt-2">
                  <input
                    type="text"
                    autoFocus
                    placeholder="Ex: Fone de Ouvido Bluetooth TWS Pro com Cancelamento de Ruído"
                    value={productTitle}
                    onChange={(e) => setProductTitle(e.target.value)}
                    className="w-full px-4 py-3.5 bg-[#151a26] border border-[#1e2636] focus:border-blue-500 rounded-xl text-sm text-white placeholder:text-[#93a0b5] focus:outline-none transition-all"
                  />
                  <span className="text-[10px] text-[#93a0b5] block text-right">
                    {productTitle.length} caracteres
                  </span>
                </div>
              </div>
            )}

            {/* ════ ETAPA 2: PREÇO DO PRODUTO ════ */}
            {currentQuizStep === 2 && (
              <div className="space-y-4 animate-fadeIn">
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2">
                    <span className="w-7 h-7 rounded-xl bg-blue-600/20 text-blue-400 border border-blue-500/30 flex items-center justify-center text-xs font-black">
                      2
                    </span>
                    <h2 className="text-base sm:text-lg font-black text-white">
                      Qual é o valor ou preço do produto?
                    </h2>
                  </div>
                  <p className="text-xs text-[#93a0b5] pl-9">
                    Informe o preço promocional de venda e opcionalmente o preço anterior.
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-emerald-400">Preço Atual (R$)</label>
                    <input
                      type="text"
                      autoFocus
                      placeholder="Ex: 89,90"
                      value={productPriceTo}
                      onChange={(e) => setProductPriceTo(e.target.value)}
                      className="w-full px-4 py-3 bg-[#151a26] border border-[#1e2636] focus:border-emerald-500 rounded-xl text-sm text-white placeholder:text-[#93a0b5] focus:outline-none transition-all"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-[#93a0b5]">Preço Anterior / "De" (Opcional)</label>
                    <input
                      type="text"
                      placeholder="Ex: 199,90"
                      value={productPriceFrom}
                      onChange={(e) => setProductPriceFrom(e.target.value)}
                      className="w-full px-4 py-3 bg-[#151a26] border border-[#1e2636] focus:border-blue-500 rounded-xl text-sm text-white placeholder:text-[#93a0b5] focus:outline-none transition-all"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* ════ ETAPA 3: FOTOS / IMAGEM DO PRODUTO ════ */}
            {currentQuizStep === 3 && (
              <div className="space-y-4 animate-fadeIn">
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2">
                    <span className="w-7 h-7 rounded-xl bg-blue-600/20 text-blue-400 border border-blue-500/30 flex items-center justify-center text-xs font-black">
                      3
                    </span>
                    <h2 className="text-base sm:text-lg font-black text-white">
                      Foto ou Mídia de Referência do Produto
                    </h2>
                  </div>
                  <p className="text-xs text-[#93a0b5] pl-9">
                    Insira a URL da imagem principal do produto para visualização.
                  </p>
                </div>

                <div className="space-y-4 pt-2">
                  <input
                    type="url"
                    autoFocus
                    placeholder="https://exemplo.com/foto-do-produto.jpg"
                    value={productImageUrl}
                    onChange={(e) => setProductImageUrl(e.target.value)}
                    className="w-full px-4 py-3 bg-[#151a26] border border-[#1e2636] focus:border-blue-500 rounded-xl text-sm text-white placeholder:text-[#93a0b5] focus:outline-none transition-all"
                  />

                  {productImageUrl ? (
                    <div className="p-3 bg-[#151a26] rounded-xl border border-[#1e2636] flex items-center gap-4">
                      <img
                        src={productImageUrl}
                        alt="Preview"
                        referrerPolicy="no-referrer"
                        className="w-20 h-20 rounded-lg object-cover bg-black/40 border border-[#1e2636]"
                        onError={(e) => {
                          (e.target as HTMLElement).style.display = 'none';
                        }}
                      />
                      <div className="text-xs text-[#93a0b5] space-y-1">
                        <span className="font-bold text-white block">Imagem carregada</span>
                        <p className="text-[11px]">Será usada como referência para as cenas visuais.</p>
                      </div>
                    </div>
                  ) : (
                    <p className="text-[11px] text-[#93a0b5] italic">
                      Dica: você pode avançar sem foto caso não tenha a URL em mãos.
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* ════ ETAPA 4: CATEGORIA DO PRODUTO ════ */}
            {currentQuizStep === 4 && (
              <div className="space-y-4 animate-fadeIn">
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2">
                    <span className="w-7 h-7 rounded-xl bg-blue-600/20 text-blue-400 border border-blue-500/30 flex items-center justify-center text-xs font-black">
                      4
                    </span>
                    <h2 className="text-base sm:text-lg font-black text-white">
                      Qual é o nicho ou categoria do produto?
                    </h2>
                  </div>
                  <p className="text-xs text-[#93a0b5] pl-9">
                    Escolha uma categoria popular ou digite o nicho exato.
                  </p>
                </div>

                <div className="space-y-4 pt-2">
                  <input
                    type="text"
                    autoFocus
                    placeholder="Ex: Eletrônicos & Áudio"
                    value={productCategory}
                    onChange={(e) => setProductCategory(e.target.value)}
                    className="w-full px-4 py-3 bg-[#151a26] border border-[#1e2636] focus:border-blue-500 rounded-xl text-sm text-white placeholder:text-[#93a0b5] focus:outline-none transition-all"
                  />

                  <div className="space-y-2">
                    <span className="text-[11px] font-bold text-[#93a0b5] block">Sugestões rápidas:</span>
                    <div className="flex flex-wrap gap-2">
                      {POPULAR_CATEGORIES.map((cat) => (
                        <button
                          key={cat}
                          type="button"
                          onClick={() => setProductCategory(cat)}
                          className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                            productCategory === cat
                              ? 'bg-blue-600 text-white border border-blue-500'
                              : 'bg-[#151a26] text-[#93a0b5] hover:text-white border border-[#1e2636]'
                          }`}
                        >
                          {cat}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* ════ ETAPA 5: DESCRIÇÃO & BENEFÍCIOS ════ */}
            {currentQuizStep === 5 && (
              <div className="space-y-4 animate-fadeIn">
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2">
                    <span className="w-7 h-7 rounded-xl bg-blue-600/20 text-blue-400 border border-blue-500/30 flex items-center justify-center text-xs font-black">
                      5
                    </span>
                    <h2 className="text-base sm:text-lg font-black text-white">
                      Descrição e Principais Benefícios
                    </h2>
                  </div>
                  <p className="text-xs text-[#93a0b5] pl-9">
                    Descreva o que o produto resolve, seus diferenciais e características principais.
                  </p>
                </div>

                <div className="space-y-2 pt-2">
                  <textarea
                    autoFocus
                    rows={4}
                    placeholder="Ex: Bateria com 30 horas de duração, cancelamento ativo de ruído, resistente à água, encaixe ergonômico e graves potentes."
                    value={productDescription}
                    onChange={(e) => setProductDescription(e.target.value)}
                    className="w-full px-4 py-3 bg-[#151a26] border border-[#1e2636] focus:border-blue-500 rounded-xl text-sm text-white placeholder:text-[#93a0b5] focus:outline-none transition-all resize-none"
                  />
                  <span className="text-[10px] text-[#93a0b5] block text-right">
                    {productDescription.length} caracteres
                  </span>
                </div>
              </div>
            )}

            {/* ════ ETAPA 6: PLATAFORMA DO VÍDEO (TIKTOK / INSTAGRAM / CRIATIVO) ════ */}
            {currentQuizStep === 6 && (
              <div className="space-y-4 animate-fadeIn">
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2">
                    <span className="w-7 h-7 rounded-xl bg-blue-600/20 text-blue-400 border border-blue-500/30 flex items-center justify-center text-xs font-black">
                      6
                    </span>
                    <h2 className="text-base sm:text-lg font-black text-white">
                      Para qual plataforma é o vídeo?
                    </h2>
                  </div>
                  <p className="text-xs text-[#93a0b5] pl-9">
                    Selecione a plataforma para carregar os 15 estilos virais específicos na próxima etapa.
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 pt-2">
                  {/* TikTok */}
                  <button
                    type="button"
                    onClick={() => {
                      setTargetPlatform('tiktok');
                      setSelectedStyleId('tk_achadinho_secreto');
                    }}
                    className={`p-5 rounded-2xl border text-left transition-all flex flex-col justify-between gap-4 cursor-pointer ${
                      targetPlatform === 'tiktok'
                        ? 'bg-blue-600/10 border-blue-500 ring-2 ring-blue-500/30 shadow-lg'
                        : 'bg-[#151a26] border-[#1e2636] hover:border-slate-600'
                    }`}
                  >
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="font-extrabold text-sm text-white flex items-center gap-2">
                          <Video className="w-4 h-4 text-cyan-400" /> TikTok
                        </span>
                        {targetPlatform === 'tiktok' && <Check className="w-4 h-4 text-blue-400" />}
                      </div>
                      <p className="text-xs text-[#93a0b5] leading-relaxed">
                        Foco em viralidade instantânea, retenção rápida, achadinhos e ganchos de curiosidade.
                      </p>
                    </div>
                    <span className="text-[10px] font-bold text-cyan-400 bg-cyan-500/10 border border-cyan-500/20 px-2.5 py-1 rounded-full self-start">
                      15 Estilos Virais
                    </span>
                  </button>

                  {/* Instagram Reels */}
                  <button
                    type="button"
                    onClick={() => {
                      setTargetPlatform('instagram');
                      setSelectedStyleId('ig_estetica_rotina');
                    }}
                    className={`p-5 rounded-2xl border text-left transition-all flex flex-col justify-between gap-4 cursor-pointer ${
                      targetPlatform === 'instagram'
                        ? 'bg-pink-600/10 border-pink-500 ring-2 ring-pink-500/30 shadow-lg'
                        : 'bg-[#151a26] border-[#1e2636] hover:border-slate-600'
                    }`}
                  >
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="font-extrabold text-sm text-white flex items-center gap-2">
                          <Instagram className="w-4 h-4 text-pink-400" /> Instagram Reels
                        </span>
                        {targetPlatform === 'instagram' && <Check className="w-4 h-4 text-pink-400" />}
                      </div>
                      <p className="text-xs text-[#93a0b5] leading-relaxed">
                        Foco em estética, autoridade, salvamentos, rotinas organizadas e chamadas para Direct.
                      </p>
                    </div>
                    <span className="text-[10px] font-bold text-pink-400 bg-pink-500/10 border border-pink-500/20 px-2.5 py-1 rounded-full self-start">
                      15 Estilos de Engajamento
                    </span>
                  </button>

                  {/* Criativo / Tráfego Pago */}
                  <button
                    type="button"
                    onClick={() => {
                      setTargetPlatform('creative');
                      setSelectedStyleId('cr_ugc_autentico');
                    }}
                    className={`p-5 rounded-2xl border text-left transition-all flex flex-col justify-between gap-4 cursor-pointer ${
                      targetPlatform === 'creative'
                        ? 'bg-amber-600/10 border-amber-500 ring-2 ring-amber-500/30 shadow-lg'
                        : 'bg-[#151a26] border-[#1e2636] hover:border-slate-600'
                    }`}
                  >
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="font-extrabold text-sm text-white flex items-center gap-2">
                          <Layers className="w-4 h-4 text-amber-400" /> Criativo (Anúncios)
                        </span>
                        {targetPlatform === 'creative' && <Check className="w-4 h-4 text-amber-400" />}
                      </div>
                      <p className="text-xs text-[#93a0b5] leading-relaxed">
                        Foco em conversão direta, tráfego pago, UGC autêntico, quebra de objeções e ROI.
                      </p>
                    </div>
                    <span className="text-[10px] font-bold text-amber-400 bg-amber-500/10 border border-amber-500/20 px-2.5 py-1 rounded-full self-start">
                      15 Estilos de Conversão
                    </span>
                  </button>
                </div>
              </div>
            )}

            {/* ════ ETAPA 7: DURAÇÃO DO VÍDEO ════ */}
            {currentQuizStep === 7 && (
              <div className="space-y-4 animate-fadeIn">
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2">
                    <span className="w-7 h-7 rounded-xl bg-blue-600/20 text-blue-400 border border-blue-500/30 flex items-center justify-center text-xs font-black">
                      7
                    </span>
                    <h2 className="text-base sm:text-lg font-black text-white">
                      Qual é a duração ideal do vídeo?
                    </h2>
                  </div>
                  <p className="text-xs text-[#93a0b5] pl-9">
                    Escolha o tempo alvo para calibrar a quantidade de cenas e o ritmo da narração.
                  </p>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
                  {[
                    { id: '15s', label: '15 Segundos', sub: 'Impacto Ultra Rápido' },
                    { id: '30s', label: '30 Segundos', sub: 'Mais Recomendado' },
                    { id: '60s', label: '60 Segundos', sub: 'Review Detalhado' },
                    { id: '90s', label: '90 Segundos', sub: 'Demonstração Completa' },
                  ].map((dur) => (
                    <button
                      key={dur.id}
                      type="button"
                      onClick={() => setDuration(dur.id as any)}
                      className={`p-4 rounded-xl border text-center transition-all cursor-pointer ${
                        duration === dur.id
                          ? 'bg-blue-600/15 border-blue-500 text-white shadow-md'
                          : 'bg-[#151a26] border-[#1e2636] text-[#93a0b5] hover:text-white'
                      }`}
                    >
                      <span className="text-sm font-black block text-white">{dur.label}</span>
                      <span className="text-[10px] text-[#93a0b5] mt-1 block">{dur.sub}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* ════ ETAPA 8: ESTILO DO VÍDEO (15 OPÇÕES EXCLUSIVAS DA PLATAFORMA) ════ */}
            {currentQuizStep === 8 && (
              <div className="space-y-4 animate-fadeIn">
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="w-7 h-7 rounded-xl bg-blue-600/20 text-blue-400 border border-blue-500/30 flex items-center justify-center text-xs font-black">
                        8
                      </span>
                      <h2 className="text-base sm:text-lg font-black text-white">
                        Escolha o Estilo do Vídeo ({availableStyles.length} Opções para{' '}
                        {targetPlatform === 'tiktok'
                          ? 'TikTok'
                          : targetPlatform === 'instagram'
                          ? 'Instagram Reels'
                          : 'Criativos'}
                        )
                      </h2>
                    </div>
                  </div>
                  <p className="text-xs text-[#93a0b5] pl-9">
                    Selecione a abordagem que melhor se encaixa com o seu produto e objetivo de venda.
                  </p>
                </div>

                {/* Lista Limpa e Organizada dos 15 Estilos */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2 max-h-[480px] overflow-y-auto pr-1">
                  {availableStyles.map((st) => (
                    <button
                      key={st.id}
                      type="button"
                      onClick={() => setSelectedStyleId(st.id)}
                      className={`p-4 rounded-xl border text-left transition-all flex flex-col justify-between gap-2.5 cursor-pointer ${
                        selectedStyleId === st.id
                          ? 'bg-blue-600/15 border-blue-500 ring-2 ring-blue-500/20 shadow-md'
                          : 'bg-[#151a26] border-[#1e2636] hover:border-slate-600'
                      }`}
                    >
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between gap-2">
                          <h3 className="text-xs font-bold text-white">{st.name}</h3>
                          <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20 shrink-0">
                            {st.tag}
                          </span>
                        </div>
                        <p className="text-[11px] text-[#93a0b5] leading-relaxed">{st.desc}</p>
                      </div>

                      <div className="bg-[#0e1119] p-2.5 rounded-lg border border-[#1e2636]">
                        <span className="text-[10px] font-semibold text-slate-400 block">Exemplo Prático:</span>
                        <p className="text-[11px] text-slate-300 italic mt-0.5">"{st.example}"</p>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* ════ ETAPA 9: INFORMAÇÕES & MÍDIAS ESPECÍFICAS DO ESTILO (ADAPTATIVO) ════ */}
            {currentQuizStep === 9 && (
              <div className="space-y-5 animate-fadeIn">
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2">
                    <span className="w-7 h-7 rounded-xl bg-blue-600/20 text-blue-400 border border-blue-500/30 flex items-center justify-center text-xs font-black">
                      9
                    </span>
                    <h2 className="text-base sm:text-lg font-black text-white flex items-center gap-2">
                      <Sliders className="w-4 h-4 text-blue-400" />
                      Detalhes & Mídias do Estilo: {availableStyles.find((s) => s.id === selectedStyleId)?.name || 'Personalizado'}
                    </h2>
                  </div>
                  <p className="text-xs text-[#93a0b5] pl-9">
                    Este estilo requer informações e mídias complementares para criar um roteiro ultra específico e de alta conversão.
                  </p>
                </div>

                {/* ── CASO A: ESTILOS DE LISTA / TOP 3 / CARROSSEL DE ACHADINHOS ── */}
                {(selectedStyleId.includes('top3') ||
                  selectedStyleId.includes('carrossel') ||
                  selectedStyleId.includes('lista') ||
                  selectedStyleId.includes('kit') ||
                  styleContext.productCountMode === 'multiple') && (
                  <div className="space-y-4 pt-1">
                    <div className="p-3.5 rounded-xl bg-[#151a26] border border-blue-500/30 space-y-3">
                      <div className="flex items-center justify-between">
                        <label className="text-xs font-bold text-white flex items-center gap-2">
                          <ShoppingBag className="w-4 h-4 text-blue-400" />
                          Quantos produtos você vai apresentar no vídeo?
                        </label>
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => updateStyleContext('productCountMode', 'multiple')}
                            className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                              styleContext.productCountMode === 'multiple'
                                ? 'bg-blue-600 text-white'
                                : 'bg-[#0e1119] text-[#93a0b5] border border-[#1e2636]'
                            }`}
                          >
                            Top 3 Produtos
                          </button>
                          <button
                            type="button"
                            onClick={() => updateStyleContext('productCountMode', 'single')}
                            className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                              styleContext.productCountMode === 'single'
                                ? 'bg-blue-600 text-white'
                                : 'bg-[#0e1119] text-[#93a0b5] border border-[#1e2636]'
                            }`}
                          >
                            Apenas 1 Produto
                          </button>
                        </div>
                      </div>
                      <p className="text-[11px] text-[#93a0b5]">
                        O <strong>Produto 1</strong> é o principal ({productTitle || 'preenchido nas etapas anteriores'}). Adicione os outros produtos abaixo:
                      </p>
                    </div>

                    {/* Card Produto 2 */}
                    <div className="p-4 rounded-xl bg-[#151a26] border border-[#1e2636] space-y-3">
                      <div className="flex items-center justify-between border-b border-[#1e2636] pb-2">
                        <h4 className="text-xs font-bold text-amber-400 flex items-center gap-2">
                          <span className="w-5 h-5 rounded-full bg-amber-500/20 flex items-center justify-center text-[10px] font-black">2</span>
                          Produto 2 da Lista
                        </h4>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div className="space-y-1">
                          <label className="text-[11px] font-medium text-slate-300">Nome do Produto 2</label>
                          <input
                            type="text"
                            value={extraProducts[0]?.title || ''}
                            onChange={(e) => updateExtraProduct(0, 'title', e.target.value)}
                            placeholder="Ex: Mini Luminária Noturna com Sensor"
                            className="w-full px-3 py-2 bg-[#0e1119] border border-[#1e2636] rounded-lg text-xs text-white placeholder:text-[#93a0b5] focus:outline-none focus:border-blue-500"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[11px] font-medium text-slate-300">Preço (R$)</label>
                          <input
                            type="text"
                            value={extraProducts[0]?.price_to || ''}
                            onChange={(e) => updateExtraProduct(0, 'price_to', e.target.value)}
                            placeholder="Ex: 29,90"
                            className="w-full px-3 py-2 bg-[#0e1119] border border-[#1e2636] rounded-lg text-xs text-white placeholder:text-[#93a0b5] focus:outline-none focus:border-blue-500"
                          />
                        </div>
                      </div>
                      <div className="space-y-1">
                        <label className="text-[11px] font-medium text-slate-300">Principal Destaque / Benefício</label>
                        <input
                          type="text"
                          value={extraProducts[0]?.highlight || ''}
                          onChange={(e) => updateExtraProduct(0, 'highlight', e.target.value)}
                          placeholder="Ex: Bateria recarregável via USB e não precisa de furadeira"
                          className="w-full px-3 py-2 bg-[#0e1119] border border-[#1e2636] rounded-lg text-xs text-white placeholder:text-[#93a0b5] focus:outline-none focus:border-blue-500"
                        />
                      </div>
                    </div>

                    {/* Card Produto 3 */}
                    <div className="p-4 rounded-xl bg-[#151a26] border border-[#1e2636] space-y-3">
                      <div className="flex items-center justify-between border-b border-[#1e2636] pb-2">
                        <h4 className="text-xs font-bold text-emerald-400 flex items-center gap-2">
                          <span className="w-5 h-5 rounded-full bg-emerald-500/20 flex items-center justify-center text-[10px] font-black">3</span>
                          Produto 3 da Lista (O mais surpreendente)
                        </h4>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div className="space-y-1">
                          <label className="text-[11px] font-medium text-slate-300">Nome do Produto 3</label>
                          <input
                            type="text"
                            value={extraProducts[1]?.title || ''}
                            onChange={(e) => updateExtraProduct(1, 'title', e.target.value)}
                            placeholder="Ex: Selador Térmico Portátil de Embalagens"
                            className="w-full px-3 py-2 bg-[#0e1119] border border-[#1e2636] rounded-lg text-xs text-white placeholder:text-[#93a0b5] focus:outline-none focus:border-blue-500"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[11px] font-medium text-slate-300">Preço (R$)</label>
                          <input
                            type="text"
                            value={extraProducts[1]?.price_to || ''}
                            onChange={(e) => updateExtraProduct(1, 'price_to', e.target.value)}
                            placeholder="Ex: 19,90"
                            className="w-full px-3 py-2 bg-[#0e1119] border border-[#1e2636] rounded-lg text-xs text-white placeholder:text-[#93a0b5] focus:outline-none focus:border-blue-500"
                          />
                        </div>
                      </div>
                      <div className="space-y-1">
                        <label className="text-[11px] font-medium text-slate-300">Principal Destaque / Benefício</label>
                        <input
                          type="text"
                          value={extraProducts[1]?.highlight || ''}
                          onChange={(e) => updateExtraProduct(1, 'highlight', e.target.value)}
                          placeholder="Ex: Fecha qualquer saco plástico em 3 segundos mantendo tudo crocante"
                          className="w-full px-3 py-2 bg-[#0e1119] border border-[#1e2636] rounded-lg text-xs text-white placeholder:text-[#93a0b5] focus:outline-none focus:border-blue-500"
                        />
                      </div>
                    </div>
                  </div>
                )}

                {/* ── CASO B: ESTILOS DE REACT A VÍDEO VIRAL / REAÇÃO GENUÍNA ── */}
                {(selectedStyleId.includes('react') || selectedStyleId.includes('reacao')) && (
                  <div className="space-y-4 pt-1">
                    <div className="p-4 rounded-xl bg-[#151a26] border border-cyan-500/30 space-y-4">
                      <div className="flex items-center gap-2 text-cyan-400">
                        <Video className="w-5 h-5" />
                        <h4 className="text-xs font-bold text-white">Upload / Link do Vídeo Viral de Referência (React)</h4>
                      </div>
                      <p className="text-xs text-[#93a0b5]">
                        Faça o upload do vídeo original que você vai reagir ou cole o link do TikTok / Instagram Reels.
                      </p>

                      {/* Upload de Vídeo com Drag & Drop */}
                      <div className="border-2 border-dashed border-[#1e2636] hover:border-cyan-500/50 rounded-xl p-5 text-center transition-all bg-[#0e1119] relative">
                        <input
                          type="file"
                          accept="video/*,image/*"
                          onChange={(e) =>
                            handleFileUpload(e, (dataUrl, fileName) => {
                              updateStyleContext('reactVideoUrl', dataUrl);
                              updateStyleContext('reactVideoName', fileName);
                            })
                          }
                          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                        />
                        <div className="space-y-2 pointer-events-none">
                          <UploadCloud className="w-8 h-8 text-cyan-400 mx-auto" />
                          <p className="text-xs font-bold text-white">
                            {styleContext.reactVideoName
                              ? `Arquivo selecionado: ${styleContext.reactVideoName}`
                              : 'Arraste o vídeo aqui ou clique para selecionar do dispositivo'}
                          </p>
                          <p className="text-[10px] text-[#93a0b5]">Suporta MP4, MOV, WebM, PNG, JPG</p>
                        </div>
                      </div>

                      {/* Prévia do Vídeo Carregado */}
                      {styleContext.reactVideoUrl && (
                        <div className="p-3 bg-[#0e1119] rounded-xl border border-[#1e2636] flex items-center justify-between gap-3">
                          <div className="flex items-center gap-3 min-w-0">
                            <FileVideo className="w-6 h-6 text-cyan-400 shrink-0" />
                            <div className="min-w-0">
                              <span className="text-xs font-bold text-white block truncate">
                                {styleContext.reactVideoName || 'Vídeo carregado com sucesso'}
                              </span>
                              <span className="text-[10px] text-emerald-400">Pronto para incorporação no roteiro</span>
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              updateStyleContext('reactVideoUrl', '');
                              updateStyleContext('reactVideoName', '');
                            }}
                            className="p-1.5 rounded-lg bg-rose-500/10 text-rose-400 hover:bg-rose-500/20 text-xs transition-colors cursor-pointer"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      )}

                      {/* Ou colar Link */}
                      <div className="space-y-1.5">
                        <label className="text-[11px] font-medium text-slate-300 flex items-center gap-1.5">
                          <LinkIcon className="w-3.5 h-3.5 text-cyan-400" /> Ou cole o link do vídeo viral:
                        </label>
                        <input
                          type="text"
                          value={styleContext.reactVideoUrl?.startsWith('data:') ? '' : styleContext.reactVideoUrl || ''}
                          onChange={(e) => updateStyleContext('reactVideoUrl', e.target.value)}
                          placeholder="https://www.tiktok.com/@exemplo/video/12345..."
                          className="w-full px-3 py-2 bg-[#0e1119] border border-[#1e2636] rounded-lg text-xs text-white placeholder:text-[#93a0b5] focus:outline-none focus:border-cyan-500"
                        />
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                        <div className="space-y-1">
                          <label className="text-[11px] font-medium text-slate-300">
                            O que acontece no vídeo ao qual você vai reagir?
                          </label>
                          <textarea
                            rows={2}
                            value={styleContext.reactKeyMoment || ''}
                            onChange={(e) => updateStyleContext('reactKeyMoment', e.target.value)}
                            placeholder="Ex: Pessoa sofrendo para abrir pote ou reclamando que nada funciona..."
                            className="w-full px-3 py-2 bg-[#0e1119] border border-[#1e2636] rounded-lg text-xs text-white placeholder:text-[#93a0b5] focus:outline-none focus:border-cyan-500 resize-none"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[11px] font-medium text-slate-300">
                            Qual é o seu ângulo / gancho de resposta?
                          </label>
                          <textarea
                            rows={2}
                            value={styleContext.reactResponseAngle || ''}
                            onChange={(e) => updateStyleContext('reactResponseAngle', e.target.value)}
                            placeholder="Ex: Corto rindo e mostro esse abridor elétrico de 25 reais que resolve em 1 segundo!"
                            className="w-full px-3 py-2 bg-[#0e1119] border border-[#1e2636] rounded-lg text-xs text-white placeholder:text-[#93a0b5] focus:outline-none focus:border-cyan-500 resize-none"
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* ── CASO C: ESTILOS DE TESTE / DESAFIO / TESTANDO PRODUTO VIRAL ── */}
                {(selectedStyleId.includes('testando') ||
                  selectedStyleId.includes('desafio') ||
                  selectedStyleId.includes('durabilidade') ||
                  selectedStyleId.includes('prova')) && (
                  <div className="space-y-4 pt-1">
                    <div className="p-4 rounded-xl bg-[#151a26] border border-amber-500/30 space-y-3">
                      <h4 className="text-xs font-bold text-amber-400 flex items-center gap-2">
                        <Flame className="w-4 h-4" />
                        Configurações do Teste Prático / Desafio
                      </h4>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div className="space-y-1">
                          <label className="text-[11px] font-medium text-slate-300">
                            Qual é o teste específico a ser feito?
                          </label>
                          <input
                            type="text"
                            value={styleContext.testType || ''}
                            onChange={(e) => updateStyleContext('testType', e.target.value)}
                            placeholder="Ex: Teste de resistência à água / Queda / Limpeza extrema"
                            className="w-full px-3 py-2 bg-[#0e1119] border border-[#1e2636] rounded-lg text-xs text-white placeholder:text-[#93a0b5] focus:outline-none focus:border-amber-500"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[11px] font-medium text-slate-300">
                            Qual foi o resultado alcançado?
                          </label>
                          <input
                            type="text"
                            value={styleContext.testResult || ''}
                            onChange={(e) => updateStyleContext('testResult', e.target.value)}
                            placeholder="Ex: Passou no teste 100% intacto e superou a expectativa"
                            className="w-full px-3 py-2 bg-[#0e1119] border border-[#1e2636] rounded-lg text-xs text-white placeholder:text-[#93a0b5] focus:outline-none focus:border-amber-500"
                          />
                        </div>
                      </div>

                      {/* Upload de Gravação do Teste */}
                      <div className="pt-2">
                        <label className="text-[11px] font-medium text-slate-300 block mb-1.5">
                          Upload do clipe de vídeo do teste (Opcional):
                        </label>
                        <div className="border border-dashed border-[#1e2636] rounded-xl p-3 text-center bg-[#0e1119] relative hover:border-amber-500/40 transition-all">
                          <input
                            type="file"
                            accept="video/*,image/*"
                            onChange={(e) =>
                              handleFileUpload(e, (dataUrl) => updateStyleContext('testMediaUrl', dataUrl))
                            }
                            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                          />
                          <p className="text-[11px] text-slate-300 flex items-center justify-center gap-1.5">
                            <Upload className="w-3.5 h-3.5 text-amber-400" />
                            {styleContext.testMediaUrl ? 'Vídeo do teste anexado ✅' : 'Clique para anexar o vídeo do teste'}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* ── CASO D: ESTILOS DE ANTES VS DEPOIS / TRANSFORMAÇÃO ── */}
                {(selectedStyleId.includes('antes') ||
                  selectedStyleId.includes('depois') ||
                  selectedStyleId.includes('transformacao') ||
                  selectedStyleId.includes('organizacao')) && (
                  <div className="space-y-4 pt-1">
                    <div className="p-4 rounded-xl bg-[#151a26] border border-pink-500/30 space-y-3">
                      <h4 className="text-xs font-bold text-pink-400 flex items-center gap-2">
                        <Sparkles className="w-4 h-4" />
                        Detalhes do Antes vs Depois (Transformação)
                      </h4>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div className="space-y-1">
                          <label className="text-[11px] font-medium text-rose-300">
                            Descrição do ANTES (o caos / problema)
                          </label>
                          <textarea
                            rows={2}
                            value={styleContext.beforeDescription || ''}
                            onChange={(e) => updateStyleContext('beforeDescription', e.target.value)}
                            placeholder="Ex: Pia cheia de gordura encrostada e queimada há meses..."
                            className="w-full px-3 py-2 bg-[#0e1119] border border-[#1e2636] rounded-lg text-xs text-white placeholder:text-[#93a0b5] focus:outline-none focus:border-pink-500 resize-none"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[11px] font-medium text-emerald-300">
                            Descrição do DEPOIS (a solução brilhando)
                          </label>
                          <textarea
                            rows={2}
                            value={styleContext.afterDescription || ''}
                            onChange={(e) => updateStyleContext('afterDescription', e.target.value)}
                            placeholder="Ex: Brilhando como nova em apenas 2 minutos sem esforço nenhum..."
                            className="w-full px-3 py-2 bg-[#0e1119] border border-[#1e2636] rounded-lg text-xs text-white placeholder:text-[#93a0b5] focus:outline-none focus:border-pink-500 resize-none"
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* ── CASO E: ESTILOS COMPARATIVOS / VS CONCORRENTE CARO ── */}
                {(selectedStyleId.includes('comparativo') ||
                  selectedStyleId.includes('vs') ||
                  selectedStyleId.includes('concorrente')) && (
                  <div className="space-y-4 pt-1">
                    <div className="p-4 rounded-xl bg-[#151a26] border border-blue-500/30 space-y-3">
                      <h4 className="text-xs font-bold text-blue-400 flex items-center gap-2">
                        <Layers className="w-4 h-4" />
                        Comparativo Lado a Lado
                      </h4>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <div className="space-y-1">
                          <label className="text-[11px] font-medium text-slate-300">
                            Nome do Concorrente ou Método Tradicional
                          </label>
                          <input
                            type="text"
                            value={styleContext.competitorName || ''}
                            onChange={(e) => updateStyleContext('competitorName', e.target.value)}
                            placeholder="Ex: Marca Famosa de Grife"
                            className="w-full px-3 py-2 bg-[#0e1119] border border-[#1e2636] rounded-lg text-xs text-white placeholder:text-[#93a0b5] focus:outline-none focus:border-blue-500"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[11px] font-medium text-slate-300">
                            Preço do Concorrente (R$)
                          </label>
                          <input
                            type="text"
                            value={styleContext.competitorPrice || ''}
                            onChange={(e) => updateStyleContext('competitorPrice', e.target.value)}
                            placeholder="Ex: 380,00"
                            className="w-full px-3 py-2 bg-[#0e1119] border border-[#1e2636] rounded-lg text-xs text-white placeholder:text-[#93a0b5] focus:outline-none focus:border-blue-500"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[11px] font-medium text-slate-300">
                            Vantagem do seu Achadinho
                          </label>
                          <input
                            type="text"
                            value={styleContext.competitorFlaw || ''}
                            onChange={(e) => updateStyleContext('competitorFlaw', e.target.value)}
                            placeholder="Ex: Mesma potência custando 80% menos"
                            className="w-full px-3 py-2 bg-[#0e1119] border border-[#1e2636] rounded-lg text-xs text-white placeholder:text-[#93a0b5] focus:outline-none focus:border-blue-500"
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* ── CASO F: OUTROS ESTILOS / UPLOAD GERAL DE VÍDEOS BRUTOS OU DETALHES ── */}
                <div className="p-4 rounded-xl bg-[#151a26] border border-[#1e2636] space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-white flex items-center gap-2">
                      <FileVideo className="w-4 h-4 text-blue-400" />
                      Upload de Vídeos Brutos ou Imagens Gravadas do Produto (Opcional):
                    </label>
                    <span className="text-[10px] text-[#93a0b5]">B-roll / Takes de demonstração</span>
                  </div>

                  <div className="border border-dashed border-[#1e2636] hover:border-blue-500/40 rounded-xl p-4 text-center bg-[#0e1119] relative transition-all">
                    <input
                      type="file"
                      accept="video/*,image/*"
                      multiple
                      onChange={(e) => {
                        const files = e.target.files;
                        if (!files || files.length === 0) return;
                        Array.from(files).forEach((file) => {
                          const reader = new FileReader();
                          reader.onload = (event) => {
                            const dataUrl = event.target?.result as string;
                            setStyleContext((prev) => ({
                              ...prev,
                              uploadedVideos: [
                                ...(prev.uploadedVideos || []),
                                {
                                  name: file.name,
                                  url: dataUrl,
                                  type: file.type.startsWith('video') ? 'video' : 'image',
                                },
                              ],
                            }));
                          };
                          reader.readAsDataURL(file);
                        });
                      }}
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                    />
                    <div className="space-y-1 pointer-events-none">
                      <Upload className="w-5 h-5 text-blue-400 mx-auto" />
                      <p className="text-xs font-bold text-white">Adicionar vídeos e fotos gravados</p>
                      <p className="text-[10px] text-[#93a0b5]">Takes de abertura, aplicação prática, close-up</p>
                    </div>
                  </div>

                  {/* Listagem de Mídias Anexadas */}
                  {styleContext.uploadedVideos && styleContext.uploadedVideos.length > 0 && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-2">
                      {styleContext.uploadedVideos.map((vid, idx) => (
                        <div
                          key={idx}
                          className="p-2.5 bg-[#0e1119] rounded-lg border border-[#1e2636] flex items-center justify-between gap-2"
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            {vid.type === 'video' ? (
                              <FileVideo className="w-4 h-4 text-blue-400 shrink-0" />
                            ) : (
                              <ImageIcon className="w-4 h-4 text-emerald-400 shrink-0" />
                            )}
                            <span className="text-[11px] font-medium text-white truncate">{vid.name}</span>
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              setStyleContext((prev) => ({
                                ...prev,
                                uploadedVideos: prev.uploadedVideos?.filter((_, i) => i !== idx),
                              }));
                            }}
                            className="text-[#93a0b5] hover:text-rose-400 p-1 cursor-pointer"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Observações Extras */}
                  <div className="space-y-1.5 pt-2">
                    <label className="text-[11px] font-medium text-slate-300">
                      Observações criativas adicionais para o roteiro (Opcional):
                    </label>
                    <input
                      type="text"
                      value={styleContext.extraNotes || ''}
                      onChange={(e) => updateStyleContext('extraNotes', e.target.value)}
                      placeholder="Ex: Fazer tom de conversa bem informal, usar piada rápida no segundo 5..."
                      className="w-full px-3 py-2 bg-[#0e1119] border border-[#1e2636] rounded-lg text-xs text-white placeholder:text-[#93a0b5] focus:outline-none focus:border-blue-500"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* ════ ETAPA 10: GANCHOS (HOOKS) - 15 OPÇÕES GERADAS DINAMICAMENTE ════ */}
            {currentQuizStep === 10 && (
              <div className="space-y-4 animate-fadeIn">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="w-7 h-7 rounded-xl bg-blue-600/20 text-blue-400 border border-blue-500/30 flex items-center justify-center text-xs font-black">
                        10
                      </span>
                      <h2 className="text-base sm:text-lg font-black text-white">
                        Escolha o Gancho Inicial (15 Ganchos Gerados sob Medida)
                      </h2>
                    </div>
                    <p className="text-xs text-[#93a0b5] pl-9">
                      Ganchos calculados especificamente para o seu produto, preço, plataforma e estilo ({availableStyles.find((s) => s.id === selectedStyleId)?.name}).
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => generateDynamicHooks(true)}
                    disabled={loadingHooks}
                    className="px-3 py-1.5 rounded-lg bg-[#151a26] hover:bg-[#1e2636] text-blue-400 border border-blue-500/20 text-xs font-bold flex items-center gap-1.5 transition-all self-start sm:self-auto cursor-pointer"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${loadingHooks ? 'animate-spin' : ''}`} />
                    <span>{loadingHooks ? 'Gerando...' : 'Regenerar com IA'}</span>
                  </button>
                </div>

                {loadingHooks ? (
                  <div className="py-12 text-center space-y-3">
                    <Loader2 className="w-8 h-8 text-blue-400 mx-auto animate-spin" />
                    <p className="text-xs text-white font-bold">
                      Criando 15 ganchos irresistíveis com todo o contexto do produto e estilo...
                    </p>
                    <p className="text-[11px] text-[#93a0b5]">
                      Analisando preço, benefícios, plataforma, produtos adicionais e formato selecionado.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-4 pt-1">
                    {/* Lista dos 15 Ganchos */}
                    <div className="space-y-2 max-h-[380px] overflow-y-auto pr-1">
                      {generatedHooks.map((hk, idx) => (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => {
                            setSelectedHook(hk);
                            setIsEditingHookCustom(false);
                          }}
                          className={`w-full p-3.5 rounded-xl border text-left transition-all flex items-start gap-3 cursor-pointer ${
                            selectedHook === hk && !isEditingHookCustom
                              ? 'bg-blue-600/15 border-blue-500 ring-2 ring-blue-500/20 text-white'
                              : 'bg-[#151a26] border-[#1e2636] text-slate-300 hover:text-white hover:border-slate-600'
                          }`}
                        >
                          <span className="w-5 h-5 rounded-md bg-black/40 text-blue-400 flex items-center justify-center text-[10px] font-black shrink-0 mt-0.5">
                            {idx + 1}
                          </span>
                          <span className="text-xs font-medium leading-relaxed flex-1">"{hk}"</span>
                          {selectedHook === hk && !isEditingHookCustom && (
                            <Check className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
                          )}
                        </button>
                      ))}
                    </div>

                    {/* Opção para Personalizar / Editar Gancho Manualmente */}
                    <div className="pt-2 border-t border-[#1e2636] space-y-2">
                      <div className="flex items-center justify-between">
                        <label className="text-xs font-bold text-white flex items-center gap-1.5">
                          <Edit3 className="w-3.5 h-3.5 text-blue-400" /> Ou edite o gancho manualmente:
                        </label>
                        <span className="text-[10px] text-[#93a0b5]">{selectedHook.length} caracteres</span>
                      </div>
                      <input
                        type="text"
                        value={selectedHook}
                        onChange={(e) => {
                          setSelectedHook(e.target.value);
                          setIsEditingHookCustom(true);
                        }}
                        placeholder="Digite sua própria versão do gancho aqui..."
                        className="w-full px-4 py-3 bg-[#151a26] border border-[#1e2636] focus:border-blue-500 rounded-xl text-xs text-white placeholder:text-[#93a0b5] focus:outline-none transition-all"
                      />
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ════ ETAPA 11: CHAMADA PARA AÇÃO (CTA) & FINALIZAR ════ */}
            {currentQuizStep === 11 && (
              <div className="space-y-4 animate-fadeIn">
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2">
                    <span className="w-7 h-7 rounded-xl bg-blue-600/20 text-blue-400 border border-blue-500/30 flex items-center justify-center text-xs font-black">
                      11
                    </span>
                    <h2 className="text-base sm:text-lg font-black text-white">
                      Qual é a Chamada para Ação (CTA) do final do vídeo?
                    </h2>
                  </div>
                  <p className="text-xs text-[#93a0b5] pl-9">
                    Escolha uma sugestão recomendada para {targetPlatform === 'tiktok' ? 'TikTok' : targetPlatform === 'instagram' ? 'Instagram' : 'Criativos'} ou personalize.
                  </p>
                </div>

                <div className="space-y-4 pt-2">
                  <div className="space-y-2">
                    <span className="text-[11px] font-bold text-[#93a0b5] block">Sugestões otimizadas:</span>
                    <div className="space-y-2">
                      {ctaSuggestionsForPlatform.map((sug, idx) => (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => setCustomCta(sug)}
                          className={`w-full p-3 rounded-xl border text-left text-xs font-semibold transition-all cursor-pointer flex items-center justify-between gap-2 ${
                            customCta === sug
                              ? 'bg-blue-600/15 border-blue-500 text-white ring-1 ring-blue-500/20'
                              : 'bg-[#151a26] border-[#1e2636] text-[#93a0b5] hover:text-white'
                          }`}
                        >
                          <span>"{sug}"</span>
                          {customCta === sug && <Check className="w-3.5 h-3.5 text-blue-400 shrink-0" />}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-1.5 pt-2">
                    <label className="text-xs font-semibold text-white">Texto da CTA Personalizada:</label>
                    <input
                      type="text"
                      value={customCta}
                      onChange={(e) => setCustomCta(e.target.value)}
                      placeholder="Ex: Comente 'EU QUERO' para receber o link promocional no direct!"
                      className="w-full px-4 py-3 bg-[#151a26] border border-[#1e2636] focus:border-blue-500 rounded-xl text-xs text-white placeholder:text-[#93a0b5] focus:outline-none transition-all"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* ─── BOTÕES DE NAVEGAÇÃO DO QUIZ ─── */}
            <div className="flex items-center justify-between pt-4 border-t border-[#1e2636] gap-3">
              {currentQuizStep > 1 ? (
                <button
                  type="button"
                  onClick={handlePrevStep}
                  className="px-4 py-2.5 rounded-xl bg-[#151a26] hover:bg-[#1e2636] text-[#93a0b5] hover:text-white text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <ArrowLeft className="w-4 h-4" />
                  <span>Voltar</span>
                </button>
              ) : (
                <div />
              )}

              {currentQuizStep < TOTAL_STEPS ? (
                <button
                  type="button"
                  onClick={handleNextStep}
                  disabled={currentQuizStep === 1 && !productTitle.trim()}
                  className="px-6 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-black flex items-center gap-2 transition-all shadow-lg shadow-blue-600/20 cursor-pointer"
                >
                  <span>Próximo</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleGenerateFinalScript}
                  disabled={generatingScript || !productTitle.trim()}
                  className="px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-black flex items-center gap-2 transition-all shadow-lg shadow-emerald-600/25 cursor-pointer"
                >
                  {generatingScript ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Gerando Roteiro...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4" />
                      <span>Gerar Roteiro Completo</span>
                    </>
                  )}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════════════════
          3. VISUALIZAÇÃO DO ROTEIRO PRONTO (CENA A CENA + TELEPROMPTER + TÍTULOS + HASHTAGS)
         ════════════════════════════════════════════════════════════════════════ */}
      {viewMode === 'view_ready' && generatedScript && (
        <div className="space-y-6 animate-fadeIn max-w-4xl mx-auto">
          {/* Header da Visualização */}
          <div className="bg-[#0e1119] border border-[#1e2636] rounded-2xl p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-xl">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setViewMode('dashboard')}
                  className="p-1.5 rounded-lg bg-[#151a26] hover:bg-[#1e2636] text-[#93a0b5] hover:text-white transition-colors cursor-pointer"
                  title="Voltar ao Painel"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <h2 className="text-base sm:text-lg font-black text-white">{generatedScript.title}</h2>
              </div>
              <p className="text-xs text-[#93a0b5] pl-8">
                Plataforma:{' '}
                <strong className="text-white">
                  {targetPlatform === 'tiktok'
                    ? 'TikTok'
                    : targetPlatform === 'instagram'
                    ? 'Instagram Reels'
                    : 'Criativo de Alta Conversão'}
                </strong>{' '}
                • Duração: <strong className="text-white">{duration}</strong>
              </p>
            </div>

            {/* Ações de Cópia Rápida */}
            <div className="flex items-center gap-2 shrink-0">
              {generatedScript.cleanText && (
                <button
                  type="button"
                  onClick={() => handleCopyText(generatedScript.cleanText!, 'view_clean')}
                  className="px-3.5 py-2 rounded-xl bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 border border-amber-500/30 text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer"
                >
                  {copiedId === 'view_clean' ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-400" />
                      <span>Fala Copiada!</span>
                    </>
                  ) : (
                    <>
                      <AlignLeft className="w-3.5 h-3.5" />
                      <span>Copiar Fala (Teleprompter)</span>
                    </>
                  )}
                </button>
              )}

              <button
                type="button"
                onClick={() => handleCopyText(generatedScript.fullText, 'view_full')}
                className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-black flex items-center gap-1.5 transition-all shadow-md cursor-pointer"
              >
                {copiedId === 'view_full' ? (
                  <>
                    <Check className="w-3.5 h-3.5" />
                    <span>Copiado!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    <span>Copiar Tudo</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* ─── BLOCO 1: GANCHO PRINCIPAL ─── */}
          <div className="bg-[#0e1119] border border-blue-500/30 rounded-2xl p-5 space-y-2 shadow-lg">
            <span className="text-[11px] font-bold text-blue-400 uppercase tracking-wider block">
              Gancho Inicial (Primeiros 3 segundos)
            </span>
            <p className="text-sm sm:text-base font-extrabold text-white leading-relaxed">
              "{generatedScript.hook}"
            </p>
          </div>

          {/* ─── BLOCO 2: ROTEIRO LIMPO PARA GRAVAÇÃO (TELEPROMPTER) ─── */}
          {generatedScript.cleanText && (
            <div className="bg-[#0e1119] border border-[#1e2636] rounded-2xl p-5 sm:p-6 space-y-3 shadow-lg">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-extrabold text-white flex items-center gap-2">
                  <AlignLeft className="w-4 h-4 text-amber-400" /> Roteiro Limpo (Apenas a Fala Contínua)
                </h3>
                <button
                  type="button"
                  onClick={() => handleCopyText(generatedScript.cleanText!, 'block_clean')}
                  className="text-xs font-bold text-amber-400 hover:text-amber-300 flex items-center gap-1 transition-colors cursor-pointer"
                >
                  <Copy className="w-3 h-3" />
                  <span>{copiedId === 'block_clean' ? 'Copiado!' : 'Copiar Fala'}</span>
                </button>
              </div>

              <div className="bg-[#151a26] p-4 rounded-xl border border-[#1e2636] text-xs sm:text-sm text-stone-200 leading-relaxed font-sans whitespace-pre-wrap">
                {generatedScript.cleanText}
              </div>
            </div>
          )}

          {/* ─── BLOCO 3: ESTRUTURA CENA A CENA ─── */}
          <div className="space-y-3">
            <h3 className="text-sm font-extrabold text-white flex items-center gap-2">
              <Film className="w-4 h-4 text-blue-400" /> Estrutura Cena a Cena
            </h3>

            <div className="space-y-3">
              {generatedScript.scenes.map((scene) => (
                <div
                  key={scene.sceneNumber}
                  className="bg-[#0e1119] border border-[#1e2636] rounded-2xl p-5 space-y-3 shadow-sm"
                >
                  <div className="flex items-center justify-between border-b border-[#1e2636] pb-2">
                    <span className="text-xs font-black text-blue-400">Cena {scene.sceneNumber}</span>
                    <span className="text-[11px] font-semibold text-[#93a0b5] bg-[#151a26] px-2.5 py-0.5 rounded-full border border-[#1e2636]">
                      {scene.timeRange}
                    </span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                    <div className="space-y-1">
                      <span className="text-[11px] font-bold text-slate-400 block">Enquadramento & Visual:</span>
                      <p className="text-stone-300 leading-relaxed">{scene.visual}</p>
                    </div>

                    <div className="space-y-1">
                      <span className="text-[11px] font-bold text-emerald-400 block">Fala do Narrador:</span>
                      <p className="text-white font-medium leading-relaxed">"{scene.audio}"</p>
                    </div>
                  </div>

                  {(scene.onScreenText || scene.actingTip) && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-2 border-t border-[#1e2636] text-[11px]">
                      {scene.onScreenText && (
                        <div className="text-[#93a0b5]">
                          <strong className="text-slate-300">Texto na Tela:</strong> {scene.onScreenText}
                        </div>
                      )}
                      {scene.actingTip && (
                        <div className="text-[#93a0b5]">
                          <strong className="text-slate-300">Dica de Atuação:</strong> {scene.actingTip}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* ─── BLOCO 4: SUGESTÕES DE TÍTULOS E HASHTAGS ─── */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Títulos Sugeridos */}
            {generatedScript.suggestedTitles && generatedScript.suggestedTitles.length > 0 && (
              <div className="bg-[#0e1119] border border-[#1e2636] rounded-2xl p-5 space-y-3 shadow-lg">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold text-white flex items-center gap-1.5">
                    <FileText className="w-3.5 h-3.5 text-blue-400" /> Títulos para Descrição
                  </h4>
                  <button
                    type="button"
                    onClick={() =>
                      handleCopyText(generatedScript.suggestedTitles!.join('\n'), 'copy_titles')
                    }
                    className="text-[11px] font-semibold text-blue-400 hover:text-blue-300 cursor-pointer"
                  >
                    {copiedId === 'copy_titles' ? 'Copiado!' : 'Copiar'}
                  </button>
                </div>
                <div className="space-y-2">
                  {generatedScript.suggestedTitles.map((title, idx) => (
                    <div
                      key={idx}
                      className="p-2.5 rounded-xl bg-[#151a26] border border-[#1e2636] text-xs text-stone-300"
                    >
                      {title}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Hashtags Recomendadas */}
            {generatedScript.hashtags && generatedScript.hashtags.length > 0 && (
              <div className="bg-[#0e1119] border border-[#1e2636] rounded-2xl p-5 space-y-3 shadow-lg">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold text-white flex items-center gap-1.5">
                    <Hash className="w-3.5 h-3.5 text-emerald-400" /> Hashtags Recomendadas
                  </h4>
                  <button
                    type="button"
                    onClick={() =>
                      handleCopyText(generatedScript.hashtags!.join(' '), 'copy_hashtags')
                    }
                    className="text-[11px] font-semibold text-emerald-400 hover:text-emerald-300 cursor-pointer"
                  >
                    {copiedId === 'copy_hashtags' ? 'Copiado!' : 'Copiar'}
                  </button>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {generatedScript.hashtags.map((tag, idx) => (
                    <span
                      key={idx}
                      className="px-2.5 py-1 rounded-lg bg-[#151a26] border border-[#1e2636] text-xs font-semibold text-emerald-400"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
