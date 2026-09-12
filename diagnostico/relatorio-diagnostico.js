// =============================================
// RELATÓRIO VIVO DO DIAGNÓSTICO — v2 (hub)
// diagnostico/relatorio-diagnostico.js
//
// Monta, a partir dos MESMOS getters/DOM que a página usa (não do banco),
// o relatório consolidado que o hub abre no card "Gerar Diagnóstico".
// Só apresentação: nada aqui calcula análise nova — o relatório declara os
// dados informados e o que o plano financeiro vai entregar (via
// window.getPlanoPorSecao / window.getQuestoesPorSecao da cópia v2 das
// questões) e o resultado já pronto do motor (window.getPerfilFinanceiroResultado).
//
// API: window.RelatorioDiagnostico = { render(container), secoes(), html() }
//   render(container) → container.innerHTML = html() e, depois, instancia os
//                       gráficos (Chart.js, se window.Chart existir) nos
//                       canvases já no DOM
//   secoes()          → [{ slug, titulo, icone }] (chips do hub), na ordem
//                       final do relatório
//   html()            → string com a estrutura .rel-* (H2 estiliza em hub.css)
//
// ORDEM FINAL (fase 2): capa → 12 seções de coleta (dados alinhados à
// esquerda, questões no mesmo formato das linhas, sem plano dentro) →
// #rel-secao-graficos → #rel-secao-perfil-financeiro → #rel-secao-codigo-matriz
// → #rel-secao-adesao-plano → #rel-secao-plano (todos os tópicos do plano +
// "Para fechar o plano") → #rel-secao-faltantes (slot para o painel do
// validador, que o hub.js adota em #rel-faltantes-slot).
// Não mostra análise/percentuais das questões nem o gabarito detalhado.
//
// Tudo tolerante a getter ausente / dado antigo: undefined vira vazio.
// Todo texto vindo de dados passa por esc(). Formatos pt-BR.
// Reversível: remover este script do HTML não afeta nada da página.
// =============================================

(function () {
  'use strict';

  // ------------------------------------------------------------
  // Catálogo das seções (mesma ordem do anel do hub, sem apresentação).
  // Título/ícone padrão; quando a seção existe no DOM, o h3 do
  // .section-header vence (para não duplicar nomes).
  // ------------------------------------------------------------
  const CATALOGO = [
    { slug: 'dados-pessoais',    titulo: 'Dados pessoais',                    icone: 'fa-user',                obs: 'obs_dados_pessoais' },
    { slug: 'pessoas-renda',     titulo: 'Outras pessoas com renda',          icone: 'fa-users',               obs: 'obs_pessoas_renda' },
    { slug: 'dependentes',       titulo: 'Dependentes',                       icone: 'fa-baby',                obs: 'obs_dependentes' },
    { slug: 'patrimonio-fisico', titulo: 'Patrimônio físico',                 icone: 'fa-home',                obs: 'obs_patrimonio_fisico' },
    { slug: 'patrimonio-liquido', titulo: 'Patrimônio líquido (investimentos)', icone: 'fa-wallet',            obs: 'obs_patrimonio_liquido' },
    { slug: 'dividas',           titulo: 'Dívidas',                           icone: 'fa-file-invoice-dollar', obs: 'obs_dividas' },
    { slug: 'sucessao',          titulo: 'Sucessão patrimonial',              icone: 'fa-gavel',               obs: 'obs_sucessao' },
    { slug: 'produtos-protecao', titulo: 'Produtos & proteção',               icone: 'fa-shield-alt',          obs: 'obs_produtos_protecao' },
    { slug: 'ir',                titulo: 'Imposto de renda',                  icone: 'fa-file-invoice-dollar', obs: 'obs_ir' },
    { slug: 'contas-cartoes',    titulo: 'Contas & cartões de crédito',       icone: 'fa-credit-card',         obs: 'obs_contas_cartoes' },
    { slug: 'fluxo-caixa',       titulo: 'Fluxo de caixa',                    icone: 'fa-chart-line',          obs: 'obs_fluxo_caixa' },
    { slug: 'objetivos',         titulo: 'Objetivos financeiros',             icone: 'fa-bullseye',            obs: 'obs_objetivos' },
    { slug: 'perfil-financeiro', titulo: 'Perfil financeiro',                 icone: 'fa-user-circle',         obs: 'obs_perfil_financeiro' },
    { slug: 'adesao-plano',      titulo: 'Adesão',                            icone: 'fa-handshake',           obs: 'obs_adesao_plano' }
  ];

  // Seções que têm questões pertinentes e plano (chaves do questoes-module)
  const SECOES_COM_QUESTOES = ['patrimonio-liquido', 'dividas', 'sucessao', 'produtos-protecao', 'ir', 'contas-cartoes', 'fluxo-caixa', 'objetivos'];

  // As 12 seções de COLETA do relatório (fase 2): tudo do CATALOGO menos
  // perfil-financeiro e adesao-plano, que passam a ser capítulos próprios
  // depois dos gráficos.
  const SECOES_COLETA = CATALOGO.filter(function (c) {
    return c.slug !== 'perfil-financeiro' && c.slug !== 'adesao-plano';
  });

  // Ordem fixa dos tópicos do plano (mesma ordem das regras do questoes-module)
  const ORDEM_PLANO = ['objetivos', 'fluxo-caixa', 'contas-cartoes', 'ir', 'patrimonio-liquido', 'produtos-protecao', 'dividas', 'sucessao'];

  // Catálogo do RELATÓRIO (ordem final da seção 11 do desenho). `chip` é o
  // texto curto para os chips do hub; `titulo` é o título do capítulo.
  function itemCatalogo(slug) {
    return CATALOGO.filter(function (c) { return c.slug === slug; })[0];
  }
  const CATALOGO_RELATORIO = SECOES_COLETA.concat([
    { slug: 'graficos',          titulo: 'Gráficos',                                    icone: 'fa-chart-pie',           chip: 'Gráficos' },
    itemCatalogo('perfil-financeiro'),
    { slug: 'codigo-matriz',     titulo: 'Código da matriz',                            icone: 'fa-table-cells',         chip: 'Matriz' },
    itemCatalogo('adesao-plano'),
    { slug: 'plano',             titulo: 'O que o plano financeiro precisa conter',     icone: 'fa-list-check',          chip: 'Plano' },
    { slug: 'faltantes',         titulo: 'Informações faltantes para as ferramentas',   icone: 'fa-triangle-exclamation', chip: 'Faltantes' }
  ]).filter(Boolean);

  const VERSAO_REGRAS_PADRAO = '2.1.0';

  // Paleta dos gráficos (seção 11 do desenho)
  const CORES_GRAFICO = ['#ffd700', '#2e8b57', '#d4af37', '#1a4d3a', '#28a745', '#8fbc8f', '#f0f8f0'];
  const COR_NEGATIVO = '#dc3545';
  const COR_TEXTO_GRAFICO = '#f0f8f0';
  const COR_GRADE_GRAFICO = 'rgba(240,248,240,.12)';
  const COR_FUNDO_GRAFICO = '#0f2e1f';

  // ------------------------------------------------------------
  // Rótulos (mesmos valores dos módulos; só para exibir)
  // ------------------------------------------------------------
  const PERFIS_FALLBACK = [
    { id: 'dividas_impagaveis', rotulo: '1 - Dívidas Impagáveis', cor: '#dc3545' },
    { id: 'dividas_pagaveis', rotulo: '2 - Dívidas Pagáveis', cor: '#fd7e14' },
    { id: 'zero_a_zero_obrigatorio', rotulo: '3 - Zero a Zero Obrigatório', cor: '#6c757d' },
    { id: 'zero_a_zero_opcional', rotulo: '4 - Zero a Zero Opcional', cor: '#ffc107' },
    { id: 'fluxo_positivo', rotulo: '5 - Fluxo Positivo', cor: '#17a2b8' },
    { id: 'poupador', rotulo: '6 - Poupador', cor: '#28a745' },
    { id: 'investidor_amador', rotulo: '7 - Investidor-Amador', cor: '#6f42c1' },
    { id: 'investidor_planejador', rotulo: '8 - Investidor-Planejador', cor: '#d4af37' }
  ];

  const PERFIL_INVESTIDOR = {
    '1': 'Ultra-Conservador', '2': 'Conservador', '3': 'Conservador-Moderado', '4': 'Moderado',
    '5': 'Moderado-Arrojado', '6': 'Arrojado', '7': 'Ultra-Arrojado'
  };

  const POSICOES_MATRIZ = [
    { chave: 'dependencia', rotulo: 'Dependência' },
    { chave: 'tempo', rotulo: 'Tempo até a aposentadoria' },
    { chave: 'moradia', rotulo: 'Moradia' },
    { chave: 'poupanca', rotulo: 'Poder de poupança' },
    { chave: 'fonte', rotulo: 'Fonte da renda' },
    { chave: 'patrimonio', rotulo: 'Patrimônio' },
    { chave: 'reserva', rotulo: 'Reserva de emergência' }
  ];

  const CUSTEIO_MORADIA = { nao_contribui: 'Não contribui', parcial: 'Parcial', integral: 'Integral' };
  const SIM_NAO = { sim: 'Sim', nao: 'Não' };

  const FINALIDADE = {
    SEM_FINALIDADE: 'Sem finalidade específica',
    RESERVA_EMERGENCIA: 'Reserva de emergência',
    RESERVA_OBJETIVOS: 'Reserva para objetivos',
    APOSENTADORIA: 'Aposentadoria'
  };

  const RISCO = {
    RISCO_MUITO_BAIXO: 'Risco muito baixo',
    RISCO_BAIXO: 'Risco baixo',
    RISCO_MEDIO_BAIXO: 'Risco médio-baixo',
    RISCO_MEDIO: 'Risco médio',
    RISCO_MEDIO_ALTO: 'Risco médio-alto',
    RISCO_ALTO: 'Risco alto',
    RISCO_MUITO_ALTO: 'Risco muito alto'
  };

  const APORTE_FREQ = { NENHUM: '', MENSAL: 'mensal', ANUAL: 'anual' };

  const SITUACAO_DIVIDA = {
    em_dia: 'Em dia',
    em_negociacao: 'Em negociação',
    em_atraso: 'Em atraso (ignorada)',
    judicializada: 'Judicializada',
    prescrita: 'Prescrita'
  };

  const TIPOS_RECEITA = {
    clt: 'CLT', concurso: 'Concurso público', autonomo: 'Autônomo', empresario: 'Empresário/Pró-labore',
    aluguel: 'Aluguel', dividendos: 'Dividendos', aposentadoria: 'Aposentadoria', pensao: 'Pensão',
    freelancer: 'Freelancer', comissao: 'Comissão', bonus: 'Bônus', outro: 'Outro', restituicao: 'Restituição de IR'
  };

  const TIPOS_DESPESA = { fixa: 'Fixa', variavel: 'Variável' };

  const CATEGORIA_DESPESA = {
    sobrevivencia: 'Sobrevivência', necessidades: 'Necessidades', aperfeicoamento: 'Aperfeiçoamento',
    dividas: 'Dívidas', conforto: 'Conforto/Supérfluo'
  };

  const NIVEIS_IMPORTANCIA_FALLBACK = {
    '1': '★ Mais importante', '2': 'Muito importante', '3': 'Importante', '4': 'Preferível ter',
    '5': 'Indiferente', '6': 'Preferível não ter', '7': 'Inaceitável'
  };
  const NIVEIS_CONFORTO_FALLBACK = {
    '1': 'Muito abaixo do básico', '2': 'Menos que básico', '3': 'Apenas básico',
    '4': 'Mais que básico', '5': 'Muito acima do básico'
  };
  const ALTERAVEL_FALLBACK = { sim: 'Sim', nao: 'Não' };

  const ORIGEM_AUTOMATICA = {
    produto_protecao: 'proteção', divida: 'dívida', conta_cartao: 'conta/cartão',
    ir_pagamento: 'IR', ir_restituicao: 'IR'
  };

  const UND_SINGULAR = { dia: 'dia', semana: 'semana', mes: 'mês', ano: 'ano' };
  const UND_PLURAL = { dia: 'dias', semana: 'semanas', mes: 'meses', ano: 'anos' };

  const TIPO_DECLARACAO = {
    nao_declara: 'Não declara', isento: 'Declara isento', simplificada: 'Declara simplificado', completa: 'Declara completa'
  };
  const RESULTADO_IR = { paga: 'Paga', restitui: 'Restitui' };

  const PLANOS = { nivel_1: 'HV Nível I', nivel_2: 'HV Nível II', nivel_3: 'HV Nível III', nivel_4: 'HV Nível IV', nivel_5: 'HV Nível V' };

  // Texto das perguntas do suitability (mesmo enunciado do patrimonio-liquido-module)
  const SUIT_QUESTOES = {
    A1: 'Em quanto tempo você pretende parar de trabalhar?',
    A2: 'Por quanto tempo você conseguiria deixar a maior parte do patrimônio aplicado?',
    A3: 'Quanto tempo teria para esperar recuperação em cenário ruim?',
    B1: 'Como reagiria se investimentos perdessem 20% em um mês?',
    B2: 'Qual sua atitude em relação a risco e retorno?',
    B3: 'Qual perda temporária conseguiria suportar?',
    C1: 'Qual seu nível de conhecimento sobre investimentos?',
    C2: 'Há quanto tempo investe no mercado financeiro?',
    C3: 'Já investiu em renda variável?'
  };
  // Alternativas (1–5) de cada pergunta, para imprimir a resposta em texto
  const SUIT_ALTERNATIVAS = {
    A1: ['Faltam 10 anos ou menos', 'Faltam entre 10 e 15 anos', 'Faltam entre 15 e 20 anos', 'Faltam entre 20 e 30 anos', 'Faltam mais de 30 anos'],
    A2: ['Menos de 1 ano', 'Entre 1 e 3 anos', 'Entre 3 e 10 anos', 'Entre 10 e 20 anos', 'Mais de 20 anos'],
    A3: ['Nenhum - precisaria resgatar', 'Até 2 anos', 'Entre 2 e 5 anos', 'Entre 5 e 10 anos', 'Mais de 10 anos'],
    B1: ['Resgataria tudo imediatamente', 'Consideraria resgatar parte', 'Aguardaria a recuperação', 'Ficaria tranquilo', 'Compraria mais com desconto'],
    B2: ['Não aceito risco algum', 'Aceito risco mínimo', 'Aceito risco moderado', 'Aceito risco alto', 'Aceito risco muito alto'],
    B3: ['Nenhuma perda', 'Até 5%', 'Até 10%', 'Até 20%', 'Mais de 20%'],
    C1: ['Nenhum', 'Básico', 'Intermediário', 'Avançado', 'Especialista'],
    C2: ['Nunca investi', 'Menos de 2 anos', 'Entre 2 e 5 anos', 'Entre 5 e 10 anos', 'Mais de 10 anos'],
    C3: ['Não, nunca', 'Não, mas tenho interesse', 'Sim, valores pequenos', 'Sim, regularmente', 'Sim, significativamente']
  };
  const SUIT_ORDEM = ['A1', 'A2', 'A3', 'B1', 'B2', 'B3', 'C1', 'C2', 'C3'];

  // Percentuais padrão do módulo de sucessão (4/1/6): sem patrimônio e sem
  // alteração, a seção conta como "nada informado".
  const SUCESSAO_PADRAO = { itcmd: 4, emolumentos: 1, honorarios: 6 };

  // Ordem e rótulos das finalidades do patrimônio líquido no gráfico
  const FINALIDADES_GRAFICO = ['RESERVA_EMERGENCIA', 'RESERVA_OBJETIVOS', 'APOSENTADORIA', 'SEM_FINALIDADE'];
  const CATEGORIAS_GRAFICO = ['sobrevivencia', 'necessidades', 'aperfeicoamento', 'dividas', 'conforto'];

  // ------------------------------------------------------------
  // Utilitários
  // ------------------------------------------------------------
  function esc(v) {
    if (v === null || v === undefined) return '';
    return String(v)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  // Texto com quebras de linha (observações) — escapa e troca \n por <br>
  function escMultilinha(v) {
    return esc(v).replace(/\r?\n/g, '<br>');
  }

  function seguro(fn, padrao) {
    try {
      const v = fn();
      return v === null || v === undefined ? padrao : v;
    } catch (e) {
      return padrao;
    }
  }

  // Chama window[nome]() se existir; senão devolve o padrão
  function getter(nome, padrao) {
    return seguro(function () {
      return typeof window[nome] === 'function' ? window[nome]() : undefined;
    }, padrao);
  }

  function lista(v) {
    return Array.isArray(v) ? v : [];
  }

  function str(v) {
    return v === null || v === undefined ? '' : String(v).trim();
  }

  function num(v) {
    if (typeof v === 'number') return isFinite(v) ? v : 0;
    if (v === null || v === undefined || v === '') return 0;
    const n = parseFloat(String(v).replace(/\./g, '').replace(',', '.'));
    if (isFinite(n) && /,/.test(String(v))) return n;
    const n2 = parseFloat(v);
    return isFinite(n2) ? n2 : 0;
  }

  // "R$ 1.234,56" → 1234.56 (mesmo critério do parseMoeda do HTML)
  function parseMoeda(texto) {
    const s = str(texto);
    if (!s) return 0;
    const limpo = s.replace(/[^\d,]/g, '').replace(',', '.');
    const n = parseFloat(limpo);
    return isFinite(n) ? n : 0;
  }

  function moeda(v) {
    const n = typeof v === 'number' ? v : num(v);
    const abs = Math.abs(n).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    return (n < 0 ? '-R$ ' : 'R$ ') + abs;
  }

  function pct(v, casas) {
    const n = typeof v === 'number' ? v : num(v);
    const c = casas === undefined ? 2 : casas;
    return n.toLocaleString('pt-BR', { minimumFractionDigits: c, maximumFractionDigits: c }) + '%';
  }

  function inteiro(v) {
    const n = parseInt(v, 10);
    return isFinite(n) ? String(n) : '0';
  }

  // Data local a partir de 'YYYY-MM-DD', 'DD/MM/YYYY' ou ISO completo
  function parseData(v) {
    const s = str(v);
    if (!s) return null;
    let m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (m) return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
    m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
    if (m) return new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1]));
    const d = new Date(s);
    return isNaN(d) ? null : d;
  }

  function dois(n) {
    return (n < 10 ? '0' : '') + n;
  }

  // Data em texto puro (sem escape) — para rótulos de gráfico
  function fmtDataTexto(v) {
    const d = parseData(v);
    if (!d) return str(v);
    return dois(d.getDate()) + '/' + dois(d.getMonth() + 1) + '/' + d.getFullYear();
  }

  // Data para HTML (escapada; para datas válidas o escape não muda nada)
  function fmtData(v) {
    return esc(fmtDataTexto(v));
  }

  // Valor inteiro em R$ (eixos e legendas de gráfico): "R$ 12.345"
  function moedaInteira(v) {
    const n = typeof v === 'number' ? v : num(v);
    const abs = Math.round(Math.abs(n)).toLocaleString('pt-BR');
    return (n < 0 ? '-R$ ' : 'R$ ') + abs;
  }

  function hojeFormatada() {
    const d = new Date();
    return dois(d.getDate()) + '/' + dois(d.getMonth() + 1) + '/' + d.getFullYear();
  }

  // Idade em anos completos (hoje); null se vazio/inválido/negativo
  function idadeAnos(dataNasc) {
    const n = parseData(dataNasc);
    if (!n) return null;
    const hoje = new Date();
    let idade = hoje.getFullYear() - n.getFullYear();
    const m = hoje.getMonth() - n.getMonth();
    if (m < 0 || (m === 0 && hoje.getDate() < n.getDate())) idade--;
    return idade >= 0 ? idade : null;
  }

  // Meses completos de vida (hoje); null se vazio/inválido/negativo
  function idadeMeses(dataNasc) {
    const n = parseData(dataNasc);
    if (!n) return null;
    const hoje = new Date();
    let meses = (hoje.getFullYear() - n.getFullYear()) * 12 + (hoje.getMonth() - n.getMonth());
    if (hoje.getDate() < n.getDate()) meses--;
    return meses >= 0 ? meses : null;
  }

  // Idade em texto: "3 anos", "1 ano", ou, abaixo de 1 ano, "7 meses" / "1 mês"
  // / "menos de 1 mês" (dependentes bebês). '' quando não dá para calcular.
  function idadeTexto(dataNasc) {
    const anos = idadeAnos(dataNasc);
    if (anos === null) return '';
    if (anos >= 1) return anos + (anos === 1 ? ' ano' : ' anos');
    const meses = idadeMeses(dataNasc);
    if (meses === null || meses <= 0) return 'menos de 1 mês';
    return meses + (meses === 1 ? ' mês' : ' meses');
  }

  // Data de nascimento de uma pessoa a partir do id sintético (titular,
  // conjuge, pessoa_N, pessoa_N_conjuge, dependente_N). '' se não houver.
  function dataNascimentoPessoa(id) {
    const s = str(id) || 'titular';
    if (s === 'titular') return valorDom('data_nascimento');
    if (s === 'conjuge') return valorDom('conjuge_data_nascimento');
    const pessoas = lista(window.pessoasRenda);
    const deps = lista(window.dependentes);
    let m = s.match(/^pessoa_(\d+)_conjuge$/);
    if (m) return str(campoLista('pessoa', Number(m[1]), 'conjuge_data_nascimento', pessoas[Number(m[1])]));
    m = s.match(/^pessoa_(\d+)$/);
    if (m) return str(campoLista('pessoa', Number(m[1]), 'data_nascimento', pessoas[Number(m[1])]));
    m = s.match(/^dependente_(\d+)$/);
    if (m) return str(campoLista('dependente', Number(m[1]), 'data_nascimento', deps[Number(m[1])]));
    return '';
  }

  function fmtCPF(v) {
    const d = str(v).replace(/\D/g, '');
    if (d.length === 11) return d.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
    return str(v);
  }

  function valorDom(id) {
    const el = document.getElementById(id);
    if (!el) return '';
    if (el.type === 'checkbox' || el.type === 'radio') return el.checked ? 'sim' : '';
    return str(el.value);
  }

  function textoDom(id) {
    const el = document.getElementById(id);
    return el ? str(el.textContent) : '';
  }

  function rotulo(mapa, valor, padrao) {
    const k = str(valor);
    if (!k) return padrao === undefined ? '' : padrao;
    return Object.prototype.hasOwnProperty.call(mapa, k) ? mapa[k] : k;
  }

  // Mapa {id → nome} a partir de um array [{id, nome}] (FLUXO_CLASSIFICACAO)
  function mapaDeArray(arr, fallback) {
    if (!Array.isArray(arr) || !arr.length) return fallback;
    const m = {};
    arr.forEach(function (x) { if (x && x.id !== undefined) m[String(x.id)] = str(x.nome); });
    return m;
  }

  function simNao(v) {
    return v === true || v === 'true' || v === 'sim' ? 'Sim' : 'Não';
  }

  function simOuTraco(v) {
    return v === true || v === 'true' || v === 'sim' ? 'Sim' : '—';
  }

  // Equivalência mensal uniforme (anuais entram como 1/12).
  // Semanal usa fator 4 — mesmo critério de calcularValorMensal (fluxo-caixa-module.js)
  // e do consolidado da ficha do cliente, para os números baterem entre as telas.
  function mensal(valor, qtd, und) {
    const v = num(valor);
    const q = parseInt(qtd, 10) || 1;
    switch (str(und)) {
      case 'dia': return v * 30 / q;
      case 'semana': return v * 4 / q;
      case 'mes': return v / q;
      case 'ano': return v / (12 * q);
      default: return v;
    }
  }

  function recorrencia(qtd, und) {
    const q = parseInt(qtd, 10) || 1;
    const u = str(und) || 'mes';
    // rotulo() usa hasOwnProperty: unidade desconhecida não cai em chave herdada
    if (q <= 1) return 'por ' + rotulo(UND_SINGULAR, u, u);
    return 'a cada ' + q + ' ' + rotulo(UND_PLURAL, u, u);
  }

  // Origem de uma receita/despesa automática ("proteção", "dívida"…), '' se desconhecida
  function origemAutomatica(origem) {
    return rotulo(ORIGEM_AUTOMATICA, origem, '');
  }

  // Sufixo "(automática: proteção)" das linhas do fluxo de caixa
  function marcaAutomatica(item) {
    if (!item || !item.automatica) return '';
    const o = origemAutomatica(item.origem);
    return ' <span class="rel-mudo">(automática' + (o && o !== str(item.origem) ? ': ' + esc(o) : '') + ')</span>';
  }

  // Ids sintéticos de pessoa → nome (titular, conjuge, pessoa_N, pessoa_N_conjuge, dependente_N).
  // Nomes já resolvidos (donos do PL) passam direto.
  function nomePessoa(id) {
    const s = str(id);
    if (!s) return '';
    const pessoas = lista(window.pessoasRenda);
    const deps = lista(window.dependentes);
    if (s === 'titular') return valorDom('nome_diagnostico') || 'Titular';
    if (s === 'conjuge') return valorDom('conjuge_nome') || 'Cônjuge';
    let m = s.match(/^pessoa_(\d+)_conjuge$/);
    if (m) { const p = pessoas[Number(m[1])]; return (p && str(p.conjuge_nome)) || s; }
    m = s.match(/^pessoa_(\d+)$/);
    if (m) { const p = pessoas[Number(m[1])]; return (p && str(p.nome)) || s; }
    m = s.match(/^dependente_(\d+)$/);
    if (m) { const d = deps[Number(m[1])]; return (d && str(d.nome)) || s; }
    return s;
  }

  function nomesPessoas(ids) {
    return lista(ids).map(nomePessoa).filter(Boolean).map(esc).join(', ');
  }

  // ------------------------------------------------------------
  // Blocos de HTML
  // ------------------------------------------------------------
  function linha(rot, valorHtml) {
    if (valorHtml === '' || valorHtml === null || valorHtml === undefined) return '';
    return '<p class="rel-linha"><strong>' + esc(rot) + ':</strong> ' + valorHtml + '</p>';
  }

  function subtitulo(texto) {
    return '<h4 class="rel-sub">' + esc(texto) + '</h4>';
  }

  function total(rot, valorHtml) {
    return '<p class="rel-total"><strong>' + esc(rot) + ':</strong> ' + valorHtml + '</p>';
  }

  // cabecalhos: array de strings (escapadas aqui); linhas: array de arrays de HTML já pronto;
  // numericas: índices das colunas de valor — recebem a classe rel-valor (só
  // marcação semântica; NADA é alinhado à direita: pedido do dono, fase 2).
  function tabela(cabecalhos, linhas, numericas) {
    if (!linhas.length) return '';
    const ehNum = {};
    lista(numericas).forEach(function (i) { ehNum[i] = true; });
    const attr = function (i) { return ehNum[i] ? ' class="rel-valor"' : ''; };
    let h = '<div class="rel-tabela-wrap"><table class="rel-tabela"><thead><tr>';
    cabecalhos.forEach(function (c, i) { h += '<th' + attr(i) + '>' + esc(c) + '</th>'; });
    h += '</tr></thead><tbody>';
    linhas.forEach(function (cels) {
      h += '<tr>';
      cels.forEach(function (c, i) { h += '<td' + attr(i) + '>' + (c === null || c === undefined || c === '' ? '—' : c) + '</td>'; });
      h += '</tr>';
    });
    h += '</tbody></table></div>';
    return h;
  }

  // ------------------------------------------------------------
  // Listas do HTML (pessoas, dependentes, patrimônios) são identificadas por
  // índice, e o que é digitado só volta ao objeto em memória na sincronização
  // (add/excluir/salvar). Para o relatório ser vivo, o input do DOM
  // (`${prefixo}_${i}_${campo}`) vence; sem ele, vale o objeto.
  // ------------------------------------------------------------
  function campoLista(prefixo, indice, campo, objeto) {
    const el = document.getElementById(prefixo + '_' + indice + '_' + campo);
    if (el && (el.tagName === 'INPUT' || el.tagName === 'SELECT' || el.tagName === 'TEXTAREA')) {
      if (el.type === 'checkbox' || el.type === 'radio') return el.checked;
      return str(el.value);
    }
    const v = objeto && typeof objeto === 'object' ? objeto[campo] : undefined;
    return v === null || v === undefined ? '' : v;
  }

  // Valor que pode vir como number (objeto) ou como texto mascarado do input ("R$ 1.234,56")
  function valorMonetario(v) {
    if (typeof v === 'number') return isFinite(v) ? v : 0;
    const s = str(v);
    if (!s) return 0;
    if (/,/.test(s) || /R\$/.test(s)) return parseMoeda(s);
    const n = parseFloat(s);
    return isFinite(n) ? n : 0;
  }

  function booleano(v, padrao) {
    if (v === '' || v === null || v === undefined) return !!padrao;
    return v === true || v === 'true' || v === 'sim';
  }

  function listaHtml(itens, classe) {
    const arr = lista(itens).filter(function (x) { return str(x) !== ''; });
    if (!arr.length) return '';
    return '<ul class="' + (classe || 'rel-lista') + '">' + arr.map(function (x) { return '<li>' + esc(x) + '</li>'; }).join('') + '</ul>';
  }

  // ------------------------------------------------------------
  // Perfil (motor) — leitura tolerante
  // ------------------------------------------------------------
  function perfisMotor() {
    const p = seguro(function () { return window.PerfilFinanceiro && window.PerfilFinanceiro.PERFIS; }, null);
    return Array.isArray(p) && p.length ? p : PERFIS_FALLBACK;
  }

  function perfilPorId(id) {
    const k = str(id);
    if (!k) return null;
    const achado = perfisMotor().filter(function (p) { return p && p.id === k; })[0];
    if (achado) return achado;
    return PERFIS_FALLBACK.filter(function (p) { return p.id === k; })[0] || null;
  }

  function resultadoPerfil() {
    const r = getter('getPerfilFinanceiroResultado', null);
    return r && typeof r === 'object' ? r : null;
  }

  function versaoRegras(resultado) {
    return seguro(function () { return window.PerfilFinanceiro && window.PerfilFinanceiro.VERSAO_REGRAS; }, '')
      || (resultado && str(resultado.versao_regras))
      || VERSAO_REGRAS_PADRAO;
  }

  // ------------------------------------------------------------
  // Seções — cada uma devolve o HTML de .rel-dados ('' = nada informado)
  // ------------------------------------------------------------
  function secDadosPessoais() {
    let h = '';
    const nome = valorDom('nome_diagnostico');
    const cpf = valorDom('cpf');
    const nasc = valorDom('data_nascimento');
    const profissao = valorDom('profissao');
    const estadoCivil = valorDom('estado_civil');
    const regime = valorDom('regime_bens');
    const telefone = valorDom('telefone');
    const email = valorDom('email');
    const rendaFraca = parseMoeda(valorDom('renda_mes_fraco'));

    h += linha('Nome', esc(nome));
    h += linha('CPF', esc(fmtCPF(cpf)));
    if (nasc) {
      const idade = idadeAnos(nasc);
      h += linha('Nascimento', fmtData(nasc) + (idade !== null ? ' (' + idade + ' anos)' : ''));
    }
    h += linha('Profissão', esc(profissao));
    h += linha('Estado civil', esc(estadoCivil));
    h += linha('Regime de bens', esc(regime));
    h += linha('Telefone', esc(telefone));
    h += linha('E-mail', esc(email));
    if (rendaFraca > 0) h += linha('Renda no mês fraco', moeda(rendaFraca));

    const conjNome = valorDom('conjuge_nome');
    if (conjNome) {
      h += subtitulo('Cônjuge');
      h += linha('Nome', esc(conjNome));
      h += linha('CPF', esc(fmtCPF(valorDom('conjuge_cpf'))));
      const cNasc = valorDom('conjuge_data_nascimento');
      if (cNasc) {
        const idadeC = idadeAnos(cNasc);
        h += linha('Nascimento', fmtData(cNasc) + (idadeC !== null ? ' (' + idadeC + ' anos)' : ''));
      }
      h += linha('Profissão', esc(valorDom('conjuge_profissao')));
      h += linha('Telefone', esc(valorDom('conjuge_telefone')));
      h += linha('E-mail', esc(valorDom('conjuge_email')));
      h += linha('Dependente no IR', simNao(valorDom('conjuge_dependente_ir')));
      const cRenda = parseMoeda(valorDom('conjuge_renda_mes_fraco'));
      if (cRenda > 0) h += linha('Renda no mês fraco', moeda(cRenda));
    }
    return h;
  }

  function secPessoasRenda() {
    const pessoas = lista(window.pessoasRenda);
    if (!pessoas.length) return '';
    const linhas = [];
    pessoas.forEach(function (p, i) {
      const nome = str(campoLista('pessoa', i, 'nome', p));
      const profissao = str(campoLista('pessoa', i, 'profissao', p));
      const estadoCivil = str(campoLista('pessoa', i, 'estado_civil', p));
      const conj = str(campoLista('pessoa', i, 'conjuge_nome', p));
      const renda = valorMonetario(campoLista('pessoa', i, 'renda_mes_fraco', p));
      if (!nome && !profissao && !conj && renda <= 0) return; // card recém-criado, ainda vazio
      linhas.push([
        '<strong>' + esc(nome || '—') + '</strong>',
        esc(profissao),
        esc(estadoCivil),
        esc(conj),
        renda > 0 ? moeda(renda) : ''
      ]);
    });
    return tabela(['Nome', 'Profissão', 'Estado civil', 'Cônjuge', 'Renda no mês fraco'], linhas, [4]);
  }

  function secDependentes() {
    const deps = lista(window.dependentes);
    if (!deps.length) return '';
    const linhas = [];
    deps.forEach(function (d, i) {
      const nome = str(campoLista('dependente', i, 'nome', d));
      const nasc = str(campoLista('dependente', i, 'data_nascimento', d));
      const parentesco = str(campoLista('dependente', i, 'parentesco', d));
      const responsavel = str(campoLista('dependente', i, 'responsavel', d));
      if (!nome && !nasc && !parentesco) return;
      // bebês (< 1 ano) saem em meses
      linhas.push([
        '<strong>' + esc(nome || '—') + '</strong>',
        esc(idadeTexto(nasc)),
        esc(parentesco),
        esc(nomePessoa(responsavel))
      ]);
    });
    return tabela(['Nome', 'Idade', 'Parentesco', 'Responsável'], linhas, [1]);
  }

  function secPatrimonioFisico() {
    const pats = lista(window.patrimonios);
    if (!pats.length) return '';
    let soma = 0;
    const linhas = [];
    pats.forEach(function (p, i) {
      const obj = p && typeof p === 'object' ? p : {};
      const tipo = str(campoLista('patrimonio', i, 'tipo', obj));
      const detalhes = str(campoLista('patrimonio', i, 'detalhes', obj));
      const valor = valorMonetario(campoLista('patrimonio', i, 'valor', obj));
      if (!tipo && !detalhes && valor <= 0) return;
      soma += valor;
      const quitado = booleano(campoLista('patrimonio', i, 'quitado', obj), true);
      const saldo = quitado ? 0 : valorMonetario(campoLista('patrimonio', i, 'saldo_devedor', obj));
      const situacao = quitado ? 'Quitado' : ('Financiado' + (saldo > 0 ? ' — saldo ' + moeda(saldo) : ''));
      const temSeguro = booleano(campoLista('patrimonio', i, 'seguro', obj), false);
      const venc = str(campoLista('patrimonio', i, 'seguro_vencimento', obj));
      const seguroTxt = temSeguro ? ('Sim' + (venc ? ' (venc. ' + fmtData(venc) + ')' : '')) : 'Não';
      // proprietários, inventariável, moradia e gera-renda vivem no objeto (os handlers mantêm em dia)
      linhas.push([
        '<strong>' + esc(tipo || '—') + '</strong>',
        esc(detalhes),
        moeda(valor),
        situacao,
        seguroTxt,
        nomesPessoas(obj.proprietarios),
        simOuTraco(obj.imovel_unico_moradia),
        simOuTraco(obj.gera_renda),
        obj.inventariavel === false ? 'Não' : 'Sim'
      ]);
    });
    if (!linhas.length) return '';
    let h = tabela(['Tipo', 'Detalhes', 'Valor', 'Situação', 'Seguro', 'Proprietários', 'Moradia única', 'Gera renda', 'Inventariável'], linhas, [2]);
    h += total('Total do patrimônio físico', moeda(soma));
    return h;
  }

  function secPatrimonioLiquido() {
    const pls = lista(getter('getPatrimoniosLiquidosData', [])).filter(function (p) { return p && typeof p === 'object'; });
    let h = '';
    if (pls.length) {
      let soma = 0;
      const linhas = pls.map(function (pl) {
        const valor = num(pl.valor_atual);
        soma += valor;
        const produto = str(pl.nome_produto_customizado) || str(pl.tipo_produto_nome) || '—';
        const tipoExtra = str(pl.nome_produto_customizado) && str(pl.tipo_produto_nome) ? ' <span class="rel-mudo">(' + esc(pl.tipo_produto_nome) + ')</span>' : '';
        const aporte = num(pl.aporte_valor);
        const freq = rotulo(APORTE_FREQ, pl.aporte_frequencia, '');
        const aporteTxt = aporte > 0 && freq ? moeda(aporte) + ' ' + freq : '';
        const reserva = typeof pl.reserva_emergencia === 'boolean' ? pl.reserva_emergencia : str(pl.finalidade) === 'RESERVA_EMERGENCIA';
        return [
          '<strong>' + esc(produto) + '</strong>' + tipoExtra,
          esc(str(pl.instituicao_nome)),
          moeda(valor),
          esc(rotulo(FINALIDADE, pl.finalidade, '')),
          aporteTxt,
          esc(rotulo(RISCO, pl.classificacao_risco, '')),
          nomesPessoas(pl.donos),
          reserva ? 'Sim' : '—'
        ];
      });
      h += tabela(['Produto', 'Instituição', 'Valor atual', 'Finalidade', 'Aporte', 'Risco', 'Dono(s)', 'Reserva de emergência'], linhas, [2, 4]);
      h += total('Total do patrimônio líquido', moeda(soma));
    }

    // Suitability: por pessoa, uma linha por pergunta respondida ("Pergunta? Resposta"),
    // no mesmo formato das linhas de dados; o perfil só aparece se
    // window.calcularPerfilInvestidor existir (o módulo não a expõe hoje).
    const suit = getter('getRespostasSuitabilityData', null);
    if (suit && typeof suit === 'object') {
      const calc = typeof window.calcularPerfilInvestidor === 'function' ? window.calcularPerfilInvestidor : null;
      let blocos = '';
      Object.keys(suit).forEach(function (pessoa) {
        const resps = suit[pessoa];
        if (!resps || typeof resps !== 'object') return;
        const respondidas = SUIT_ORDEM.filter(function (q) { return parseInt(resps[q], 10) > 0; });
        if (!respondidas.length) return;
        let b = '<div class="rel-suit-pessoa">';
        b += '<p class="rel-linha"><strong>Pessoa:</strong> ' + esc(pessoa) + ' <span class="rel-mudo">(' + respondidas.length + ' de ' + SUIT_ORDEM.length + ' respondidas)</span></p>';
        if (calc) {
          const r = seguro(function () { return calc(resps); }, null);
          if (r && r.perfil && r.perfil.nome) {
            b += linha('Perfil de investidor', esc(r.perfil.nome) + (r.PFP !== undefined ? ' <span class="rel-mudo">(PFP ' + esc(r.PFP) + ')</span>' : ''));
          }
        }
        respondidas.forEach(function (q) {
          const valor = parseInt(resps[q], 10);
          const alternativas = rotulo(SUIT_ALTERNATIVAS, q, null);
          const respostaTxt = Array.isArray(alternativas) && alternativas[valor - 1] ? alternativas[valor - 1] : String(valor);
          b += linha(rotulo(SUIT_QUESTOES, q, q), esc(respostaTxt));
        });
        b += '</div>';
        blocos += b;
      });
      if (blocos) {
        h += subtitulo('Teste de perfil de investidor (suitability)');
        h += blocos;
      }
    }
    return h;
  }

  function secDividas() {
    const divs = lista(getter('getDividasData', [])).filter(function (d) { return d && typeof d === 'object'; });
    if (!divs.length) return '';
    let somaSaldo = 0, somaParcela = 0;
    const linhas = divs.map(function (d) {
      const saldo = num(d.saldo_devedor);
      const parcela = num(d.valor_parcela);
      somaSaldo += saldo;
      somaParcela += parcela;
      const prazo = parseInt(d.prazo, 10) || 0;
      const pagas = parseInt(d.parcelas_pagas, 10) || 0;
      const prazoTxt = prazo > 0 ? pagas + ' de ' + prazo + ' pagas' : (pagas > 0 ? pagas + ' pagas' : '');
      const taxa = num(d.taxa_juros);
      const taxaTxt = taxa > 0 ? pct(taxa, 2) + ' ' + (str(d.taxa_juros_tipo) === 'mensal' ? 'a.m.' : 'a.a.') : '';
      const proposta = str(d.proposta_em_vigor);
      const parcelaProposta = num(d.parcela_proposta);
      let propostaTxt = '';
      if (proposta === 'sim') propostaTxt = 'Sim' + (parcelaProposta > 0 ? ' — ' + moeda(parcelaProposta) : '');
      else if (proposta === 'nao') propostaTxt = 'Não';
      return [
        '<strong>' + esc(str(d.motivo) || ('Dívida #' + esc(d.id))) + '</strong>',
        esc(str(d.credor)),
        moeda(saldo),
        parcela > 0 ? moeda(parcela) : '',
        prazoTxt,
        taxaTxt,
        esc(rotulo(SITUACAO_DIVIDA, d.situacao_divida, '')),
        simOuTraco(d.divida_estruturada),
        propostaTxt
      ];
    });
    let h = tabela(['Motivo', 'Credor', 'Saldo devedor', 'Parcela', 'Prazo', 'Taxa', 'Situação', 'Estruturada', 'Proposta em mãos'], linhas, [2, 3, 5]);
    h += total('Total do saldo devedor', moeda(somaSaldo) + ' <span class="rel-mudo">· parcelas somadas: ' + moeda(somaParcela) + '</span>');
    return h;
  }

  function secSucessao() {
    const s = getter('getSucessaoData', null);
    if (!s || typeof s !== 'object') return '';
    const itcmd = num(s.itcmd), emol = num(s.emolumentos), hon = num(s.honorarios);
    if (itcmd === 0 && emol === 0 && hon === 0) return '';
    // Percentuais padrão do módulo (4/1/6) sem nenhum patrimônio físico ou
    // líquido = ninguém informou nada: seção vazia.
    const saoPadrao = itcmd === SUCESSAO_PADRAO.itcmd && emol === SUCESSAO_PADRAO.emolumentos && hon === SUCESSAO_PADRAO.honorarios;
    if (saoPadrao && totalPatrimonioFisico() <= 0 && totalPatrimonioLiquido() <= 0) return '';
    let h = '';
    h += linha('ITCMD', pct(itcmd, 2));
    h += linha('Emolumentos', pct(emol, 2));
    h += linha('Honorários', pct(hon, 2));
    h += total('Total dos percentuais sucessórios', pct(itcmd + emol + hon, 2));
    return h;
  }

  function secProtecao() {
    const prods = lista(getter('getProdutosProtecaoData', [])).filter(function (p) { return p && typeof p === 'object'; });
    if (!prods.length) return '';
    let somaMensal = 0, somaAnual = 0;
    const linhas = prods.map(function (p) {
      const custo = num(p.custo);
      const anual = str(p.periodicidade) === 'anual';
      if (anual) { somaAnual += custo; somaMensal += custo / 12; }
      else { somaMensal += custo; somaAnual += custo * 12; }
      return [
        '<strong>' + esc(str(p.tipo_produto) || '—') + '</strong>',
        esc(str(p.objeto)),
        custo > 0 ? moeda(custo) + ' ' + (anual ? 'por ano' : 'por mês') : '',
        esc(str(p.seguradora)),
        str(p.vencimento) ? fmtData(p.vencimento) : '',
        p.cotou_analisou === true || p.cotou_analisou === 'true' ? 'Sim' : 'Não'
      ];
    });
    let h = tabela(['Tipo', 'Objeto', 'Custo', 'Seguradora/operadora', 'Vencimento', 'Cotou e analisou'], linhas, [2]);
    h += total('Total da proteção', moeda(somaMensal) + ' por mês <span class="rel-mudo">· ' + moeda(somaAnual) + ' por ano</span>');
    return h;
  }

  function secIR() {
    const decls = lista(getter('getDeclaracoesIRData', [])).filter(function (d) { return d && typeof d === 'object'; });
    const comInfo = decls.filter(function (d) {
      return (str(d.tipo_declaracao) && str(d.tipo_declaracao) !== 'nao_declara') || num(d.renda_bruta_anual) > 0 || str(d.resultado_tipo);
    });
    if (!comInfo.length) return '';
    const linhas = decls.map(function (d) {
      const tipo = str(d.tipo_declaracao) || 'nao_declara';
      const declara = tipo !== 'nao_declara';
      const renda = num(d.renda_bruta_anual);
      const resTipo = str(d.resultado_tipo);
      const resValor = num(d.resultado_valor);
      const resTxt = resTipo ? rotulo(RESULTADO_IR, resTipo, resTipo) + (resValor > 0 ? ' ' + moeda(resValor) : '') : '';
      return [
        '<strong>' + esc(str(d.pessoa_nome) || '—') + '</strong>' + (str(d.pessoa_tipo) ? ' <span class="rel-mudo">(' + esc(d.pessoa_tipo) + ')</span>' : ''),
        esc(rotulo(TIPO_DECLARACAO, tipo, tipo)),
        declara && renda > 0 ? moeda(renda) : '',
        declara ? resTxt : ''
      ];
    });
    return tabela(['Pessoa', 'Declaração', 'Renda bruta anual', 'Resultado'], linhas, [2]);
  }

  function secContasCartoes() {
    const bruto = getter('getContasCartoesData', null);
    let itens = [];
    let tipos = [];
    if (Array.isArray(bruto)) itens = bruto;
    else if (bruto && typeof bruto === 'object') {
      itens = lista(bruto.contasCartoes);
      tipos = lista(bruto.tiposCartao);
    }
    itens = itens.filter(function (c) { return c && typeof c === 'object'; });
    if (!itens.length) return '';
    const nomeTipoCartao = function (id) {
      const k = str(id);
      if (!k) return '';
      const t = tipos.filter(function (x) { return x && String(x.id) === k; })[0];
      return t ? str(t.nome) : k;
    };
    const linhas = itens.map(function (c) {
      const cartao = str(c.tipo) !== 'conta';
      const anuidade = num(c.tarifa_anuidade);
      const pontos = num(c.pontos_por_dolar);
      const cashback = num(c.cashback);
      return [
        '<strong>' + (cartao ? 'Cartão de crédito' : 'Conta bancária') + '</strong>',
        esc(nomePessoa(c.titular)),
        esc(str(c.instituicao)),
        cartao ? esc(nomeTipoCartao(c.tipo_cartao)) : '',
        anuidade > 0 ? moeda(anuidade) : '',
        cartao && pontos > 0 ? esc(pontos.toLocaleString('pt-BR', { maximumFractionDigits: 2 })) : '',
        cartao && cashback > 0 ? pct(cashback, 2) : '',
        esc(str(c.beneficios))
      ];
    });
    return tabela(['Tipo', 'Titular', 'Instituição', 'Tipo do cartão', 'Anuidade/tarifa', 'Pontos por dólar', 'Cashback', 'Benefícios'], linhas, [4, 5, 6]);
  }

  // Números do fluxo de caixa compartilhados pela seção e pelos gráficos:
  // listas filtradas, totais mensais equivalentes e despesas por categoria.
  function dadosFluxo() {
    const fx = getter('getFluxoCaixaData', null);
    const vazio = { receitas: [], despesas: [], totalReceitas: 0, totalDespesas: 0, sobra: 0, porCategoria: {}, semCategoria: 0 };
    if (!fx || typeof fx !== 'object') return vazio;
    const receitas = lista(fx.receitas).filter(function (r) { return r && typeof r === 'object'; });
    const despesas = lista(fx.despesas).filter(function (d) { return d && typeof d === 'object'; });
    let totalReceitas = 0, totalDespesas = 0, semCategoria = 0;
    const porCategoria = {};
    CATEGORIAS_GRAFICO.forEach(function (c) { porCategoria[c] = 0; });
    receitas.forEach(function (r) { totalReceitas += mensal(r.valor, r.qtd_recorrencia, r.und_recorrencia); });
    despesas.forEach(function (d) {
      const m = mensal(d.valor, d.qtd_recorrencia, d.und_recorrencia);
      totalDespesas += m;
      const cat = str(d.categoria_comportamental);
      if (Object.prototype.hasOwnProperty.call(porCategoria, cat)) porCategoria[cat] += m;
      else semCategoria += m;
    });
    return {
      receitas: receitas,
      despesas: despesas,
      totalReceitas: totalReceitas,
      totalDespesas: totalDespesas,
      sobra: totalReceitas - totalDespesas,
      porCategoria: porCategoria,
      semCategoria: semCategoria
    };
  }

  function secFluxoCaixa() {
    const fx = dadosFluxo();
    const receitas = fx.receitas;
    const despesas = fx.despesas;
    if (!receitas.length && !despesas.length) return '';

    const clas = seguro(function () { return window.FLUXO_CLASSIFICACAO; }, null) || {};
    const mapaImportancia = mapaDeArray(clas.NIVEIS_IMPORTANCIA, NIVEIS_IMPORTANCIA_FALLBACK);
    const mapaConforto = mapaDeArray(clas.NIVEIS_CONFORTO, NIVEIS_CONFORTO_FALLBACK);
    const mapaAlteravel = mapaDeArray(clas.OPCOES_ALTERAVEL, ALTERAVEL_FALLBACK);

    let h = '';
    const totalReceitas = fx.totalReceitas, totalDespesas = fx.totalDespesas;

    if (receitas.length) {
      const linhas = receitas.map(function (r) {
        const m = mensal(r.valor, r.qtd_recorrencia, r.und_recorrencia);
        return [
          '<strong>' + esc(str(r.nome) || '—') + '</strong>' + marcaAutomatica(r),
          esc(nomePessoa(r.titular)),
          esc(rotulo(TIPOS_RECEITA, r.tipo, '')),
          moeda(num(r.valor)) + ' <span class="rel-mudo">' + esc(recorrencia(r.qtd_recorrencia, r.und_recorrencia)) + '</span>',
          moeda(m)
        ];
      });
      h += subtitulo('Receitas');
      h += tabela(['Receita', 'De quem', 'Tipo', 'Valor', 'Mensal equivalente'], linhas, [3, 4]);
    }

    if (despesas.length) {
      const linhas = despesas.map(function (d) {
        const m = mensal(d.valor, d.qtd_recorrencia, d.und_recorrencia);
        return [
          '<strong>' + esc(str(d.nome) || '—') + '</strong>' + marcaAutomatica(d),
          esc(nomePessoa(d.titular)),
          esc(rotulo(TIPOS_DESPESA, d.tipo, '')),
          moeda(num(d.valor)) + ' <span class="rel-mudo">' + esc(recorrencia(d.qtd_recorrencia, d.und_recorrencia)) + '</span>',
          moeda(m),
          esc(rotulo(CATEGORIA_DESPESA, d.categoria_comportamental, '')),
          esc(rotulo(mapaImportancia, d.nivel_importancia, '')),
          esc(rotulo(mapaConforto, d.nivel_conforto, '')),
          esc(rotulo(mapaAlteravel, d.alteravel, ''))
        ];
      });
      h += subtitulo('Despesas');
      h += tabela(['Despesa', 'Dono', 'Tipo', 'Valor', 'Mensal equivalente', 'Categoria', 'Importância', 'Conforto', 'Alterável'], linhas, [3, 4]);
    }

    const sobra = fx.sobra;
    h += total('Receitas mensais', moeda(totalReceitas) + ' <span class="rel-mudo">(anuais divididas por 12)</span>');
    h += total('Despesas mensais', moeda(totalDespesas) + ' <span class="rel-mudo">(anuais divididas por 12)</span>');
    h += '<p class="rel-total rel-total-destaque"><strong>Sobra mensal simples (receitas − despesas):</strong> <span class="' + (sobra < 0 ? 'rel-negativo' : 'rel-positivo') + '">' + moeda(sobra) + '</span></p>';
    return h;
  }

  // Prazo do objetivo em texto puro (sem escape) — rótulos de gráfico
  function prazoObjetivoTexto(o) {
    const tipo = str(o.prazo_tipo);
    const meses = parseInt(o.prazo_meses, 10) || 0;
    if (str(o.tipo) === 'aposentadoria' && (tipo === 'idade' || !tipo)) {
      const idade = parseInt(o.prazo_idade, 10) || 65;
      const quem = nomePessoa(o.prazo_pessoa);
      return 'aos ' + idade + ' anos' + (quem ? ' (' + quem + ')' : '');
    }
    if (tipo === 'data' && str(o.prazo_data)) return 'até ' + fmtDataTexto(o.prazo_data);
    if (tipo === 'anos' && meses > 0) {
      const anos = meses / 12;
      return 'em ' + anos.toLocaleString('pt-BR', { maximumFractionDigits: 1 }) + (anos === 1 ? ' ano' : ' anos');
    }
    if (meses > 0) return 'em ' + meses + (meses === 1 ? ' mês' : ' meses');
    return '';
  }

  // Prazo do objetivo para HTML (escapado)
  function prazoObjetivo(o) {
    return esc(prazoObjetivoTexto(o));
  }

  // Capital necessário para a aposentadoria: renda anual ÷ (rentabilidade
  // anual de aposentadoria / 100) — a mesma conta que o módulo de objetivos
  // mostra em "capital necessário". 0 quando não há renda ou rentabilidade.
  function capitalAposentadoria(o, vm) {
    const renda = num(o && o.renda_anual);
    // mesmo padrão do módulo de objetivos: sem rentabilidade informada, 6% a.a.
    const rent = num(vm && vm.rent_anual_aposentadoria) || 6;
    if (renda <= 0 || rent <= 0) return 0;
    return renda / (rent / 100);
  }

  function metaObjetivo(o, vm) {
    const tipo = str(o.tipo);
    if (tipo === 'aposentadoria') {
      const renda = num(o.renda_anual);
      if (renda <= 0) return '';
      const capital = capitalAposentadoria(o, vm);
      return moeda(renda) + ' por ano' + (capital > 0 ? ' <span class="rel-mudo">(capital necessário ' + moeda(capital) + ')</span>' : '');
    }
    if (tipo === 'intangivel') {
      const marcos = lista(o.marcos).filter(function (m) { return m && str(m.texto); });
      if (!marcos.length) return '';
      const feitos = marcos.filter(function (m) { return m.concluido === true; }).length;
      return marcos.length + (marcos.length === 1 ? ' marco' : ' marcos') + ' (' + feitos + ' concluído' + (feitos === 1 ? '' : 's') + ')';
    }
    const meta = num(o.meta_acumulo);
    if (meta > 0) return moeda(meta) + ' <span class="rel-mudo">(meta de acúmulo)</span>';
    const vf = num(o.valor_final);
    if (vf > 0) return moeda(vf) + ' <span class="rel-mudo">(valor final)</span>';
    return '';
  }

  function secObjetivos() {
    const od = getter('getObjetivosData', null);
    if (!od || typeof od !== 'object') return '';
    const objs = lista(od.objetivos).filter(function (o) { return o && typeof o === 'object'; });
    const vm = od.variaveis_mercado && typeof od.variaveis_mercado === 'object' ? od.variaveis_mercado : null;
    let h = '';
    if (objs.length) {
      const linhas = objs.map(function (o) {
        const tipo = str(o.tipo);
        const tipoTxt = tipo === 'aposentadoria' ? 'Aposentadoria' : (tipo === 'intangivel' ? 'Intangível' : 'Objetivo');
        const vi = num(o.valor_inicial);
        return [
          '<strong>' + esc(str(o.descricao) || '—') + '</strong>' + (str(o.importancia) ? ' <span class="rel-mudo">— ' + esc(o.importancia) + '</span>' : ''),
          tipoTxt,
          prazoObjetivo(o),
          metaObjetivo(o, vm),
          tipo !== 'intangivel' && vi > 0 ? moeda(vi) : '',
          nomesPessoas(o.responsaveis)
        ];
      });
      h += tabela(['Objetivo', 'Tipo', 'Prazo', 'Meta', 'Valor inicial', 'De quem'], linhas, [3, 4]);
    }

    // Variáveis de mercado: uma linha por variável (rótulo: valor), à esquerda
    if (vm) {
      let v = '';
      if (str(vm.data_reuniao)) v += linha('Data da reunião', fmtData(vm.data_reuniao));
      if (num(vm.selic) > 0) v += linha('Selic', pct(vm.selic, 2));
      if (num(vm.cdi) > 0) v += linha('CDI', pct(vm.cdi, 2));
      if (num(vm.ipca) > 0) v += linha('IPCA', pct(vm.ipca, 2));
      if (num(vm.dolar) > 0) v += linha('Dólar', moeda(vm.dolar));
      if (num(vm.rent_anual_aposentadoria) > 0) v += linha('Rentabilidade anual de aposentadoria', pct(vm.rent_anual_aposentadoria, 2) + ' a.a.');
      if (v) {
        h += subtitulo('Variáveis de mercado');
        h += v;
      }
    }
    return h;
  }

  function secPerfilFinanceiro() {
    const r = resultadoPerfil();
    if (!r) return '';
    const pf = r.perfil_financeiro && typeof r.perfil_financeiro === 'object' ? r.perfil_financeiro : {};
    const pi = r.perfil_investidor && typeof r.perfil_investidor === 'object' ? r.perfil_investidor : {};
    const cm = r.codigo_matriz && typeof r.codigo_matriz === 'object' ? r.codigo_matriz : {};
    const justificativas = lista(pf.justificativa_auto);
    const faltantes = lista(pf.faltantes);
    const vigente = str(pf.vigente);
    const calculado = str(pf.calculado);
    const ajustado = str(pf.ajustado);

    // (o código da matriz — cm — tem capítulo próprio: secCodigoMatriz)
    if (!vigente && !justificativas.length && !faltantes.length && !str(pi.ajustado)) return '';

    let h = '';
    if (vigente) {
      const p = perfilPorId(vigente);
      const rot = p ? p.rotulo : (vigente === calculado ? str(pf.rotulo) : vigente);
      // Igual ao card do motor: ajustado preenchido = "ajustado pelo consultor",
      // mesmo que coincida com o calculado.
      const origem = ajustado ? 'ajustado pelo consultor' : 'calculado';
      h += '<p class="rel-linha rel-perfil-vigente"><strong>Perfil vigente:</strong> <span class="rel-perfil-rotulo"' + (p && p.cor ? ' style="color:' + esc(p.cor) + '"' : '') + '>' + esc(rot) + '</span> <span class="rel-mudo">(' + origem + ')</span></p>';
      if (ajustado) {
        h += linha('Perfil calculado', esc(calculado ? str(pf.rotulo) : 'Perfil incalculável'));
      }
    } else {
      h += '<p class="rel-linha rel-perfil-vigente"><strong>Perfil vigente:</strong> <span class="rel-perfil-rotulo rel-mudo">a calcular</span></p>';
    }

    if (justificativas.length) {
      h += subtitulo('Justificativas');
      h += listaHtml(justificativas, 'rel-lista');
    }
    // A justificativa do consultor é o textarea obs_perfil_financeiro — sai
    // no bloco de observações da seção (blocoObs), sem duplicar aqui.
    if (faltantes.length) {
      h += subtitulo('Faltam ' + faltantes.length + (faltantes.length === 1 ? ' informação' : ' informações') + ' para calcular');
      h += listaHtml(faltantes, 'rel-lista rel-lista-faltantes');
    }

    const dc = pf.dados_complementares && typeof pf.dados_complementares === 'object' ? pf.dados_complementares : {};
    if (str(dc.custeio_moradia)) h += linha('Custeio da moradia', esc(rotulo(CUSTEIO_MORADIA, dc.custeio_moradia, dc.custeio_moradia)));
    if (str(dc.decide_pelo_objetivo)) h += linha('Decide onde investir pelo objetivo', esc(rotulo(SIM_NAO, dc.decide_pelo_objetivo, dc.decide_pelo_objetivo)));

    const invAjustado = str(pi.ajustado);
    if (invAjustado) {
      h += subtitulo('Perfil de investidor');
      h += linha('Ajustado pelo consultor', esc(rotulo(PERFIL_INVESTIDOR, invAjustado, invAjustado)));
      if (str(pi.justificativa_consultor)) h += linha('Justificativa', escMultilinha(pi.justificativa_consultor));
    }
    return h;
  }

  // Código da matriz: código em destaque + tabela posição | valor | justificativa
  function secCodigoMatriz() {
    const r = resultadoPerfil();
    if (!r) return '';
    const cm = r.codigo_matriz && typeof r.codigo_matriz === 'object' ? r.codigo_matriz : {};
    const pos = cm.por_posicao && typeof cm.por_posicao === 'object' ? cm.por_posicao : {};
    const linhasPos = [];
    POSICOES_MATRIZ.forEach(function (p) {
      const item = pos[p.chave];
      if (!item || typeof item !== 'object') return;
      linhasPos.push([
        '<strong>' + esc(p.rotulo) + '</strong>',
        '<span class="rel-codigo">' + esc(str(item.valor) || '?') + '</span>',
        esc(str(item.justificativa))
      ]);
    });
    if (!str(cm.codigo) && !linhasPos.length) return '';
    let h = '';
    if (str(cm.codigo)) h += '<p class="rel-linha rel-matriz-codigo"><strong>Código:</strong> <span class="rel-codigo">' + esc(cm.codigo) + '</span></p>';
    if (linhasPos.length) h += tabela(['Posição', 'Valor', 'Justificativa'], linhasPos);
    const faltMatriz = lista(cm.faltantes);
    if (faltMatriz.length) h += '<p class="rel-linha rel-mudo">Posições pendentes: ' + faltMatriz.map(esc).join('; ') + '</p>';
    return h;
  }

  function secAdesao() {
    const od = getter('getObjetivosData', null);
    const ia = od && od.investimento_assistencia && typeof od.investimento_assistencia === 'object' ? od.investimento_assistencia : null;
    if (!ia) return '';
    const proposta = str(ia.proposta_final);
    const plano = str(ia.plano_acompanhamento);
    const qtd = parseInt(ia.qtd_recomendacoes, 10) || 0;
    if (!proposta && !plano && qtd <= 0 && !ia.mostrar_especial) return '';
    let h = '';
    if (proposta) h += linha('Proposta escolhida', proposta === 'ordinaria' ? 'Ordinária' : (proposta === 'especial' ? 'Especial' : esc(proposta)));
    if (ia.mostrar_especial === true) h += linha('Proposta especial', 'Habilitada');
    if (qtd > 0) h += linha('Recomendações', esc(inteiro(qtd)));
    if (plano) h += linha('Plano de acompanhamento', esc(rotulo(PLANOS, plano, plano)));
    return h;
  }

  const CONSTRUTORES = {
    'dados-pessoais': secDadosPessoais,
    'pessoas-renda': secPessoasRenda,
    'dependentes': secDependentes,
    'patrimonio-fisico': secPatrimonioFisico,
    'patrimonio-liquido': secPatrimonioLiquido,
    'dividas': secDividas,
    'sucessao': secSucessao,
    'produtos-protecao': secProtecao,
    'ir': secIR,
    'contas-cartoes': secContasCartoes,
    'fluxo-caixa': secFluxoCaixa,
    'objetivos': secObjetivos,
    'perfil-financeiro': secPerfilFinanceiro,
    'adesao-plano': secAdesao,
    'codigo-matriz': secCodigoMatriz
  };

  // ------------------------------------------------------------
  // Totais compartilhados (seções + gráficos)
  // ------------------------------------------------------------
  // Soma do patrimônio físico (mesmo critério da tabela: input do DOM vence o objeto)
  function totalPatrimonioFisico() {
    let soma = 0;
    lista(window.patrimonios).forEach(function (p, i) {
      const obj = p && typeof p === 'object' ? p : {};
      soma += valorMonetario(campoLista('patrimonio', i, 'valor', obj));
    });
    return soma;
  }

  function patrimoniosLiquidos() {
    return lista(getter('getPatrimoniosLiquidosData', [])).filter(function (p) { return p && typeof p === 'object'; });
  }

  function totalPatrimonioLiquido() {
    return patrimoniosLiquidos().reduce(function (s, pl) { return s + num(pl.valor_atual); }, 0);
  }

  // Patrimônio líquido somado por finalidade (item sem finalidade → SEM_FINALIDADE)
  function patrimonioLiquidoPorFinalidade() {
    const acc = {};
    FINALIDADES_GRAFICO.forEach(function (f) { acc[f] = 0; });
    patrimoniosLiquidos().forEach(function (pl) {
      const f = str(pl.finalidade);
      const chave = Object.prototype.hasOwnProperty.call(acc, f) ? f : 'SEM_FINALIDADE';
      acc[chave] += num(pl.valor_atual);
    });
    return acc;
  }

  // Números da aposentadoria para o gráfico g (null se não há objetivo de
  // aposentadoria com renda anual > 0). Tudo tolerante a getter ausente.
  function dadosAposentadoria() {
    const od = getter('getObjetivosData', null);
    if (!od || typeof od !== 'object') return null;
    const objs = lista(od.objetivos).filter(function (o) { return o && typeof o === 'object'; });
    const apos = objs.filter(function (o) { return str(o.tipo) === 'aposentadoria' && num(o.renda_anual) > 0; })[0];
    if (!apos) return null;
    const vm = od.variaveis_mercado && typeof od.variaveis_mercado === 'object' ? od.variaveis_mercado : {};
    const capital = capitalAposentadoria(apos, vm);
    // "Já reservado" = Σ valor_atual do patrimônio líquido com finalidade APOSENTADORIA
    const reservado = patrimoniosLiquidos()
      .filter(function (pl) { return str(pl.finalidade) === 'APOSENTADORIA'; })
      .reduce(function (s, pl) { return s + num(pl.valor_atual); }, 0);

    // Anos até a aposentadoria: por idade (prazo_idade − idade da pessoa do
    // objetivo, a partir da data de nascimento), por data ou por meses/anos.
    const tipoPrazo = str(apos.prazo_tipo) || 'idade';
    let idadeAlvo = null;
    let anosFaltam = null;
    if (tipoPrazo === 'idade') {
      idadeAlvo = parseInt(apos.prazo_idade, 10) || 65;
      const idade = idadeAnos(dataNascimentoPessoa(apos.prazo_pessoa));
      if (idade !== null) anosFaltam = Math.max(0, idadeAlvo - idade);
    } else if (tipoPrazo === 'data') {
      const d = parseData(apos.prazo_data);
      if (d) anosFaltam = Math.max(0, (d.getTime() - Date.now()) / (365.25 * 24 * 3600 * 1000));
    } else {
      const meses = parseInt(apos.prazo_meses, 10) || 0;
      if (meses > 0) anosFaltam = meses / 12;
    }
    return {
      renda: num(apos.renda_anual),
      rent: num(vm.rent_anual_aposentadoria),
      capital: capital,
      reservado: reservado,
      idadeAlvo: idadeAlvo,
      anosFaltam: anosFaltam,
      quem: nomePessoa(apos.prazo_pessoa)
    };
  }

  // ------------------------------------------------------------
  // Gráficos (seção 11 do desenho) — especificação neutra, renderizada por
  // Chart.js quando window.Chart existe ou por barras CSS (fallback).
  // Cada espec: { id, titulo, tipo: 'bar'|'barh'|'doughnut', labels,
  //   datasets: [{ label, data, cores }], legenda (texto opcional),
  //   mostrarLegendaChart }
  // ------------------------------------------------------------
  let especsGraficos = [];      // especs do último html()
  let instanciasGraficos = {};  // id → Chart (destruídas a cada render)

  function temChart() {
    return typeof window.Chart === 'function';
  }

  function anosTexto(anos) {
    const n = Math.round(anos * 10) / 10;
    const txt = n.toLocaleString('pt-BR', { maximumFractionDigits: 1 });
    return txt + (n === 1 ? ' ano' : ' anos');
  }

  function especificarGraficos() {
    const especs = [];

    // a. fluxo-resumo — Receitas / Despesas / Sobra (mensal equivalente)
    const fx = dadosFluxo();
    if (fx.receitas.length || fx.despesas.length) {
      especs.push({
        id: 'fluxo-resumo',
        titulo: 'Fluxo de caixa mensal',
        tipo: 'bar',
        labels: ['Receitas', 'Despesas', 'Sobra'],
        datasets: [{
          label: 'Mensal equivalente',
          data: [fx.totalReceitas, fx.totalDespesas, fx.sobra],
          cores: [CORES_GRAFICO[1], CORES_GRAFICO[2], fx.sobra < 0 ? COR_NEGATIVO : CORES_GRAFICO[0]]
        }],
        legenda: 'Receitas ' + moeda(fx.totalReceitas) + ' · Despesas ' + moeda(fx.totalDespesas) + ' · Sobra ' + moeda(fx.sobra),
        mostrarLegendaChart: false
      });
    }

    // b. fluxo-categorias — donut das despesas por categoria comportamental
    if (fx.despesas.length && fx.totalDespesas > 0) {
      const labels = [], data = [], cores = [];
      CATEGORIAS_GRAFICO.forEach(function (c, i) {
        const v = fx.porCategoria[c] || 0;
        if (v <= 0) return;
        labels.push(rotulo(CATEGORIA_DESPESA, c, c));
        data.push(v);
        cores.push(c === 'dividas' ? COR_NEGATIVO : CORES_GRAFICO[i % CORES_GRAFICO.length]);
      });
      if (fx.semCategoria > 0) { labels.push('Sem categoria'); data.push(fx.semCategoria); cores.push(CORES_GRAFICO[5]); }
      if (data.length) {
        especs.push({
          id: 'fluxo-categorias',
          titulo: 'Despesas por categoria',
          tipo: 'doughnut',
          labels: labels,
          datasets: [{ label: 'Mensal equivalente', data: data, cores: cores }],
          mostrarLegendaChart: true
        });
      }
    }

    // c. patrimonio-total — donut físico × líquido
    const fisico = totalPatrimonioFisico();
    const liquido = totalPatrimonioLiquido();
    if (fisico > 0 || liquido > 0) {
      especs.push({
        id: 'patrimonio-total',
        titulo: 'Patrimônio total: ' + moeda(fisico + liquido),
        tipo: 'doughnut',
        labels: ['Patrimônio físico', 'Patrimônio líquido'],
        datasets: [{ label: 'Valor', data: [fisico, liquido], cores: [CORES_GRAFICO[2], CORES_GRAFICO[0]] }],
        mostrarLegendaChart: true
      });
    }

    // d. patrimonio-finalidade — líquido por finalidade (líquido + objetivos)
    if (liquido > 0) {
      const porFin = patrimonioLiquidoPorFinalidade();
      especs.push({
        id: 'patrimonio-finalidade',
        titulo: 'Patrimônio líquido por finalidade',
        tipo: 'barh',
        labels: FINALIDADES_GRAFICO.map(function (f) { return rotulo(FINALIDADE, f, f); }),
        datasets: [{
          label: 'Valor atual',
          data: FINALIDADES_GRAFICO.map(function (f) { return porFin[f] || 0; }),
          cores: [CORES_GRAFICO[4], CORES_GRAFICO[0], CORES_GRAFICO[2], CORES_GRAFICO[5]]
        }],
        mostrarLegendaChart: false
      });
    }

    // e. dividas — saldo devedor por dívida (+ parcela mensal, se houver)
    const divs = lista(getter('getDividasData', [])).filter(function (d) {
      return d && typeof d === 'object' && (num(d.saldo_devedor) > 0 || num(d.valor_parcela) > 0);
    });
    if (divs.length) {
      const labels = divs.map(function (d) { return str(d.motivo) || str(d.credor) || ('Dívida #' + str(d.id)); });
      const saldos = divs.map(function (d) { return num(d.saldo_devedor); });
      const parcelas = divs.map(function (d) { return num(d.valor_parcela); });
      const datasets = [{ label: 'Saldo devedor', data: saldos, cores: COR_NEGATIVO }];
      if (parcelas.some(function (p) { return p > 0; })) datasets.push({ label: 'Parcela mensal', data: parcelas, cores: CORES_GRAFICO[2] });
      especs.push({
        id: 'dividas',
        titulo: 'Dívidas: saldo devedor',
        tipo: 'barh',
        labels: labels,
        datasets: datasets,
        mostrarLegendaChart: datasets.length > 1
      });
    }

    // f. objetivos — metas de acúmulo dos objetivos normais (+ valor inicial)
    const od = getter('getObjetivosData', null);
    const objs = od && typeof od === 'object' ? lista(od.objetivos).filter(function (o) { return o && typeof o === 'object'; }) : [];
    const normais = objs.filter(function (o) {
      const t = str(o.tipo);
      return t !== 'aposentadoria' && t !== 'intangivel' && num(o.meta_acumulo) > 0;
    });
    if (normais.length) {
      const labels = normais.map(function (o) {
        const prazo = prazoObjetivoTexto(o);
        return (str(o.descricao) || 'Objetivo') + (prazo ? ' (' + prazo + ')' : '');
      });
      const datasets = [{ label: 'Meta de acúmulo', data: normais.map(function (o) { return num(o.meta_acumulo); }), cores: CORES_GRAFICO[0] }];
      if (normais.some(function (o) { return num(o.valor_inicial) > 0; })) {
        datasets.push({ label: 'Valor inicial já alocado', data: normais.map(function (o) { return num(o.valor_inicial); }), cores: CORES_GRAFICO[1] });
      }
      especs.push({
        id: 'objetivos',
        titulo: 'Objetivos: metas de acúmulo',
        tipo: 'barh',
        labels: labels,
        datasets: datasets,
        mostrarLegendaChart: datasets.length > 1
      });
    }

    // g. aposentadoria — capital necessário × já reservado
    const ap = dadosAposentadoria();
    if (ap && (ap.capital > 0 || ap.reservado > 0)) {
      let legenda = 'capital necessário × já reservado · renda anual desejada ' + moeda(ap.renda);
      if (ap.idadeAlvo !== null) {
        legenda += ' · aposentadoria aos ' + ap.idadeAlvo + ' anos' + (ap.anosFaltam !== null ? ' (faltam ' + anosTexto(ap.anosFaltam) + ')' : '');
      } else if (ap.anosFaltam !== null) {
        legenda += ' · faltam ' + anosTexto(ap.anosFaltam);
      }
      if (ap.quem) legenda += ' · ' + ap.quem;
      especs.push({
        id: 'aposentadoria',
        titulo: 'Aposentadoria',
        tipo: 'barh',
        labels: ['Capital necessário', 'Já reservado'],
        datasets: [{ label: 'Valor', data: [ap.capital, ap.reservado], cores: [CORES_GRAFICO[0], CORES_GRAFICO[1]] }],
        legenda: legenda,
        mostrarLegendaChart: false
      });
    }

    return especs;
  }

  // Barras CSS quando não há Chart.js (.rel-barra > .rel-barra-fill)
  function fallbackBarras(espec) {
    let max = 0;
    espec.datasets.forEach(function (ds) { ds.data.forEach(function (v) { if (Math.abs(v) > max) max = Math.abs(v); }); });
    let h = '<div class="rel-barras">';
    espec.labels.forEach(function (rot, i) {
      espec.datasets.forEach(function (ds) {
        const v = num(ds.data[i]);
        const cor = Array.isArray(ds.cores) ? ds.cores[i] : ds.cores;
        const largura = max > 0 ? Math.round(Math.abs(v) / max * 100) : 0;
        // valor negativo (ou barra vermelha) marca o item, para o CSS pintar
        // também na impressão, onde o style inline é sobrescrito
        const negativo = v < 0 || cor === COR_NEGATIVO;
        h += '<div class="rel-barra-item' + (negativo ? ' rel-negativo' : '') + '">';
        h += '<span class="rel-barra-rotulo">' + esc(rot) + (espec.datasets.length > 1 ? ' <span class="rel-mudo">(' + esc(ds.label) + ')</span>' : '') + ': ' + moeda(v) + '</span>';
        h += '<div class="rel-barra"><span class="rel-barra-fill" style="width:' + largura + '%;background:' + esc(cor || CORES_GRAFICO[0]) + '"></span></div>';
        h += '</div>';
      });
    });
    h += '</div>';
    return h;
  }

  function blocoGrafico(espec) {
    // classes explícitas para navegadores sem :has() (o CSS usa as duas)
    let h = '<div class="rel-grafico' + (espec.legenda ? ' com-legenda' : '') +
      (temChart() ? '' : ' rel-grafico-fallback') +
      '" data-grafico="' + esc(espec.id) + '" data-tipo="' + esc(espec.tipo) + '">';
    h += '<div class="rel-grafico-titulo">' + esc(espec.titulo) + '</div>';
    if (temChart()) {
      // .rel-grafico-canvas é a área do canvas (hub.css define a altura; o
      // min-height inline é só uma rede de segurança para o Chart.js medir algo)
      h += '<div class="rel-grafico-canvas" style="position:relative;min-height:200px"><canvas role="img" aria-label="' + esc(espec.titulo) + '"></canvas></div>';
    } else {
      h += fallbackBarras(espec);
    }
    if (espec.legenda) h += '<div class="rel-grafico-legenda">' + esc(espec.legenda) + '</div>';
    h += '</div>';
    return h;
  }

  function secGraficosHtml(especs) {
    if (!especs.length) return '';
    return '<div class="rel-graficos-grade">' + especs.map(blocoGrafico).join('') + '</div>';
  }

  // Eixo do Chart.js; `emMoeda` põe os ticks em R$ (só no eixo de valores)
  function eixoChart(emMoeda, comecaEmZero) {
    const ticks = { color: COR_TEXTO_GRAFICO, font: { size: 11 } };
    if (emMoeda) ticks.callback = function (v) { return moedaInteira(v); };
    const eixo = { ticks: ticks, grid: { color: COR_GRADE_GRAFICO } };
    if (comecaEmZero) eixo.beginAtZero = true;
    return eixo;
  }

  function configChart(espec) {
    const donut = espec.tipo === 'doughnut';
    const horizontal = espec.tipo === 'barh';
    const datasets = espec.datasets.map(function (ds) {
      return {
        label: ds.label,
        data: ds.data,
        backgroundColor: ds.cores,
        borderColor: donut ? COR_FUNDO_GRAFICO : ds.cores,
        borderWidth: donut ? 2 : 0,
        borderRadius: donut ? 0 : 4
      };
    });
    const tooltipLabel = function (ctx) {
      let v;
      if (donut) v = ctx.parsed;
      else v = horizontal ? ctx.parsed.x : ctx.parsed.y;
      let txt = donut ? (ctx.label + ': ') : (ctx.dataset.label ? ctx.dataset.label + ': ' : '');
      txt += moeda(num(v));
      if (donut) {
        const totalDs = lista(ctx.dataset.data).reduce(function (s, x) { return s + num(x); }, 0);
        if (totalDs > 0) txt += ' (' + pct(num(v) / totalDs * 100, 1) + ')';
      }
      return txt;
    };
    const opcoes = {
      responsive: true,
      maintainAspectRatio: false,
      indexAxis: horizontal ? 'y' : 'x',
      plugins: {
        legend: {
          display: !!espec.mostrarLegendaChart,
          position: 'bottom',
          labels: { color: COR_TEXTO_GRAFICO, font: { size: 11 }, boxWidth: 12 }
        },
        tooltip: { callbacks: { label: tooltipLabel } }
      }
    };
    if (donut) {
      opcoes.cutout = '58%';
    } else {
      opcoes.scales = {
        x: eixoChart(horizontal, horizontal),
        y: eixoChart(!horizontal, !horizontal)
      };
    }
    return { type: donut ? 'doughnut' : 'bar', data: { labels: espec.labels, datasets: datasets }, options: opcoes };
  }

  function destruirGraficos() {
    Object.keys(instanciasGraficos).forEach(function (k) {
      try { instanciasGraficos[k].destroy(); } catch (e) { /* já destruído */ }
    });
    instanciasGraficos = {};
  }

  // Instancia os Chart.js nos canvases já presentes em `container`
  function instanciarGraficos(container) {
    if (!temChart() || !container) return;
    especsGraficos.forEach(function (espec) {
      const bloco = container.querySelector('.rel-grafico[data-grafico="' + espec.id + '"]');
      const canvas = bloco ? bloco.querySelector('canvas') : null;
      if (!canvas) return;
      try {
        instanciasGraficos[espec.id] = new window.Chart(canvas, configChart(espec));
      } catch (e) {
        if (window.console && console.warn) console.warn('Relatório: falha ao desenhar o gráfico ' + espec.id, e);
      }
    });
  }

  // ------------------------------------------------------------
  // Plano e faltantes (capítulos finais)
  // ------------------------------------------------------------
  // Todos os tópicos do plano na ordem fixa das regras, cada um com título e
  // lista; por último "Para fechar o plano:" em bloco destacado.
  function secPlano(plano) {
    // sem o módulo de questões não dá para afirmar nada sobre o plano
    if (!plano || typeof plano !== 'object') {
      return '<p class="rel-vazio">Plano indisponível nesta página.</p>';
    }
    const porSecao = plano && plano.porSecao && typeof plano.porSecao === 'object' ? plano.porSecao : {};
    const fechamento = lista(plano && plano.fechamento);
    let h = '';
    let topicos = 0;
    const chaves = ORDEM_PLANO.slice();
    // tópicos de chaves novas (fora da ordem conhecida) entram no fim
    Object.keys(porSecao).forEach(function (k) { if (chaves.indexOf(k) === -1) chaves.push(k); });
    chaves.forEach(function (k) {
      const t = porSecao[k];
      const itens = lista(t && t.itens);
      if (!itens.length) return;
      topicos++;
      h += '<div class="rel-plano-topico" data-secao="' + esc(k) + '">';
      h += '<h4 class="rel-sub">' + esc(str(t.titulo) || k) + '</h4>';
      h += listaHtml(itens, 'rel-plano-lista');
      h += '</div>';
    });
    if (!topicos && !fechamento.length) {
      return '<p class="rel-vazio">Nenhuma frente pendente: todas as questões estão adequadas ou inaplicáveis.</p>';
    }
    if (fechamento.length) {
      h += '<div class="rel-plano-fechar"><h4 class="rel-sub rel-plano-fechar-titulo">Para fechar o plano:</h4>' + listaHtml(fechamento, 'rel-plano-lista') + '</div>';
    }
    return h;
  }

  // Slot vazio: o hub.js coloca aqui o #painel-info-faltantes do validador
  function secFaltantes() {
    return '<div id="rel-faltantes-slot"><p class="rel-vazio rel-faltantes-vazio">Painel de informações faltantes indisponível nesta página.</p></div>';
  }

  // ------------------------------------------------------------
  // Questões, plano e observações por seção
  // ------------------------------------------------------------
  function classeResposta(r) {
    if (r === 'SIM') return 'rel-sim';
    if (r === 'NÃO') return 'rel-nao';
    if (r === 'INAPLICÁVEL') return 'rel-na';
    return 'rel-pendente';
  }

  function textoResposta(r) {
    if (r === 'SIM') return 'SIM';
    if (r === 'NÃO') return 'NÃO';
    if (r === 'INAPLICÁVEL') return 'N/A';
    return '—';
  }

  function blocoQuestoes(slug, questoesPorSecao) {
    if (SECOES_COM_QUESTOES.indexOf(slug) === -1) return '';
    const qs = lista(questoesPorSecao && questoesPorSecao[slug]);
    if (!qs.length) return '';
    // Mesmo formato das linhas de dados: "<b>Pergunta?</b> <chip>", uma por
    // linha, alinhada à esquerda (sem lista com marcador).
    let h = '<div class="rel-questoes"><h4 class="rel-sub">Questões pertinentes</h4>';
    qs.forEach(function (q) {
      const r = str(q.resposta);
      h += '<p class="rel-linha rel-questao ' + classeResposta(r) + '"><strong class="rel-questao-texto">' + esc(q.texto) + '</strong> <span class="rel-chip ' + classeResposta(r) + '">' + textoResposta(r) + '</span></p>';
    });
    h += '</div>';
    return h;
  }

  // (fase 2) Mantida por compatibilidade, mas NÃO é mais usada dentro das
  // seções de coleta: o plano inteiro vai para #rel-secao-plano (secPlano).
  function blocoPlano(slug, plano) {
    if (SECOES_COM_QUESTOES.indexOf(slug) === -1) return '';
    const topico = plano && plano.porSecao && plano.porSecao[slug];
    const itens = lista(topico && topico.itens);
    if (!itens.length) return '';
    return '<div class="rel-plano"><h4 class="rel-sub">O plano financeiro precisa conter:</h4>' + listaHtml(itens, 'rel-plano-lista') + '</div>';
  }

  function blocoObs(idObs) {
    const v = valorDom(idObs);
    if (!v) return '';
    return '<div class="rel-obs"><strong>Observações:</strong> ' + escMultilinha(v) + '</div>';
  }

  // ------------------------------------------------------------
  // Catálogo do relatório, na ORDEM FINAL (título/ícone do DOM quando a
  // seção existir na página; capítulos novos usam o título fixo).
  // Devolve também `chip` (texto curto) para os chips do hub.
  // ------------------------------------------------------------
  function secoes() {
    return CATALOGO_RELATORIO.map(function (c) {
      let titulo = c.titulo;
      let icone = c.icone;
      const sec = document.getElementById('secao-' + c.slug);
      const h3 = sec ? sec.querySelector('.section-header h3') : null;
      if (h3) {
        const i = h3.querySelector('i');
        const cls = i ? Array.prototype.filter.call(i.classList, function (k) { return /^fa-/.test(k) && k !== 'fa'; })[0] : '';
        if (cls) icone = cls;
        const txt = str(h3.textContent);
        if (txt) titulo = txt;
      }
      return { slug: c.slug, titulo: c.chip || titulo, tituloCompleto: titulo, icone: icone };
    });
  }

  // ------------------------------------------------------------
  // Capa
  // ------------------------------------------------------------
  function capa(resumo, resultado) {
    const nome = valorDom('nome_diagnostico') || textoDom('diagnostico-title') || 'Cliente';
    const status = textoDom('status-badge') || '—';
    const pf = resultado && resultado.perfil_financeiro && typeof resultado.perfil_financeiro === 'object' ? resultado.perfil_financeiro : {};
    const cm = resultado && resultado.codigo_matriz && typeof resultado.codigo_matriz === 'object' ? resultado.codigo_matriz : {};
    const vigente = str(pf.vigente);
    const p = vigente ? perfilPorId(vigente) : null;
    const rot = vigente ? (p ? p.rotulo : (vigente === str(pf.calculado) ? str(pf.rotulo) : vigente)) : 'a calcular';
    const cor = p && p.cor ? p.cor : '';

    let h = '<div class="rel-capa">';
    h += '<div class="rel-capa-nome">' + esc(nome) + '</div>';
    h += '<div class="rel-capa-meta"><span>' + esc(hojeFormatada()) + '</span> <span class="rel-mudo">·</span> <span>' + esc(status) + '</span> <span class="rel-mudo">·</span> <span>regras v' + esc(versaoRegras(resultado)) + '</span></div>';
    h += '<div class="rel-capa-perfil' + (vigente ? '' : ' rel-capa-perfil-vazio') + '"' + (cor ? ' style="color:' + esc(cor) + '"' : '') + ' data-perfil="' + esc(vigente) + '">' + esc(rot) + '</div>';
    h += '<div class="rel-capa-codigo">' + (str(cm.codigo) ? '<span class="rel-codigo">' + esc(cm.codigo) + '</span>' : '<span class="rel-mudo">matriz a calcular</span>') + '</div>';
    h += '<div class="rel-capa-resumo">';
    // .rel-num dentro de .rel-capa-resumo é o número grande (hub.css); o rótulo fica abaixo
    h += '<div class="rel-capa-num"><span class="rel-num">' + esc(resumo.secoesComDados) + '<span class="rel-mudo">/' + esc(resumo.totalSecoes) + '</span></span><span class="rel-capa-num-rotulo">seções com dados</span></div>';
    h += '<div class="rel-capa-num"><span class="rel-num">' + esc(resumo.pendencias) + '</span><span class="rel-capa-num-rotulo">pendências do validador</span></div>';
    h += '<div class="rel-capa-num"><span class="rel-num">' + esc(resumo.questoesRespondidas) + '<span class="rel-mudo">/' + esc(resumo.totalQuestoes) + '</span></span><span class="rel-capa-num-rotulo">questões respondidas</span></div>';
    h += '</div>';
    h += '</div>';
    return h;
  }

  function contarPendencias() {
    if (typeof window.validarDiagnostico !== 'function') return '—';
    const faltantes = seguro(function () { return window.validarDiagnostico(); }, null);
    if (!Array.isArray(faltantes)) return '—';
    return faltantes.reduce(function (s, g) { return s + lista(g && g.itens).length; }, 0);
  }

  function contarQuestoes(questoesPorSecao) {
    let total = 0, respondidas = 0;
    if (questoesPorSecao && typeof questoesPorSecao === 'object') {
      Object.keys(questoesPorSecao).forEach(function (k) {
        lista(questoesPorSecao[k]).forEach(function (q) {
          total++;
          if (str(q && q.resposta)) respondidas++;
        });
      });
    }
    return { total: total, respondidas: respondidas };
  }

  // ------------------------------------------------------------
  // Montagem
  // ------------------------------------------------------------
  const VAZIO = '<p class="rel-vazio">Nada informado ainda.</p>';

  function html() {
    const cat = secoes();
    const porSlug = {};
    cat.forEach(function (c) { porSlug[c.slug] = c; });
    const catObs = {};
    CATALOGO.forEach(function (c) { catObs[c.slug] = c.obs; });

    const resultado = resultadoPerfil();
    const questoesPorSecao = getter('getQuestoesPorSecao', {}) || {};
    const plano = getter('getPlanoPorSecao', null);
    const contagem = contarQuestoes(questoesPorSecao);

    // Abre uma <section> do relatório com o título do catálogo
    function abrir(slug, classeExtra) {
      const c = porSlug[slug] || { tituloCompleto: slug, icone: 'fa-circle' };
      return '<section class="rel-secao' + (classeExtra ? ' ' + classeExtra : '') + '" id="rel-secao-' + esc(slug) + '">' +
        '<h3 class="rel-secao-titulo"><i class="fas ' + esc(c.icone) + '"></i> ' + esc(c.tituloCompleto || c.titulo) + '</h3>';
    }
    function dadosDe(slug) {
      const construtor = CONSTRUTORES[slug];
      return construtor ? seguro(construtor, '') : '';
    }

    let corpo = '';
    let secoesComDados = 0;

    // 2. COLETA — 12 seções: dados + questões (mesmo formato) + observação.
    //    Sem bloco de plano dentro delas (fase 2).
    SECOES_COLETA.forEach(function (c) {
      const dados = dadosDe(c.slug);
      if (dados) secoesComDados++;
      corpo += abrir(c.slug);
      corpo += '<div class="rel-dados">' + (dados || VAZIO) + '</div>';
      corpo += seguro(function () { return blocoQuestoes(c.slug, questoesPorSecao); }, '');
      corpo += seguro(function () { return blocoObs(catObs[c.slug]); }, '');
      corpo += '</section>';
    });

    // 3. GRÁFICOS — só depois de toda a coleta; omitidos sem dados
    especsGraficos = seguro(especificarGraficos, []) || [];
    if (especsGraficos.length) {
      corpo += abrir('graficos', 'rel-secao-graficos');
      corpo += secGraficosHtml(especsGraficos);
      corpo += '</section>';
    }

    // 4. PERFIL FINANCEIRO
    const dadosPerfil = dadosDe('perfil-financeiro');
    if (dadosPerfil) secoesComDados++;
    corpo += abrir('perfil-financeiro');
    corpo += '<div class="rel-dados">' + (dadosPerfil || VAZIO) + '</div>';
    corpo += seguro(function () { return blocoObs(catObs['perfil-financeiro']); }, '');
    corpo += '</section>';

    // 5. CÓDIGO DA MATRIZ
    corpo += abrir('codigo-matriz');
    corpo += '<div class="rel-dados">' + (dadosDe('codigo-matriz') || '<p class="rel-vazio">Matriz a calcular.</p>') + '</div>';
    corpo += '</section>';

    // 6. ADESÃO
    const dadosAdesao = dadosDe('adesao-plano');
    if (dadosAdesao) secoesComDados++;
    corpo += abrir('adesao-plano');
    corpo += '<div class="rel-dados">' + (dadosAdesao || VAZIO) + '</div>';
    corpo += seguro(function () { return blocoObs(catObs['adesao-plano']); }, '');
    corpo += '</section>';

    // 7. O QUE O PLANO FINANCEIRO PRECISA CONTER (todos os tópicos + fechamento)
    corpo += abrir('plano', 'rel-secao-plano');
    corpo += '<div class="rel-dados">' + seguro(function () { return secPlano(plano); }, '<p class="rel-vazio">Plano indisponível nesta página.</p>') + '</div>';
    corpo += '</section>';

    // 8. INFORMAÇÕES FALTANTES PARA AS FERRAMENTAS (slot para o painel do validador)
    corpo += abrir('faltantes', 'rel-secao-faltantes');
    corpo += secFaltantes();
    corpo += '</section>';

    const resumo = {
      secoesComDados: secoesComDados,
      totalSecoes: SECOES_COLETA.length + 2, // + perfil financeiro + adesão (as 14 do hub)
      pendencias: contarPendencias(),
      questoesRespondidas: contagem.respondidas,
      totalQuestoes: contagem.total
    };

    return '<div class="rel">' + capa(resumo, resultado) + corpo + '</div>';
  }

  // Monta o HTML no container e DEPOIS instancia os gráficos nos canvases
  // já presentes no DOM. Instâncias anteriores são destruídas antes.
  function render(container) {
    const alvo = container || document.getElementById('hub-relatorio-corpo');
    if (!alvo) return '';
    destruirGraficos();
    const saida = seguro(html, '<div class="rel"><p class="rel-vazio">Não foi possível montar o relatório.</p></div>');
    alvo.innerHTML = saida;
    seguro(function () { instanciarGraficos(alvo); return true; }, false);
    return saida;
  }

  window.RelatorioDiagnostico = {
    render: render,
    secoes: secoes,
    html: html
  };

})();
