# MeuTreino · HANDOFF v3

PWA single-file de hipertrofia ABCD Push/Pull. App pessoal pro Lucas usar no iPhone na academia.

**Última atualização:** 2026-07-08.02 (Histórico de treinos exposto — mini-histórico no treino aberto + seção na aba Corpo (data/duração/sets/volume, do `session.history` que já existia). Inteligência de dia corrigida: já-treinou-hoje não marca mais o próximo como "HOJE". SHELL v15)

**Antes: 2026-07-08.01** — Edição de exercícios pelo app: nome/descrição/nota por exercício, override isolado em `ST.exmeta` ancorado por `id` estável (git nunca sobrescreve).

## Antes de codar: ler primeiro
- **§ Sessão 2026-07-02** neste doc — rename das laterais, fix da foto quebrada, refactor de PHOTO_ID/ALTERNATIVES, fix timer nativo em PWA standalone, APP_VERSION, e pendências de fotos
- **§ Timer nativo iOS (Atalhos)** neste doc — arquitetura + setup + limitação do swap
- **`HOME_SESSIONS.md`** — 5 sessões em casa, pickHomeSessions, storage freelog, weekStreak, banner skip (feature 2026-06-30)
- **`DAY1_FEEDBACK.md`** — 10 itens originais do dia 1 (2026-06-29) + status de cada
- **`AUDITS.md`** — 5 cross-cutting audits (imagens, botões, foreground-only, storage, surfacing) + checklist P0-P3
- **`PLATFORM_NOTES.md`** — particularidades iOS Safari PWA (Audio bg, Vibration, Push, Wake Lock, ITP) + diff Android
- **`SECRETS.local.md`** — credenciais do Cloudflare Worker (gitignored — só local)
- **`push-worker/`** — código do Cloudflare Worker (web push) + wrangler config
- **`backups/backup_2026-06-30_day1.json`** — snapshot do dia 1 (recovery se localStorage perder)

## Regras de produto/UI
- **Sem emojis em nada visível** (UI, toasts, push, banners, commits). Usar SVGs do objeto `I` (flame, bolt, trophy, moon, check2, spark, etc.) ou texto puro. Memória canônica: `~/.claude-moco/projects/-Users-zana/memory/feedback_no_emojis.md`.
- **Don't fix what isn't broken** (Helms/Israetel) — funções centrais (suggestedNextDay, suggestNext, weeklyVolume, weekStreak, EXERCISE_ALTERNATIVES) só com motivo forte.
- **Storage isolado pra features paralelas** — sessões em casa NÃO mexem em `ST.logs` nem em funções de progressão. Ficam em `ST.freelog` separado. Padrão a seguir pra qualquer extensão futura.

---

## Quick facts
- **URL produção:** https://lucasrobertoooo.github.io/meu-treino/
- **Repo:** https://github.com/lucasrobertoooo/meu-treino (público, necessário pro Pages free)
- **Stack:** Vanilla HTML/CSS/JS single-file, sem build, sem dependências externas (só Free Exercise DB pras fotos)
- **Persistência:** localStorage (10 chaves, `storage.persist()` requisitado no boot)
- **PWA:** instalável no iPhone, funciona offline depois da 1ª carga
- **Tamanho:** ~4200 linhas, ~200KB, 1 arquivo

---

## Perfil do usuário (Lucas)
- Vegetariano (laticínios + ovos ok)
- ~75kg, hipertrofia limpa
- Treina 4x/semana (ABCD Push/Pull)
- **Prioridades:** largura de ombro #1, peito superior, braços, redução de gordura abdominal
- **Restrição:** sem agachamento/leg press (náusea)
- Metas default: 150g proteína, 350g carbs, 2800 kcal

---

## Estrutura de arquivos

```
~/Documents/MeuTreino/
├── index.html              # app inteiro (HTML + CSS + JS inline)
├── manifest.json           # PWA manifest
├── sw.js                   # service worker (cache offline)
├── icon-192.png            # ícones PWA
├── icon-512.png
├── icon-512-maskable.png
├── apple-touch-icon.png
├── img/                    # imagens locais geradas (preferidas vs Free Exercise DB)
│   ├── cable-lateral-raise.jpg
│   ├── roman-chair.jpg
│   └── lying-leg-curl.jpg
├── HANDOFF.md              # este arquivo
└── .gitignore
```

---

## 4 abas (nav inferior)

### 1. Treinos
- Lista A/B/C/D com **foto do exercício principal no fundo** (75% direita) + fade pra esquerda via mask-image
- **Badge glass** translúcido (avermelhado pra push, azulado pra pull) com backdrop-filter
- Streak 🔥 + treinos completados na semana
- **Alerta de deload** vermelho a cada 5 semanas (com botão "Feito" pra marcar)
- Treino sugerido destacado com borda (rotação ABCD baseada no último com dados válidos)

### 2. Hoje
- **Atalho pro treino sugerido** (card grande no topo)
- **Peso de hoje** (input, mostra última pesagem)
- **Sono ontem** (input em horas, meta ≥7h)
- **Card Macros do dia:**
  - Buscador de alimentos (90 itens FOOD_DB, normaliza acento via `\p{Diacritic}`)
  - Botão "+ Alimento personalizado" (form inline com nome + porção + 3 macros opcionais)
  - **3 barras coloridas:** Proteína verde, Carbs azul, Calorias dourado
  - Lista do dia com cada entry mostrando `Xp · Xc · Xk` + ✕
- **Suplementos checklist** (6 toggles: creatina, whey, D, B12, ômega-3, cafeína)
- **Cardio + passos** (steps + Z2 minutos)

### 3. Corpo
- Stats: semanas treinando, séries totais da semana
- **Sparkline SVG** do peso (últimas 30 pesagens, delta colorido)
- **Volume semanal por grupo muscular** (12 grupos, ★ priorizados: ombro_lat, peito_sup, biceps, triceps)
- **Lista de PRs** de compostos (e1RM Brzycki, com data e set que bateu)
- **Medidas:** peito, ombro, braço, cintura, coxa (com delta vs primeira medição)
- **Fotos de progresso:** upload via câmera do iPhone, comprime canvas pra ~80KB, salva base64 em localStorage

### 4. Mais
- **12 princípios** científicos (sobrecarga, RIR, alongado>encurtado, excêntrica, mente-músculo, descanso por tipo, sono, superávit, frequência 2x, volume, deload, fotos)
- "Parecer maior" (largura ombro/cintura, postura, cheião rápido)
- Nutrição (proteína 1.8-2.2g/kg vegetariano)
- **Metas editáveis** (proteína/carbs/calorias)
- Backup (export/import JSON com versionamento `_v` e `_at`)

---

## Treino aberto (renderDay)

Cada exercício mostra:
- **Foto** (PHOTO_LOCAL preferido, fallback Free Exercise DB)
- Pill `composto / iso / core`
- Séries × reps × descanso (`X séries · Y reps · Z:ZZ descanso`)
- **Cue** com `<em>` pras palavras-chave (rich text inline)
- **Aquecimento auto** nos compostos: "Aquecimento: 50% × 8 · 75% × 5"
- **Sugestão da próxima série** (banner verde): "Meta: 24kg × 8 · bateu o topo · sobe carga"
- **Alerta de troca** (banner azul): só se plateau pós-deload OU ≥12 semanas no mesmo exercício
- **Alerta de plateau** (banner vermelho): se 3 sessões sem subir e1RM e ainda não fez deload
- **PR badge** dourado no canto da foto se a sessão atual bate e1RM histórico
- **Log com 4 colunas:** kg, reps, RIR (0-5), check ✓
- Histórico: "Última (DD-MM): X×Y@R · X×Y@R · e1RM Zkg"
- Botões: Vídeo (busca YouTube) · Descanso (abre timer com tempo do tipo)

---

## Programa ABCD

| Treino | Foco | Hero exercise (foto) |
|--------|------|-------|
| A — Push 1 | Ênfase Peito | Supino inclinado halter 30° |
| B — Pull 1 | Costas, bíceps, perna, core | Puxada aberta |
| C — Push 2 | Ênfase Ombro | Desenvolvimento sentado halter |
| D — Pull 2 | Costas, bíceps, perna, core (ângulos diferentes) | Puxada neutra |

Estrutura no objeto `WK` em index.html. Cada exercício:
```js
{
  id: "a_1",                               // ID ESTÁVEL — âncora dos overrides (ver § Edição de exercícios)
  n: "Supino inclinado halter 30°",
  s: 4,                                    // séries
  r: "6-10",                               // faixa de reps
  t: "comp",                               // comp | iso | core
  mg: {peito_sup:1, triceps:0.5, ombro_ant:0.5},  // muscle groups c/ peso
  cue: "Principal do peito superior. Desce bem alongado..."
}
```
**Todo exercício (WK e HOME_SESSIONS) tem um `id` único e imutável** (`a_1..a_6`, `b_1..`, `core_completo_1..`, etc). É a chave dos overrides do usuário. **Nunca reusar um id pra outro exercício.** Ao adicionar exercício novo, dar um id fresco (ex: `a_7`); reordenar/renomear no código é seguro pois o id viaja junto no objeto.

---

## Lógica científica implementada

### Descansos (Schoenfeld 2016, Grgic 2017)
- Compostos: **150s** (2:30) — antigamente 90s, ciência atualizada
- Isoladores: **90s**
- Core: **75s**

### Sugestão de progressão (`suggestNext`)
- Analisa última sessão válida (sets done com kg+reps)
- Pega `maxKg` e `minRepsTop` (mín reps das séries com essa kg)
- Lógica:
  - `minRepsTop >= rng.max` → **+inc kg** (inc = 2.5/5 pra comp >40kg, 1/2.5 pra iso)
  - `minRepsTop >= rng.min` → **+1 rep, mesma kg**
  - Senão → mesma kg, foca em chegar no mínimo

### PR detection (Brzycki e1RM)
- `e1RM = kg / (1.0278 - 0.0278 × min(reps, 12))`
- `isPRSession`: cur > histórico + 0.1 kg E exige `historicalBest > 0` (não dispara em primeira sessão)

### Plateau (`detectPlateau`)
- Últimas 3 sessões VÁLIDAS (filtradas por bestE1RM > 0)
- True se `last3[2] <= last3[0] && last3[2] <= last3[1]`

### Volume semanal (`weeklyVolume`)
- Soma de séries equivalentes por mg, últimos 7 dias
- Compostos contam 0.5 pros músculos secundários
- **Só conta sets VÁLIDOS** (done + kg>0 + reps>0) — corrigido em auditoria

### Deload (`needsDeload`)
- Alerta a cada 5 semanas desde último deload marcado
- Recomendação: volume -50% OU kg -20% por 1 semana

### Troca de exercício (`shouldSwapExercise`)
- Disparador 1: **plateau** + **deload já feito** + **≥6 semanas no exercício** → "plateau-pos-deload"
- Disparador 2: **≥12 semanas no mesmo exercício** (Schoenfeld 2021) → "tempo-longo"
- Mapa `EXERCISE_ALTERNATIVES` com 26 entradas, prioriza posição alongada (Wolf 2023)

---

## Banco de alimentos (FOOD_DB)

90 itens vegetarianos brasileiros. Schema:
```js
{n: "Whey protein", q: "1 scoop 30g", p: 24, c: 3, k: 120}
//                                     │     │     │
//                                proteína(g) carb(g) kcal
```

Categorias: suplementos, ovos, lácteos, pães (francês, forma, integral, italiano, ciabata, fogaccia, pão queijo, tapioca), cereais/massas, leguminosas, soja, tubérculos, oleaginosas, legumes/verduras, frutas, pratos compostos (lasanha, pizza, etc).

Fontes nutricionais: TACO/UNICAMP, USDA FoodData Central, rótulos comerciais BR.

Função `searchFoods(q)`: normaliza acento, multi-termo, top 12 resultados.

---

## Storage (localStorage keys)

```
meutreino_logs_v1     = {id: [{date, sets:[{kg,reps,rir,done}]}]}
meutreino_bw_v1       = [{date, kg}]                                  (array sorteado)
meutreino_sleep_v1    = {[date]: hours}
meutreino_protein_v1  = {[date]: [{n,q,p,c,k}]}                       (array de entries — migrado 2026-06-29)
meutreino_suppl_v1    = {[date]: {creatina, d, b12, omega, cafe, whey}}
meutreino_photos_v1   = [{date, dataUrl(base64)}]
meutreino_measures_v1 = [{date, peito, ombro, braco, cintura, coxa}]
meutreino_cardio_v1   = {[date]: {steps, z2min}}
meutreino_meta_v1     = {proteinTarget, carbTarget, calTarget, lastDeloadWeek}
meutreino_session_v1  = {active:{workoutId,startAt,pausedAt,pausedTotal}|null, history:[{date,workoutId,startAt,endAt,durationMs,activeMs,sets,volume}]}
meutreino_freelog_v1  = {"<templateId>_<exIdx>": [{date,sets:[{kg,reps,rir,done}]}]}   (sessões de casa — HOME_SESSIONS.md)
meutreino_exmeta_v1   = {"<id>": {n?, cue?, note?}}                   (overrides de exercício editados pelo usuário — ver § Edição de exercícios)
```

`DEFAULTS` constante centraliza tipos pra evitar drift no `resetData()` e `importData()`.

Migração automática no load: `protein` antigo (objeto numérico) → array vazio.

---

## Timer

- **Chime suave** quando acaba: acorde maior C5-E5-G5 (523/659/784 Hz), seno + 1 oitava abaixo, envelope tipo sino com decay 1.5s
- **Vibração** [120, 60, 120] (funciona mesmo com som mudo)
- **Wake Lock** (`navigator.wakeLock`) — mantém tela acesa, iOS 16.4+
- **Flash verde** no overlay quando chega 0 (700ms)
- Re-adquire wake lock no `visibilitychange` se tela voltar e timer rodando
- `setTimer` chama `clearInterval` antes de resetar — evita race

---

## Auditoria 2026-06-29 (3 agentes paralelos)

### Bugs P1 corrigidos
1. `weeklyVolume`, `workoutDates`, `suggestedNextDay` agora exigem `done + kg + reps` (era só `done`)
2. `lastBW !== firstBW` → `ST.bw.length > 1` (comparação por valor)
3. **XSS em lastTxt**: `reps`/`rir` passam por `fmtInt`, `date` por `esc()`
4. `addPhoto`: `saveK` retorna bool, rollback + alert se quota cheia

### Bugs P2 corrigidos
- `isPRSession` não dispara em primeira sessão de exercício novo
- `detectPlateau` filtra sessões sem dados válidos
- `esc()` completo (`'` e `>` adicionados)
- Migração de `protein` roda em TODOS os dias no load (não só hoje)
- `importData` reseta ST antes de aplicar (evita Frankenstein)
- Export adiciona `_v` e `_at`
- `REST[e.t] ?? 90` fallback

### Pendente P3 (UX, não bugs)
- Streak zera no dia de descanso. ABCD 4x/sem não combina. Reframe como "treinos esta semana" seria melhor.
- Incrementos de progressão não conhecem chapas BR (5kg) — sugere 22.5kg quando máquina só tem 20/25
- `upsertToday` duplica sessão na virada de meia-noite (raro)

---

## Como atualizar

```bash
cd ~/Documents/MeuTreino
# editar index.html (ou outros)
git add . && git commit -m "..." && git push
```

GitHub Pages rebuilda em ~1min. No iPhone:
1. Safari → `https://lucasrobertoooo.github.io/meu-treino/`
2. **Puxa pra baixo** pra fazer refresh (essencial — SW cache)
3. Fecha o app de Treino (swipe up nos cards de app)
4. Abre pelo ícone — versão nova

Se mudar nomes de arquivos do shell ou estrutura crítica, **bumpar SHELL version em sw.js** (`treino-shell-vN`) pra forçar invalidação de cache.

---

## Imagens

### Free Exercise DB (yuhonas, CC0) — 20 exercícios
URL: `https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/{ID}/0.jpg`

### Locais (`img/*.jpg`) — 3 exercícios já gerados
- `cable-lateral-raise.jpg` — Elevação lateral cabo (cobre 3 variações no PHOTO_LOCAL)
- `roman-chair.jpg` — Cadeira romana (substitui hanging leg raise errado)
- `lying-leg-curl.jpg` — Mesa flexora

Gerados via ElevenLabs gpt-image-2 (estilo SDXL) com prompts do `~/Desktop/treino-prompts-imagens.txt`.

Pra desconectar 100% do Free Exercise DB futuramente: gerar mais 20 imagens no mesmo estilo, adicionar no `PHOTO_LOCAL`, remover do `PHOTO_ID`.

---

## Princípios científicos (referências usadas)

- **Schoenfeld et al 2016** (J Strength Cond Res) — descansos longos > curtos pra hipertrofia
- **Grgic et al 2017** (Sports Med, meta-análise) — descansos ≥2min ideais
- **Wolf et al 2023** — exercícios na posição alongada crescem mais
- **Fonseca et al 2014** — variação dá hipertrofia regional mas perde força
- **Baz-Valle et al 2019** — variação não supera fixo em hipertrofia total
- **Schoenfeld 2021** (Science and Development of Muscle Hypertrophy) — variação moderada a cada 8-12 sem
- **Helms, Israetel, Nuckols** — "don't fix what isn't broken"
- **Leproult & Van Cauter 2011** — sono <5h derruba testosterona ~15%
- **Dattilo et al 2011** — sono <6h derruba síntese proteica
- **Brzycki 1993** — fórmula 1RM (capada em 12 reps)

---

## Push notifications (Cloudflare Worker)

**URL:** `https://meu-treino-push.lucasrobertoooo.workers.dev`
**Folder código:** `~/Documents/MeuTreino/push-worker/`
**Custo:** $0/mês (free tier)
**Lag típico:** 0-60s no descanso (cron de 1 min no free)

### Arquitetura

```
[iPhone PWA]                    [Cloudflare Worker]
    |                                 |
    | POST /vapid-key                 | (público, retorna VAPID public key)
    | POST /subscribe (subscription)  | salva em KV sub:<hash>
    | POST /schedule (fireAt)         | salva em KV pending:<fireAt>:<hash>:<id>
    | POST /cancel (hash)             | remove pending:*:<hash>:*
    | POST /test (hash)               | dispara push imediato (debug)
                                      |
[Cron tick 1/min]                     | varre pending:*, dispara web push
                                      | → Apple Push Service
                                      |   → iPhone (notification banner + som padrão)
                                      | → Service Worker do app
                                      |   → showNotification('⏱️ Descanso terminado')
```

### Por que NÃO usei `web-push` npm

`web-push` (Node) usa `crypto.createECDH` que **não está implementado** no `nodejs_compat` do Cloudflare Workers (erro: `[unenv] crypto.createECDH is not implemented yet!`).

Implementei VAPID JWT (ES256) + push protocol direto com **Web Crypto API** em `push-worker/src/index.js`. ~140 linhas, zero dependências em runtime.

### Tickle push (sem payload)

Os pushes vão **sem body** — o Service Worker do app (`sw.js`) tem fallback fixo `"⏱️ Descanso terminado · Próxima série!"`. Vantagem: pula encryption complexa (aes128gcm RFC 8188).

Pra futuros pushes com texto dinâmico (PR celebration, streak risk, proteína baixa), precisará implementar payload encryption.

### Comandos

```bash
cd ~/Documents/MeuTreino/push-worker
npx wrangler tail        # logs em tempo real
npx wrangler deploy      # re-deploy
npx wrangler kv:key list --binding=KV    # ver KV entries
```

Setup completo passo-a-passo em `SECRETS.local.md`.

---

## Timer nativo iOS (Atalhos)

**Adicionado 2026-07-01.** Solução paralela ao Web Push pra confiabilidade do fim de descanso com tela bloqueada.

### Por que
Web Push do Cloudflare Worker funciona, mas às vezes só é renderizado quando o app tá em foreground (SW morre em bg no iOS, subscription volta stale, etc). O Timer nativo do Relógio do iOS **sempre** dispara o alarme com tela bloqueada — é o comportamento que a academia precisa.

### Como funciona
1. Lucas cria 1x no Atalhos um shortcut chamado `MeuTreinoTimer` que:
   - Recebe "Entrada de Atalho" (texto)
   - Ação única: "Iniciar Timer" com **segundos** = Entrada de Atalho
2. Toggle em Mais → "Ativar Timer via Atalhos" liga `ST.meta.shortcutTimerEnabled`
3. Cada `startTimer()` faz `location.href = 'shortcuts://run-shortcut?name=MeuTreinoTimer&input=text&text=<segundos>'`
4. iOS abre Atalhos brevemente → dispara ação → Timer nativo roda no Relógio (Live Activity/Ilha Dinâmica) → alarme toca no fim mesmo com tela bloqueada

Storage:
```
ST.meta.shortcutTimerEnabled  // bool, opt-in
ST.meta.shortcutName          // string, default "MeuTreinoTimer"
```

### Limitação dura (2026-07-01, confirmado com Lucas)
**iOS traz o Atalhos pra foreground por ~500ms** ao executar qualquer `shortcuts://` URL scheme. Não tem como rodar invisível a partir de PWA. Alternativas testadas mentalmente e piores:
- `x-callback-url` com `x-success=https://.../meu-treino/` volta pro **Safari**, não pro PWA instalado
- Adicionar "Abrir URL" no fim do Atalho: mesmo problema (volta pro Safari, não PWA)
- Só Web Push: volta o problema original (chega só quando abre o app)

Lucas aceita o swap pq o Timer nativo compensa. Web Push continua rodando em paralelo como reserva (não desativado).

### Onde mexer
- `maybeInvokeShortcutTimer(seconds)` em `index.html` — dispara o deep-link
- Chamado dentro de `startTimer()` antes de `scheduleRemotePush`
- UI + setters em `renderMais()` seção "Timer nativo do iPhone (via Atalhos)"

---

## Última posição planejada (skip descanso + auto-conclui)

**Adicionado 2026-07-01.** Melhora UX do fim do treino.

### O que mudou
- **Skip descanso último set:** ao marcar o último set do último exercício (ABCD ou Home Session), o timer de descanso não abre. Antes abria e era irrelevante.
- **Auto-concluir treino:** setting `ST.meta.autoCompleteOnLastCheck` (default true, opt-out em Mais). Se última posição marcada mas ainda restam sets pulados no meio (não é `isWorkoutComplete`), aparece `confirm()` perguntando se conclui. Sim → `showCelebration()` + `endSession()`. Não → treino segue aberto.
- Se 100% dos sets planejados foram feitos, o fluxo antigo continua (celebra direto sem perguntar).

### Helpers novos
```js
isLastPlannedPosition(day, exIdx, setIdx)    // ABCD
isLastHomePosition(templateId, exIdx, setIdx)  // Home Sessions
```

### Onde mexer
- `toggleDone` (~L2971) — gate no `openTimer/startTimer` + branch novo de `confirm()`
- `toggleHomeDone` (~L3117) — gate no `openTimer/startTimer` (Home não tem celebração)
- UI + setters em `renderMais()` seção "Comportamento do treino"

---

## Sessão 2026-07-02 (rename laterais + fix fotos + fix timer PWA)

**Contexto que disparou:** Lucas notou que "elevação lateral" aparecia em 3 dias com nomes idênticos, não dava pra distinguir se era bilateral/unilateral. Também trouxe dúvida científica: tríceps 2× no ciclo é ok?

### Respostas científicas dadas
- **Elevação lateral:** na verdade estava em **4 dias**, todas bilaterais idênticas (halter ou polia). Volume 14 séries/sem = zona ótima (MEV 8, MAV 12-20, MRV 25-30). Deltoide lateral tem fibras tipo I dominantes → recupera em 24h, tolera frequência 4-6×/sem (Nippard, Helms).
- **Tríceps:** direto em A (6 séries) + C (5 séries) = ~11 diretas + ~6 secundárias = **~17 equivalentes/sem** (zona ótima). Rotação ABCD sempre coloca B/D entre A e C → ≥48h recuperação. 2×/sem é sweet spot (Schoenfeld 2016 meta-análise).

### Rename das elevações laterais (WK)
Cada dia agora tem variação real com cue completo:
- **A (Push 1):** `Elevação lateral com halter em pé (bilateral)` — 4×12-20, base clássica encurtado
- **B (Pull 1):** `Elevação lateral na polia unilateral em pé` — 3×12-20 por lado, cabo passa na frente do corpo
- **C (Push 2):** `Elevação lateral com halter no banco inclinado 75°` — 4×12-20, curva de força diferente
- **D (Pull 2):** `Elevação lateral polia unilateral cabo atrás do corpo (alongado)` — 3×12-20 por lado, Wolf 2023

**Cue de log unilateral:** "registre 3 sets — cada set = 1 execução por lado (mesma carga)". Isso mantém `weeklyVolume` sem alteração (convenção Nippard: 1 set logado = 1 execução por lado).

### Fotos — bugs achados e corrigidos
1. **`Dumbbell_Lateral_Raise` estava 404** no repo yuhonas há tempos — a foto das laterais em A/B/D nunca carregou. Trocado por `Side_Lateral_Raise` (verificado 200).
2. Bumpado PHOTO_ID pra **~65 entradas** cobrindo TODOS os inativos (`EXERCISE_ALTERNATIVES`), pra quando `shouldSwapExercise` sugerir substituição já vir com foto.
3. Removido `PHOTO_LOCAL["Elevação lateral (polia ou halter)"]` (chave antiga). Arquivo `img/cable-lateral-raise.jpg` ficou órfão — não deletar (custa 0, pode ser reusado; se quiser limpar futuro sem perder trabalho).

### IDs novos das laterais no Free Exercise DB
- A → `Side_Lateral_Raise` (dumbbell bilateral em pé)
- B → `Standing_Low-Pulley_Deltoid_Raise` (cable unilateral em pé)
- C → `Dumbbell_Incline_Shoulder_Raise` (dumbbell incline)
- D → `Standing_Low-Pulley_Deltoid_Raise` (reusa — não tem foto específica cross-body)

### Verificação visual (4 agentes Explore em paralelo)
Delegados 4 batches (~22 pares cada) — cada agente lê `/tmp/meutreino-verify/imgs/*.jpg` e compara com nome PT-BR.
Resultado bruto em `/tmp/meutreino-verify/RESULTADOS.md`.

**3 mismatches legítimos pendentes de correção:**
1. `Triceps_Pushdown_-_Rope_Attachment` mapeado pra alt "Tríceps polia barra reta" — foto é da corda. Trocar nome pra "Tríceps polia corda" (dedup) ou achar ID de barra reta.
2. `Hanging_Leg_Raise` mapeado pra "Elevação de pernas suspenso (joelho dobrado)" — foto tem perna estendida. Renomear cue.
3. `Low_Cable_Crossover` → "Crucifixo na polia baixa" — agente disse foto é cable front raise (VERIFICAR — pode ser alucinação, memória diz Explore agentes alucinam ~40%).

**5 achados suspeitos de alucinação** (não corrigidos, reverificar depois):
- `Incline_Dumbbell_Curl` → "Rosca inclinada com halter"
- `Concentration_Curls` → "Rosca concentrada"
- `Cable_Rope_Overhead_Triceps_Extension` → "Extensão na polia overhead"
- `Hack_Squat` → "Hack machine leve"
- `Weighted_Sissy_Squat` → "Sissy squat"

### Fix do Timer nativo (iOS PWA standalone)
Timer via Atalhos parou de funcionar no PWA instalado (mas rodava no Safari). Diagnóstico multi-rodada:

**Causas identificadas:**
1. **`location.href = 'shortcuts://...'` é silenciosamente bloqueado** em PWA standalone. Só funciona em Safari puro. `try{}catch{}` engolia sem log.
2. **User gesture só sobrevive à primeira ação** — no `startTimer` original, `unlockAudio() → maybeRequestNotificationPermission() → requestWakeLock() → openTimer(overlay)` queimavam o gesto antes de chegar no `location.href`.
3. **Toggle vs config são gates separados** — `testShortcutTimer` só checava `shortcutName`, então funcionava; `maybeInvokeShortcutTimer` checava `shortcutTimerEnabled` também. Lucas configurou nome mas não ligou o toggle — teste passava, fluxo automático não.

**Fixes aplicados (em `index.html`):**
- Novo `invokeExternalScheme(url)` (~L3045) — usa `<a target="_blank">` sintético clicado em vez de `location.href`
- `maybeInvokeShortcutTimer` movido pra **antes** de `openTimer` no `toggleDone` (~L3128) e `toggleHomeDone` (~L3281) pra preservar gesto
- Adicionado botão azul grande **dentro do overlay do timer** — `<a href="shortcuts://...">` estático no DOM (linha 1380 no HTML, `updateShortcutLink` em ~L4137). Aparece sempre que `shortcutName` estiver setado, **independe do toggle**. Fallback 100% confiável em PWA.
- `testShortcutTimer` (~L4324) agora usa `invokeExternalScheme` + toast de feedback visual

**Regras futuras pra deep-links em PWA** (memória salva em `feedback_ios_pwa_deeplink.md`):
- Deep-link tem que ser primeira ação do handler
- Fallback estático (`<a>` real) sempre que possível
- Gate do fallback só depende de config essencial, nunca do toggle
- Testar em Safari **e** em PWA standalone (comportamento diverge)

### APP_VERSION visível
Novo `const APP_VERSION = '2026-07-02.05'` no topo do JS. Aparece no rodapé da aba Mais em texto monospace pequeno. **Usar pra distinguir "não deployou" de "deployou mas bugado"** — evita bater a cabeça com cache do PWA sem saber.

Bumpado SW `SHELL` pra `treino-shell-v13` na mesma sessão.

### Como forçar refresh completo no iPhone (documentar)
Sequência agressiva pra invalidar 100% do cache PWA:
1. Push do commit
2. **Ajustes → Safari → Avançado → Dados de sites → apaga `github.io`**
3. Remove o app "Treino" da tela de início
4. Safari → URL → refresh
5. Adicionar à Tela de Início

Sem essa sequência, `sw.js` antigo pode manter parte do cache mesmo com novo SHELL version.

---

## Edição de exercícios pelo app (2026-07-08)

**O que resolve:** Lucas queria ajustar nome, descrição e adicionar nota pessoal nos exercícios sem editar `index.html` + commitar toda vez — e sem medo de perder as edições numa atualização futura do app.

### Como funciona (e por que git nunca sobrescreve)
- Edições ficam em `ST.exmeta` (localStorage, chave `meutreino_exmeta_v1`). **Git versiona arquivos; localStorage mora só no iPhone.** Deploy novo do `index.html` não toca no localStorage → edições sobrevivem a qualquer atualização. Mesmo princípio de "storage isolado" das sessões de casa.
- **Ancoragem por `id` estável, não por posição.** Cada exercício no `WK`/`HOME_SESSIONS` tem um `id` imutável. O override é keyado por esse id, então reordenar ou renomear exercícios no código **não** faz a edição migrar pro exercício errado. (Antes, se fosse por `exId` posicional `A_0`, um reorder no código grudaria o override no vizinho.)
- Merge no render: `exName(e)`, `exCue(e)`, `exNote(e)` retornam o override do usuário se existir, senão o padrão do código. A **foto** continua sendo buscada pela chave original (`e.n`) — renomear não quebra imagem.
- **Não congela o padrão:** se o usuário salvar um campo igual ao valor padrão do código, o override daquele campo não é gravado — assim o exercício continua acompanhando futuras melhorias do texto vindas de update do app. `resetExEdit()` (botão "Restaurar padrão") apaga o override e volta 100% ao código.
- Entra no **backup export/import** automaticamente (é só mais uma chave em `LS`) — importante porque localStorage some se reinstalar o PWA.

### UI
- Botão **"Editar"** (lápis) no card de cada exercício, tanto no treino ABCD (`renderDay`) quanto nas sessões de casa (`renderHomeDay`).
- Abre modal (`#exEdit`) com 3 campos: Nome, Descrição/técnica, Minha nota.
- Nota do usuário aparece no card num bloco dourado distinto (`.exnote`), separado do cue científico.

### Onde mexer
- Helpers: `exOverride/exName/exCue/exNote/saveExMeta/resetExMeta/exById` (logo após `exId`).
- Modal: `openExEdit/closeExEdit/saveExEdit/resetExEdit` + markup `#exEdit` + CSS `.exedit-*` / `.exnote`.
- Segurança: nome/nota sempre via `esc()`; cue do usuário via `esc()` (perde `<em>`, aceitável), cue padrão renderiza rich como antes.

### Detalhe de manutenção
Os `id` foram injetados uma vez via script (`tools/inject_ids.js`, guardado pra referência), escopados por dia/template: `a_1..a_6`, `b_1..b_10`, `c_1..c_6`, `d_1..d_11`, `core_completo_1..`, etc. **Ao adicionar exercício novo no código, dar um id fresco e nunca reciclar um antigo.**

---

## Histórico de treinos + inteligência de dia (2026-07-08.02)

**Contexto que disparou:** Lucas notou (1) que não dava pra ver quanto durou um treino em semanas anteriores vs hoje, e (2) que ao concluir o C, o D já ficava com tag "HOJE" como se tivesse que fazer os dois.

### O dado de histórico já existia — só não era exibido
`ST.session.history` (chave `meutreino_session_v1`) sempre gravou `{date, workoutId, activeMs, sets, volume, ...}` a cada treino ABCD concluído. Só aparecia por 2s no card de comemoração. Agora é exposto em dois lugares (helpers em `sessionsForDay`, `fmtDurMin`):
- **Mini-histórico no treino aberto** (`renderDay`, topo): últimas 4 vezes daquele treino — data · duração · sets · volume. Comparação no contexto.
- **Seção "Histórico de treinos" na aba Corpo** (`renderCorpo`): últimas 12 sessões cronológicas, todas as letras, com duração destacada.
- Sessões de casa NÃO entram (usam `freelog`, sem duração) — histórico de duração é só ABCD.

### Correção da "inteligência de dia"
`suggestedNextDay()` (inalterada) retorna o próximo do ciclo ABCD — mas ignora o calendário. O bug era de **rótulo**: o próximo era chamado de "HOJE" mesmo já tendo treinado. Helpers novos: `todayTrainedDays()` (dias ABCD com sets válidos hoje) e `todaySessionRecord()` (último concluído hoje, com duração).
- **`renderDays`:** se já treinou hoje, o treino feito ganha tag verde "✓ HOJE · Xmin" e o próximo do ciclo vira "· PRÓXIMO" (neutro). Se não treinou, o sugerido é "· HOJE" (azul).
- **`renderHoje`:** se já treinou, o card de destaque mostra o treino **feito** ("concluído · Xmin", classe `.done` verde) e abaixo um card discreto `.nextworkout` "Próximo treino · X". Se não treinou, destaca o sugerido como antes. O card "Antes do treino" (princípio+PRs) só aparece quando ainda não treinou.

### Onde mexer
- Helpers: `fmtDurMin/sessionsForDay/todayTrainedDays/todaySessionRecord` (logo após `suggestedNextDay`).
- CSS: `.daytag.*`, `.wkhist/.wkh-*`, `.nextworkout`, `.todayworkout.done`, `.histcard/.hrow/.hbadge/.hdur`.

### Verificação
Sem navegador (preview do MCP fica preso no disclaimer de rede do macOS). Validado por: sintaxe (`new Function`), testes de lógica com `localStorage` semeado, e **assertions no HTML real** produzido por `renderDays/renderHoje/renderDay/renderCorpo` nos 2 cenários (treinou hoje / não treinou). Todos passaram.

---

## Próximos passos sugeridos (não implementado)

### Pendências da sessão 2026-07-02
- Aplicar os 3 mismatches legítimos de foto (ver seção acima)
- Reverificar os 5 suspeitos de alucinação (baixar imagem, olhar direto, decidir)
- Se validar tudo: gerar `img/*.jpg` locais das laterais no estilo aquarela pra consistência visual (`Side_Lateral_Raise`, `Standing_Low-Pulley_Deltoid_Raise`, `Dumbbell_Incline_Shoulder_Raise`)
- Deletar `img/cable-lateral-raise.jpg` órfão (opcional)

### Feitos em 2026-07-01
- ~~Timer nativo iOS via Atalhos~~ → toggle em Mais, deep-link em `startTimer()`, setup 1x do Shortcut
- ~~Último set do último exercício sem descanso~~ → gate em `toggleDone`/`toggleHomeDone`
- ~~Auto-concluir treino ao marcar último item~~ → `confirm()` + setting default on em Mais

### Feitos em 2026-06-30 (sessão home sessions)
- ~~Streak baseado em treinos por semana~~ → `weekStreak()` modelo Hevy, ≥3 treinos/sem
- ~~Sessões livres em casa~~ → 5 HOME_SESSIONS + recomendador + storage isolado (ver `HOME_SESSIONS.md`)
- ~~Cleanup de emojis~~ → todos substituídos por SVG do objeto `I` ou texto puro

### Pendentes
- **Sync via Worker** — usar o Worker já rodando pra também sincronizar `logs`/`bw`/`measures`/`freelog` entre devices E sobreviver a reinstalações do PWA (Lucas perdeu dados 2x).
- **Payload encryption** pra pushes — habilita mensagens dinâmicas (PR celebration, streak risk, proteína baixa).
- **Cardio recommender heurístico** (item 9 do feedback) — regras de bolso, sem IA externa.
- **Gerar imagens locais aquarela via ElevenLabs** (~$2-4 pra 21 imagens, gpt-image-2) — precisa OK $.
- **Revisão visual humana** Tríceps francês (A_4) + Abdominal declinado (B_7/D_8).
- **Aba Mais → biblioteca pesquisável** dos princípios (refactor grande, defer).
- **Incrementos por máquina BR** (chapas de 5kg em polia, 2.5kg em halter).
- **Gráficos por exercício** (e1RM ao longo do tempo).
- **Modo "treino do dia" enxuto** (sem chrome, só exercícios em scroll).
- **HOME_SESSIONS v2**: sub-templates editáveis, histórico timeline, recomendação por MEV semanal (ver `HOME_SESSIONS.md` §Próximos passos).
