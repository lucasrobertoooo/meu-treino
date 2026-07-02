# HOME_SESSIONS — Treinos em casa (Opção C)

Documento canônico da feature "treinos em casa" implementada em 2026-06-30.
Lê em conjunto com `HANDOFF.md`.

---

## Contexto (o que motivou)

Lucas perguntou em 2026-06-30: "hoje não vou treinar por trabalho. Amanhã o app vai sugerir B ou C? Estarei em casa, faz sentido fazer abdominal aqui? Como organizo isso no app?"

3 agentes foram disparados em paralelo pra responder:
1. **Como outros apps lidam com missed workout** (Hevy, Strong, FitNotes, RP, Fitbod, JuggernautAI, Boostcamp)
2. **Literatura científica** sobre missed sessions, frequência de core, active recovery, detraining, greasing the groove
3. **Análise técnica + propostas de design** pro próprio MeuTreino

### Conclusão dos agentes

- **Rotação ABCD do app já é sequencial** (`suggestedNextDay` linha 2355 — pega último treino com sets válidos e devolve próximo). Pular 1 dia simplesmente desliza tudo. Sem prejuízo no programa.
- **Cientificamente, pular 1 sessão = zero prejuízo** mensurável (Bosquet 2013, Ogasawara 2013, Schoenfeld 2014). Detraining sério só vira mensurável após 14+ dias.
- **Core/abs em casa é active recovery validado** (Dupuy 2018, McGill 2007, Behm 2010). Reto abdominal ~55% fibra tipo I — tolera alta frequência. Não atrapalha grupos pesados.
- **Padrão UX dominante**: dois primitivos separados — "start routine" (avança fila) vs "empty workout" (loga histórico sem avançar fila). Hevy/Strong/FitNotes usam exatamente isso.
- **Streak diário é punitivo em programa 4x/sem** — estudo Fitbod: usuários focados em streak diário tiveram 3.2× mais chance de abandonar após 1 dia perdido. Hevy usa streak semanal explicitamente.

### Decisão: Opção C completa

Catálogo de 5 sessões de casa, recomendador inteligente baseado no próximo treino ABCD, storage isolado pra não corromper progressão.

---

## HOME_SESSIONS (5 templates)

Cada template tem `name`, `focus`, `desc`, `duration`, `bestBefore`, `avoidBefore`, `canSkipNextDay`, `ex[]`.

| ID | Sessão | Duração | bestBefore | avoidBefore | Permite pular amanhã |
|---|---|---|---|---|---|
| `core_completo` | Core Completo | 20min | (sempre vale) | — | Abdominal declinado + Cadeira romana (em B/D) |
| `panturrilha_cardio` | Panturrilha + Cardio Z2 | 25min | A, C | — | Panturrilha (em B/D) |
| `posterior_mobilidade` | Posterior + Mobilidade | 20min | A, C | B, D | Mesa flexora (em B/D) |
| `peito_triceps` | Calistenia Peito + Tríceps | 20min | B, D | A, C | — (volume extra) |
| `ombro_postura` | Ombro Lateral + Postura | 15min | B, D | A, C | — (volume extra pra prioridade #1) |

Definido em `index.html` linha ~2280, antes do `weeklyVolume`.

### Exercícios por sessão

**Core Completo** (~20min):
- Hollow hold 3×30s · Dead bug 3×10/lado · Reverse crunch 3×15 · Side plank com elevação de quadril 3×12/lado · Bird dog 3×8/lado

**Panturrilha + Cardio Z2** (~25min):
- Panturrilha em pé na escada 4×15-20 · Polichinelo baixo 6×40s · Marcha estacionária joelho alto 4×45s · Burpee leve 3×10

**Posterior + Mobilidade** (~20min):
- Ponte glútea (single leg) 3×12/lado · Single-leg deadlift sem peso 3×10/lado · Good morning sem carga 3×15 · Alongamento isquio 3×30s/lado · Mobilidade quadril 90/90 3×45s

**Calistenia Peito + Tríceps** (~20min):
- Pike push-up 3×6-12 · Decline push-up 3×8-15 · Diamond push-up 3×6-12 · Tríceps mergulho no sofá 3×10-15 · Flexão diamante negativa lenta 2×5

**Ombro Lateral + Postura** (~15min):
- Elevação lateral isométrica (mochila/livros) 3×30s · Face pull com elástico/toalha 3×15 · YTW prone 3×8 cada letra · Wall slide 3×10 · Elevação frontal com mochila 2×12

---

## Recomendador `pickHomeSessions(nextDay)`

Scoring (definido em `index.html` ~linha 2415):

- **+30** se `bestBefore` inclui `nextDay` → tier `best`
- **−50** se `avoidBefore` inclui `nextDay` → tier `avoid`
- **+20** se `canSkipNextDay[nextDay]` tem entradas (palpável: "faz isso e pula X amanhã")
- **+10** por grupo muscular do exercício principal em `MG_PRIORITY` (ombro_lat, peito_sup, biceps, triceps)
- **+15** bonus pra `core_completo` (sub-treinado em ABCD Push/Pull)

Retorna array ordenado por score com `{id, tmpl, score, tier, reason}`.

### Validação do scoring (testado via node --check)

| Próximo treino | Top recomendado (best) | Evite (avoid) |
|---|---|---|
| **B** (Pull 1) | Calistenia Peito/Tri (50), Ombro/Postura (40), Core (35) | Posterior/Mobilidade (−30) |
| **C** (Push 2 — Ombro) | Panturrilha+Z2 (30), Posterior/Mob (30), Core (15) | Peito/Tri (−30), Ombro/Postura (−40) |
| **A** (Push 1 — Peito) | Panturrilha+Z2 (30), Posterior/Mob (30), Core (15) | Peito/Tri (−30), Ombro/Postura (−40) |
| **D** (Pull 2) | Igual a B |

---

## Storage isolado (`meutreino_freelog_v1`)

Adicionado em `LS` e `DEFAULTS`. Schema:

```js
ST.freelog = {
  "<templateId>_<exIdx>": [{date:"YYYY-MM-DD", sets:[{kg, reps, rir, done}]}]
}
```

Exemplo: `ST.freelog["core_completo_0"]` = histórico do "Hollow hold".

**Princípio invioláv el**: as funções de progressão (`suggestedNextDay`, `suggestNext`, `isPRSession`, `detectPlateau`, `shouldSwapExercise`) **só leem `ST.logs`**. Nunca olham `freelog`. Isso garante:

- Rotação ABCD nunca quebra por causa de sessão de casa
- PRs/e1RM dos compostos não são poluídos por calistenia
- `historicalBestE1RM` continua limpo

### Funções novas (mirror das de logs)

- `freeExId(sessionId, i)` — gera ID
- `lastFreeSession(id)` / `todayFreeSession(id)` / `upsertFreeToday(id, sets)`
- `freeWorkoutDates()` — datas com qualquer freelog válido (set válido = `done + reps>0`, kg pode ser 0)
- `freeSessionsOnDate(date)` — sessões livres na data X
- `homeTemplatesCompletedOn(date)` — templates únicos completados na data

---

## `weeklyVolume` agora soma freelog

Segundo loop em `weeklyVolume()` (linha ~2470):
- Itera `ST.freelog`, separa `templateId` e `exIdx`
- Olha `HOME_SESSIONS[templateId].ex[exIdx].mg`
- Soma `doneCount × peso(mg)` igual ao ABCD
- Set válido pra calistenia: `done + reps>0` (kg pode ser 0)

Resultado: barra de **Core** sobe na aba Corpo quando fizer Core em casa. Idem panturrilha, posterior, etc.

---

## `weekStreak` — bug fix P3

Modelo Hevy: **semanas consecutivas com ≥3 treinos ABCD**.

```js
function weekStreak(){
  // Conta semanas (janela rolling de 7 dias) pra trás
  // Semana atual em andamento (≥1 treino) usa anterior como base
  // Semana completa com ≥3 = válida pra streak
}
```

UI principal (`renderDays` linha ~2760) passa a mostrar:
- "🔥 Semanas seguidas: X" (com SVG `I.flame`)
- "Esta semana: X/4 treinos completados" (mantém)

`getStreak()` (antigo, dias consecutivos) ainda existe, agora inclui `freeWorkoutDates()` na união via `activityDates()` — preserva streak em dias de casa. Aparece como fallback no header de Hoje quando `weekStreak === 0`.

---

## Banner "feito ontem em casa" no programa

No `renderDay(d)` (linha ~2840), pra cada exercício do programa:

1. Olha `homeTemplatesCompletedOn(yesterday)`
2. Pra cada template, verifica se o nome do exercício está em `canSkipNextDay[d]`
3. Se sim, renderiza banner verde com `I.check2` antes do `sugBlock`

Exemplo prático: você faz Core Completo segunda à noite. Terça abre treino B, e os dois exercícios de core (Abdominal declinado + Cadeira romana) aparecem com banner:

> ✓ **Core Completo feito ontem em casa** · esse músculo já foi trabalhado — pode pular se preferir (ou fazer leve)

---

## Cleanup completo de emojis

Removidos todos os 22 emojis do `index.html` + 2 do `sw.js`:
- Novos: `🏠 ✅ 🔥 ⚡ 🎯 ⚠️ ⏱️ 💾 ▶ ⏸ 📱`
- Substituídos por SVGs do objeto `I` (`I.flame`, `I.bolt`, `I.trophy`, `I.moon`, `I.check2`)
- Onde SVG não fazia sentido (toasts, push OS-level): texto puro

Regra agora canônica em `~/.claude-moco/projects/-Users-zana/memory/feedback_no_emojis.md` — aplicada a todos os projetos.

---

## Como testar (validação manual em 6 passos)

1. Aba **Hoje** → ver card verde "CASA · Recomendado pra hoje" (ou "Evite hoje" / "Opção pra hoje" dependendo de qual ABCD é o próximo)
2. Tocar → abre `renderHomeDay` com banner azul "se completar essa sessão hoje, pode pular X/Y no treino de amanhã"
3. Marcar uns sets → ver na aba **Corpo** que volume do grupo subiu
4. Voltar pra aba **Treinos** → confirmar que próximo continua sendo o mesmo (rotação preservada)
5. Abrir o treino do programa do dia seguinte → confirmar banner verde "Sessão X feita ontem em casa" nos exercícios cobertos
6. Card streak: passou de "Streak dias" pra "Semanas seguidas" com ícone SVG `I.flame`

---

## Próximos passos sugeridos (não implementados)

- **Sub-templates editáveis**: usuário escolher quais exercícios de cada HOME_SESSIONS prefere fazer (hoje é fixo)
- **Histórico de sessões livres** na aba Corpo (timeline)
- **Recomendador mais inteligente**: olhar volume semanal atual e priorizar grupos abaixo de MEV
- **Notificação push pra sessão de casa**: "Faltam 4h pra dormir — 15min de Core?" (depende de payload encryption no push-worker)
- **Permitir registrar sessão de casa retroativa** (ex: "fiz isso ontem")
- **Outras pendências P3 do HANDOFF original**:
  - Incrementos por chapa BR (5kg em polia, 2.5kg em halter)
  - `upsertToday` raro duplicar sessão na virada de meia-noite
