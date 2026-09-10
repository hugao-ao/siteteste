-- =====================================================================
-- Diagnóstico v2 — Perfil Financeiro automático
-- Colunas novas em public.diagnosticos_financeiros
-- =====================================================================
--
-- ATENÇÃO: ESTE SCRIPT JÁ FOI APLICADO NO SUPABASE.
-- Ele fica aqui apenas como DOCUMENTAÇÃO do que existe no banco.
-- Não precisa (nem deve) ser executado de novo. Mesmo assim, todos os
-- comandos usam "add column if not exists", então rodar por engano
-- não quebra nada: as colunas já existentes são simplesmente ignoradas.
--
-- Quem grava essas colunas: /diagnostico/diagnostico-financeiro.html
-- (update por id, via Object.assign(dataToSave, getPerfilFinanceiroResultado())).
-- Quem lê versao_diagnostico para escolher a página: cliente-detalhes.html
-- (displayDiagnosticoLink) e clientes.js (showDiagnosticoModal).
--
-- Fonte de verdade das regras: DESIGN-diagnostico-v2.md, seção 1.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1) Roteamento entre versões da página
-- ---------------------------------------------------------------------
-- 1 → abre /diagnostico-financeiro.html (v1, raiz)
-- 2 → abre /diagnostico/diagnostico-financeiro.html (v2)
-- Diagnósticos antigos ficam com o default 1 (nada muda para eles).
-- Diagnósticos novos nascem com 2 (insert em cliente-detalhes.html e clientes.js).
alter table public.diagnosticos_financeiros
  add column if not exists versao_diagnostico integer not null default 1;

-- ---------------------------------------------------------------------
-- 2) Resultado do motor de perfil (perfil-financeiro.js)
-- ---------------------------------------------------------------------
-- perfil_financeiro: objeto com calculado, rotulo, justificativa_auto,
--   faltantes, ajustado, justificativa_consultor, vigente,
--   dados_complementares e analise (camada_divida, camada_fluxo,
--   subjacente, camada_investidor). Vai CRU (jsonb), sem JSON.stringify.
alter table public.diagnosticos_financeiros
  add column if not exists perfil_financeiro jsonb;

-- perfil_investidor: { calculado, ajustado, justificativa_consultor }.
-- Nesta versão o cálculo automático não existe (calculado = null);
-- guarda só o ajuste manual do consultor e a justificativa.
alter table public.diagnosticos_financeiros
  add column if not exists perfil_investidor jsonb;

-- codigo_matriz: { codigo (ex.: 'B-T2-M2-P3-F2-B1-R2'), por_posicao, faltantes }.
alter table public.diagnosticos_financeiros
  add column if not exists codigo_matriz jsonb;

-- versao_regras: versão das regras usadas no cálculo (ex.: '2.1.0').
alter table public.diagnosticos_financeiros
  add column if not exists versao_regras text;

-- calculado_em: instante (ISO) em que o motor calculou o resultado salvo.
alter table public.diagnosticos_financeiros
  add column if not exists calculado_em timestamptz;

-- ---------------------------------------------------------------------
-- 3) Renda no mês fraco (opcional — só para renda variável)
-- ---------------------------------------------------------------------
-- Usada pelo motor como renda_base do funil da dívida quando informada
-- (regra M3). Titular e cônjuge têm campo próprio; pessoas com renda
-- guardam o valor dentro do JSON pessoas_renda (chave renda_mes_fraco).
alter table public.diagnosticos_financeiros
  add column if not exists renda_mes_fraco numeric;

alter table public.diagnosticos_financeiros
  add column if not exists conjuge_renda_mes_fraco numeric;

-- ---------------------------------------------------------------------
-- Observações
-- ---------------------------------------------------------------------
-- * Nenhuma coluna existente foi renomeada, removida ou alterada de tipo.
-- * As demais informações novas da v2 (situacao_divida, divida_estruturada,
--   proposta_em_vigor, parcela_proposta nas dívidas; nivel_conforto,
--   alteravel, disposto nas despesas; reserva_emergencia no patrimônio
--   líquido; imovel_unico_moradia e gera_renda no patrimônio físico)
--   vivem DENTRO dos JSONs já existentes (dividas, fluxo_caixa,
--   patrimonios_liquidos, patrimonios) e não precisam de coluna nova.
-- * RLS: este script não cria nem altera política alguma. Colunas novas
--   ficam sob as mesmas políticas de linha que a tabela já tiver
--   (RLS é por linha, não por coluna).
