-- =====================================================================
-- Investimentos v3 — catálogo em 9 degraus de risco + teste de perfil novo
-- Arquivo: diagnostico/sql/investimentos-v3.sql
-- =====================================================================
--
-- O QUE ESTE SCRIPT FAZ
--   1) Acrescenta ao catálogo public.tipos_produtos_investimento quatro
--      colunas NOVAS: classe_risco (9 degraus), liquidez, elegivel e
--      revisao_item.
--   2) Cria duas restrições (CHECK) que só aceitam os valores válidos
--      nessas colunas novas.
--   3) Divide CDB, RDB e LC em dois tipos cada: o tipo existente é
--      renomeado para "<X> com prazo/carência" (mantém o id, então os
--      itens já cadastrados vão para a versão com prazo) e é inserido
--      "<X> com liquidez diária".
--   4) Preenche classe_risco, liquidez, elegivel e revisao_item produto a
--      produto (tabela 7.2 aprovada pelo dono).
--   5) Acrescenta a coluna public.diagnosticos_financeiros.suitability_v3
--      (jsonb) para as respostas do teste de perfil novo.
--   6) No fim, relatórios de conferência (só SELECT, não alteram nada).
--
-- O QUE ESTE SCRIPT NÃO FAZ
--   * NÃO altera a coluna antiga classificacao_risco. A tela antiga
--     (diagnostico-financeiro.html da RAIZ), a ficha do cliente e a
--     ferramenta Patrimônio continuam lendo a escala de 7 classes.
--   * NÃO altera respostas_suitability (teste antigo) nem os JSONs de
--     patrimônio salvos nos diagnósticos.
--   * NÃO cria nem altera política de segurança (RLS).
--   * NÃO remove produto nenhum.
--
-- IDEMPOTENTE: pode rodar duas vezes sem estragar nada.
--   - "add column if not exists" ignora coluna que já existe;
--   - as restrições só são criadas se ainda não existirem;
--   - o renomear só acontece se o nome antigo existir E o novo não;
--   - o insert só acrescenta o nome que ainda não existe ("where not
--     exists"; não depende de restrição única na coluna nome);
--   - os updates gravam sempre o mesmo valor, localizando pelo nome.
--
-- COMO RODAR: Supabase → SQL Editor → colar o arquivo inteiro → Run.
--   A parte que altera está entre "begin;" e "commit;": se qualquer
--   comando falhar, nada é gravado. Os relatórios ficam depois do commit.
--
-- Referência de regras: DESIGN-investimentos-v3.md, seções 2 e 7.
-- =====================================================================

begin;

-- ---------------------------------------------------------------------
-- 1) Colunas novas do catálogo (a coluna antiga não é tocada)
-- ---------------------------------------------------------------------
-- classe_risco : uma das 9 chaves novas, ou null (produto genérico que
--                exige a classe definida no próprio item)
-- liquidez     : D0 | D1 | D1_MERCADO | ATE_D30 | SO_VENCIMENTO | ILIQUIDO, ou null
-- elegivel     : false = produto fora da matriz de alocação (não conta como reserva)
-- revisao_item : true  = o consultor precisa confirmar/definir a classe em cada item
alter table public.tipos_produtos_investimento
  add column if not exists classe_risco varchar,
  add column if not exists liquidez varchar,
  add column if not exists elegivel boolean not null default true,
  add column if not exists revisao_item boolean not null default false;

-- ---------------------------------------------------------------------
-- 2) Restrições (CHECK) das colunas novas — criadas uma única vez
-- ---------------------------------------------------------------------
do $$
begin
  if not exists (
    select 1 from pg_constraint
     where conname = 'tipos_produtos_investimento_classe_risco_chk'
  ) then
    alter table public.tipos_produtos_investimento
      add constraint tipos_produtos_investimento_classe_risco_chk
      check (classe_risco is null or classe_risco in (
        'RISCO_SOBERANO', 'RISCO_MUITO_BAIXO', 'RISCO_BAIXO',
        'RISCO_MEDIO_BAIXO', 'RISCO_MEDIO', 'RISCO_MEDIO_ALTO',
        'RISCO_ALTO', 'RISCO_MUITO_ALTO', 'RISCO_MAXIMO'
      ));
  end if;

  if not exists (
    select 1 from pg_constraint
     where conname = 'tipos_produtos_investimento_liquidez_chk'
  ) then
    alter table public.tipos_produtos_investimento
      add constraint tipos_produtos_investimento_liquidez_chk
      check (liquidez is null or liquidez in (
        'D0', 'D1', 'D1_MERCADO', 'ATE_D30', 'SO_VENCIMENTO', 'ILIQUIDO'
      ));
  end if;
end $$;

-- ---------------------------------------------------------------------
-- 3) Divisão de CDB, RDB e LC em "com prazo/carência" e "com liquidez diária"
-- ---------------------------------------------------------------------
-- 3a) Renomear o tipo existente para "<X> com prazo/carência".
--     Mantém o id: os itens já cadastrados passam a apontar para a versão
--     com prazo (a relação de revisão manual, no fim, lista esses itens).
--     Só renomeia se o nome antigo existir e o novo ainda não existir.
do $$
declare
  base text;
begin
  foreach base in array array['CDB', 'RDB', 'LC'] loop
    if exists (
         select 1 from public.tipos_produtos_investimento where nome = base
       )
       and not exists (
         select 1 from public.tipos_produtos_investimento where nome = base || ' com prazo/carência'
       ) then
      update public.tipos_produtos_investimento
         set nome = base || ' com prazo/carência'
       where nome = base;
    end if;
  end loop;
end $$;

-- 3b) Inserir "<X> com liquidez diária".
--     classificacao_risco = 'RISCO_BAIXO' (escala antiga de 7, igual ao
--     tipo original), para a tela antiga continuar entendendo o produto.
--     Idempotente SEM depender de restrição única em "nome" (o levantamento
--     do banco não registra essa restrição; "on conflict (nome)" daria erro
--     e desfaria a migração inteira): só insere o nome que ainda não existe.
insert into public.tipos_produtos_investimento (nome, categoria, classificacao_risco, descricao, ativo)
select v.nome, 'Renda Fixa', 'RISCO_BAIXO', v.descricao, true
  from (values
    ('CDB com liquidez diária',
     'CDB com resgate a qualquer dia útil pelo valor aplicado mais rendimento; coberto pelo FGC dentro do limite.'),
    ('RDB com liquidez diária',
     'RDB com resgate a qualquer dia útil pelo valor aplicado mais rendimento; coberto pelo FGC dentro do limite.'),
    ('LC com liquidez diária',
     'Letra de Câmbio com resgate a qualquer dia útil; coberta pelo FGC dentro do limite.')
  ) as v(nome, descricao)
 where not exists (
   select 1 from public.tipos_produtos_investimento t where t.nome = v.nome
 );

-- ---------------------------------------------------------------------
-- 4) Preenchimento produto a produto (tabela 7.2 aprovada pelo dono)
-- ---------------------------------------------------------------------
-- Princípios (os mesmos comentados em riscos-v3.js):
--   * risco do ponto de vista de quem carrega o papel: Tesouro Selic é o
--     único Soberano porque não sofre marcação relevante; os demais
--     títulos públicos vão para o degrau Baixo;
--   * a embalagem herda o risco do conteúdo (ETF, fundo, previdência, COE);
--   * sem classificação de autoridade → degrau máximo;
--   * liquidez é dimensão própria do risco (coluna liquidez).
-- Classificação por CLASSE de produto, nunca recomendação de ativo.

-- Tesouro Selic: único degrau Soberano
update public.tipos_produtos_investimento
   set classe_risco = 'RISCO_SOBERANO', liquidez = 'D1', elegivel = true, revisao_item = false
 where nome = 'Tesouro Selic';

-- Demais títulos públicos: Baixo, resgate em D1 a preço de mercado
update public.tipos_produtos_investimento
   set classe_risco = 'RISCO_BAIXO', liquidez = 'D1_MERCADO', elegivel = true, revisao_item = false
 where nome in ('Tesouro IPCA+', 'Tesouro Prefixado', 'Tesouro RendA+', 'Tesouro Educa+');

-- FGC + liquidez diária: Muito Baixo
update public.tipos_produtos_investimento
   set classe_risco = 'RISCO_MUITO_BAIXO', liquidez = 'D0', elegivel = true, revisao_item = false
 where nome in ('Poupança', 'Conta Corrente',
                'CDB com liquidez diária', 'RDB com liquidez diária', 'LC com liquidez diária');

-- FGC sem liquidez diária: Baixo, só no vencimento
update public.tipos_produtos_investimento
   set classe_risco = 'RISCO_BAIXO', liquidez = 'SO_VENCIMENTO', elegivel = true, revisao_item = false
 where nome in ('CDB com prazo/carência', 'RDB com prazo/carência', 'LC com prazo/carência',
                'LCA', 'LCI', 'LH', 'LCD');

-- LF: sem FGC → Médio-Baixo
update public.tipos_produtos_investimento
   set classe_risco = 'RISCO_MEDIO_BAIXO', liquidez = 'SO_VENCIMENTO', elegivel = true, revisao_item = false
 where nome = 'LF';

-- Título de Capitalização: fora da matriz (não é investimento no sentido da matriz)
update public.tipos_produtos_investimento
   set classe_risco = 'RISCO_BAIXO', liquidez = 'SO_VENCIMENTO', elegivel = false, revisao_item = false
 where nome = 'Título de Capitalização';

-- Outros (Renda Fixa): genérico demais para um degrau → sem classe, revisão obrigatória por item
update public.tipos_produtos_investimento
   set classe_risco = null, liquidez = null, elegivel = true, revisao_item = true
 where nome = 'Outros' and categoria = 'Renda Fixa';

-- CRA, CRI, Debêntures:
-- Default do tipo; o rating do papel ajusta no item (AAA/AA → Médio-Baixo; A → Médio; BBB → Médio-Alto).
update public.tipos_produtos_investimento
   set classe_risco = 'RISCO_MEDIO_BAIXO', liquidez = 'SO_VENCIMENTO', elegivel = true, revisao_item = false
 where nome in ('CRA', 'CRI', 'Debêntures');

-- Fundo de Crédito Privado
update public.tipos_produtos_investimento
   set classe_risco = 'RISCO_MEDIO_BAIXO', liquidez = 'ATE_D30', elegivel = true, revisao_item = false
 where nome = 'Fundo de Crédito Privado';

-- Fundo DI e Fundo Renda Fixa:
-- Só permanece no Baixo o fundo que entrega acima do produto com FGC de liquidez equivalente;
-- caso contrário, o consultor rebaixa pelo item.
update public.tipos_produtos_investimento
   set classe_risco = 'RISCO_BAIXO', liquidez = 'D1', elegivel = true, revisao_item = false
 where nome in ('Fundo DI', 'Fundo Renda Fixa');

-- Multimercado e previdência: Médio (a previdência herda o risco da carteira)
update public.tipos_produtos_investimento
   set classe_risco = 'RISCO_MEDIO', liquidez = 'ATE_D30', elegivel = true, revisao_item = false
 where nome in ('Fundo Multimercado', 'PGBL', 'VGBL');

-- FII diversificado e ETF de índice amplo: Médio-Alto
update public.tipos_produtos_investimento
   set classe_risco = 'RISCO_MEDIO_ALTO', liquidez = 'D1_MERCADO', elegivel = true, revisao_item = false
 where nome in ('FIIs', 'Fundo Imobiliário', 'ETFs');

-- Cambial: Alto, D1
update public.tipos_produtos_investimento
   set classe_risco = 'RISCO_ALTO', liquidez = 'D1', elegivel = true, revisao_item = false
 where nome = 'Fundo Cambial';

-- Ações, BDRs e Ouro: Alto, D1 a preço de mercado
update public.tipos_produtos_investimento
   set classe_risco = 'RISCO_ALTO', liquidez = 'D1_MERCADO', elegivel = true, revisao_item = false
 where nome in ('Ações', 'BDRs', 'Ouro');

-- Fundo de Ações: Alto, até D30
update public.tipos_produtos_investimento
   set classe_risco = 'RISCO_ALTO', liquidez = 'ATE_D30', elegivel = true, revisao_item = false
 where nome = 'Fundo de Ações';

-- COE:
-- Default Alto + revisão obrigatória por item (look-through: a embalagem herda o risco do conteúdo;
-- a 'proteção de capital' é promessa do emissor, sem FGC, com prazo travado).
update public.tipos_produtos_investimento
   set classe_risco = 'RISCO_ALTO', liquidez = 'SO_VENCIMENTO', elegivel = true, revisao_item = true
 where nome = 'COE';

-- Derivativos e alavancagem: Máximo
update public.tipos_produtos_investimento
   set classe_risco = 'RISCO_MAXIMO', liquidez = 'SO_VENCIMENTO', elegivel = true, revisao_item = false
 where nome = 'Contratos a Termo';

-- Cripto direta e Day Trade: Máximo, D0
update public.tipos_produtos_investimento
   set classe_risco = 'RISCO_MAXIMO', liquidez = 'D0', elegivel = true, revisao_item = false
 where nome in ('Criptomoedas (BTC)', 'Criptomoedas (Não-BTC)', 'Day Trade');

-- Futuros e Opções: Máximo, D1 a preço de mercado
update public.tipos_produtos_investimento
   set classe_risco = 'RISCO_MAXIMO', liquidez = 'D1_MERCADO', elegivel = true, revisao_item = false
 where nome in ('Futuros', 'Opções');

-- Private Equity e Venture Capital: Muito Alto, ilíquido
update public.tipos_produtos_investimento
   set classe_risco = 'RISCO_MUITO_ALTO', liquidez = 'ILIQUIDO', elegivel = true, revisao_item = false
 where nome in ('Private Equity', 'Venture Capital');

-- ---------------------------------------------------------------------
-- 5) Coluna do teste de perfil novo no diagnóstico
-- ---------------------------------------------------------------------
-- suitability_v3: { versao: 3, pessoas: { "<nome>": { A1, A2, A3..A10, C1..C5, C6[8] } },
--                   domicilio: { B3, confirmacao_b1b2: {...} }, atualizado_em }
-- Gravada CRUA (jsonb) só pelo formato novo (/diagnostico/). A coluna antiga
-- respostas_suitability não é alterada.
alter table public.diagnosticos_financeiros
  add column if not exists suitability_v3 jsonb;

commit;

-- =====================================================================
-- 6) RELATÓRIOS DE CONFERÊNCIA (só SELECT — não alteram nada)
-- =====================================================================
-- No SQL Editor do Supabase aparece o resultado do ÚLTIMO select.
-- Para ver cada relatório, selecione só o bloco dele com o mouse e
-- clique em Run (roda só o trecho selecionado).

-- ---------------------------------------------------------------------
-- 6a) Catálogo depois da migração (esperado: 46 produtos = 43 + 3 novos)
-- ---------------------------------------------------------------------
select t.nome,
       t.categoria,
       t.classificacao_risco as classe_antiga_escala_7,
       t.classe_risco        as classe_nova_9_degraus,
       t.liquidez,
       t.elegivel,
       t.revisao_item,
       t.ativo
  from public.tipos_produtos_investimento t
 order by coalesce(array_position(array[
            'RISCO_SOBERANO', 'RISCO_MUITO_BAIXO', 'RISCO_BAIXO',
            'RISCO_MEDIO_BAIXO', 'RISCO_MEDIO', 'RISCO_MEDIO_ALTO',
            'RISCO_ALTO', 'RISCO_MUITO_ALTO', 'RISCO_MAXIMO'
          ], t.classe_risco::text), 99),
          t.nome;

-- ---------------------------------------------------------------------
-- 6b) Produtos que ficaram SEM classe nova ou sem liquidez
--     Esperado: só "Outros" (sem classe e sem liquidez, de propósito).
--     Qualquer outra linha é produto cadastrado fora da lista de 43.
-- ---------------------------------------------------------------------
select t.nome, t.categoria, t.classificacao_risco, t.classe_risco, t.liquidez, t.revisao_item
  from public.tipos_produtos_investimento t
 where t.classe_risco is null
    or t.liquidez is null
 order by t.nome;

-- ---------------------------------------------------------------------
-- 6c) As duas colunas novas existem? (esperado: 5 linhas)
-- ---------------------------------------------------------------------
select table_name, column_name, data_type, is_nullable, column_default
  from information_schema.columns
 where table_schema = 'public'
   and (
         (table_name = 'tipos_produtos_investimento'
          and column_name in ('classe_risco', 'liquidez', 'elegivel', 'revisao_item'))
      or (table_name = 'diagnosticos_financeiros' and column_name = 'suitability_v3')
       )
 order by table_name, column_name;

-- ---------------------------------------------------------------------
-- 6d) LISTA DE REVISÃO MANUAL — itens de investimento já salvos nos
--     diagnósticos que precisam de um olhar do consultor.
--     patrimonios_liquidos é lido qualquer que seja o tipo da coluna
--     (text, json ou jsonb) e qualquer que seja o formato gravado (array
--     ou texto JSON): to_jsonb() transforma texto cru em string jsonb e
--     mantém array jsonb como está; a string que começa com "[" é lida
--     como array.
--     ATENÇÃO: se algum diagnóstico tiver nessa coluna um texto que começa
--     com "[" mas NÃO é JSON válido, este relatório para com erro de
--     conversão ("invalid input syntax for type json"). A migração não é
--     afetada (este bloco fica depois do commit).
-- ---------------------------------------------------------------------
with diag as (
  select d.id as diagnostico_id,
         d.cliente_id,
         d.link_unico,
         d.versao_diagnostico,
         case
           when jsonb_typeof(to_jsonb(d.patrimonios_liquidos)) = 'array'
             then to_jsonb(d.patrimonios_liquidos)
           when jsonb_typeof(to_jsonb(d.patrimonios_liquidos)) = 'string'
                and left(btrim(to_jsonb(d.patrimonios_liquidos) #>> '{}'), 1) = '['
             then (to_jsonb(d.patrimonios_liquidos) #>> '{}')::jsonb
           else '[]'::jsonb
         end as itens
    from public.diagnosticos_financeiros d
   where d.patrimonios_liquidos is not null
),
itens as (
  select diag.diagnostico_id,
         diag.cliente_id,
         diag.link_unico,
         diag.versao_diagnostico,
         it.item,
         coalesce(it.item ->> 'tipo_produto_nome', '') as produto
    from diag
    cross join lateral jsonb_array_elements(diag.itens) as it(item)
)
select c.nome                                   as cliente,
       i.link_unico,
       i.versao_diagnostico,
       i.produto,
       i.item ->> 'nome_produto_customizado'    as nome_no_item,
       i.item ->> 'valor_atual'                 as valor_atual,
       i.item ->> 'classificacao_risco'         as classe_gravada_no_item,
       case
         when i.item ->> 'reserva_emergencia' = 'true' then 'sim'
         when i.item ->> 'reserva_emergencia' is null
              and i.item ->> 'finalidade' = 'RESERVA_EMERGENCIA' then 'sim (pela finalidade)'
         else 'não'
       end                                      as conta_como_reserva,
       cat.nome                                 as tipo_no_catalogo,
       cat.liquidez                             as liquidez_no_catalogo,
       case
         when i.produto in ('CDB', 'RDB', 'LC') or i.produto like '% com prazo/carência'
           then 'CDB/RDB/LC: o tipo foi para "com prazo/carência" (Risco Baixo, só no vencimento). Se o papel tem liquidez diária, troque o tipo do item para "com liquidez diária".'
         when i.produto = 'Tesouro Selic'
           then 'Tesouro Selic: passa ao degrau Risco Soberano. Conferir o item.'
         when i.produto = 'COE'
           then 'COE: revisão obrigatória por item (a classe é a do conteúdo do papel).'
         when i.produto in ('CRA', 'CRI', 'Debêntures')
           then 'Crédito privado: classe padrão Médio-Baixo; ajustar no item pelo rating do papel.'
         when i.produto = 'Outros'
           then 'Outros: produto genérico sem classe; classificar o risco no item.'
         else 'Tipo sem liquidez no catálogo (ou não encontrado no catálogo): confirmar a liquidez.'
       end                                      as motivo_da_revisao
  from itens i
  left join public.clientes c
         on c.id = i.cliente_id
  left join lateral (
         select t.nome, t.liquidez
           from public.tipos_produtos_investimento t
          where t.id::text = i.item ->> 'tipo_produto'
             or t.nome = i.produto
          order by case when t.id::text = i.item ->> 'tipo_produto' then 0 else 1 end
          limit 1
       ) cat on true
 where i.produto in ('CDB', 'RDB', 'LC', 'Tesouro Selic', 'COE', 'CRA', 'CRI', 'Debêntures', 'Outros')
    or i.produto like '% com prazo/carência'
    or cat.liquidez is null
 order by c.nome, i.link_unico, i.produto;
