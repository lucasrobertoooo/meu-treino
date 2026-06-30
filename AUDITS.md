# MeuTreino · Cross-cutting audits

**Data inicial:** 2026-06-30 (manhã)
**Última atualização:** 2026-06-30 (noite, após implementação)
**Origem:** 5 audits transversais propostos no `DAY1_FEEDBACK.md`. Cada feedback do dia 1 expôs um padrão genérico — esse doc mapeia onde mais o padrão aparece.
**Backup do dia 1:** `backups/backup_2026-06-30_day1.json`

## 🎯 STATUS GERAL DOS AUDITS

| Audit | Achados originais | Status |
|---|---|---|
| A · Imagens | 1 bug + 3 suspeitas + 2 ambiguidades | ✅ Bug fix (Free DB Dumbbell_Lateral_Raise) · ⏸ 3 suspeitas pendem revisão visual · ⏸ aquarela local (precisa $) |
| B · Botões | 5 botões com feedback sub-ótimo | ✅ Todos os 5 fixados (food undo, measures toast, exportar clipboard, + alimento label, desmarcar fecha timer) |
| C · Foreground-only | 6 features foreground-only | ✅ Push remoto via Worker resolve descanso · ⏸ Streak/PR/proteína/deload pushes (precisa payload encryption) |
| D · Storage resilience | 13/14 writes sem rollback + zero quota check + zero persist | ✅ persist() + quota >80% toast + saveK toast no fail · ⏸ IndexedDB migration (defer) |
| E · Surfacing contextual | Aba Mais cemitério; Corpo "puxe pra ver"; Hoje sem dica | ✅ Card "Foco de hoje" + PR-tracker + Volume baixo + Sono <6h · ⏸ Aba Mais biblioteca pesquisável |

---

## 🐛 Bug colateral encontrado durante audit (não tava no feedback)

**Phantom session em A_1 (Elevação lateral halter):**

Backup mostra `logs.A_1[0]` = `2026-06-29` com 3 sets vazios (sets[0] tem `kg:"24", reps:"", done:false`, os outros 2 estão `{kg:"", reps:"", done:false}`).

Isso aconteceu porque você abriu o exercício no dia 1 (06-29), digitou 24kg num set, mas nunca checou ✓ — e o `upsertToday` criou a sessão pelo `onLog` (input change). Sessão "fantasma" não impacta volume/e1RM/sugestão (todos filtram `kg>0 && reps>0`), **mas polui `lastTxt`**: hoje o exercício mostra "Última (06-29): 24×0 · 0×0 · 0×0" como histórico, que é informação ruidosa.

**Fix necessário (P1):**
- Limpar no load: filtrar sessões sem `hasValidDone()` ao carregar `logs` (ou pelo menos no `lastSession`)
- Ou: filtrar no `lastTxt` rendering (mais defensivo, não destrutivo)
- Causa-raiz: `onLog` (linha 1881) cria a sessão a cada keystroke — deveria criar só quando user faz commit (check ✓ ou perde foco).

---

## Audit A · Imagens (40+ exercícios)

**Mecânica:** `photoURL(name)` em `index.html:1142` faz lookup em `PHOTO_LOCAL` primeiro (imagens locais `img/*.jpg`), depois fallback pra `PHOTO_ID` (Free Exercise DB yuhonas).

### Inventário completo

**Treino A · Push 1 (6 exercícios)**

| # | Exercício | Source | Foto | Status |
|---|---|---|---|---|
| A_0 | Supino inclinado halter 30° | DB | `Incline_Dumbbell_Press` | ✅ ok |
| A_1 | Supino reto halter ou máquina | DB | `Dumbbell_Bench_Press` | ✅ ok |
| A_2 | Crucifixo na polia baixa | DB | `Low_Cable_Crossover` | ✅ ok |
| A_3 | **Elevação lateral halter** | LOCAL | `cable-lateral-raise.jpg` | ❌ **BUG confirmado** (item 5) — gerar `dumbbell-lateral-raise.jpg` |
| A_4 | Tríceps francês / extensão acima da cabeça | DB | `Seated_Triceps_Press` | ⚠️ revisar — Free DB mostra extensão sentado com 1 halter (próximo, mas o francês deitado é diferente) |
| A_5 | Tríceps na polia (corda) | DB | `Triceps_Pushdown_-_Rope_Attachment` | ✅ ok |

**Treino B · Pull 1 (10 exercícios)**

| # | Exercício | Source | Foto | Status |
|---|---|---|---|---|
| B_0 | Puxada na polia (pegada aberta) | DB | `Wide-Grip_Lat_Pulldown` | ✅ ok |
| B_1 | Remada sentada na polia ou máquina | DB | `Seated_Cable_Rows` | ✅ ok |
| B_2 | Crucifixo inverso (peck deck/polia) | DB | `Reverse_Machine_Flyes` | ✅ ok |
| B_3 | Elevação lateral (halter ou polia) | LOCAL | `cable-lateral-raise.jpg` | ⚠️ nome diz "halter ou polia" mas foto é polia — ambíguo; trocar pra `dumbbell-lateral-raise.jpg` (halter listado primeiro) |
| B_4 | Rosca inclinada com halter | DB | `Incline_Dumbbell_Curl` | ✅ ok |
| B_5 | Mesa flexora | LOCAL | `lying-leg-curl.jpg` | ✅ ok |
| B_6 | Cadeira extensora | DB | `Leg_Extensions` | ✅ ok |
| B_7 | **Abdominal declinado com anilha** | DB | `Weighted_Crunches` | ⚠️ revisar — Free DB `Weighted_Crunches` é abdominal no chão com anilha, não declinado |
| B_8 | Cadeira romana (joelho dobrado) | LOCAL | `roman-chair.jpg` | ✅ ok |
| B_9 | Panturrilha | DB | `Standing_Calf_Raises` | ✅ ok |

**Treino C · Push 2 (6 exercícios)**

| # | Exercício | Source | Foto | Status |
|---|---|---|---|---|
| C_0 | Desenvolvimento sentado com halter | DB | `Seated_Dumbbell_Press` | ✅ ok |
| C_1 | Elevação lateral (polia ou halter) | LOCAL | `cable-lateral-raise.jpg` | ✅ ok (polia listada primeiro) |
| C_2 | Supino inclinado halter 30° | DB | `Incline_Dumbbell_Press` | ✅ ok (idem A_0) |
| C_3 | Peck deck ou crucifixo máquina | DB | `Butterfly` | ✅ ok |
| C_4 | Extensão de tríceps acima da cabeça | DB | `Cable_Rope_Overhead_Triceps_Extension` | ✅ ok |
| C_5 | Tríceps na polia | DB | `Triceps_Pushdown_-_Rope_Attachment` | ✅ ok |

**Treino D · Pull 2 (11 exercícios)**

| # | Exercício | Source | Foto | Status |
|---|---|---|---|---|
| D_0 | Puxada na polia (pegada neutra/fechada) | DB | `Close-Grip_Front_Lat_Pulldown` | ✅ ok |
| D_1 | Remada na polia ou máquina | DB | `Seated_Cable_Rows` | ⚠️ mesma foto do B_1 — ok pra "remada", mas se queira variar visualmente sinalizando o ângulo diferente, gerar foto distinta |
| D_2 | Crucifixo inverso | DB | `Reverse_Machine_Flyes` | ✅ ok |
| D_3 | Elevação lateral (halter ou polia) | LOCAL | `cable-lateral-raise.jpg` | ⚠️ igual B_3 — corrigir |
| D_4 | Rosca direta na polia ou halter | DB | `Standing_Biceps_Cable_Curl` | ✅ ok |
| D_5 | Rosca martelo | DB | `Hammer_Curls` | ✅ ok |
| D_6 | Mesa flexora | LOCAL | `lying-leg-curl.jpg` | ✅ ok |
| D_7 | Cadeira extensora | DB | `Leg_Extensions` | ✅ ok |
| D_8 | Abdominal declinado com anilha | DB | `Weighted_Crunches` | ⚠️ idem B_7 |
| D_9 | Cadeira romana (joelho dobrado) | LOCAL | `roman-chair.jpg` | ✅ ok |
| D_10 | Panturrilha | DB | `Standing_Calf_Raises` | ✅ ok |

### Achados

- **1 bug confirmado:** A_3 mostrando polia quando deveria ser halter (item 5 do feedback).
- **3 entries suspeitas** que valem revisão visual antes de afirmar bug:
  - A_4 Tríceps francês — Free DB image é "seated triceps press" (overhead com 1 halter sentado). Acabamento próximo, mas se o francês visualizado no cue for "deitado, halter atrás da cabeça", precisa gerar local.
  - B_7/D_8 Abdominal declinado — Free DB mostra crunch no chão com anilha, não banco declinado.
- **2 entries com ambiguidade halter/polia** que herdam o mesmo cable image (B_3, D_3) — corrigir após gerar dumbbell-lateral-raise.jpg.
- **Cobertura:** 100% dos 33 exercícios distintos têm imagem mapeada. Nenhum cai no fallback null.

### Recomendação
- [ ] **P1** Gerar `dumbbell-lateral-raise.jpg` no ElevenLabs (prompt em `~/Desktop/treino-prompts-imagens.txt`)
- [ ] **P1** Atualizar mapping A_3/B_3/D_3 conforme tabela
- [ ] **P2** Revisar A_4 (Tríceps francês) — abrir Free DB e ver `Seated_Triceps_Press/0.jpg`. Se for "press sentado" e não "francês deitado", gerar `lying-french-press.jpg`
- [ ] **P2** Revisar B_7/D_8 (Abdominal declinado) — se Free DB mostrar floor crunch, gerar `decline-weighted-crunch.jpg`
- [ ] **P3** Considerar gerar todas as 21 fotos restantes do PHOTO_ID pra desconectar 100% do Free Exercise DB (já estava no roadmap do HANDOFF)

---

## Audit B · Botões + estados pós-ação

**Padrão procurado:** botão cujo estado pós-clique é visualmente igual ao pré-clique (causa confusão, double-tap, ação errada).

### Inventário (24 botões interativos)

| Linha | Botão | Pós-clique | Status |
|---|---|---|---|
| 956 | FAB Timer | abre overlay | ✅ ok (overlay = feedback claro) |
| 961-973 | 4 nav tabs | troca aba + classe `.on` | ✅ ok |
| 996-998 | 3 presets timer (1:30 / 2:00 / 0:45) | seta timer + `.active` no preset | ✅ ok |
| 1001 | "Fechar" timer | fecha overlay | ✅ ok |
| 1002 | **`ppbtn` Iniciar/Pausar** | texto muda, MAS volta pra "Iniciar" no done | ❌ **BUG item 3** confirmado |
| 1709 | "Feito" deload alert | marca deload + re-render → banner some | ✅ ok (sumir = feedback) |
| 1740 | "Treinos" back | volta pra lista | ✅ ok |
| **1800** | **Set check ✓** | toggle `.on` + flashSaved (1.2s) + abre timer | ⚠️ duplo papel: marca done + dispara timer. Feedback do save é sutil (sv_id pisca 1.2s). Mais grave: se você quis só TIRAR o check, o timer abre mesmo assim (linha 1887 abre timer só no `if(.on)`, ok — mas se você re-clica pra desmarcar, o timer fica aberto. Verificar fluxo). |
| 1846 | "Descanso X:XX" | abre timer no exercício | ✅ ok |
| 1933 | Atalho treino do dia | navega pro treino | ✅ ok |
| **1973** | **"+ Alimento personalizado"** | toggle form | ⚠️ texto do botão não muda. Após abrir, clicar de novo fecha sem confirmação — ok pra desfazer, mas o botão deveria virar "Fechar" ou ficar `.active` |
| 1983 | "Cancelar" form custom | fecha form | ✅ ok |
| 1984 | "Adicionar" form custom | adiciona + fecha form + re-render | ✅ ok (item aparece na lista = feedback) |
| **2013** | **✕ remove food entry** | splice imediato + re-render, **sem confirm** | ⚠️ tap acidental no celular = perda silenciosa. Adicionar `confirm()` ou undo toast (5s) |
| 2029 | Toggle suplemento | classe `.on` muda + persiste | ✅ ok |
| 2074 | food-item (resultado busca) | addFood + re-render + preserva scroll/query | ✅ ok (bem desenhado) |
| **2251** | **"Salvar medidas"** | save + re-render | ⚠️ **silent success** — sem toast/feedback. Lucas pode ficar inseguro se foi salvo. Adicionar flashSaved toast |
| 2275 | ✕ delPhoto | confirm + delete | ✅ ok |
| **2396** | **"Exportar"** | abre textarea com JSON pra user copiar manual | ⚠️ UX mobile ruim — usar `navigator.clipboard.writeText()` + toast "Copiado!" |
| 2397 | "Importar" | toggle textarea de importação | ✅ ok |
| 2398 | "Apagar tudo" | confirm + reset | ✅ ok |
| 2402 | "Confirmar importação" | parse + apply + alert sucesso/erro | ✅ ok |

### Achados

- **1 bug confirmado** (item 3, ppbtn pós-done): já documentado.
- **5 botões com feedback sub-ótimo:**
  - `toggleDone` (1800): feedback de save sutil, e re-clique pra desmarcar não fecha timer aberto
  - `+ Alimento personalizado` (1973): estado aberto vs fechado não comunicado pelo botão
  - `✕ food entry` (2013): sem confirmação, perda silenciosa
  - `Salvar medidas` (2251): silent success
  - `Exportar` (2396): força copy manual

### Recomendação
- [ ] **P0** Fix item 3 (ppbtn done state) — coberto no DAY1_FEEDBACK
- [ ] **P1** `✕ food entry` (2013): adicionar undo toast 5s ou confirm dialog
- [ ] **P1** `Salvar medidas` (2251): toast "Medidas salvas" 2s
- [ ] **P1** `Exportar` (2396): copiar pra clipboard + toast (e oferecer `navigator.share` em paralelo pra Files)
- [ ] **P2** `+ Alimento personalizado` (1973): trocar pra "Fechar" quando aberto
- [ ] **P2** `toggleDone` (1800): se re-checar pra OFF, fechar timer se aberto pra esse exercício

---

## Audit C · Foreground-only assumptions

**Padrão procurado:** features que assumem o app aberto no foreground pra entregar valor.

### Inventário

| Feature | Como entrega | Foreground-only? | Severidade |
|---|---|---|---|
| **Timer end notification** | chime + flash + vibrate (no iOS) | 100% ❌ | **P0** (item 1) |
| Wake Lock | mantém tela acesa | Foreground only (esperado) | ok |
| **Deload alert** | banner vermelho no topo da aba Treinos | só quando user abre app | P2 — daily push "5 semanas treinando, hoje pode ser deload" |
| **Plateau warning** | banner laranja no exercício aberto | só ao abrir exercício específico | P3 — pode esperar |
| **Swap exercise suggestion** | banner azul no exercício | idem | P3 |
| **PR badge** | dourado no canto da foto durante a sessão | só visível durante o treino | P2 — toast push no momento do PR ("PR! Supino 24×8") |
| **Streak risk** | nenhuma — streak decrementa silenciosamente | 100% silent | P2 — push "treino hoje pra manter streak" no fim do dia se não logou |
| **Sugestão de próxima carga** | banner verde no exercício | só durante treino | ok (contextual, faz sentido) |
| **Macros do dia** | barras na aba Hoje | só ao abrir | P2 — push 22h "Falta 30g de proteína hoje" |
| **Cardio recommendation** | não existe | n/a | P3 |
| **Backup reminder** | não existe | 100% silent | P1 — toast semanal "faça backup" |

### Achados

- **Critical foreground gap:** timer (item 1) — único onde a falta de notification é blocker.
- **High-value pushes deferidos:** streak risk, PR celebration, proteína baixa fim do dia, backup semanal. Todos exigem ou (a) push notification scheduling no SW ou (b) push remoto.

### Recomendação
- [ ] **P0** Timer notification (já no DAY1_FEEDBACK item 1)
- [ ] **P1** Backup reminder semanal (domingo 20h)
- [ ] **P2** Streak risk push (se 18h e não treinou + dia agendado)
- [ ] **P2** PR celebration toast (sincrono com item 10 do feedback)
- [ ] **P2** Proteína baixa push (22h se <70% da meta)
- [ ] **P3** Deload week push (segunda-feira da 5ª semana)

🤖 **Android port:** todas essas pushes ficam **mais fáceis** (SW lifetime maior, push sem A2HS obrigatório).

---

## Audit D · Storage resilience

**Padrão procurado:** writes em localStorage sem rollback + quota check + persistência.

### Inventário de calls a `saveK(...)`

| Linha | Caller | Rollback se falhar? | Critical? |
|---|---|---|---|
| 1360 | `upsertToday` (logs) | ❌ | **alto** — perde sessão de treino |
| 1649 | `markDeloadDone` (meta) | ❌ | médio — perde data de deload |
| 2058 | `setBW` (bw) | ❌ | alto — perde pesagem do dia |
| 2063 | `setSleep` (sleep) | ❌ | médio |
| 2084 | `addFood` (protein) | ❌ | médio |
| 2098 | `removeFoodEntry` (protein) | ❌ | médio |
| 2124 | `addCustomFood` (protein) | ❌ | médio |
| 2134 | `toggleSuppl` (suppl) | ❌ | baixo |
| 2143 | `setCardio` (cardio) | ❌ | médio |
| 2298 | `saveMeasures` | ❌ | médio |
| 2314 | `addPhoto` | ✅ **único com rollback** + alert | alto |
| 2327 | `delPhoto` | ❌ | médio |
| 2373/2378/2383 | Macro targets oninput | ❌ | baixo |
| 2422/2429 | `importData` | ❌ | alto |
| 2443 | `resetData` | ❌ | n/a (já reset) |

### Achados

- **13 de 14 writes** não checam o retorno de `saveK()`. Se localStorage encher ou ITP evictar mid-write, a sessão é perdida silenciosamente.
- **Zero quota monitoring.** Sem `navigator.storage.estimate()` no boot ou periodicamente.
- **Zero `navigator.storage.persist()`.** Storage está sob risco de eviction.
- **Migration de `protein` legacy** (objeto numérico → array) roda no boot, mas se falhar não há fallback nem aviso.
- **`upsertToday` é o write mais frequente** (cada keystroke nos sets) e o que mais perderia se falhasse.

### Recomendação
- [ ] **P0** `navigator.storage.persist()` no boot (1 linha — `if(navigator.storage?.persist) await navigator.storage.persist();`) 🍎
- [ ] **P0** Wrap genérico `safeSave(k, fn)` que checa retorno + rollback + toast erro
- [ ] **P1** Aplicar `safeSave` em `upsertToday`, `setBW`, `addFood`, `saveMeasures`, `importData`
- [ ] **P1** `navigator.storage.estimate()` no boot — se >80% usado, banner "Storage quase cheio"
- [ ] **P1** Lembrete semanal de backup (já no audit C)
- [ ] **P2** Migrar fotos pra IndexedDB quando passar de 2MB total
- [ ] **P3** Considerar dual-write (localStorage + IndexedDB) pros dados críticos (logs, bw, measures)

🤖 **Android:** storage é mais permissivo; quota check ainda boa prática, persist() ainda recomendado.

---

## Audit E · Surfacing contextual

**Padrão procurado:** informação útil que mora num lugar que o user só visita uma vez (= info morta).

### Inventário por aba

**Aba Mais (info "lida 1x"):**
- 12 princípios científicos — lidos no dia 1, depois zero retorno
- "Parecer maior" (largura, postura, cheião rápido) — idem
- Nutrição (proteína 1.8-2.2, banco de alimentos info) — idem
- Metas editáveis — touch points raros (uma vez, talvez nunca de novo)
- Backup — touch point ocasional

**Aba Corpo (info "pull-to-see"):**
- Semanas treinando, sets totais — não-urgentes
- Sparkline peso — útil mas user precisa ir lá
- Volume semanal por grupo — **crítico pra prioridades** mas escondido
- PRs por exercício — celebratório mas escondido
- Medidas — manual input ocasional
- Fotos progresso — semanal/mensal

**Aba Hoje (semi-contextual):**
- Atalho treino do dia ✅
- Peso, sono, macros, supl, cardio — tudo input, nada surfacing
- **Falta:** dica do dia, alerta sono baixo, alerta volume prioridade, alerta deload próximo, lembrete backup

**Aba Treinos (entry point):**
- Lista ABCD + deload alert ✅
- **Falta:** lembrete de cintura crescendo, PR potencial hoje, "essa é a última semana antes do deload"

### Achados

- **Aba Mais é cemitério de info.** Princípios provavelmente nunca relidos. Migrar pro contextual elimina 80% do conteúdo dessa aba.
- **Aba Corpo é "puxe pra ver"** — gráficos e PRs deviam fazer um cameo no Hoje.
- **Aba Hoje surface zero dicas contextuais hoje.** É só input. Maior oportunidade do app.

### Padrões a aplicar (já no DAY1_FEEDBACK item 4)
- JITAI (Just-In-Time Adaptive Interventions)
- Spaced repetition de princípios (`meutreino_seen_v1`)
- "Block of the day" — 1 destaque rotativo
- Card pre-workout / during / post-workout

### Recomendações específicas surgidas no audit
- [ ] **P1** Card "Antes do treino" no Hoje com 1 princípio rotativo (já no DAY1_FEEDBACK)
- [ ] **P2** Mini PR-tracker no Hoje: "Você tá perto de PR no Supino" (e1RM atual + threshold)
- [ ] **P2** Volume snapshot no Hoje: "Ombro lateral: 8/18 sets esta semana — hoje é dia D, capricha"
- [ ] **P2** Sono <6h ontem: card "Treino mais leve hoje? (1 rep a menos)"
- [ ] **P3** "Última semana antes do deload" warning no Treinos
- [ ] **P3** Aba Mais vira "biblioteca pesquisável" + glossário (deixa de ser passiva)

---

## Checklist consolidada dos audits (deltas vs DAY1_FEEDBACK)

Esses são **achados novos** dos audits — itens que NÃO estavam no DAY1_FEEDBACK original.

### P0 — adicionar à fila
- [ ] **D-1:** `navigator.storage.persist()` no boot (1 linha, gigantesco upside) 🍎

### P1 — adicionar à fila
- [ ] **Bug colateral:** limpar phantom session ao load (logs A_1[0] de 06-29)
- [ ] **A-1:** Gerar `dumbbell-lateral-raise.jpg` + corrigir B_3 e D_3 também
- [ ] **B-1:** `✕ food entry` (2013) — undo toast ou confirm
- [ ] **B-2:** `Salvar medidas` (2251) — toast "Salvo"
- [ ] **B-3:** `Exportar` (2396) — `navigator.clipboard.writeText` + toast + offer `navigator.share`
- [ ] **C-1:** Backup reminder semanal (domingo)
- [ ] **D-2:** Wrapper `safeSave(k, fn)` + aplicar nos writes críticos
- [ ] **D-3:** `navigator.storage.estimate()` no boot → banner se >80%

### P2 — adicionar à fila
- [ ] **A-2:** Revisar Tríceps francês (A_4) — se Free DB não bate, gerar local
- [ ] **A-3:** Revisar Abdominal declinado (B_7/D_8) — idem
- [ ] **B-4:** `+ Alimento personalizado` (1973) — trocar pra "Fechar" quando aberto
- [ ] **B-5:** `toggleDone` (1800) — fechar timer ao desmarcar
- [ ] **C-2:** Streak risk push 18h
- [ ] **C-3:** PR celebration toast (sync com item 10 feedback)
- [ ] **C-4:** Proteína baixa push 22h
- [ ] **E-1:** Mini PR-tracker no Hoje
- [ ] **E-2:** Volume snapshot no Hoje
- [ ] **E-3:** Sono baixo → card "treino mais leve"

### P3 — adicionar à fila
- [ ] **A-4:** Gerar todas as 21 fotos restantes pra zerar Free Exercise DB
- [ ] **C-5:** Deload week push (segunda 5ª semana)
- [ ] **D-4:** Migrar fotos pra IndexedDB
- [ ] **D-5:** Dual-write localStorage + IndexedDB pra dados críticos
- [ ] **E-4:** Aba Mais vira biblioteca pesquisável

---

## Priorização atualizada (DAY1_FEEDBACK + AUDITS merged)

### P0 (próximo treino, ~2026-07-02)
1. Item 1 feedback — notification + audio resiliente + Web Push avaliação 🍎
2. Item 2 feedback + Audit D-1 — `storage.persist()` + safeSave wrapper + backup snapshot + confirmar A2HS standalone 🍎
3. Item 3 feedback — refator estado do timer + botão "Fechar" no done
4. Item 5 feedback + Audit A-1 — gerar dumbbell lateral + corrigir 3 entries

### P1 (próximas 2 semanas)
- Item 1: timer minimizável
- Item 4 + Audit E: card "Antes do treino" com dica contextual
- Item 7: workout session duration tracking
- Audit B-1/2/3: melhorias UX em ✕food / Salvar medidas / Exportar
- Audit C-1: backup reminder semanal
- Audit D-2/3: safeSave wrapper + quota banner
- Bug phantom session A_1

### P2 (próximo mês)
- Item 4: cards Durante/Depois do treino
- Item 6: FAB Speed Dial
- Item 8: auto-close timer com visibilitychange
- Item 10: celebração ao completar
- Audit A-2/3: revisar Tríceps francês + Abdominal declinado
- Audit B-4/5: + Alimento toggle text + toggleDone close timer
- Audit C-2/3/4: pushes (streak / PR / proteína)
- Audit E-1/2/3: surfacing PR-tracker + volume + sono

### P3 (stretch)
- Item 1: Web Push remoto
- Item 4: algoritmo de rotação
- Item 9: cardio heurístico
- Audit A-4: zerar Free Exercise DB
- Audit C-5: deload push
- Audit D-4/5: IndexedDB migration
- Audit E-4: aba Mais → biblioteca

---

## Conclusão

5 audits rodados. Achados novos significativos:
- **1 bug colateral** (phantom session A_1) — fix simples
- **1 P0 esquecido** (`storage.persist()`)
- **3 botões com feedback sub-ótimo** (food ✕, Salvar medidas, Exportar)
- **5 oportunidades de push notification** além do timer
- **13 writes sem rollback** no storage
- **Aba Mais quase morta** — boa parte do conteúdo migra pro contextual

Antes de começar implementação P0, **confirme:**
1. App é Caminho A (Safari → Add to Home Screen → standalone) ou Caminho B (Shortcuts.app → Safari normal)? Push notification depende disso.
2. Topo no roadmap: notificações (item 1) ou storage persistence (item 2 + Audit D-1)? Recomendo Storage primeiro — é 1 linha que protege tudo, e push notification vai exigir mais trabalho (~1-2 dias).
