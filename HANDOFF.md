# MeuTreino · HANDOFF v3

PWA single-file de hipertrofia ABCD Push/Pull. App pessoal pro Lucas usar no iPhone na academia.

**Última atualização:** 2026-06-30 (HOME_SESSIONS shippado + weekStreak + cleanup completo de emojis)

## Antes de codar: ler primeiro
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

Estrutura no objeto `WK` em index.html (~linha 870). Cada exercício:
```js
{
  n: "Supino inclinado halter 30°",
  s: 4,                                    // séries
  r: "6-10",                               // faixa de reps
  t: "comp",                               // comp | iso | core
  mg: {peito_sup:1, triceps:0.5, ombro_ant:0.5},  // muscle groups c/ peso
  cue: "Principal do peito superior. Desce bem alongado..."
}
```

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

## Próximos passos sugeridos (não implementado)

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
