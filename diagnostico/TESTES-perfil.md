# TESTES — Perfil Financeiro automático (Diagnóstico v2)

Roteiro de teste manual com seis clientes fictícios. Cada caso traz: a história, os valores para
digitar seção por seção, a memória de cálculo feita à mão pelas regras da seção 8 do desenho
(`DESIGN-diagnostico-v2.md`, regras v2.1.0) e o resultado esperado — o que o card mostra e o que
fica só no JSON salvo.

As listas de justificativas e de posições da matriz em "Resultado esperado no card" reproduzem as
frases que o motor (`perfil-financeiro.js`) emite de fato para os seis casos, na ordem em que
aparecem. Se a redação mudar no motor, os números continuam sendo o que importa. Convenções de
formato do motor: moeda sem centavos (`R$ 4.000`, `R$ -300`); percentual com uma casa decimal só
abaixo de 10% (`8,0%`, `0,0%`, `-6,0%`) e sem casa acima (`15%`, `23%` para 22,5%); múltiplo com
até uma casa (`3×`, `6,7×`).

O arquivo `testes/perfil-casos.json` traz os mesmos seis casos já no formato do objeto `dados`
que o motor recebe (`PerfilFinanceiro.calcular(dados)`), para conferência automática no console.

---

## 0. Antes de começar

**Data de referência:** todos os cálculos de idade usam `2026-09-10`. Na seção **Objetivos → painel
Mercado**, deixe a "Data da reunião" em `10/09/2026` (se a reunião for hoje, é o valor padrão).

**Ordem de preenchimento sugerida** (a ordem evita retrabalho, porque os selects de "De quem é",
"Dono(s)", "Responsáveis" só listam pessoas já cadastradas):

1. Dados pessoais do titular (nome, CPF qualquer válido, data de nascimento, profissão, estado civil)
   e, se houver, cônjuge. O campo novo **"Renda no mês fraco"** fica logo abaixo do e-mail; só é
   preenchido quando o caso pedir.
2. Pessoas com renda (nenhum caso usa) e Dependentes.
3. Patrimônio físico — marcar pelo menos um proprietário; nos casos abaixo "Possui seguro?" é
   **Não**, exceto onde indicado. Os dois checkboxes novos: "Imóvel único de moradia" e
   "Necessário para gerar a renda".
4. Patrimônio líquido — o que importa para o motor é o **badge de risco** que aparece no card ao
   escolher o tipo de produto (o tipo vem do cadastro do Supabase; escolha um tipo cuja
   classificação seja a indicada: Poupança/Tesouro Selic → Risco Muito Baixo; CDB → Risco Baixo;
   Fundo multimercado → Risco Médio; Previdência → Risco Médio-Alto; Ações → Risco Alto).
   Instituição: qualquer. O checkbox novo "Faz parte da reserva de emergência" fica após
   "Inventariável".
5. Dívidas — além dos campos antigos, preencher os novos: **Situação da dívida**, **Dívida
   estruturada**, **Proposta de renegociação em mãos?**, **Parcela proposta**.
6. Produtos & Proteção (só o caso 6).
7. Fluxo de caixa — receitas com "De quem é" correto (é dele que sai a renda por pessoa); despesas
   com **Categoria, Importância, Conforto, Alterável?, Disposição**. "Forma Pgto" pode ficar em
   branco. Depois de cadastrar dívidas e produtos, clique em **"Sincronizar Despesas Automáticas"**
   (ou salve e recarregue): as parcelas e os produtos aparecem como linhas automáticas.
8. Objetivos — o módulo cria sozinho "Aposentadoria de <titular>" (prazo por idade, 65 anos, renda
   anual = **12 × as receitas mensais do titular no fluxo de caixa**). Confira "De quem" = titular
   e que a renda anual bate com o valor indicado em cada caso.
9. Perfil Financeiro — no card automático, preencher os dois **dados complementares** ("Custeio da
   moradia pelo cliente" e "O cliente decide onde investir pelo objetivo?"). Não mexer no seletor
   manual (override) nem nas observações.

**Escalas (leitura única, seção 0 do desenho):** Importância 1 = "★ Mais importante" … 7 =
"Inaceitável"; cortável = importância 5, 6 ou 7. Conforto 1 = "Muito abaixo do básico" … 3 =
"Apenas básico" … 5 = "Muito acima do básico"; redução de 25% no nível 4 e 50% no nível 5, só se
"Alterável?" ≠ Não. "Disposição" é ignorada pelo método (pode escolher qualquer valor).

**Como conferir no console** (na página do diagnóstico v2, F12 → Console):

```js
fetch('testes/perfil-casos.json').then(r => r.json()).then(({ casos }) => {
  casos.forEach(c => {
    const r  = PerfilFinanceiro.calcular(c.dados);
    const pf = r.perfil_financeiro;
    const cd = pf.analise.camada_divida;
    const obtido = {
      calculado: pf.calculado,
      subtipo: cd.subtipo,
      subtipo_latente: cd.subtipo_latente,
      subjacente: pf.analise.subjacente,
      reclassificavel_apos_pesquisa: cd.reclassificavel_apos_pesquisa,
      codigo: r.codigo_matriz.codigo
    };
    const ok = Object.keys(c.esperado).every(k => obtido[k] === c.esperado[k]);
    console.log(ok ? 'OK  ' : 'ERRO', c.id, c.nome, ok ? '' : { esperado: c.esperado, obtido, faltantes: pf.faltantes });
  });
});
```

Em todos os casos **faltantes = nenhum** (card sem o bloco "Faltam N informações") e o código da
matriz sai completo (sem `?`).

**Convenções da memória de cálculo:** valores mensais; itens anuais entram como 1/12 (regra
`mensal` do motor, diferente do módulo de fluxo, que zera anuais no mês). "sob" = Sobrevivência,
"nec" = Necessidades, "aperf" = Aperfeiçoamento, "conf" = Conforto/Supérfluo, "obrig_auto" =
despesas automáticas de proteção/conta/IR. Parâmetros: piso de cobertura 90%; prazo razoável 60
meses; mínimo existencial R$ 600 por pessoa do domicílio; relevância 10% da renda em saldo OU 5%
em parcelas; piso de sobra 3%; piso de compromisso 5%.

---

## Caso 1 — Carlos Andrade: Perfil 1 pela Etapa 1 (déficit estrutural)

**História.** Carlos, 36 anos, solteiro, cria o filho Miguel sozinho. Ganha R$ 4.000 na CLT,
mora de aluguel e o essencial da casa já custa mais do que ele ganha. Tem um rotativo de cartão de
R$ 12.000 a 12% ao mês, em negociação, mas sem proposta em mãos. Nada a cortar: tudo é básico e
importante.

### Valores a digitar

**Dados pessoais:** Nome `Carlos Andrade`; nascimento `20/05/1990`; estado civil `Solteiro(a)`;
profissão `Auxiliar administrativo`; renda no mês fraco: em branco.

**Pessoas com renda:** nenhuma. **Dependentes:** `Miguel Andrade`, nascido `10/03/2016`, parentesco
`filho`, dependente do titular.

**Patrimônio físico:** tipo `Moto`, detalhes `Honda CG 160 2019`, valor `R$ 8.000`, Quitado,
proprietário Carlos, seguro Não, imóvel único de moradia **desmarcado**, gera renda **desmarcado**.

**Patrimônio líquido:** nenhum.

**Dívidas:** uma.
| campo | valor |
|---|---|
| Motivo / A quem deve | `Cartão de crédito rotativo` / `Banco Norte` |
| Valor inicial / Prazo / Parcelas pagas | `R$ 10.000` / `24` / `2` |
| Valor das parcelas | `R$ 600` |
| Saldo devedor | `R$ 12.000` |
| Taxa de juros | `12` **a.m.** |
| Situação da dívida | `Em negociação` |
| Dívida estruturada | desmarcado |
| Proposta em mãos? / Parcela proposta | `Não` / `R$ 0` |
| Quem fez | Carlos |

**Fluxo de caixa — receitas:** `Salário` R$ 4.000, CLT, 1 mês, de Carlos.

**Fluxo de caixa — despesas** (todas 1 × mês; Dono fica Carlos):
| nome | valor | tipo | categoria | import. | conforto | alterável | disposição |
|---|---|---|---|---|---|---|---|
| Aluguel | 1.500 | fixa | Sobrevivência | 1 | 3 | Não | Não quer/pode mexer |
| Alimentação | 1.200 | variável | Sobrevivência | 1 | 3 | Sim | Não quer/pode mexer |
| Energia, água e gás | 300 | fixa | Sobrevivência | 2 | 3 | Não | Não quer/pode mexer |
| Transporte | 500 | variável | Necessidades | 2 | 3 | Sim | Não quer/pode mexer |
| Escola do Miguel | 800 | fixa | Necessidades | 1 | 3 | Não | Não quer/pode mexer |
| Celular e internet | 200 | fixa | Necessidades | 3 | 3 | Sim | Não quer/pode mexer |
| Farmácia | 300 | variável | Necessidades | 2 | 3 | Não | Não quer/pode mexer |
| Lanches fora de casa | 200 | variável | Conforto/Supérfluo | 5 | 3 | Sim | Cancelaria |

Linha automática esperada após sincronizar: `Dívida: Cartão de crédito rotativo - Banco Norte`
R$ 600/mês (não é somada pelo motor — a parcela já vem do módulo de dívidas).

**Produtos & Proteção:** nenhum. **IR:** Carlos declara simplificado, renda bruta anual R$ 48.000,
resultado em branco. **Objetivos:** só a aposentadoria automática (Carlos, aos 65, renda anual
R$ 48.000). **Card — complementares:** custeio da moradia `Integral`; decide pelo objetivo
`Não informado`.

### Memória de cálculo

Pessoas e renda:
- Domicílio: Carlos + Miguel = **2 pessoas** (mínimo existencial 2 × 600 = **R$ 1.200**).
- Renda média = 4.000. Sem mês fraco → renda variável = não → **renda_base = 4.000**.

Despesas:
- sob = 1.500 + 1.200 + 300 = **3.000**; nec = 500 + 800 + 200 + 300 = **1.800**; conf = 200; obrig_auto = 0.
- **essencial_atual = 3.000 + 1.800 + 0 = 4.800**; despesas_totais = 5.000.
- Eliminação: nenhuma despesa essencial tem importância ≥ 5 → 0. Redução: nenhuma essencial com conforto 4–5 → 0.
- **essencial_otimizado = 4.800** (igual ao atual).

Dívidas:
- Não estruturada, situação "em negociação" → dívida-problema. saldo_problema = 12.000; parcelas_problema = 600 (nos dois cenários, sem proposta); parcelas_estruturadas = 0; parcelas_total = 600.
- Relevância: 12.000 ≥ 10% × 4.000 = 400 → **relevante** (também 600 ≥ 200).
- Juros mensais = 12.000 × 12% = **1.440**; taxa média = 12% a.m.
- Patrimônio vendável = moto 8.000 (quitada, não é moradia, não gera renda) + PL 0 = **8.000**.

Funil (otimizado = atual, porque nada muda):
- C1: essencial + parcelas = 4.800 + 600 = 5.400; cobertura = 4.000 / 5.400 = **74,1%**; precisa de 90% × 5.400 = 4.860 → **falha**.
- Déficit estrutural: 4.000 < 90% × 4.800 = 4.320 → **sim** (4.000 / 4.800 = 83,3% do essencial de R$ 4.800, mesmo sem parcelas). Esses 83% e o 4.800 ficam só aqui na memória: o card diz apenas que a renda não cobre 90% do essencial.
- Etapa 2 não roda. passou = false. reclassificável = !passou && !déficit = **false**.

Camada de dívida → **Perfil 1 (dívidas_impagaveis)**. subtipo = null, latente = null.

Camada de fluxo (subjacente):
- parcelas = 600; nec_reduzida = 1.800 (nada a reduzir).
- sobra_estrutural = 4.000 − (3.000 + 1.800 + 0 + 600) = **−1.400** (−35%) ≤ 3% × 4.000 = 120 → **zero_a_zero_obrigatorio** (para na regra 1).
- sobra_real = 4.000 − (5.000 + 600) = −1.600 (−40%). aportes = 0. reserva_atual = 0; micro_reserva = 0 < 0,5 × 5.600 = 2.800 → true.

Matriz:
- Dependência: sem cônjuge; dependentes-pessoa = 1 → **B**.
- Tempo: idade 36 → (65 − 36) × 12 = 348 meses = 29 anos → **T2** (≥ 20 e < 30).
- Moradia: `integral` → **M2**.
- Poupança: (proteção 0 + aperf 0 + aportes 0) / 4.000 = 0% → **P4**.
- Fonte: maior receita = Salário 4.000, tipo CLT → **F2**.
- Patrimônio: físico 8.000 / (8.000 + 0) = 100% → **B4**.
- Reserva: alvo do único earner = (6 base F2 + 1 dependentes + 0 T2 + 1 M2 + 1 P4 + 1 B4) = 10 meses × 4.000 = 40.000; reserva atual 0 → **R0**.

### Resultado esperado no card
- Rótulo: **1 - Dívidas Impagáveis** (vermelho). Perfil vigente: 1 - Dívidas Impagáveis (calculado).
- Justificativas (frases reais do motor, nesta ordem; a redação pode variar levemente, os números são o que importa):
  - Renda mensal considerada: R$ 4.000
  - Dívidas-problema: R$ 12.000 de saldo (3× a renda) e R$ 600 de parcelas (15% da renda)
  - Renda cobre 74% do essencial + parcelas (mínimo 90%)
  - Mesmo sem as parcelas, a renda não cobre 90% do essencial
- Faltantes: nenhum.
- Matriz: `B-T2-M2-P4-F2-B4-R0`, com a lista por posição:
  - B — sem parceiro com renda própria; 1 dependente
  - T2 — 29 anos até a aposentadoria aos 65 anos (titular com 36)
  - M2 — custeio integral da moradia
  - P4 — poder de poupança = 0,0% da renda (proteção R$ 0 + aperfeiçoamento R$ 0 + aportes R$ 0)
  - F2 — maior receita: Salário (clt) R$ 4.000
  - B4 — 100% do patrimônio é físico (físico R$ 8.000 / líquido R$ 0)
  - R0 — sem reserva de emergência (alvo R$ 40.000, 10 meses)

### Só no JSON
- `camada_divida.status = 'perfil_1'`, `subtipo = null`, `subtipo_latente = null`, `reclassificavel_apos_pesquisa = false`.
- `funil_otimizado` e `funil_atual` (idênticos): `c1.cobertura ≈ 0,74`, `c1.passou false`, `deficit_estrutural true`, **`caminho_a = null` e `caminho_b = null`** (o funil para em C1; não existe `prazo_meses` neste caso).
- `subjacente = 'zero_a_zero_obrigatorio'`.
- `alavancas`: eliminacao 0, reducao 0, ofertas_em_maos 0, venda_de_bem 8.000 — todas `fecha_conta: false` (nenhuma faz C1 passar; venda de bem não altera C1).
- `alertas = []` (motivo não casa a regex de rolagem; não há atraso; não há proposta; renda não é variável).
- `numeros`: renda_base 4.000, saldo_problema 12.000, parcelas_problema 600, essencial_atual 4.800, essencial_otimizado 4.800, juros_mensais 1.440, patrimonio_vendavel 8.000, n_domicilio 2.
- `marcadores.micro_reserva = true`.
- `texto_analise` termina com "Há déficit estrutural: a renda não cobre o essencial mesmo sem parcelas."
- `codigo_matriz.por_posicao` traz as mesmas sete frases listadas no card.

---

## Caso 2 — Fernanda Lopes: Perfil 1 reclassificável (juros altos sem oferta em mãos)

**História.** Fernanda, 32, solteira, sem dependentes, ganha R$ 6.000 na CLT. A renda cobre o
essencial com folga, mas o rotativo do cartão (R$ 40.000 a 8% ao mês) rende R$ 3.200 de juros por
mês — mais do que ela consegue destinar à dívida. Não tem proposta de renegociação em mãos. Se
negociar os juros, sai do Perfil 1: por isso fica marcada como reclassificável.

### Valores a digitar

**Dados pessoais:** `Fernanda Lopes`; nascimento `10/02/1994`; `Solteiro(a)`; profissão
`Analista de marketing`; mês fraco em branco. **Pessoas com renda / Dependentes:** nenhum.

**Patrimônio físico:** `Automóvel` / `Fiat Argo 2021` / `R$ 25.000` / Quitado / proprietária
Fernanda / seguro Não / moradia desmarcado / gera renda desmarcado.

**Patrimônio líquido:** um item: `R$ 5.000`, tipo **Poupança** (Risco Muito Baixo), finalidade
`Reserva de Emergência`, aporte `R$ 0` / `Nenhum`, dona Fernanda, **reserva de emergência marcado**.

**Dívidas:** uma.
| campo | valor |
|---|---|
| Motivo / A quem deve | `Rotativo do cartão` / `Banco Azul` |
| Valor inicial / Prazo / Parcelas pagas | `R$ 30.000` / `48` / `6` |
| Valor das parcelas | `R$ 1.200` |
| Saldo devedor | `R$ 40.000` |
| Taxa de juros | `8` **a.m.** |
| Situação | `Em dia` |
| Estruturada | desmarcado |
| Proposta em mãos? / Parcela proposta | `Não` / `R$ 0` |
| Quem fez | Fernanda |

**Receitas:** `Salário` R$ 6.000, CLT, 1 mês, de Fernanda.

**Despesas** (1 × mês):
| nome | valor | tipo | categoria | import. | conforto | alterável | disposição |
|---|---|---|---|---|---|---|---|
| Aluguel | 1.800 | fixa | Sobrevivência | 1 | 3 | Não | Não quer/pode mexer |
| Alimentação | 900 | variável | Sobrevivência | 1 | 3 | Sim | Não quer/pode mexer |
| Energia, água e gás | 300 | fixa | Sobrevivência | 2 | 3 | Não | Não quer/pode mexer |
| Transporte | 400 | variável | Necessidades | 2 | 3 | Sim | Não quer/pode mexer |
| Celular e internet | 200 | fixa | Necessidades | 3 | 3 | Sim | Não quer/pode mexer |
| Academia | 150 | fixa | Aperfeiçoamento | 4 | 3 | Sim | Alteraria |
| Streaming | 100 | fixa | Conforto/Supérfluo | 5 | 3 | Sim | Cancelaria |

Linha automática: `Dívida: Rotativo do cartão - Banco Azul` R$ 1.200/mês.

**Proteção:** nenhum. **IR:** simplificada, renda bruta anual R$ 72.000, resultado em branco.
**Objetivos:** aposentadoria automática (Fernanda, 65, renda anual R$ 72.000).
**Card — complementares:** moradia `Integral`; decide pelo objetivo `Não informado`.

### Memória de cálculo

- Domicílio: **1 pessoa** (mínimo R$ 600). Renda média = renda_base = **6.000** (sem mês fraco).
- sob = 1.800 + 900 + 300 = **3.000**; nec = 400 + 200 = **600**; aperf 150; conf 100; obrig_auto 0.
- **essencial_atual = 3.600**; despesas_totais = 3.850. Sem eliminação nem redução → **essencial_otimizado = 3.600**.
- Dívida-problema: saldo 40.000; parcelas 1.200; estruturadas 0; parcelas_total 1.200. Relevância: 40.000 ≥ 600 → **relevante**.
- Juros mensais = 40.000 × 8% = **3.200**. Patrimônio vendável = carro 25.000 + poupança 5.000 = **30.000**.

Funil (idêntico nos dois cenários):
- C1: 3.600 + 1.200 = 4.800; cobertura 6.000 / 4.800 = **125%** ≥ 90% → **passa**. Déficit estrutural: 6.000 < 3.240? não → **false**.
- Caminho A: 30.000 ≥ 40.000? **não**.
- Caminho B: sobra_para_divida = 6.000 − 3.600 − 0 = **2.400**. C3: 2.400 > 3.200? **não** (prazo infinito; o motor grava `prazo_meses = null`, nunca `Infinity`, e C4 sai false). C5: sobra_apos_minimo = 6.000 − 3.600 − 1.200 = 1.200 ≥ 600 → sim, mas B exige C3, C4 e C5 → **B falha**.
- passou = false; **reclassificável = !passou && !déficit = true**.

Camada de dívida → **Perfil 1**, reclassificável após pesquisa de renegociação.

Camada de fluxo (subjacente):
- parcelas 1.200; sobra_estrutural = 6.000 − (3.000 + 600 + 0 + 1.200) = **1.200** (20%) > 180 → segue.
- investe_recorrente: poupança sem aporte → não. compromisso: aportes 0 → não.
- sobra_real = 6.000 − (3.850 + 1.200) = **950** (15,8%) ≥ 180 → **fluxo_positivo**.
- reserva_atual 5.000; micro_reserva = 5.000 < 0,5 × 5.050 = 2.525? não → false.

Matriz:
- Dependência: sem cônjuge, sem dependentes → **A**.
- Tempo: idade 32 → 33 anos (396 meses) → **T1**.
- Moradia `integral` → **M2**. Poupança: (0 + 150 + 0) / 6.000 = 2,5% → **P4**. Fonte: CLT → **F2**.
- Patrimônio: 25.000 / 30.000 = 83,3% → **B4**.
- Reserva: alvo = (6 + 0 + 0 + 1 M2 + 1 P4 + 1 B4) = 9 meses × 6.000 = 54.000; 5.000 / 54.000 = 9,3% ≤ 25% → **R1**.

### Resultado esperado no card
- Rótulo: **1 - Dívidas Impagáveis**. Perfil vigente: 1 - Dívidas Impagáveis (calculado).
- Justificativas (frases reais, nesta ordem):
  - Renda mensal considerada: R$ 6.000
  - Dívidas-problema: R$ 40.000 de saldo (6,7× a renda) e R$ 1.200 de parcelas (20% da renda)
  - Patrimônio vendável R$ 30.000 não cobre a dívida de R$ 40.000
  - Sobra para a dívida R$ 2.400/mês não supera os juros de R$ 3.200/mês
- A linha "Renda cobre 125% …" **não** aparece: quando C1 passa, o motor explica só por que a Etapa 2 falhou (os 125% ficam em `funil_*.c1.cobertura`). O card também **não** diz "reclassificável" (fica só no JSON).
- Faltantes: nenhum. Matriz `A-T1-M2-P4-F2-B4-R1`, por posição:
  - A — sem parceiro com renda própria; 0 dependentes
  - T1 — 33 anos até a aposentadoria aos 65 anos (titular com 32)
  - M2 — custeio integral da moradia
  - P4 — poder de poupança = 2,5% da renda (proteção R$ 0 + aperfeiçoamento R$ 150 + aportes R$ 0)
  - F2 — maior receita: Salário (clt) R$ 6.000
  - B4 — 83% do patrimônio é físico (físico R$ 25.000 / líquido R$ 5.000)
  - R1 — reserva R$ 5.000 = 9,3% do alvo de R$ 54.000 (9 meses)

### Só no JSON
- `status 'perfil_1'`, `subtipo null`, `subtipo_latente null`, **`reclassificavel_apos_pesquisa: true`**, `deficit_estrutural false` nos dois funis.
- `caminho_a`: `patrimonio_vendavel 30.000`, `saldo_problema 40.000`, `passou false`. `caminho_b`: `sobra_para_divida 2.400`, `juros_mensais 3.200`, `c3 false`, **`prazo_meses = null`** (infinito — o motor grava `null` sempre que o prazo não é finito), `c4 false`, `c5 true`, `passou false`.
- `subjacente = 'fluxo_positivo'`.
- `alavancas`: eliminacao 0, reducao 0, ofertas_em_maos 0, venda_de_bem 30.000 — **`fecha_conta: true` em todas, inclusive `venda_de_bem`**: a regra literal do desenho compara só C1 no cenário atual, e C1 já passa (a venda não cobre o saldo, mas o flag não olha a Etapa 2).
- `alertas = []`.
- `texto_analise` termina com "Não há déficit estrutural: pode ser reclassificada após pesquisa de acordos/alienação."
- `codigo_matriz.por_posicao` traz as mesmas sete frases do card.

---

## Caso 3 — Paulo e Renata Moreira: 2A (passa no cenário atual), renda variável da cônjuge

**História.** Paulo (43, servidor, R$ 9.000) e Renata (40, consultora autônoma, R$ 5.000 na
média e R$ 3.500 no mês fraco). Sem filhos. Financiam o apartamento em que moram (estruturada, em
dia) e o carro (não estruturada). Guardam R$ 20.000 em CDB e Paulo compra R$ 1.500 de ações por
mês "porque rende mais" — sem objetivo definido. A dívida do carro cabe no orçamento de hoje: 2A.

### Valores a digitar

**Dados pessoais:** `Paulo Moreira`; nascimento `15/06/1983`; `Casado(a)`; regime qualquer;
profissão `Servidor público`; mês fraco do titular em branco. **Cônjuge:** `Renata Moreira`;
nascimento `25/09/1986`; profissão `Consultora`; **renda no mês fraco `R$ 3.500`**; dependente no
IR: Não.

**Pessoas com renda / Dependentes:** nenhum.

**Patrimônio físico:**
1. `Imóvel` / `Apartamento onde moram` / `R$ 400.000` / **Financiado**, saldo devedor `R$ 250.000` / proprietários Paulo e Renata / seguro Não / **imóvel único de moradia marcado** / gera renda desmarcado.
2. `Automóvel` / `Jeep Renegade 2023` / `R$ 45.000` / **Financiado**, saldo devedor `R$ 30.000` / proprietária Renata / seguro Não / moradia desmarcado / gera renda desmarcado.

**Patrimônio líquido:**
1. `R$ 20.000`, **CDB** (Risco Baixo), finalidade `Reserva de Emergência`, aporte 0 / Nenhum, donos Paulo e Renata, **reserva de emergência marcado**.
2. `R$ 10.000`, **Ações** (Risco Alto), finalidade `Sem Finalidade Específica`, aporte `R$ 1.500` / `Mensal`, dono Paulo, reserva desmarcado.

**Dívidas:**
| campo | Dívida 1 | Dívida 2 |
|---|---|---|
| Motivo / Credor | `Financiamento do apartamento` / `Caixa` | `Financiamento do carro` / `Banco Verde` |
| Valor inicial / Prazo / Pagas | `R$ 300.000` / `360` / `60` | `R$ 40.000` / `48` / `12` |
| Parcela | `R$ 2.200` | `R$ 1.000` |
| Saldo devedor | `R$ 250.000` | `R$ 30.000` |
| Taxa | `10` a.a. | `18` a.a. |
| Situação | `Em dia` | `Em dia` |
| Estruturada | **marcado** | desmarcado |
| Proposta / Parcela proposta | Não / 0 | Não / 0 |
| Quem fez | Paulo | Renata |

**Receitas:** `Salário (servidor)` R$ 9.000, Concurso Público, 1 mês, de Paulo · `Consultoria
autônoma` R$ 5.000, Autônomo, 1 mês, de Renata.

**Despesas** (1 × mês):
| nome | valor | tipo | categoria | import. | conforto | alterável | disposição |
|---|---|---|---|---|---|---|---|
| Condomínio e IPTU | 900 | fixa | Sobrevivência | 1 | 3 | Não | Não quer/pode mexer |
| Alimentação | 2.000 | variável | Sobrevivência | 1 | **4** | Sim | Alteraria |
| Energia, água e gás | 500 | fixa | Sobrevivência | 2 | 3 | Não | Não quer/pode mexer |
| Transporte e combustível | 800 | variável | Necessidades | 2 | 3 | Sim | Não quer/pode mexer |
| Farmácia e consultas | 400 | variável | Necessidades | 2 | 3 | Sim | Não quer/pode mexer |
| Internet e celulares | 300 | fixa | Necessidades | 3 | 3 | Sim | Não quer/pode mexer |
| Faxina e manutenção do apartamento | 700 | fixa | Necessidades | 3 | 3 | Sim | Não quer/pode mexer |
| Vestuário | 800 | variável | Necessidades | 3 | 3 | Sim | Alteraria |
| Restaurantes e lazer | 1.200 | variável | Conforto/Supérfluo | 5 | 4 | Sim | Alteraria |
| Curso de inglês | 400 | fixa | Aperfeiçoamento | 4 | 3 | Sim | Não quer/pode mexer |
| Assinaturas e streaming | 150 | fixa | Conforto/Supérfluo | 6 | 3 | Sim | Cancelaria |

Linhas automáticas: `Dívida: Financiamento do apartamento - Caixa` R$ 2.200 e `Dívida:
Financiamento do carro - Banco Verde` R$ 1.000; receita automática `Restituição IR - Paulo
Moreira` R$ 2.400/ano (ignorada pelo motor: renda e posição F da matriz consideram só receitas
manuais; no JSON ela está com `automatica: true` e nada mais).

**Proteção:** nenhum. **IR:** Paulo completa, renda bruta R$ 108.000, **Restitui R$ 2.400**; Renata
simplificada, R$ 60.000, resultado em branco. **Objetivos:** aposentadoria automática (Paulo, 65,
renda anual R$ 108.000). **Card — complementares:** moradia `Parcial`; decide pelo objetivo
`Não informado`.

### Memória de cálculo

Pessoas e renda:
- Domicílio: Paulo + Renata = **2** (mínimo R$ 1.200).
- Renda por pessoa: Paulo 9.000, Renata 5.000 → **renda média 14.000**.
- Renda fraca = Paulo 9.000 (sem mês fraco) + Renata 3.500 = **12.500**. Renda variável = sim → **renda_base = 12.500** (regra M3: o funil da dívida usa o mês fraco).

Despesas:
- sob = 900 + 2.000 + 500 = **3.400**; nec = 800 + 400 + 300 + 700 + 800 = **3.000**; aperf 400; conf 1.350; obrig_auto 0.
- **essencial_atual = 6.400**; despesas_totais = 8.150.
- Eliminação: nenhuma essencial com importância ≥ 5 → 0. Redução: Alimentação (sob, conforto 4, alterável) → 2.000 × 0,75 = 1.500, **redução 500**.
- **essencial_otimizado = 5.900**.

Dívidas:
- Apartamento: estruturada e em dia → **não é problema**; parcelas_estruturadas = 2.200.
- Carro: não estruturada → **problema**. saldo_problema 30.000; parcelas_problema 1.000; parcelas_total = 3.200.
- Relevância: 30.000 ≥ 10% × 12.500 = 1.250 → relevante.
- Taxa mensal do carro: (1,18)^(1/12) − 1 = **1,389% a.m.**; juros mensais = 30.000 × 0,01389 = **R$ 417**; taxa média 1,389%.
- Patrimônio vendável: apartamento fora (moradia); carro 45.000 − 30.000 = 15.000; PL 20.000 + 10.000 = 30.000 → **45.000**.

Funil otimizado (roda primeiro):
- C1: 5.900 + 3.200 = 9.100; 90% = 8.190 ≤ 12.500 → passa; cobertura = 12.500 / 9.100 = **137%** (é esta cobertura, do cenário otimizado, que vai para o card — o otimizado é o funil que decide). Déficit: 12.500 < 5.310? não.
- A: 45.000 ≥ 30.000 → **passa**. B (informativo): sobra_para_divida = 12.500 − 5.900 − 2.200 = 4.400 > 417; prazo = −ln(1 − 0,01389 × 30.000 / 4.400) / ln(1,01389) = −ln(0,9053) / 0,01379 = 0,0995 / 0,01379 ≈ **7,2 meses** ≤ 60; C5: 12.500 − 5.900 − 3.200 = 3.400 ≥ 1.200. passou = **true**.

Funil atual:
- C1: 6.400 + 3.200 = 9.600; 90% = 8.640 ≤ 12.500 → passa; cobertura = 12.500 / 9.600 = **130%** (fica no JSON e no `texto_analise`; não aparece no card).
- A: 45.000 ≥ 30.000 → passa. B: sobra 12.500 − 6.400 − 2.200 = **3.900** > 417; prazo = −ln(1 − 417 / 3.900) / 0,01379 = −ln(0,8932) / 0,01379 = 0,1130 / 0,01379 ≈ **8,2 meses**; C5: 12.500 − 6.400 − 3.200 = 2.900 ≥ 1.200. passou = **true**.

Decisão: otimizado passou → Perfil 2; funil atual passou → **latente 2A**; nenhuma dívida-problema em atraso → **subtipo 2A**. reclassificável = false.

Alerta de renda variável: o funil otimizado passa com a renda média (14.000) e também com a fraca (12.500) → **sem alerta**.

Camada de fluxo (subjacente, usa renda média 14.000):
- parcelas = 3.200 (todas as dívidas). nec_reduzida = 3.000 (nenhuma nec com conforto 4–5; a Alimentação é sob e fica como está).
- sobra_estrutural = 14.000 − (3.400 + 3.000 + 0 + 3.200) = **4.400** (31%) > 420 → segue.
- investe_recorrente: Ações (Risco Alto = não é guarda) com aporte 1.500 mensal → **sim**.
- Amarras P8: (i) objetivo com prazo e valor: aposentadoria com renda anual 108.000 > 0 → sim; (ii) aportes vinculados: Ações tem finalidade `SEM_FINALIDADE` → **não**; (iii) tudo com finalidade: Ações → não; (iv) decide pelo objetivo `''` → não. → **investidor_amador**.
- aportes_mensais 1.500 (10,7%) → compromisso true (não decide). sobra_real = 14.000 − (8.150 + 3.200) = 2.650 (18,9%); sobra_real_fraca = 12.500 − 11.350 = 1.150.
- reserva_atual = 20.000 (só o CDB está marcado). micro_reserva: 20.000 < 0,5 × 11.350 = 5.675? não. investidor_sem_reserva_completa: 20.000 < alvo 105.000 → **true**.

Matriz:
- Dependência: cônjuge com renda própria (5.000) e 0 dependentes → **C**.
- Tempo: Paulo 43 → 22 anos (264 meses) → **T2**.
- Moradia `parcial` → **M1**.
- Poupança: (0 + 400 + 1.500) / 14.000 = 13,6% → **P3**.
- Fonte: maior receita = 9.000 Concurso → **F1** (outra: 5.000 Autônomo).
- Patrimônio: físico bruto 400.000 + 45.000 = 445.000; líquido 30.000 → 445 / 475 = 93,7% → **B4**.
- Reserva: ajustes comuns = +1 (B4) apenas (deps 0, T2, M1, P3). Paulo: F1 → 4 + 1 = 5 meses × 9.000 = 45.000. Renata: autônoma → F3 → 12 + 1 = 13 → teto 12 × 5.000 = 60.000. Alvo 105.000; 20.000 / 105.000 = 19% → **R1**.

### Resultado esperado no card
- Rótulo: **2 - Dívidas Pagáveis** (laranja). Nada de "2A". Perfil vigente: 2 - Dívidas Pagáveis (calculado).
- Justificativas (frases reais, nesta ordem):
  - Renda mensal considerada: R$ 12.500 (mês fraco)
  - Dívidas-problema: R$ 30.000 de saldo (2,4× a renda) e R$ 1.000 de parcelas (8,0% da renda)
  - Renda cobre 137% do essencial + parcelas (mínimo 90%)
  - Patrimônio vendável R$ 45.000 cobre a dívida de R$ 30.000
- Atenção a dois pontos: a cobertura mostrada é a do **cenário otimizado** (137%), não os 130% do cenário atual; e, como o Caminho A passa, o card **não** mostra a linha "Quitaria em N meses com sobra de …" — o Caminho B (sobra 3.900, prazo ≈ 8 meses) fica só no JSON.
- Faltantes: nenhum. Matriz `C-T2-M1-P3-F1-B4-R1`, por posição:
  - C — parceiro com renda própria; 0 dependentes
  - T2 — 22 anos até a aposentadoria aos 65 anos (titular com 43)
  - M1 — custeio parcial da moradia
  - P3 — poder de poupança = 14% da renda (proteção R$ 0 + aperfeiçoamento R$ 400 + aportes R$ 1.500)
  - F1 — maior receita: Salário (servidor) (concurso) R$ 9.000; demais: Consultoria autônoma R$ 5.000
  - B4 — 94% do patrimônio é físico (físico R$ 445.000 / líquido R$ 30.000)
  - R1 — reserva R$ 20.000 = 19% do alvo de R$ 105.000 (5 meses / 12 meses)
- Na posição F a restituição automática não entra em "demais" (só receitas manuais).

### Só no JSON
- `status 'perfil_2'`, **`subtipo '2A'`, `subtipo_latente '2A'`**, `reclassificavel false`.
- `funil_otimizado`: `c1.cobertura ≈ 1,37`, `caminho_a.passou true`, `caminho_b` com `sobra_para_divida 4.400`, `prazo_meses ≈ 7,21`, `c3`/`c4`/`c5`/`passou` true. `funil_atual`: `c1.cobertura ≈ 1,30`, `caminho_a.passou true`, `caminho_b` com `sobra_para_divida 3.900`, **`prazo_meses ≈ 8,19`**, `c3`/`c4`/`c5`/`passou` true.
- `subjacente = 'investidor_amador'`; `amarras_p8 = { objetivos_com_prazo_e_valor: true, aportes_vinculados: false, tudo_com_finalidade: false, declaracao_coerente: false }`; `marcadores.investidor_sem_reserva_completa = true`, `micro_reserva = false`.
- `numeros`: renda_base 12.500, renda_media 14.000, renda_fraca 12.500, usou_mes_fraco true, saldo_problema 30.000, parcelas_problema 1.000, parcelas_total 3.200, essencial_atual 6.400, essencial_otimizado 5.900, eliminacao 0, reducao 500, patrimonio_vendavel 45.000, juros_mensais ≈ 417 (416,65), n_domicilio 2.
- `alavancas`: eliminacao 0, **reducao 500**, ofertas_em_maos 0, venda_de_bem 45.000 — `fecha_conta` true em todas (C1 já passa no cenário atual).
- `alertas = []`.
- `texto_analise`: "A dívida já cabe no plano atual (renda cobre 130% do essencial + parcelas); otimizar o custo sem urgência." — aqui sim aparece o 130% do cenário atual.
- `codigo_matriz.por_posicao` traz as mesmas sete frases do card.

---

## Caso 4 — Marta Ribeiro: 2C com subjacente Poupadora

**História.** Marta, 46, divorciada, mora de aluguel com o filho Lucas. Ganha R$ 7.000 na CLT,
guarda R$ 500 por mês na poupança religiosamente e tem R$ 4.000 num CDB — só instrumentos de guarda.
Deixou uma fatura de cartão de R$ 12.000 a 14% ao mês **em atraso, ignorada**: não paga nada. A
conta fecharia com folga se ela tratasse a dívida (latente 2A), mas enquanto ignora é 2C.

### Valores a digitar

**Dados pessoais:** `Marta Ribeiro`; nascimento `05/03/1980`; `Divorciado(a)`; profissão
`Enfermeira`; mês fraco em branco. **Dependentes:** `Lucas Ribeiro`, `15/08/2014`, `filho`,
dependente do titular.

**Patrimônio físico:** `Automóvel` / `Hyundai HB20 2020` / `R$ 20.000` / Quitado / proprietária
Marta / seguro Não / moradia desmarcado / gera renda desmarcado.

**Patrimônio líquido:**
1. `R$ 6.000`, **Poupança** (Risco Muito Baixo), `Reserva de Emergência`, aporte `R$ 500` / `Mensal`, dona Marta, **reserva de emergência marcado**.
2. `R$ 4.000`, **CDB** (Risco Baixo), `Reserva para Objetivos`, aporte 0 / Nenhum, dona Marta, reserva desmarcado.

**Dívidas:** uma.
| campo | valor |
|---|---|
| Motivo / Credor | `Fatura do cartão atrasada` / `Banco Sul` |
| Valor inicial / Prazo / Pagas | `R$ 6.000` / `0` / `0` |
| Valor das parcelas | `R$ 0` (ela não paga nada) |
| Saldo devedor | `R$ 12.000` |
| Taxa | `14` **a.m.** |
| Situação | **`Em atraso (ignorada)`** |
| Estruturada | desmarcado |
| Proposta / Parcela proposta | Não / 0 |
| Quem fez | Marta |

Sem parcela, o fluxo **não** cria linha automática para essa dívida — está certo.

**Receitas:** `Salário` R$ 7.000, CLT, 1 mês, de Marta.

**Despesas** (1 × mês):
| nome | valor | tipo | categoria | import. | conforto | alterável | disposição |
|---|---|---|---|---|---|---|---|
| Aluguel | 1.600 | fixa | Sobrevivência | 1 | 3 | Não | Não quer/pode mexer |
| Alimentação | 1.100 | variável | Sobrevivência | 1 | 3 | Sim | Não quer/pode mexer |
| Energia, água e gás | 350 | fixa | Sobrevivência | 2 | 3 | Não | Não quer/pode mexer |
| Escola do Lucas | 700 | fixa | Necessidades | 1 | 3 | Não | Não quer/pode mexer |
| Transporte | 450 | variável | Necessidades | 2 | 3 | Sim | Não quer/pode mexer |
| Celular e internet | 200 | fixa | Necessidades | 3 | 3 | Sim | Não quer/pode mexer |
| Farmácia | 100 | variável | Necessidades | 2 | 3 | Sim | Não quer/pode mexer |
| Lazer com o Lucas | 400 | variável | Conforto/Supérfluo | 4 | 3 | Sim | Alteraria |
| Salão e cuidados pessoais | 200 | variável | Conforto/Supérfluo | 5 | 3 | Sim | Alteraria |

**Proteção:** nenhum. **IR:** simplificada, R$ 84.000, resultado em branco. **Objetivos:**
aposentadoria automática (Marta, 65, renda anual R$ 84.000). **Card — complementares:** moradia
`Integral`; decide pelo objetivo `Não informado`.

### Memória de cálculo

- Domicílio: Marta + Lucas = **2** (mínimo R$ 1.200). Renda média = renda_base = **7.000**.
- sob = 1.600 + 1.100 + 350 = **3.050**; nec = 700 + 450 + 200 + 100 = **1.450**; conf 600; obrig_auto 0.
- **essencial_atual = 4.500** = essencial_otimizado (nada cortável: importâncias essenciais 1–3, confortos 3). despesas_totais = 5.100.
- Dívida-problema (não estruturada; "em atraso" não está fora do estoque): saldo 12.000; parcela 0; parcelas_total 0. Relevância: 12.000 ≥ 700 → relevante.
- Juros mensais = 12.000 × 14% = **1.680**. Vendável = carro 20.000 + PL 10.000 = **30.000**.

Funil (igual nos dois cenários):
- C1: 4.500 + 0 = 4.500; 90% = 4.050 ≤ 7.000 → passa; cobertura 7.000 / 4.500 = **156%**. Déficit: não.
- A: 30.000 ≥ 12.000 → **passa**. B: sobra_para_divida = 7.000 − 4.500 − 0 = 2.500 > 1.680 (C3 ok); prazo = −ln(1 − 0,14 × 12.000 / 2.500) / ln(1,14) = −ln(0,328) / 0,1310 = 1,1147 / 0,1310 ≈ **8,5 meses** (C4 ok); C5: 7.000 − 4.500 − 0 = 2.500 ≥ 1.200 (ok). passou = **true**.

Decisão: Perfil 2; latente **2A** (atual passa); existe dívida-problema **em atraso → subtipo 2C** (precedência).

Alerta "dívida ignorada engordando": 12.000 × ((1,14)^12 − 1) = 12.000 × 3,818 = **45.815** por ano de juros > 12 × sobra_para_divida = 12 × 2.500 = 30.000 → **alerta ligado**.

Camada de fluxo (subjacente):
- parcelas 0; nec_reduzida = 1.450. sobra_estrutural = 7.000 − (3.050 + 1.450 + 0 + 0) = **2.500** (35,7%) > 210 → segue.
- investe_recorrente: poupança (Muito Baixo) e CDB (Baixo) são guarda → **não**.
- compromisso: aportes 500 ≥ 5% × 7.000 = 350 → **sim**; apenas_guarda: todo PL é guarda → **sim** → **poupador**.
- sobra_real = 7.000 − 5.100 = 1.900 (27%). reserva_atual = 6.000; micro_reserva: 6.000 < 2.550? não.

Matriz:
- Dependência: sem cônjuge; 1 dependente → **B**.
- Tempo: 46 anos → 19 anos (228 meses) → **T3**.
- Moradia `integral` → **M2**. Poupança: 500 / 7.000 = 7,1% → **P4**. Fonte CLT → **F2**.
- Patrimônio: 20.000 / (20.000 + 10.000) = 66,7% → **B3**.
- Reserva: (6 F2 + 1 dep + 0 T3 + 1 M2 + 1 P4 + 0 B3) = 9 × 7.000 = 63.000; 6.000 / 63.000 = 9,5% → **R1**.

### Resultado esperado no card
- Rótulo: **2 - Dívidas Pagáveis**. O card **não** fala em atraso, 2C nem "se tratada seria 2A". Perfil vigente: 2 - Dívidas Pagáveis (calculado).
- Justificativas (frases reais, nesta ordem):
  - Renda mensal considerada: R$ 7.000
  - Dívidas-problema: R$ 12.000 de saldo (1,7× a renda) e R$ 0 de parcelas (0,0% da renda)
  - Renda cobre 156% do essencial + parcelas (mínimo 90%)
  - Patrimônio vendável R$ 30.000 cobre a dívida de R$ 12.000
- Faltantes: nenhum. Matriz `B-T3-M2-P4-F2-B3-R1`, por posição:
  - B — sem parceiro com renda própria; 1 dependente
  - T3 — 19 anos até a aposentadoria aos 65 anos (titular com 46)
  - M2 — custeio integral da moradia
  - P4 — poder de poupança = 7,1% da renda (proteção R$ 0 + aperfeiçoamento R$ 0 + aportes R$ 500)
  - F2 — maior receita: Salário (clt) R$ 7.000
  - B3 — 67% do patrimônio é físico (físico R$ 20.000 / líquido R$ 10.000)
  - R1 — reserva R$ 6.000 = 9,5% do alvo de R$ 63.000 (9 meses)

### Só no JSON
- `status 'perfil_2'`, **`subtipo '2C'`, `subtipo_latente '2A'`**, `reclassificavel false`.
- Funis (idênticos): `c1.cobertura ≈ 1,56`, `caminho_a.passou true`, `caminho_b` com `sobra_para_divida 2.500`, `juros_mensais 1.680`, **`prazo_meses ≈ 8,51`**, `c3`/`c4`/`c5`/`passou` true.
- **`subjacente = 'poupador'`**; `numeros.aportes_mensais 500`, `compromisso_de_guardar true`, `apenas_guarda true`, `investe_recorrente false`, `reserva_atual 6.000`.
- **`alertas = ['divida_ignorada_engordando']`**.
- `texto_analise`: "Risco: há dívida ignorada (em atraso) com juros correndo, protesto ou execução. Se tratada, seria 2A; tratar = pagar, propor acordo ou declarar plano."
- `alavancas`: eliminacao 0, reducao 0, ofertas_em_maos 0, venda_de_bem 30.000 — todas `fecha_conta true`.
- `codigo_matriz.por_posicao` traz as mesmas sete frases do card.

---

## Caso 5 — Bruno Carvalho: Perfil 4 que a compressão revela (parecia 3)

**História.** Bruno, 28, solteiro, R$ 5.000 na CLT. Fecha o mês no vermelho por R$ 300: pelo
extrato parece Zero a Zero Obrigatório. Mas o carro (R$ 1.400) e o guarda-roupa (R$ 500) estão
"muito acima do básico" e ele admite que dá para mexer — com essas necessidades comprimidas sobra
R$ 950 por mês. Ou seja: zero a zero por escolha, não por obrigação. A única dívida (celular
parcelado) é pequena demais para contar.

### Valores a digitar

**Dados pessoais:** `Bruno Carvalho`; nascimento `22/07/1998`; `Solteiro(a)`; profissão
`Desenvolvedor`; mês fraco em branco. **Dependentes:** nenhum.

**Patrimônio físico:** `Automóvel` / `Chevrolet Onix 2022` / `R$ 30.000` / Quitado / Bruno /
seguro Não / moradia desmarcado / gera renda desmarcado.

**Patrimônio líquido:** `R$ 800`, **Poupança** (Risco Muito Baixo), `Reserva de Emergência`, aporte
0 / Nenhum, dono Bruno, **reserva de emergência marcado**.

**Dívidas:** uma.
| campo | valor |
|---|---|
| Motivo / Credor | `Celular parcelado` / `Loja Tech` |
| Valor inicial / Prazo / Pagas | `R$ 1.200` / `12` / `9` |
| Parcela | `R$ 100` |
| Saldo devedor | `R$ 300` |
| Taxa | `0` a.m. |
| Situação | `Em dia` |
| Estruturada | desmarcado |
| Proposta / Parcela proposta | Não / 0 |
| Quem fez | Bruno |

**Receitas:** `Salário` R$ 5.000, CLT, 1 mês, de Bruno.

**Despesas** (1 × mês):
| nome | valor | tipo | categoria | import. | conforto | alterável | disposição |
|---|---|---|---|---|---|---|---|
| Aluguel | 1.500 | fixa | Sobrevivência | 1 | 3 | Não | Não quer/pode mexer |
| Alimentação | 900 | variável | Sobrevivência | 1 | 3 | Sim | Não quer/pode mexer |
| Energia, água e gás | 300 | fixa | Sobrevivência | 2 | 3 | Não | Não quer/pode mexer |
| Carro (combustível, seguro, manutenção) | 1.400 | variável | Necessidades | 2 | **5** | Sim | Alteraria |
| Roupas e calçados | 500 | variável | Necessidades | 3 | **5** | Sim | Alteraria |
| Celular e internet | 200 | fixa | Necessidades | 3 | 3 | Sim | Não quer/pode mexer |
| Farmácia | 100 | variável | Necessidades | 2 | 3 | Sim | Não quer/pode mexer |
| Restaurantes e delivery | 300 | variável | Conforto/Supérfluo | 5 | 3 | Sim | Alteraria |

Linha automática: `Dívida: Celular parcelado - Loja Tech` R$ 100/mês.

**Proteção:** nenhum. **IR:** isento, R$ 60.000. **Objetivos:** aposentadoria automática (Bruno,
65, renda anual R$ 60.000). **Card — complementares:** moradia `Integral`; decide pelo objetivo
`Não informado`.

### Memória de cálculo

- Domicílio: **1**. Renda média = **5.000**.
- sob = 1.500 + 900 + 300 = **2.700**; nec = 1.400 + 500 + 200 + 100 = **2.200**; conf 300; obrig_auto 0. essencial_atual = 4.900; despesas_totais = **5.200**.
- Dívida: não estruturada, em dia → problema, mas saldo 300 < 10% × 5.000 = 500 e parcela 100 < 5% × 5.000 = 250 → **sem dívidas relevantes**; vai para `pendencias_menores`. A parcela de 100 ainda conta como compromisso no fluxo (parcelas_total atual = 100).

Camada de fluxo:
- "Como está" (informativo, o que parecia): sob + nec + parcelas = 2.700 + 2.200 + 100 = 5.000 → sobra 0 (0%) — daria Perfil 3.
- nec_reduzida = Carro 1.400 × 0,50 = 700 + Roupas 500 × 0,50 = 250 + Celular 200 + Farmácia 100 = **1.250** (Sobrevivência fica como está).
- **sobra_estrutural = 5.000 − (2.700 + 1.250 + 0 + 100) = 950** (19%) > 3% × 5.000 = 150 → não é obrigatório.
- investe_recorrente: não (poupança sem aporte). compromisso: não (aportes 0).
- **sobra_real = 5.000 − (5.200 + 100) = −300** (−6%) < 150 → não é fluxo positivo.
- opcionalidade: há despesa de conforto (Restaurantes) e necessidades com conforto 5 → **sim** → **zero_a_zero_opcional**.
- reserva_atual 800; micro_reserva: 800 < 0,5 × 5.300 = 2.650 → **true**.

Matriz:
- Dependência **A**. Tempo: 28 → 37 anos (444 meses) → **T1**. Moradia `integral` → **M2**.
- Poupança 0% → **P4**. Fonte CLT → **F2**. Patrimônio: 30.000 / 30.800 = 97,4% → **B4**.
- Reserva: (6 + 0 + 0 + 1 + 1 + 1) = 9 × 5.000 = 45.000; 800 / 45.000 = 1,8% → **R1**.

### Resultado esperado no card
- Rótulo: **4 - Zero a Zero Opcional** (amarelo). Perfil vigente: 4 - Zero a Zero Opcional (calculado).
- Justificativas (frases reais, nesta ordem — nos perfis de fluxo o card sempre abre com renda, dívidas, as duas sobras e a linha de aportes, e só depois vêm as evidências do perfil):
  - Renda mensal considerada: R$ 5.000
  - Dívidas: nenhuma relevante
  - Sobra estrutural: R$ 950 (19% da renda)
  - Sobra real: R$ -300 (-6,0% da renda)
  - Aportes mensais: R$ 0 (0,0% da renda) — abaixo de 5% da renda (sem compromisso de guardar)
  - Há gastos opcionais (conforto, aperfeiçoamento ou necessidades acima do básico) que consomem a sobra estrutural: sim
- Faltantes: nenhum. Matriz `A-T1-M2-P4-F2-B4-R1`, por posição:
  - A — sem parceiro com renda própria; 0 dependentes
  - T1 — 37 anos até a aposentadoria aos 65 anos (titular com 28)
  - M2 — custeio integral da moradia
  - P4 — poder de poupança = 0,0% da renda (proteção R$ 0 + aperfeiçoamento R$ 0 + aportes R$ 0)
  - F2 — maior receita: Salário (clt) R$ 5.000
  - B4 — 97% do patrimônio é físico (físico R$ 30.000 / líquido R$ 800)
  - R1 — reserva R$ 800 = 1,8% do alvo de R$ 45.000 (9 meses)

### Só no JSON
- `camada_divida.status = 'sem_dividas_relevantes'`, `pendencias_menores = [{ nome: 'Celular parcelado', saldo: 300, parcela: 100 }]`, `subtipo null`, `subtipo_latente null`, `reclassificavel false`; `texto_analise` começa com "Sem dívidas relevantes: as pendências ficam abaixo dos pisos de relevância".
- `subjacente = null` (não há perfil de dívida; o perfil de fluxo é o próprio calculado).
- `camada_fluxo.numeros`: renda 5.000, sobra_estrutural 950, sobra_real −300, aportes 0, reserva_atual 800, opcionalidade true; `marcadores.micro_reserva = true`.
- `codigo_matriz.por_posicao` traz as mesmas sete frases do card.

---

## Caso 6 — Helena e Marcos Tavares: Perfil 8 completo com matriz

**História.** Helena (47, servidora, R$ 12.000) e Marcos (50, empresário, R$ 8.000). Filho Pedro
e o cachorro Thor. Apartamento quitado onde moram e carro quitado. Sem dívidas. Reserva de
emergência no Tesouro Selic, fundo multimercado e ações para a casa de praia, previdência para a
aposentadoria — todo aporte tem finalidade, todo objetivo tem prazo e valor, e eles escolhem onde
investir pelo objetivo. Plano de saúde e seguro do carro pagos como produtos de proteção.

### Valores a digitar

**Dados pessoais:** `Helena Tavares`; nascimento `02/11/1978`; `Casado(a)`; regime qualquer;
profissão `Auditora fiscal`; mês fraco em branco. **Cônjuge:** `Marcos Tavares`; `18/04/1976`;
`Empresário`; mês fraco em branco; dependente no IR: Não.

**Dependentes:** `Pedro Tavares`, `20/02/2015`, parentesco `filho`, do titular · `Thor`,
`01/06/2021`, parentesco **`cachorro`**, do titular (não conta como pessoa do domicílio).

**Patrimônio físico:**
1. `Imóvel` / `Apartamento onde moram` / `R$ 600.000` / Quitado / Helena e Marcos / seguro Não / **imóvel único de moradia marcado** / gera renda desmarcado.
2. `Automóvel` / `Toyota Corolla 2024` / `R$ 80.000` / Quitado / **proprietária só Helena** / **seguro: Sim** (isso cria o produto "Seguro Automóvel" em Proteção) / moradia desmarcado / gera renda desmarcado.

**Patrimônio líquido:**
1. `R$ 60.000`, **Tesouro Selic** (Risco Muito Baixo), `Reserva de Emergência`, aporte 0 / Nenhum, donos Helena e Marcos, **reserva de emergência marcado**.
2. `R$ 150.000`, **Fundo multimercado** (Risco Médio), `Reserva para Objetivos`, aporte `R$ 2.000` / `Mensal`, donos Helena e Marcos, reserva desmarcado.
3. `R$ 200.000`, **Previdência PGBL** (Risco Médio-Alto), `Aposentadoria`, aporte `R$ 1.500` / `Mensal`, dona Helena, reserva desmarcado.
4. `R$ 90.000`, **Ações** (Risco Alto), `Reserva para Objetivos`, aporte `R$ 12.000` / **`Anual`**, dono Marcos, reserva desmarcado.

**Dívidas:** nenhuma.

**Produtos & Proteção:**
1. `Plano de Saúde`, objeto `Helena Tavares`, custo `R$ 1.800`, **Mensal**, seguradora `Saúde Total`.
2. `Seguro Automóvel` (criado pelo patrimônio), objeto `Toyota Corolla 2024`, custo `R$ 3.600`, **Anual**, seguradora `Porto Seguro`.

**Receitas:** `Salário (servidora)` R$ 12.000, Concurso Público, 1 mês, de Helena · `Pró-labore`
R$ 8.000, Empresário/Pró-labore, 1 mês, de Marcos.

**Despesas** (1 × mês):
| nome | valor | tipo | categoria | import. | conforto | alterável | disposição |
|---|---|---|---|---|---|---|---|
| Condomínio e IPTU | 1.200 | fixa | Sobrevivência | 1 | 3 | Não | Não quer/pode mexer |
| Alimentação | 2.500 | variável | Sobrevivência | 1 | 4 | Sim | Não quer/pode mexer |
| Energia, água e gás | 600 | fixa | Sobrevivência | 2 | 3 | Não | Não quer/pode mexer |
| Escola do Pedro | 2.000 | fixa | Necessidades | 1 | 3 | Não | Não quer/pode mexer |
| Transporte e combustível | 900 | variável | Necessidades | 2 | 3 | Sim | Não quer/pode mexer |
| Internet e celulares | 300 | fixa | Necessidades | 3 | 3 | Sim | Não quer/pode mexer |
| Veterinário e ração do Thor | 200 | variável | Necessidades | 3 | 3 | Sim | Não quer/pode mexer |
| Cursos e livros | 500 | variável | Aperfeiçoamento | 3 | 3 | Sim | Não quer/pode mexer |
| Viagens e lazer | 1.500 | variável | Conforto/Supérfluo | 4 | 4 | Sim | Alteraria |
| Restaurantes | 800 | variável | Conforto/Supérfluo | 5 | 3 | Sim | Alteraria |

Linhas automáticas após sincronizar: `Plano de Saúde - Saúde Total` R$ 1.800 (1 × mês) e
`Seguro Automóvel - Porto Seguro` R$ 3.600 (1 × **ano**).

**IR:** Helena completa, R$ 144.000, resultado em branco; Marcos simplificada, R$ 96.000, em branco
(resultado em branco de propósito: "restitui/paga" criaria linhas automáticas extras).

**Objetivos:**
1. Aposentadoria automática de Helena: prazo por idade **65**, renda anual **R$ 144.000** (é o que o
   módulo calcula sozinho: 12 × os R$ 12.000 de Helena no fluxo; não altere).
2. Objetivo normal `Casa de praia`: de quem = Helena; prazo **8 anos** (grava 96 meses); valor final `R$ 400.000`; meta de acúmulo `R$ 400.000`.

**Card — complementares:** custeio da moradia `Parcial`; decide pelo objetivo **`Sim`**.

### Memória de cálculo

Pessoas e renda:
- Domicílio: Helena + Marcos + Pedro = **3** ("cachorro" casa com a regex de não-pessoa).
- Renda por pessoa: Helena 12.000, Marcos 8.000 → **renda média 20.000**; sem mês fraco.

Despesas:
- sob = 1.200 + 2.500 + 600 = **4.300**; nec = 2.000 + 900 + 300 + 200 = **3.400**; aperf 500; conf 2.300.
- obrig_auto (automáticas de proteção) = 1.800 + 3.600 / 12 = **2.100**.
- essencial_atual = 4.300 + 3.400 + 2.100 = 9.800; **despesas_totais = 4.300 + 3.400 + 500 + 2.300 + 2.100 = 12.600**.

Dívidas: nenhuma → **sem dívidas relevantes** (pendências vazias).

Camada de fluxo:
- parcelas 0; nec_reduzida = 3.400 (necessidades todas com conforto 3).
- **sobra_estrutural = 20.000 − (4.300 + 3.400 + 2.100 + 0) = 10.200** (51%) > 600 → segue.
- aportes_mensais = 2.000 + 1.500 + 12.000 / 12 = **4.500** (22,5% ≥ 5% → compromisso sim).
- investe_recorrente: Fundo (Médio), Previdência (Médio-Alto) e Ações (Alto) têm aporte e não são guarda → **sim**.
- Amarras P8: (i) aposentadoria com renda anual 144.000 > 0 e "Casa de praia" com meta 400.000 e prazo 96 meses → **sim**; (ii) todo PL com aporte tem finalidade RESERVA_OBJETIVOS / APOSENTADORIA → **sim**; (iii) todo PL com saldo tem finalidade ≠ Sem finalidade → **sim**; (iv) decide pelo objetivo = sim → **sim**. → **investidor_planejador**.
- sobra_real = 20.000 − 12.600 = 7.400 (37%). reserva_atual = 60.000; micro_reserva: 60.000 < 6.300? não.

Matriz:
- Dependência: cônjuge com renda (8.000; IR 96.000) e 1 dependente-pessoa (Thor não conta) → **D**.
- Tempo: Helena 47 (faz 48 só em novembro) → 18 anos (216 meses) → **T3**.
- Moradia `parcial` → **M1**.
- Poupança: (proteção 2.100 + aperf 500 + aportes 4.500) / 20.000 = 7.100 / 20.000 = 35,5% > 30% → **P1**.
- Fonte: maior receita 12.000 Concurso → **F1** (outra: Pró-labore, Empresário).
- Patrimônio: físico 600.000 + 80.000 = 680.000; líquido 60 + 150 + 200 + 90 = 500.000 → 680 / 1.180 = 57,6% → **B3**.
- Reserva: ajustes comuns = +1 (dependentes); T3, M1, P1, B3 não somam. Helena: F1 → 4 + 1 = 5 × 12.000 = 60.000. Marcos: Empresário → F3 → 12 + 1 = 13 → teto 12 × 8.000 = 96.000. Alvo **156.000**; 60.000 / 156.000 = 38,5% → **R2** (> 25% e ≤ 50%).

### Resultado esperado no card
- Rótulo: **8 - Investidor-Planejador** (dourado). Perfil vigente: 8 - Investidor-Planejador (calculado).
- Justificativas (frases reais, nesta ordem):
  - Renda mensal considerada: R$ 20.000
  - Dívidas: nenhuma relevante
  - Sobra estrutural: R$ 10.200 (51% da renda)
  - Sobra real: R$ 7.400 (37% da renda)
  - Aportes mensais: R$ 4.500 (23% da renda) — compromisso de guardar confirmado
  - Investe recorrentemente em produtos de risco: sim
  - Objetivos com prazo e valor, aportes com finalidade definida e decisão pelo objetivo: sim
- Os 22,5% de aportes saem como "23%": acima de 10% o motor não mostra casa decimal.
- Faltantes: nenhum. Matriz **`D-T3-M1-P1-F1-B3-R2`**, com a lista por posição:
  - D — parceiro com renda própria; 1 dependente
  - T3 — 18 anos até a aposentadoria aos 65 anos (titular com 47)
  - M1 — custeio parcial da moradia
  - P1 — poder de poupança = 36% da renda (proteção R$ 2.100 + aperfeiçoamento R$ 500 + aportes R$ 4.500)
  - F1 — maior receita: Salário (servidora) (concurso) R$ 12.000; demais: Pró-labore R$ 8.000
  - B3 — 58% do patrimônio é físico (físico R$ 680.000 / líquido R$ 500.000)
  - R2 — reserva R$ 60.000 = 38% do alvo de R$ 156.000 (5 meses / 12 meses)

### Só no JSON
- `camada_divida.status = 'sem_dividas_relevantes'`, `pendencias_menores = []`, `subtipo null`, `subtipo_latente null`, `reclassificavel false`; `texto_analise = 'Sem dívidas-problema.'`; `subjacente = null`.
- `camada_fluxo.amarras_p8` todas `true`; `numeros`: renda 20.000, sobra_estrutural 10.200, sobra_real 7.400, aportes_mensais 4.500, compromisso true, investe_recorrente true, apenas_guarda false, opcionalidade true, reserva_atual 60.000; `marcadores` ambos false.
- `camada_divida.numeros` (o motor grava mesmo sem dívida): essencial_atual 9.800, essencial_otimizado 9.175 (Alimentação, sob com conforto 4 e alterável: 2.500 × 0,75 → redução 625), patrimonio_vendavel 580.000 (carro 80.000 + PL 500.000; o apartamento é moradia), saldo_problema 0, n_domicilio 3.
- `codigo_matriz.faltantes = []`; `por_posicao` traz as mesmas sete frases do card.
- No JSON de teste, `produtos_protecao` carrega só `tipo_produto`, `custo` e `periodicidade` (objeto e seguradora são campos da tela, não do motor).

---

## Resumo

| # | cliente | card | JSON (subtipo / latente / subjacente / reclassificável) | matriz |
|---|---|---|---|---|
| 1 | Carlos Andrade | 1 - Dívidas Impagáveis | null / null / zero_a_zero_obrigatorio / false | B-T2-M2-P4-F2-B4-R0 |
| 2 | Fernanda Lopes | 1 - Dívidas Impagáveis | null / null / fluxo_positivo / **true** | A-T1-M2-P4-F2-B4-R1 |
| 3 | Paulo e Renata Moreira | 2 - Dívidas Pagáveis | 2A / 2A / investidor_amador / false | C-T2-M1-P3-F1-B4-R1 |
| 4 | Marta Ribeiro | 2 - Dívidas Pagáveis | **2C** / 2A / **poupador** / false | B-T3-M2-P4-F2-B3-R1 |
| 5 | Bruno Carvalho | 4 - Zero a Zero Opcional | null / null / null / false | A-T1-M2-P4-F2-B4-R1 |
| 6 | Helena e Marcos Tavares | 8 - Investidor-Planejador | null / null / null / false | D-T3-M1-P1-F1-B3-R2 |

Testes extras rápidos (não estão no JSON):

(a) **Perfil incalculável** — em qualquer caso, apague a "Situação" de uma dívida. O rótulo vira
**Perfil incalculável** e a linha de vigente fica "Perfil vigente: — (aguardando dados)". As
justificativas encolhem para os números parciais que ainda dá para mostrar: "Renda mensal
considerada: R$ <renda_base>" (com "(mês fraco)" no caso 3), "Sobra real: R$ <sobra_real> (<x>% da
renda)" e, por último, "Cálculo pendente: 1 informação faltante" (plural "N informações faltantes"
se faltar mais de uma). A linha "Dívidas-problema: …" só aparece quando o que falta é do fluxo
(ex.: uma despesa sem classificação) e as dívidas em si estão completas — se a pendência é da
própria dívida, ela some. Abaixo aparece o bloco "Falta 1 informação para calcular:" com o item
'Situação da dívida "<motivo>"'. O código da matriz continua completo (a matriz não depende da
camada de dívida). No JSON: `calculado = null`, `subjacente = null`,
`camada_divida.status = 'incalculavel'`, `faltantes` com o item acima.

(b) escolha um perfil no seletor manual diferente do calculado sem escrever nas Observações → o
salvamento é bloqueado com a mensagem "Você ajustou o perfil financeiro para «X». Justifique o
ajuste…"; (c) limpe "Custeio da moradia" no card → a posição M vira `?` e "Custeio da moradia (card
do perfil)" entra nos faltantes.
