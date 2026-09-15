# TESTES — Investimentos v3 (9 degraus de risco, teste de perfil novo, selo da reserva)

Roteiro para o dono conferir a rodada "Investimentos v3" sem precisar ler código. Tem três partes:

1. **Rodar o SQL** (`diagnostico/sql/investimentos-v3.sql`) e o que muda antes × depois.
2. **Conferência automática no console** com os casos de `testes/investimentos-casos.json`.
3. **Roteiro manual** na tela, caso a caso, com os valores a digitar e o resultado esperado,
   inclusive a memória de cálculo feita à mão pelas regras da seção 4.5 do desenho
   (`DESIGN-investimentos-v3.md`, regras 3.0.0).

As frases de limitante e destrava, as linhas do card e as linhas da memória de cálculo mostradas
aqui são exatamente as que o motor escreve (regras 3.0.0), na mesma ordem.

---

## 0. Régua e tabelas usadas nas contas

**Régua da nota (0 a 100) → perfil de investidor** (valor exato, sem arredondar antes):

| nota | perfil |
|---|---|
| menor que 15 | 1 Ultra-Conservador |
| 15 a menos de 30 | 2 Conservador |
| 30 a menos de 45 | 3 Conservador-Moderado |
| 45 a menos de 60 | 4 Moderado |
| 60 a menos de 75 | 5 Moderado-Arrojado |
| 75 a menos de 95 | 6 Arrojado |
| 95 ou mais | 7 Ultra-Arrojado |

**Notas:**
- Preferências (A) = (A3 + A4 + A5 + A6 efetivo + A7 + A8 + A9 + A10) × 100 / 32.
- Conhecimento (C) = (C1 + C2 efetivo + C3 + C4 + C5 + nota C6) × 100 / 24, com nota C6 = acertos / 2.
- Capacidade (B) = (reserva + dívida + fonte + poupança + colchão) × 5.
  - reserva R0..R4 = 0..4;
  - dívida: Perfil 1 = 0, 2C = 1, 2B = 2, 2A = 3, sem dívida (perfis 3 a 8) = 4;
  - fonte F1 = 4, F2 = 3, F3 = 2;
  - poupança P1 = 4, P2 = 3, P3 = 2, P4 = 0;
  - colchão = investimentos ÷ renda mensal: ≥ 60 = 4, ≥ 24 = 3, ≥ 12 = 2, ≥ 6 = 1, menor = 0.
- Perfil = menor das três notas pela régua → tetos (A1, A2, B3) → travas (T1, T2, T5). Vale o
  mais baixo.

**Gabarito do C6** (só aqui e no código, nunca na tela do cliente):
1 F · 2 F · 3 F · 4 V · 5 F · 6 V · 7 F · 8 V.

**Tetos:** A1 "Posso precisar de tudo a qualquer momento" → 2 · "Grande parte em até 2 anos" → 3 ·
"Uma parte em até 2 anos" → 4 · "Só entre 2 e 5 anos" → 6 · "Sem retirada prevista em 5+ anos" →
sem teto. A2 "Preservar" → 2 · "Renda estável" → 4 · demais → sem teto. B3 "Sim, em até 2 anos" → 3.

**Travas:** T1 reserva R0 → 1 · T2 reserva R1, R2 ou R3 → 3 · T5 dívidas pagáveis → 1 (e dívidas
impagáveis sem capacidade de poupar → 1).

**Selo da reserva:** reserva válida ≥ alvo → **Adequada**; senão, se o valor em investimentos do
degrau Médio-Baixo para cima passar de 10% do alvo → **Inadequada**; senão → **Em formação**.
"Reserva válida" = itens marcados como reserva que estão num degrau aceito (Soberano, Muito Baixo,
ou Baixo com liquidez D0/D1; Baixo sem liquidez informada conta, com pendência).

---

## 1. SQL — como rodar e o que muda

### 1.1 Passo a passo

1. Abra o Supabase do projeto → menu **SQL Editor** → **New query**.
2. Abra o arquivo `diagnostico/sql/investimentos-v3.sql`, copie **tudo** e cole no editor.
3. Clique em **Run**. Deve terminar sem erro. (Se der erro, nada é gravado: a parte que altera
   está entre `begin;` e `commit;`.)
4. O editor mostra o resultado só do último relatório (lista de revisão manual). Para ver os outros,
   selecione com o mouse só o bloco do relatório (6a, 6b ou 6c) e clique em **Run** de novo.
5. Na tela do diagnóstico novo que estiver aberta, recarregue a página (F5).

Rodar o arquivo duas vezes não estraga nada: na segunda vez ele não encontra nada para mudar.

### 1.2 O que conferir nos relatórios

- **6a — catálogo:** 46 produtos (os 43 de hoje + "CDB com liquidez diária", "RDB com liquidez
  diária", "LC com liquidez diária"). "CDB", "RDB" e "LC" não existem mais com esse nome: viraram
  "… com prazo/carência". A coluna `classe_antiga_escala_7` continua exatamente como antes.
- **6b — sem classe ou sem liquidez:** só **Outros** (de propósito: o risco é definido no item).
- **6c — colunas:** 5 linhas (`classe_risco`, `elegivel`, `liquidez`, `revisao_item` no catálogo e
  `suitability_v3` no diagnóstico).
- **6d — revisão manual:** itens já salvos em diagnósticos que pedem um olhar seu, com o nome do
  cliente, o link do diagnóstico, o valor e o motivo: CDB/RDB/LC (foram para "com prazo" — se o
  papel tem liquidez diária, troque o tipo do item), Tesouro Selic (vira Soberano), COE, CRA, CRI,
  Debêntures, Outros e itens cujo tipo não tem liquidez no catálogo. Se o 6d parar com o erro
  "invalid input syntax for type json", algum diagnóstico tem o texto dos investimentos corrompido;
  a migração já foi gravada mesmo assim (o relatório fica depois do `commit;`).

### 1.3 Antes × depois do SQL (a tela nova funciona nos dois)

| | Antes de rodar o SQL | Depois de rodar o SQL |
|---|---|---|
| Classe de risco do investimento | traduzida da coluna antiga (7 classes). Tesouro Selic aparece como **Risco Muito Baixo**; Ações como **Risco Médio-Alto** | vem da coluna nova (9 degraus). Tesouro Selic = **Risco Soberano**; Ações = **Risco Alto** |
| Liquidez do investimento | não aparece; item marcado como reserva no degrau Baixo conta e gera a pendência "confirmar liquidez" | aparece no card do item (ex.: "1 dia útil") |
| Tela de tipos de produto | só os campos antigos + aviso "Classe de 9 degraus, liquidez e elegível ficam disponíveis depois de rodar o SQL investimentos-v3" | campos novos: Classe de risco (9 degraus), Liquidez, Elegível para a matriz, Revisão obrigatória por item |
| CDB / RDB / LC | um tipo só ("CDB") | dois tipos: "com prazo/carência" e "com liquidez diária" |
| Teste de perfil novo | dá para responder e o perfil é calculado, mas **não salva** (faixa amarela: "A coluna do teste novo ainda não foi criada no banco…") | salva junto com o diagnóstico |
| Outros / COE | seguem a classe antiga | pedem classe (Outros) ou confirmação da classe (COE) no próprio item |
| Tela antiga (raiz), ficha do cliente, ferramenta Patrimônio | igual a hoje | **igual a hoje** (a coluna antiga não foi tocada) |

**Nos casos B, C e D abaixo o resultado é o mesmo antes e depois do SQL** (só mudam os rótulos de
classe citados na tabela). A diferença prática: antes do SQL o teste novo não fica salvo — se
recarregar a página, as respostas somem.

### 1.4 Como saber se o SQL já foi rodado

Na página do diagnóstico novo, com um diagnóstico aberto, F12 → Console → digite
`window.SUITABILITY_V3_COLUNA_OK`. `true` = já rodou; `false` = ainda não.

---

## 2. Conferência automática no console

Na página do diagnóstico novo (`/diagnostico/diagnostico-financeiro.html`, com qualquer diagnóstico
aberto), F12 → Console, cole e tecle Enter:

```js
fetch('testes/investimentos-casos.json').then(r => r.json()).then(({ casos }) => {
  const norm = s => String(s).toUpperCase().replace(/^(TRAVA|TETO|NOTA)[_\s-]*/, '').replace(/[^A-Z0-9]/g, '');
  const PALAVRA = { T1: 't1', T2: 't2', T5: 't5', B3: 'b3', A1: 'a1', A2: 'a2', C: 'conhecimento', B: 'capacidade', A: 'prefer' };
  casos.forEach(c => {
    const e = c.esperado;
    const erros = [];
    if (!c.dados) {
      const t = RiscosV3.autoteste();
      if (!t.every(x => x.ok)) erros.push({ autoteste: t.filter(x => !x.ok) });
      ['1', '2', '3', '4', '5', '6', '7'].forEach((id, k) => {
        const soma = RiscosV3.ORDEM.reduce((s, cl) => s + RiscosV3.MATRIZ[cl][k], 0);
        if (soma !== e.somas_colunas[k]) erros.push('perfil ' + id + ' soma ' + soma);
        if (RiscosV3.andarSeguranca(id) !== e.andar_seguranca[k]) erros.push('andar do perfil ' + id + ' = ' + RiscosV3.andarSeguranca(id));
      });
      console.log(erros.length ? 'ERRO' : 'OK  ', c.id, c.nome, erros.length ? erros : '');
      return;
    }
    const r = PerfilFinanceiro.calcular(c.dados);
    const pf = r.perfil_financeiro || {};
    const pi = r.perfil_investidor || {};
    const obtido = {
      perfil_financeiro: pf.calculado,
      codigo: r.codigo_matriz && r.codigo_matriz.codigo,
      reserva_R: r.codigo_matriz && r.codigo_matriz.por_posicao.reserva.valor,
      reserva_selo: pf.reserva_selo ? pf.reserva_selo.calculado : undefined,
      nota_B: pi.domicilio ? pi.domicilio.nota_B : undefined
    };
    Object.keys(obtido).forEach(k => {
      if (k in e && obtido[k] !== e[k]) erros.push(k + ': esperado ' + JSON.stringify(e[k]) + ', obtido ' + JSON.stringify(obtido[k]));
    });
    Object.keys(e.por_pessoa || {}).forEach(nome => {
      const esp = e.por_pessoa[nome];
      const p = (pi.por_pessoa || {})[nome];
      if (!p) { erros.push('sem por_pessoa de ' + nome); return; }
      if (p.calculado !== esp.calculado) erros.push(nome + ' calculado: esperado ' + esp.calculado + ', obtido ' + p.calculado);
      if ('ajustado' in esp && p.ajustado !== esp.ajustado) erros.push(nome + ' ajustado: esperado ' + esp.ajustado + ', obtido ' + p.ajustado);
      const lim = p.limitante || {};
      const tipos = (lim.tipos || []).map(norm).sort().join(',');
      const tiposEsp = esp.limitante_tipos.map(norm).sort().join(',');
      const textoLim = JSON.stringify(lim).toLowerCase();
      const limOk = tipos === tiposEsp || esp.limitante_tipos.every(t => textoLim.indexOf(PALAVRA[norm(t)] || norm(t).toLowerCase()) !== -1);
      if (!limOk) erros.push(nome + ' limitante: esperado ' + esp.limitante_tipos + ', obtido ' + JSON.stringify(lim));
      if (esp.destrava_contem && String(p.destrava || '').indexOf(esp.destrava_contem) === -1) erros.push(nome + ' destrava: esperado conter "' + esp.destrava_contem + '", obtido "' + p.destrava + '"');
    });
    console.log(erros.length ? 'ERRO' : 'OK  ', c.id, c.nome, erros.length ? erros : '');
    (pi.pessoas_ordem || []).forEach(n => {
      const linhas = ((pi.por_pessoa[n] || {}).memoria_calculo || {}).linhas || [];
      console.log('--- ' + c.id + ' / ' + n + '\n' + linhas.join('\n'));
    });
  });
});
```

Esperado: seis linhas começando por `OK`, cada uma seguida da memória de cálculo de cada pessoa
(compare com as memórias deste documento). O `calcular` não depende do SQL: os casos trazem as
classes novas dentro dos próprios dados, então o resultado no console é o mesmo antes e depois.

O que o script confere em cada caso: perfil financeiro calculado, código da matriz, posição R,
selo da reserva, nota B do domicílio e, por pessoa, perfil de investidor calculado, limitante e
destrava.

---

## Caso A — diagnóstico antigo (Helena e Marcos Tavares)

**Para que serve.** Garantir que um diagnóstico salvo antes desta rodada abre sem erro: itens com
a classe gravada nos três vocabulários antigos, teste de perfil respondido no formato antigo e
nenhuma resposta do teste novo. O perfil financeiro sai normal; o perfil de investidor fica
**incalculável**, com a lista do que falta.

### Dados (base: Caso 6 do `TESTES-perfil.md`, com outro patrimônio líquido)

Pessoas, patrimônio físico, receitas, despesas, proteção, IR, objetivos e complementares: **iguais
ao Caso 6 do `TESTES-perfil.md`**. Patrimônio líquido (classe gravada no item, como a tela antiga
deixou):

| # | produto | valor | classe gravada | vocabulário | lida como | finalidade | aporte | donos | reserva |
|---|---|---|---|---|---|---|---|---|---|
| 1 | CDB | 160.000 | `RISCO_BAIXO_GARANTIA_FGC` | "com GARANTIA" | Risco Baixo | Reserva de Emergência | — | Helena e Marcos | sim |
| 2 | CRA | 80.000 | `RISCO_BAIXO_SEM_GARANTIA` | escala de 10 | Risco Médio-Baixo | Reserva para Objetivos | 2.000/mês | Helena e Marcos | não |
| 3 | Previdência PGBL | 100.000 | `RISCO_MEDIO_ALTO` | escala de 7 | Risco Médio-Alto | Aposentadoria | 1.500/mês | Helena | não |
| 4 | Ações | 90.000 | `RISCO_ALTO_SEM_GARANTIA` | "com GARANTIA" | Risco Alto | Reserva para Objetivos | 12.000/ano | Marcos | não |

Teste antigo (`respostas_suitability`) preenchido para os dois; `suitability_v3` vazio.

**Na tela:** o caso não se digita (a tela nova não grava vocabulário antigo). Para ver ao vivo,
abra no formato novo qualquer diagnóstico antigo com investimentos — a lista 6d do SQL mostra quais
são. O que deve acontecer: abre sem erro; o teste novo aparece com o aviso "Há respostas do teste
antigo (formato anterior). Elas continuam guardadas, mas não valem para o perfil novo: responda o
teste abaixo."; o perfil de investidor de cada pessoa aparece como incalculável.

### Memória de cálculo

Perfil financeiro (mesmas contas do Caso 6 do `TESTES-perfil.md`; só o patrimônio líquido muda):
- Renda média 20.000; aportes 2.000 + 1.500 + 12.000/12 = 4.500.
- Guarda: CDB (Baixo) é guarda; CRA (Médio-Baixo), PGBL (Médio-Alto) e Ações (Alto) não. O CRA tem
  aporte → **investe recorrentemente = sim**. Amarras P8 todas sim → **8 Investidor-Planejador**.
- Matriz: D · T3 · M1 · P1 (35,5%) · F1 · patrimônio: físico 680.000 / (680.000 + 430.000) = 61,3%
  → **B3**.
- Reserva: o CDB está no degrau Baixo e **sem liquidez informada** → conta como reserva (legado) e
  gera pendência. Reserva 160.000; alvo 156.000 (Helena 5 × 12.000 + Marcos 12 × 8.000);
  160.000 / 156.000 = 103% → **R4**.
- Código **`D-T3-M1-P1-F1-B3-R4`**.

Selo: reserva 160.000 ≥ alvo 156.000 → **Adequada**.

Capacidade (domicílio): R4 = 4 · sem dívida = 4 · F1 = 4 · P1 = 4 · colchão 430.000 / 20.000 =
21,5 rendas = 2 → soma 18 → **nota B = 90**.

Perfil de investidor, por pessoa: nenhuma resposta do teste novo → **incalculável**.

### Resultado esperado

- Card do perfil financeiro: **8 - Investidor-Planejador**, matriz `D-T3-M1-P1-F1-B3-R4`.
- Selo: **Reserva de emergência: Adequada**.
- Perfil de investidor: Helena — incalculável; Marcos — incalculável. Memória de cada um (igual
  para os dois):
  ```
  Preferências de risco... — (A3-A10: faltam respostas)
  Conhecimento............ — (C1-C6: faltam respostas)
  Capacidade.............. 90/100 → Arrojado          (R4=4 · sem dívida=4 · F1=4 · P1=4 · colchão=2)
  Teto de liquidez........ — (responder A1)
  Teto de finalidade...... — (responder A2)
  Necessidade futura...... — (responder B3)
  ──────────────────────────────
  Menor das notas → —
  PERFIL FINAL: INCALCULÁVEL
  FALTAM: responder A1, A2, A3, A4, A5, A6, A7, A8, A9, A10, C1, C2, C3, C4, C5, C6 (8 afirmações); Teste de perfil: responder B3 (necessidade futura de recursos)
  ```
- Pendências (não bloqueiam o salvar):
  - Perfil de investidor — Helena Tavares: responder A1 … C6.
  - Perfil de investidor — Marcos Tavares: responder A1 … C6.
  - Perfil de investidor — domicílio: "Teste de perfil: responder B3 (necessidade futura de recursos)".
  - Perfil de investidor — domicílio: "Teste de perfil: cliente ainda não confirmou receitas e patrimônio (B1/B2)".
  - Investimentos: "Confirmar liquidez não informada de «CDB» (conta como reserva até lá)".
- O perfil financeiro **não** fica incalculável por causa dessas pendências.
- `respostas_suitability` (teste antigo) sai do salvamento exatamente como entrou.

---

## Caso B — Bruno Carvalho: Ultra-Conservador pela trava T1

**História.** Bruno, 28, solteiro, R$ 5.000 na CLT. Tem R$ 150.000 em ações e diz que "as ações
são a reserva de emergência". Responde o teste com apetite alto e conhece bem o mercado. Como
ações não valem como reserva, a reserva de verdade é zero (R0): a trava T1 manda para
Ultra-Conservador até ele formar a reserva.

### Valores a digitar

Tudo **igual ao Caso 5 do `TESTES-perfil.md`** (Bruno Carvalho), com uma única diferença no
**patrimônio líquido**: em vez da poupança de R$ 800, um item só:

| campo | valor |
|---|---|
| Tipo de produto | **Ações** |
| Valor atual | `R$ 150.000` |
| Finalidade | `Reserva de Emergência` |
| Aporte | `R$ 0` / `Nenhum` |
| Dono | Bruno Carvalho |
| Faz parte da reserva de emergência | **marcado** |

Ao marcar a reserva, ao lado deve aparecer: **"não conta como reserva: degrau acima de Baixo (Risco
Alto)"** (antes do SQL: "(Risco Médio-Alto)").

**Teste de perfil novo — Bruno Carvalho:**

| pergunta | resposta | pontos |
|---|---|---|
| A1 | Sem retirada prevista em 5+ anos | teto: nenhum |
| A2 | Multiplicar aceitando risco | teto: nenhum |
| A3 | Não mexo e me incomoda pouco | 3 |
| A4 | Máximo crescimento com oscilação forte | 4 |
| A5 | Provável R$ 19 mil, piso R$ 8 mil | 3 |
| A6 | Vivi e comprei mais | 4 |
| A7 | O necessário, com a tese de pé | 4 |
| A8 | Discordo | 3 |
| A9 | Acima de 50% | 4 |
| A10 | Vejo oportunidade | 4 |
| C1 | ações/FIIs e formação de preço | 4 |
| C2 | ações/FIIs e formação de preço | 4 |
| C3 | mensalmente há 2+ anos | 3 |
| C4 | até 50% | 3 |
| C5 | estudo por conta própria | 2 |
| C6 | F, F, F, V, F, V, F, V (todas certas) | 8 acertos |

**Bloco B (domicílio):** marcar "Confirmo que estes dados refletem minha situação" (resumo: renda
R$ 5.000 · patrimônio líquido R$ 150.000 · físico R$ 30.000). B3: **Não prevista**.

### Memória de cálculo

Perfil financeiro (contas do Caso 5, trocando o patrimônio líquido):
- Sobra estrutural 950 (19%) > 150 e há gastos opcionais; sobra real −300; sem aporte → nem
  investidor nem poupador → **4 Zero a Zero Opcional** (igual ao Caso 5).
- Reserva: o único item marcado é Ações, degrau Alto (acima de Baixo) → **desconsiderado**.
  Reserva válida = 0.
- Matriz: A · T1 (37 anos) · M2 · P4 (0%) · F2 · patrimônio: 30.000 / (30.000 + 150.000) = 16,7% →
  **B1** · alvo = (6 F2 + 0 dependentes + 0 T1 + 1 M2 + 1 P4 + 0 B1) = 8 meses × 5.000 = 40.000;
  reserva 0 → **R0**.
- Código **`A-T1-M2-P4-F2-B1-R0`**.

Selo: reserva 0 < alvo 40.000; investimentos do Médio-Baixo para cima = 150.000 > 10% do alvo
(4.000) → **Inadequada**. (Falta 40.000; item desconsiderado: Ações, R$ 150.000.)

Notas:
- **A** = 3 + 4 + 3 + 4 + 4 + 3 + 4 + 4 = 29 → 29 × 100 / 32 = **90,6** → Arrojado. A6 = 4 vale:
  Bruno tem Ações (degrau 7 ≥ 6).
- **C** = 4 + 4 + 3 + 3 + 2 + (8/2 = 4) = 20 → 20 × 100 / 24 = **83,3** → Arrojado. C2 = 4 vale:
  Ações comprova nível 4.
- **B** = R0 = 0 · sem dívida = 4 (perfil 4 é de fluxo) · F2 = 3 · P4 = 0 · colchão 150.000 / 5.000
  = 30 rendas = 3 → soma 10 → **50** → Moderado.
- Menor nota = 50 → **Moderado (4)**.
- Tetos: A1 e A2 sem teto; B3 não prevista → sem efeito.
- Travas: **T1 (R0) → 1**. T5 não se aplica (perfil financeiro 4).
- Final = mínimo(4, 1) = **1 Ultra-Conservador**. Limitante: T1. Destrava: sem a T1, o menor nível
  restante é 4 (nota B) → "ao formar a reserva imediata (sair de R0), sobe para Moderado".

### Resultado esperado

- Card do perfil financeiro: **4 - Zero a Zero Opcional**, matriz `A-T1-M2-P4-F2-B1-R0`.
- Selo: **Reserva de emergência: Inadequada**.
- Perfil de investidor: **Bruno Carvalho: Ultra-Conservador — limitante: trava T1 — sem reserva imediata**.
- Memória de cálculo (`<pre>` abaixo do teste e no relatório):
  ```
  Preferências de risco... 91/100 → Arrojado          (A3-A10: 29/32)
  Conhecimento............ 83/100 → Arrojado          (C1-C6: 20/24)
  Capacidade.............. 50/100 → Moderado          (R0=0 · sem dívida=4 · F2=3 · P4=0 · colchão=3)
  Teto de liquidez........ sem teto
  Teto de finalidade...... sem teto
  Necessidade futura...... sem efeito
  ──────────────────────────────
  Menor das notas → Moderado
  C6: 8/8 acertos = 4
  Trava T1 (reserva em R0) → teto ULTRA-CONSERVADOR
  PERFIL FINAL: ULTRA-CONSERVADOR
  LIMITANTE: trava T1 — sem reserva imediata
  DESTRAVA: ao formar a reserva imediata (sair de R0), sobe para Moderado
  ```
- Pendências: nenhuma do perfil de investidor.
- Comparativo ideal × atual (patrimônio líquido): alocação ideal pelo perfil Ultra-Conservador de
  Bruno Carvalho (Soberano 80% · Muito Baixo 20%); atual 100% no degrau Alto; **Andar de segurança
  (Soberano + Muito Baixo)**: ideal 100%, atual 0%.

---

## Caso C — Helena e Marcos Tavares: o conhecimento segura Helena

**História.** O casal do Caso 6, agora com a reserva completa no Tesouro Selic. Helena topa
risco, mas conhece pouco de investimentos: é o conhecimento que segura o perfil dela. Marcos
conhece bem e topa risco, mas sabe que vai precisar de parte do dinheiro em até 2 anos: o teto de
liquidez (A1) segura o dele.

### Valores a digitar

Tudo **igual ao Caso 6 do `TESTES-perfil.md`**, trocando o **patrimônio líquido** por:

| # | tipo de produto | valor | finalidade | aporte | donos | reserva |
|---|---|---|---|---|---|---|
| 1 | Tesouro Selic | `R$ 160.000` | Reserva de Emergência | 0 / Nenhum | Helena e Marcos | **marcado** |
| 2 | Fundo Multimercado | `R$ 100.000` | Reserva para Objetivos | `R$ 2.000` / Mensal | Helena e Marcos | desmarcado |
| 3 | PGBL | `R$ 80.000` | Aposentadoria | `R$ 1.500` / Mensal | Helena | desmarcado |
| 4 | Ações | `R$ 90.000` | Reserva para Objetivos | `R$ 12.000` / **Anual** | Marcos | desmarcado |

**Teste de perfil novo:**

| pergunta | Helena Tavares | pts | Marcos Tavares | pts |
|---|---|---|---|---|
| A1 | Sem retirada prevista em 5+ anos | — | **Uma parte em até 2 anos** | teto 4 |
| A2 | Acumular para objetivos de longo prazo | — | Acumular para objetivos de longo prazo | — |
| A3 | Compro mais | 4 | Compro mais | 4 |
| A4 | Crescer aceitando anos ruins | 3 | Máximo crescimento com oscilação forte | 4 |
| A5 | Provável R$ 19 mil, piso R$ 8 mil | 3 | Provável R$ 19 mil, piso R$ 8 mil | 3 |
| A6 | Vivi e travei | 2 | Vivi e comprei mais | 4 |
| A7 | O necessário, com a tese de pé | 4 | 1-2 anos | 3 |
| A8 | Discordo | 3 | Discordo | 3 |
| A9 | Até 50% | 3 | Até 50% | 3 |
| A10 | Vejo oportunidade | 4 | Mantenho o plano | 3 |
| C1 | Tesouro e a diferença Selic × IPCA+ | 2 | ações/FIIs e formação de preço | 4 |
| C2 | Tesouro e a diferença Selic × IPCA+ | 2 | ações/FIIs e formação de preço | 4 |
| C3 | opera há menos de 1 ano | 1 | mensalmente há 2+ anos | 3 |
| C4 | até 10% | 1 | até 25% | 2 |
| C5 | nenhuma | 0 | estudo por conta própria | 2 |
| C6 | **V**, F, F, V, F, **F**, F, V | 6 acertos | F, F, F, V, F, V, F, V | 8 acertos |

(No C6 de Helena, as afirmações 1 e 6 estão erradas.)

**Bloco B:** confirmar os dados (renda R$ 20.000 · patrimônio líquido R$ 430.000 · físico
R$ 680.000). B3: **Não prevista**.

### Memória de cálculo

Perfil financeiro:
- Mesmos números de fluxo do Caso 6 (renda 20.000, aportes 4.500, amarras P8 todas sim); Fundo
  (Médio) com aporte → investe recorrentemente → **8 Investidor-Planejador**.
- Patrimônio: 680.000 / (680.000 + 430.000) = 61,3% → **B3**. Poupança 35,5% → **P1**.
- Reserva: Tesouro Selic (Soberano) marcado → vale. 160.000 / 156.000 = 103% → **R4**.
- Código **`D-T3-M1-P1-F1-B3-R4`**.

Selo: reserva 160.000 ≥ alvo 156.000 → **Adequada**.

Capacidade (vale para os dois): R4 = 4 · sem dívida = 4 · F1 = 4 · P1 = 4 · colchão 430.000 /
20.000 = 21,5 rendas = 2 → soma 18 → **B = 90** → Arrojado. Travas: nenhuma (R4, perfil 8).

**Helena Tavares**
- A = 4 + 3 + 3 + 2 + 4 + 3 + 3 + 4 = 26 → 26 × 100 / 32 = **81,25** → Arrojado.
- C = 2 + 2 + 1 + 1 + 0 + (6/2 = 3) = 9 → 9 × 100 / 24 = **37,5** → Conservador-Moderado.
  Verificação do C2: Helena é dona de Tesouro (nível 2), Fundo Multimercado e PGBL (nível 3) →
  comprova 3; declarou 2 → vale 2 (sem redução).
- Menor nota = 37,5 → **3**. Sem tetos, sem travas → **final 3 Conservador-Moderado**.
- Limitante: nota de conhecimento. Destrava: sem a nota C, o menor restante é 6 (A e B) → "com
  conhecimento ≥ 75, sobe para Arrojado".

**Marcos Tavares**
- A = 4 + 4 + 3 + 4 + 3 + 3 + 3 + 3 = 27 → **84,4** → Arrojado. A6 = 4 vale (dono de Ações).
- C = 4 + 4 + 3 + 2 + 2 + 4 = 19 → **79,2** → Arrojado. C2 = 4 vale (Ações comprova 4).
- Menor nota = 79,2 → 6. **Teto A1 ("Uma parte em até 2 anos") → 4**. Sem travas → **final 4
  Moderado**.
- Limitante: teto de liquidez (A1). Destrava: sem o teto, o menor restante é 6 → "com horizonte de
  retirada mais longo (A1), sobe para Arrojado".

### Resultado esperado

- Card do perfil financeiro: **8 - Investidor-Planejador**, matriz `D-T3-M1-P1-F1-B3-R4`.
- Selo: **Reserva de emergência: Adequada**.
- Perfil de investidor (dois blocos no card, Helena primeiro):
  - **Helena Tavares: Conservador-Moderado — limitante: nota C — conhecimento**
  - **Marcos Tavares: Moderado — limitante: teto A1 — horizonte de retirada: Uma parte em até 2 anos**
- Memória — Helena:
  ```
  Preferências de risco... 81/100 → Arrojado          (A3-A10: 26/32)
  Conhecimento............ 38/100 → Conservador-Moderado (C1-C6: 9/24)
  Capacidade.............. 90/100 → Arrojado          (R4=4 · sem dívida=4 · F1=4 · P1=4 · colchão=2)
  Teto de liquidez........ sem teto
  Teto de finalidade...... sem teto
  Necessidade futura...... sem efeito
  ──────────────────────────────
  Menor das notas → Conservador-Moderado
  C6: 6/8 acertos = 3
  PERFIL FINAL: CONSERVADOR-MODERADO
  LIMITANTE: nota C — conhecimento
  DESTRAVA: com conhecimento ≥ 75, sobe para Arrojado
  ```
  (37,5 arredonda para 38 na tela; a régua usa 37,5.)
- Memória — Marcos:
  ```
  Preferências de risco... 84/100 → Arrojado          (A3-A10: 27/32)
  Conhecimento............ 79/100 → Arrojado          (C1-C6: 19/24)
  Capacidade.............. 90/100 → Arrojado          (R4=4 · sem dívida=4 · F1=4 · P1=4 · colchão=2)
  Teto de liquidez........ teto Moderado (A1: Uma parte em até 2 anos)
  Teto de finalidade...... sem teto
  Necessidade futura...... sem efeito
  ──────────────────────────────
  Menor das notas → Arrojado
  Teto A1 (horizonte de retirada: Uma parte em até 2 anos) → teto MODERADO
  C6: 8/8 acertos = 4
  PERFIL FINAL: MODERADO
  LIMITANTE: teto A1 — horizonte de retirada: Uma parte em até 2 anos
  DESTRAVA: com horizonte de retirada mais longo (A1), sobe para Arrojado
  ```
- Comparativo ideal × atual: o item conjunto (Tesouro Selic + Fundo, donos Helena e Marcos) usa o
  perfil mais restritivo dos donos → legenda "Alocação ideal pelo perfil de Helena Tavares, o mais
  restritivo dos donos (Conservador-Moderado)".

---

## Caso D — Helena e Marcos Tavares: selo Inadequada e trava T2

**História.** O casal do Caso 6 original (reserva de R$ 60.000 no Tesouro Selic), mas Marcos
marcou as ações também como "reserva de emergência". Ações não valem como reserva: a reserva fica
em R2 (incompleta), o selo sai **Inadequada** (dinheiro exposto a mercado bem acima de 10% do alvo)
e a trava T2 segura os dois em Conservador-Moderado.

### Valores a digitar

Tudo **igual ao Caso 6 do `TESTES-perfil.md`**, com este **patrimônio líquido**:

| # | tipo de produto | valor | finalidade | aporte | donos | reserva |
|---|---|---|---|---|---|---|
| 1 | Tesouro Selic | `R$ 60.000` | Reserva de Emergência | 0 / Nenhum | Helena e Marcos | **marcado** |
| 2 | Fundo Multimercado | `R$ 210.000` | Reserva para Objetivos | `R$ 2.000` / Mensal | Helena e Marcos | desmarcado |
| 3 | PGBL | `R$ 200.000` | Aposentadoria | `R$ 1.500` / Mensal | Helena | desmarcado |
| 4 | Ações | `R$ 90.000` | Reserva para Objetivos | `R$ 12.000` / **Anual** | Marcos | **marcado** |

No item 4 deve aparecer "não conta como reserva: degrau acima de Baixo (Risco Alto)".

**Teste de perfil novo:** Marcos igual ao Caso C. Helena:

| pergunta | Helena Tavares | pts |
|---|---|---|
| A1 | Sem retirada prevista em 5+ anos | — |
| A2 | Acumular para objetivos de longo prazo | — |
| A3 | Compro mais | 4 |
| A4 | Crescer aceitando anos ruins | 3 |
| A5 | Provável R$ 19 mil, piso R$ 8 mil | 3 |
| A6 | **Vivi e comprei mais** | 4 (vale 2) |
| A7 | O necessário, com a tese de pé | 4 |
| A8 | Discordo | 3 |
| A9 | Até 50% | 3 |
| A10 | Vejo oportunidade | 4 |
| C1 | ações/FIIs e formação de preço | 4 |
| C2 | **ações/FIIs e formação de preço** | 4 (vale 3) |
| C3 | mensalmente há 2+ anos | 3 |
| C4 | até 50% | 3 |
| C5 | estudo por conta própria | 2 |
| C6 | F, F, F, V, F, V, F, V | 8 acertos |

**Bloco B:** confirmar (renda R$ 20.000 · patrimônio líquido R$ 560.000 · físico R$ 680.000). B3:
**Não prevista**.

### Memória de cálculo

Perfil financeiro:
- Fluxo igual ao Caso 6 → **8 Investidor-Planejador**.
- Patrimônio: 680.000 / (680.000 + 560.000) = 54,8% → **B3**. P1. Alvo 156.000.
- Reserva: Tesouro Selic vale (60.000); Ações marcadas → desconsideradas (degrau Alto).
  60.000 / 156.000 = 38,5% → **R2**.
- Código **`D-T3-M1-P1-F1-B3-R2`** (o mesmo do Caso 6).

Selo: reserva 60.000 < alvo 156.000; investimentos do Médio-Baixo para cima = Fundo 210.000 + PGBL
200.000 + Ações 90.000 = 500.000 > 15.600 (10% do alvo) → **Inadequada**. Falta 96.000; item
desconsiderado: Ações, R$ 90.000. (Mesmo contando só os itens marcados como reserva, 90.000 >
15.600: o selo é Inadequada de qualquer jeito.)

Capacidade: R2 = 2 · sem dívida = 4 · F1 = 4 · P1 = 4 · colchão 560.000 / 20.000 = 28 rendas = 3 →
soma 17 → **B = 85** → Arrojado. Trava do domicílio: **T2 (R2) → 3**.

**Helena Tavares**
- Verificação A6: declarou 4, mas Helena só é dona de Tesouro Selic (degrau 1), Fundo Multimercado
  e PGBL (degrau 5) — nada no degrau 6 ou acima → **A6 vale 2**.
- A = 4 + 3 + 3 + 2 + 4 + 3 + 3 + 4 = 26 → **81,25** → Arrojado.
- Verificação C2: declarou 4; o patrimônio dela comprova 3 (fundo/previdência) → **C2 vale 3**.
- C = 4 + 3 + 3 + 3 + 2 + 4 = 19 → **79,2** → Arrojado.
- Menor nota = 79,2 → 6. Sem tetos. **Trava T2 → 3** → **final 3 Conservador-Moderado**.
- Limitante: T2. Destrava: sem a T2, o menor restante é 6 → "ao atingir R4, sobe para Arrojado".

**Marcos Tavares**
- A = 27 → 84,4; C = 19 → 79,2; B = 85 → menor 6. Teto A1 → 4. **Trava T2 → 3** → **final 3
  Conservador-Moderado**.
- Limitante: só a T2 (o teto A1 é 4, não empata com o final 3). Destrava: sem a T2, o menor
  restante é o teto A1 = 4 → "ao atingir R4, sobe para Moderado".

### Resultado esperado

- Card do perfil financeiro: **8 - Investidor-Planejador**, matriz `D-T3-M1-P1-F1-B3-R2`.
- Selo: **Reserva de emergência: Inadequada**.
- Perfil de investidor:
  - **Helena Tavares: Conservador-Moderado — limitante: trava T2 — reserva de emergência incompleta**
  - **Marcos Tavares: Conservador-Moderado — limitante: trava T2 — reserva de emergência incompleta**
- Memória — Helena:
  ```
  Preferências de risco... 81/100 → Arrojado          (A3-A10: 26/32)
  Conhecimento............ 79/100 → Arrojado          (C1-C6: 19/24)
  Capacidade.............. 85/100 → Arrojado          (R2=2 · sem dívida=4 · F1=4 · P1=4 · colchão=3)
  Teto de liquidez........ sem teto
  Teto de finalidade...... sem teto
  Necessidade futura...... sem efeito
  ──────────────────────────────
  Menor das notas → Arrojado
  A6 declarado 4, sem ativo oscilante no patrimônio de Helena Tavares: vale 2
  C2 declarado 4, patrimônio atual comprova 3
  C6: 8/8 acertos = 4
  Trava T2 (reserva em R2) → teto CONSERVADOR-MODERADO
  PERFIL FINAL: CONSERVADOR-MODERADO
  LIMITANTE: trava T2 — reserva de emergência incompleta
  DESTRAVA: ao atingir R4, sobe para Arrojado
  ```
- Memória — Marcos:
  ```
  Preferências de risco... 84/100 → Arrojado          (A3-A10: 27/32)
  Conhecimento............ 79/100 → Arrojado          (C1-C6: 19/24)
  Capacidade.............. 85/100 → Arrojado          (R2=2 · sem dívida=4 · F1=4 · P1=4 · colchão=3)
  Teto de liquidez........ teto Moderado (A1: Uma parte em até 2 anos)
  Teto de finalidade...... sem teto
  Necessidade futura...... sem efeito
  ──────────────────────────────
  Menor das notas → Arrojado
  Teto A1 (horizonte de retirada: Uma parte em até 2 anos) → teto MODERADO
  C6: 8/8 acertos = 4
  Trava T2 (reserva em R2) → teto CONSERVADOR-MODERADO
  PERFIL FINAL: CONSERVADOR-MODERADO
  LIMITANTE: trava T2 — reserva de emergência incompleta
  DESTRAVA: ao atingir R4, sobe para Moderado
  ```
- Ajuste manual do selo: escolha "Adequada" no seletor do selo sem escrever justificativa e clique
  em Salvar → bloqueia com "Selo da reserva de emergência: justifique o ajuste para Adequada antes
  de salvar.". Escreva a justificativa → salva.

---

## Caso E — matriz 7 perfis × 9 classes

**Para que serve.** Garantir que a tabela de alocação ideal por perfil está íntegra.

**No console:** `RiscosV3.autoteste()` → todas as linhas com `ok: true`. O script da seção 2 também
confere, perfil a perfil, que as 9 classes somam **100** e que o andar de segurança (Soberano +
Muito Baixo) é:

| perfil | 1 | 2 | 3 | 4 | 5 | 6 | 7 |
|---|---|---|---|---|---|---|---|
| Soberano | 80 | 55 | 40 | 30 | 25 | 18 | 15 |
| Muito Baixo | 20 | 30 | 25 | 15 | 15 | 10 | 5 |
| **Andar de segurança** | **100** | **85** | **65** | **45** | **40** | **28** | **20** |
| soma das 9 classes | 100 | 100 | 100 | 100 | 100 | 100 | 100 |

---

## Caso F — ajuste do perfil de investidor para cima sem termo

**Para que serve.** O consultor pode ajustar o perfil de investidor, mas ajustar para **mais
arrojado** que o calculado exige o termo de desenquadramento colhido.

### Roteiro na tela

1. Monte o **Caso C** (ou abra-o, se já salvo). Helena calculada = **Conservador-Moderado (3)**.
2. No card do perfil, bloco de **Helena Tavares**: seletor de ajuste → **Moderado-Arrojado**.
   Deve aparecer o checkbox "Termo de desenquadramento colhido e arquivado" (só aparece porque o
   ajuste é mais arrojado que o calculado).
3. Justificativa: `Cliente pediu carteira mais arrojada`. Deixe o termo **desmarcado**. Clique em
   **Salvar** → bloqueia com:
   > Perfil de investidor de Helena Tavares: o ajuste para Moderado-Arrojado é mais arrojado que o
   > calculado (Conservador-Moderado). Marque «termo de desenquadramento colhido e arquivado» antes
   > de salvar.
4. Marque o termo e apague a justificativa. Salvar → bloqueia com:
   > Perfil de investidor de Helena Tavares: justifique o ajuste para Moderado-Arrojado antes de
   > salvar.
5. Escreva a justificativa de novo (termo marcado). Salvar → **salva**. Recarregue a página: o
   ajuste, a justificativa e o termo marcado de Helena voltam como estavam; Marcos continua sem
   ajuste.
6. Ajuste para **baixo** (ex.: Marcos → Conservador) com justificativa e sem termo → salva
   normalmente (o termo só é exigido para cima; o checkbox nem aparece).
7. Num diagnóstico com perfil de investidor **incalculável** (Caso A), escolher um ajuste não
   bloqueia o salvar.

### No console

`caso_f` do JSON é o Caso C com o ajuste de Helena preenchido (`investidor_ui`). O `calcular`
continua dando Helena **calculado = "3"** (e `ajustado = "5"`), Marcos "4". O bloqueio do salvar
não passa pelo `calcular` — confira pelo roteiro acima.

---

## Resumo

| caso | pessoas | perfil financeiro | matriz | selo | perfil de investidor | limitante |
|---|---|---|---|---|---|---|
| A | Helena / Marcos | 8 Investidor-Planejador | D-T3-M1-P1-F1-B3-R4 | Adequada | incalculável / incalculável | — |
| B | Bruno | 4 Zero a Zero Opcional | A-T1-M2-P4-F2-B1-R0 | **Inadequada** | **1 Ultra-Conservador** | trava T1 |
| C | Helena / Marcos | 8 Investidor-Planejador | D-T3-M1-P1-F1-B3-R4 | Adequada | **3** / **4** | nota C / teto A1 |
| D | Helena / Marcos | 8 Investidor-Planejador | D-T3-M1-P1-F1-B3-R2 | **Inadequada** | 3 / 3 | trava T2 / trava T2 |
| E | — | — | — | — | matriz soma 100; andar 100/85/65/45/40/28/20 | — |
| F | Helena / Marcos | 8 Investidor-Planejador | D-T3-M1-P1-F1-B3-R4 | Adequada | 3 (ajustado 5, bloqueia sem termo) / 4 | nota C / teto A1 |

Checagens rápidas que valem para qualquer caso:
- Nenhum texto da tela, do relatório ou da memória cita produto específico para comprar — só
  degraus ("degrau Soberano", "liquidez D0").
- Nome com apóstrofo (ex.: `Joana D'Arc` como titular) não quebra o teste novo.
- Abrir o mesmo diagnóstico na tela antiga (raiz) depois de salvar no formato novo: os valores do
  comparativo antigo continuam aparecendo (a classe antiga do item segue na escala de 7).
