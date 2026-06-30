# MeuTreino · Day 1 Feedback + Action Checklist

**Sessão:** 2026-06-29 (primeiro dia de uso real na academia, iPhone 16)
**Status:** Documentação + pesquisa + checklist priorizada. Implementação em backlog.
**Convenção:** 🍎 = particularidade iOS · 🤖 = revisar antes do port Android · 🔬 = baseado em pesquisa/metodologia

---

## Resumo executivo

10 feedbacks após 1ª sessão. 3 são **P0 blockers** (notificação muda, histórico em risco, botão pós-timer confunde). 4 são **P1 UX significativas** (imagem errada, FAB sem propósito, sem tracking de duração, surfacing não-contextual). 3 são **stretch** (timer auto-close, IA cardio, celebração).

Padrão emergente: o app foi construído **assumindo uso ativo no foreground**. iOS Safari + PWA tem 5 hostilidades não-óbvias (AudioContext suspende em bg, Vibration API ausente, Service Worker morre, ITP evicta storage, FAB não é padrão iOS) que precisam de mitigação explícita.

Esse doc serve 2 propósitos:
1. Fix dos 10 itens com solução fundamentada (não palpite).
2. **Base de auditoria proativa** — cada feedback gera um padrão a procurar em outras áreas do app.

---

## Item 1 · Timer sem feedback sensorial (P0 blocker) 🍎

### Observação
> "Não ouvi som, preciso que notifique com a tela bloqueada e em outro app aberto. (...) Não teve nenhum alerta, não vibrou, não teve som. Preciso que o timer possa ser minimizado pra ver a próxima série enquanto descanso. Quero interação com tela bloqueada e Dynamic Island."

### Diagnóstico técnico (do código atual)
- `chime()` usa `AudioContext` + `navigator.vibrate()`.
- 🍎 **iOS Safari NÃO implementa Vibration API.** A linha `navigator.vibrate(...)` é silenciosamente ignorada. Esse é o motivo de não vibrar.
- 🍎 **AudioContext suspende quando o app vai pra background.** O Wake Lock só mantém a tela acesa quando o app está em foreground; não previne a suspensão de áudio quando o usuário troca de app/bloqueia a tela.
- 🍎 `setInterval` é throttled (até pausado) em background tabs no Safari iOS — o `tLeft` para de descer enquanto o user está em outro app, então quando ele volta, o timer está atrasado.
- O app **não usa Web Push nem Notification API**. Não há como tocar com tela bloqueada hoje.
- **Dynamic Island é uma API nativa (ActivityKit/SwiftUI).** Não existe equivalente PWA. PWA jamais terá acesso à Ilha Dinâmica. Esse pedido é tecnicamente impossível sem virar app nativo.

### Pesquisa / metodologia 🔬
- **WebKit blog 2023-03 (Web Push iOS 16.4+):** PWA instalada via "Add to Home Screen" pode receber push remoto. Requer HTTPS, permissão pedida após user gesture, e o badge `display: standalone` no manifest.
- **PWA local timer end notification:** padrão = registrar `setTimeout` no Service Worker que dispara `self.registration.showNotification(...)`. 🍎 No iOS isso é frágil porque o SW pode ser killed; a abordagem robusta é **`Notification` programada via SW + fallback de Web Push remoto**. Sem backend, a opção é programar uma notification local no SW e torcer pra ele sobreviver (taxa de sucesso ~70% em iOS 16.4–17 segundo testes da equipe do Outlook PWA).
- **Whoop e Strong (referência de mercado):** ambos usam **Live Activities nativas** pro timer. Aplicativos web de descanso (Tempo Timer PWA, Strong web) usam ApresentaçãoNotification + manter tela acesa.
- **Background audio loop (hack conhecido):** tocar um arquivo de áudio silente em loop com `<audio loop muted={false}>` mantém o AudioContext "alive" em background no iOS — mas só funciona dentro de PWA standalone, gasta bateria, e o iOS pode matar mesmo assim após X minutos.
- **Haptics no iOS Safari:** existe a workaround do `<input type="checkbox" switch>` (iOS 17.4+) ou `pattern="\d*"` que dispara haptic em alguns contextos. Solução robusta = **não depender de vibração** e investir em notification visual + audio.

### Recomendação
**Camadas de fallback** (do mais forte pro mais fraco):

1. **Web Push remoto** (precisa backend mínimo — pode ser Cloudflare Worker grátis). VAPID keys + subscription guardada por usuário. Quando o timer começa, manda um push agendado pro `tLeft` final. Funciona com app fechado + tela bloqueada. 🍎 Exige PWA instalada (já é o caso) + iOS 16.4+ + permissão concedida.
2. **Notification local via Service Worker** (sem backend). Programa `showNotification` no SW com delay. Funciona se o SW sobreviver. Bom fallback.
3. **Áudio robusto em foreground:** trocar o chime atual por um audio file pré-carregado (`<audio src="chime.mp3" preload="auto">`) que toca via `.play()` no callback do timer. Áudio file é mais resiliente que sintetizar com AudioContext. Tocar em loop silencioso `<audio loop muted>` enquanto timer rodando pra manter sessão de áudio viva.
4. **Wake Lock + flash visual** (já implementado, mantém).
5. **Vibration:** remover `navigator.vibrate(...)` do código iOS-only path. Em Android o vibrate funciona — manter, mas isolar atrás de detecção de plataforma.

**Timer minimizável:** mudar overlay full-screen pra um **mini-widget sticky** no topo (acima da nav) quando minimizado. Mostra `2:14` + botão `+` pra expandir. Permite ver a próxima série atrás. Esse é o padrão do Strong/Hevy. UX research: Fitts's Law — alvo persistente reduz fricção de re-checagem.

**Sobre Dynamic Island:** documentar explicitamente que **não é possível em PWA**. Se isso for requisito real, precisa virar app nativo (Capacitor/SwiftUI). Adicionar a `PLATFORM_NOTES.md` no bloco de "limites duros".

### Checklist
- [ ] **P0** Trocar AudioContext sintetizado por `<audio>` element com mp3 pré-carregado (mais resiliente)
- [ ] **P0** Adicionar loop silencioso `<audio loop muted>` durante timer pra manter sessão áudio viva 🍎
- [ ] **P0** Implementar `Notification.requestPermission()` + agendar `showNotification` via SW no `startTimer()`
- [ ] **P1** Avaliar Web Push remoto (Cloudflare Worker free tier, ~50 linhas de código) 🍎
- [ ] **P1** Timer minimizável (mini-widget sticky no topo) com botão expandir
- [ ] **P2** Detecção de plataforma — `navigator.vibrate` só roda se Android 🤖
- [ ] **P3** Documentar em PLATFORM_NOTES que Dynamic Island é impossível em PWA
- [ ] **P3** Testar áudio file vs AudioContext em background real (medir taxa de sucesso)

### Audit derivado 🔍
Procurar outros pontos onde o app assume foreground:
- Alerta de troca de exercício, plateau, deload — só aparecem se user abre o app. Considerar push diário ao acordar com agenda do dia.
- Streak não notifica perigo de quebra ("treino hoje pra manter streak").

---

## Item 2 · Preservar histórico (P0 blocker) 🍎

### Observação
> "Preservar histórico no celular de tudo. E também do meu uso de hoje, em específico."

### Diagnóstico técnico
- 9 chaves em `localStorage`, ~5MB de limite total no iOS Safari.
- 🍎 **ITP (Intelligent Tracking Prevention)** evicta localStorage de sites visitados há mais de **7 dias sem interação** — exceto se for **PWA instalada na home**.
- O app já é PWA-able, mas o usuário pode ter aberto via Safari (não home screen icon) na primeira vez. **Confirmar: como o Lucas abriu hoje?**
- Não há backup automático nem aviso de quota.
- `addPhoto` tem rollback de quota cheia, mas o resto das funções de save não checam.

### Pesquisa / metodologia 🔬
- **`navigator.storage.persist()`** — API W3C que pede ao browser pra marcar storage como "persistente" (não evictável sob pressure). 🍎 iOS suporta desde 17.0. Sem isso, ITP pode apagar tudo. Esse é provavelmente o gap mais sério hoje.
- **Padrão "double-write":** dados críticos vão pra localStorage + IndexedDB. IndexedDB tem quota maior (~50MB+ no iOS) e é mais resistente.
- **Export automático:** backup em texto/JSON pra Files app via Web Share API. Strava faz semanal.
- **iCloud Drive sync via File System Access API:** 🍎 iOS Safari **não implementa** FSA. Não dá pra fazer sync iCloud automático em PWA. Solução manual = `<input type="file">` + `navigator.share({files})`.

### Recomendação
1. **Pedir storage persistente no boot.** Uma linha: `if (navigator.storage?.persist) await navigator.storage.persist();`
2. **Avisar quota.** No load checar `navigator.storage.estimate()` e mostrar banner se >80% usado.
3. **Backup automático para arquivo.** Botão "Backup agora" gera JSON e abre share sheet. Lembrete semanal (toast no domingo) "faça backup".
4. **Snapshot do dia 1.** Antes de qualquer alteração futura, salvar `~/Documents/MeuTreino/backup_2026-06-29_day1.json` — pedir pro Lucas exportar e me enviar o JSON pra eu commitar.
5. **Migração futura pra IndexedDB.** Quando passar de 3MB de fotos, migrar fotos pro IDB.

### Checklist
- [ ] **P0** Adicionar `navigator.storage.persist()` no boot do app 🍎
- [ ] **P0** Lucas exporta `backup_2026-06-29.json` pelo botão de export atual e me manda (commit no repo como snapshot canônico)
- [ ] **P0** Confirmar que o app foi adicionado à Home Screen ("Add to Home Screen") — não basta abrir via Safari 🍎
- [ ] **P1** Banner de quota em `navigator.storage.estimate() > 80%`
- [ ] **P1** Botão "Backup agora" + lembrete semanal (toast domingo)
- [ ] **P2** Migrar fotos pra IndexedDB quando localStorage passar de 3MB
- [ ] **P3** Avaliar sync iCloud via "atalho do Atalhos" (Shortcuts app) — Lucas roda manual 1x/sem 🍎

### Audit derivado 🔍
- 🤖 Android: storage policy é mais permissivo (Chrome quota maior, sem ITP). Documentar em PLATFORM_NOTES que no Android isso é menos urgente, mas `persist()` ainda é boa prática.

---

## Item 3 · Botão pós-timer confunde (P0 UX) 🔬

### Observação
> "Ao final do timer de descanso tem que ou fechar ou destacar o botão de fechar, pois continuou destacado o botão de iniciar, isso pode confundir e causar clique errado"

### Diagnóstico técnico (do código)
- `stopTimer()` (linhas 2505-2509) seta `b.textContent='Iniciar'` quando o timer chega em 0.
- Resultado: depois do chime, o botão grande verde está escrito "Iniciar" e visualmente em destaque. Lucas, em pé na academia, suado, vê "Iniciar" e clica achando que vai fechar — reinicia o timer.

### Pesquisa / metodologia 🔬
- **Hick's Law:** quanto mais opções pós-completion, maior latência de decisão. Pós-conclusão deve ter **uma ação clara**.
- **Princípio de "completion ritual"** (Norman, *The Design of Everyday Things*): tarefas concluídas devem ter feedback visual diferente do estado "pronto pra começar".
- **Padrão de timers consagrados** (Apple Timer, Strong, Hevy): após zerar, opções típicas:
  - **Auto-close** após 3-5s (Apple Timer faz isso).
  - **Trocar CTA** pra "Fechar" (verde) + secundário "Repetir" (cinza).
  - **Estado visual distinto:** ring verde fixo, número grande em verde, fundo do botão verde-saturado pra "Fechar".

### Recomendação
**Estado machine do timer:**
```
idle → running → paused → done
                          ↓
                  (auto-dismiss 5s OU clique Fechar)
```

Quando atinge `done`:
1. Texto do botão grande vira **"Fechar"** (não "Iniciar")
2. Cor do botão = verde sólido (sinaliza completed positivo)
3. Auto-dismiss em 5s se nenhum clique
4. Botão secundário pequeno "Repetir" abaixo, se quiser
5. Adicionar `data-state="done"` no overlay pra CSS poder estilizar o número/ring em verde

### Checklist
- [ ] **P0** Refator `stopTimer()` separa "pausar" de "completar". Adiciona `function timerDone()` distinto.
- [ ] **P0** Texto do botão grande no estado done = "Fechar"; clique chama `closeTimer()`
- [ ] **P0** Auto-dismiss 5s no estado done
- [ ] **P1** CSS state `[data-state="done"]` muda cor do botão pra verde
- [ ] **P2** Pequeno secundário "Repetir" no estado done

### Audit derivado 🔍
**Procurar outros botões com state machine ambígua:**
- Botão `+ Alimento` na aba Hoje — depois de adicionar, qual feedback?
- Botão `Feito` no alerta de deload — após clicar, o alerta desaparece imediatamente?
- Sets do log: após checar ✓, o input fica disabled? Há feedback visual de "salvo"?
- Botão de export de backup: feedback de "exportado com sucesso"?

Vou auditar isso em ronda separada antes de implementar — listar todos os botões + estado pós-clique em uma tabela.

---

## Item 4 · App precisa surfacing inteligente (P1) 🔬

### Observação
> "O app precisa ser inteligente para me mostrar tudo que preciso ao longo da semana, pois se não usarei só a home. Então as dicas, o que eu preciso saber ou fazer em um treino ou antes dele... de alguma forma tem que ter uma mecânica inteligente pra me fazer ver o que mais é relevante no app"

### Diagnóstico
- Aba **Mais** tem 12 princípios + Nutrição + Parecer maior — leitura passiva, Lucas leu uma vez e não volta.
- Aba **Corpo** tem dados úteis mas é "puxe pra ver".
- **Hoje** já é o atalho, mas mostra agenda fixa (peso/sono/macros/suplementos). Não surface nada contextual ao treino do dia.

### Pesquisa / metodologia 🔬
- **JITAI (Just-In-Time Adaptive Interventions)** — framework de behavioral science (Nahum-Shani 2018) usado em apps de saúde (Headspace, Streaks): info chega no momento certo, baseada em estado + contexto. Critérios: (a) need state — usuário está no momento em que a info importa; (b) opportunity state — usuário consegue agir.
- **Princípio "block of the day"** (Notion, Linear): 1 destaque rotativo por dia, não 12 simultâneos.
- **Apple Health "Highlights"**: surfaces 3 cards relevantes/dia rotativos.
- **Spaced repetition** (princípio Anki/Duolingo): princípios que o usuário "viu" há X semanas reaparecem; recém-vistos somem da home.
- **Pre-workout vs post-workout cue timing:** literatura de coaching (Schoenfeld 2021) sugere mente-músculo precisa de cue **30s antes do set**, não na noite anterior.

### Recomendação
**3 camadas de surfacing contextual** no Hoje:

1. **Card "Antes do treino" (pre-workout)** — aparece só no dia de treino, antes da 1ª série logada. Conteúdo:
   - Hero exercise + cue principal grande
   - 1 dica rotativa dos 12 princípios, escolhida por: (a) relevância pro tipo de treino do dia (push/pull); (b) spaced repetition (não mostrar a mesma 2x na semana)
   - Alerta de troca / plateau / deload **se aplicável hoje**
   - Lembrete: hidratação, creatina (se ainda não checada hoje)

2. **Card "Durante o treino"** — aparece quando user abre um exercício. Já existe (cue + sugestão de próxima série). Adicionar: micro-tip do princípio ligado ao tipo do exercício (ex: "Composto pesado: descanse 2min+ antes da próxima").

3. **Card "Depois do treino" (post-workout)** — aparece após completar última série. Resumo do dia (volume, PRs) + 1 ação recomendada (proteína nos próximos 30min se ainda não logou, ou agendar próximo treino).

**Mecânica de rotação dos 12 princípios:**
```
score(p) = relevance_to_today(p) * 0.5
        + days_since_last_seen(p) / 30 * 0.3
        + priority_weight(p) * 0.2  // alongado > encurtado é alto pra Lucas
```
Top 1 entra no card Hoje. Princípios "vistos" loggados em `meutreino_seen_v1`.

**Outros pontos a surfaces:**
- **Cintura crescendo?** Surface aviso baseado em medidas.
- **Sono <6h ontem?** Surface "hoje vá com 1 rep a menos" (Dattilo 2011).
- **Volume baixo num músculo prioridade?** Surface no card Hoje.

### Checklist
- [ ] **P1** Adicionar `meutreino_seen_v1` storage (princípios vistos)
- [ ] **P1** Card "Antes do treino" na aba Hoje com 1 dica rotativa contextual
- [ ] **P1** Card "Depois do treino" com resumo + ação recomendada (overlap com item 10)
- [ ] **P2** Surface alerta de sono <6h (já tem o input, só conectar)
- [ ] **P2** Surface volume baixo em grupo prioridade
- [ ] **P2** Surface cintura aumentando se medida crescer 2cm sem peso subir
- [ ] **P3** Algoritmo de rotação com score (relevância + recency + prioridade)

### Audit derivado 🔍
- Aba **Mais** vai ficar mais leve se princípios migram pro contextual. Considerar transformar Mais numa "biblioteca" pesquisável + glossário.
- 🤖 Para versão Android (namorada): se ela não treina ABCD, o algoritmo de rotação precisa ser parametrizável por programa.

---

## Item 5 · Imagem errada na elevação lateral (P1 bug) 🐛

### Observação
> "Elevação lateral está a imagem errada. Esta de unilateral na polia. Tem que ser a com halter"

### Diagnóstico técnico
- `index.html:1112-1114`: 3 entries mapeiam pro mesmo `cable-lateral-raise.jpg`:
  - `"Elevação lateral halter"` → cable-lateral-raise.jpg ❌ ERRADO
  - `"Elevação lateral (halter ou polia)"` → cable-lateral-raise.jpg (ambíguo)
  - `"Elevação lateral (polia ou halter)"` → cable-lateral-raise.jpg (ok, polia primeiro)

### Recomendação
1. Gerar `dumbbell-lateral-raise.jpg` no mesmo estilo SDXL (prompt em `~/Desktop/treino-prompts-imagens.txt`)
2. Mapeamento corrigido:
   - `"Elevação lateral halter"` → `dumbbell-lateral-raise.jpg`
   - `"Elevação lateral (halter ou polia)"` → `dumbbell-lateral-raise.jpg` (halter primeiro = padrão)
   - `"Elevação lateral (polia ou halter)"` → `cable-lateral-raise.jpg` (polia primeiro)

### Checklist
- [ ] **P1** Gerar `dumbbell-lateral-raise.jpg` via ElevenLabs
- [ ] **P1** Corrigir mapping `PHOTO_LOCAL` em index.html:1112-1114
- [ ] **P1** Commit + push + verificar no iPhone

### Audit derivado 🔍 — **Auditar TODAS as imagens**
Esse bug me indica que o mapping `PHOTO_LOCAL` + `PHOTO_ID` (linhas 1111-1140) precisa de audit completo. Vou listar todos os exercícios do programa ABCD e validar 1-a-1 se a imagem corresponde:

- [ ] Auditar 100% dos exercícios ABCD vs imagem mostrada
- [ ] Documentar em `IMAGE_AUDIT.md` cada exercício: nome → foto esperada → foto atual → status (ok/bug/falta)
- [ ] Identificar quais ainda dependem de Free Exercise DB e podem estar errados (yuhonas tem fotos genéricas que às vezes não batem)

---

## Item 6 · FAB sem propósito → Speed Dial (P2 UX) 🔬

### Observação
> "Não sei se precisa do botão flutuante... Talvez se for um botão flutuante, que ao clicar mostra mais 4 opções: iniciar treino, pausar treino, parar treino, timer avulso"

### Diagnóstico
- FAB atual (`index.html:956`) abre só o timer avulso. Pouco uso recorrente — timer já é acessível pelo botão "Descanso" em cada exercício.
- Lucas reconheceu que ele não percebeu utilidade. Pesquisa: **Material Design Guidelines** dizem que FAB deve ser **ação primária**. Se não é, vira ruído.

### Pesquisa / metodologia 🔬
- **iOS HIG não usa FAB.** iOS prefere tab bar ou contextual actions. Mas o app é PWA, então híbrido é ok.
- **Speed Dial pattern** (Material): FAB expandido revela 3-5 ações secundárias. Funciona bem quando ação primária é frequente + secundárias raras.
- **Princípio de Tesler ("conservation of complexity"):** se 4 ações precisam estar acessíveis, alguém tem que escolher onde colocar — tab bar (sempre visível) ou FAB (visível mas não óbvio).

### Recomendação
Implementar **Speed Dial** ao clique no FAB com 4 opções (sequência do mais usado pro menos):
1. **Timer avulso** (mantém função atual)
2. **Iniciar treino** (start workout duration tracker — item 7)
3. **Pausar treino** (só visível se treino ativo)
4. **Parar treino** (só visível se treino ativo)

Estado visual do FAB muda quando treino ativo:
- Idle: ícone ⏱️
- Treino rodando: ícone ▶️ pulsando + contador pequeno embaixo `0:23:14`
- Treino pausado: ícone ⏸️

### Checklist
- [ ] **P2** Componente FAB Speed Dial (4 ações)
- [ ] **P2** Estado visual FAB conectado ao workout duration state
- [ ] **P3** Avaliar: o FAB realmente é necessário ou virar uma "barra de ação contextual" no rodapé acima da nav?

### Audit derivado 🔍
- 🤖 Android: FAB é nativo do Material, namorada vai estranhar menos.
- 🍎 iOS: testar se Speed Dial não conflita com gestures de bottom edge swipe (control center).

---

## Item 7 · Workout duration tracking (P1 feature) 🔬

### Observação
> "A ideia de pausar/parar/retomar treino é pra poder contabilizar a duração do treino. O app registra o tempo de início até a conclusão do treino pra calcular o tempo de treino."

### Diagnóstico
- Hoje não existe métrica de duração de sessão. Só agregamos sets/peso/reps. Time-under-tension é uma métrica relevante mas separada.

### Pesquisa / metodologia 🔬
- **Duração de sessão correlaciona com qualidade**: sessões de hipertrofia produtivas ficam tipicamente em **60-90min** (Helms et al., RP Strength). Acima de 90min = fadiga acumulada degrada recovery (Dohi 2025).
- **Auto-pause** (Strava, Apple Workout): pausa se inatividade > 5min. Útil pra contar tempo real de treino, não tempo total no celular.
- **Estado persistente:** durations devem sobreviver app close. localStorage com timestamp `start_at` + `paused_at[]` + `resumed_at[]` permite reconstruir mesmo se app crashou no meio.

### Recomendação
Schema novo:
```js
meutreino_session_v1 = {
  active: {
    workoutId: "A",
    startAt: 1719681234000,
    pauseSegments: [[paused_at, resumed_at], ...],  // pairs
    lastActivityAt: 1719681234000  // pra auto-pause
  } | null,
  history: [
    {date, workoutId, startAt, endAt, durationMs, activeMs, sets:N}
  ]
}
```

Estados:
- **idle** — nenhum treino ativo
- **active** — startAt setado, last activity recente
- **paused** — manualmente pausado OU auto-pause após 5min sem set
- **ended** — user fecha treino OU completa última série (item 10)

UI:
- Header do treino aberto mostra tempo: `00:23:14` em monospace
- FAB mostra mini-contador se sessão ativa (ver item 6)
- Aba Corpo: adicionar "Duração média de treino esta semana"

Auto-end: se passou de 2h ativo sem set checado, sugere encerrar.

### Checklist
- [ ] **P1** Implementar `meutreino_session_v1` storage
- [ ] **P1** Funções `startSession(workoutId)`, `pauseSession()`, `resumeSession()`, `endSession()`
- [ ] **P1** Display de duração no header do treino aberto
- [ ] **P2** Auto-pause após 5min sem novo set
- [ ] **P2** Card "Duração média da semana" na aba Corpo
- [ ] **P3** Alerta se sessão > 90min ("sessões muito longas degradam recovery")

### Audit derivado 🔍
- Conecta com item 10 (celebração ao completar última série dispara `endSession()`).
- 🤖 Mesma lógica vai pro app da namorada — não precisa de mudança per plataforma.

---

## Item 8 · Timer auto-close quando app bloqueado (P2 question) 🔬

### Observação
> "O timer deve fechar depois de um tempo se o app estiver bloqueado?"

### Pesquisa / metodologia 🔬
- **Princípio "preserve user context":** se Lucas voltou ao app 10min depois, o timer **não deve estar aberto** mostrando algo irrelevante — mas também não deve ter perdido info útil.
- **Apple Timer:** se você minimiza, timer continua. Ao voltar, está lá.
- **Forecast de uso:** descanso entre sets é 90-150s. Se passou 5min+, ou Lucas terminou o treino ou se distraiu.

### Recomendação
- Se timer chegou em 0 há mais de **2min** e user nunca voltou → auto-close ao retornar.
- Se timer foi pausado e está pausado há **>10min** → ao retornar, modal "Tempo desde a pausa: 12:34. Resetar pra próximo descanso?"
- Se timer estava rodando e o `endTime` já passou + sem interação → status = `done` (mostra "Fechar" highlighted, item 3).

### Checklist
- [ ] **P2** `visibilitychange` listener: ao voltar, calcular `now - endTime` e aplicar regras acima
- [ ] **P2** Modal de "muito tempo pausado" se >10min

### Audit derivado 🔍
- Mesma lógica de "muito tempo idle" pode aplicar ao workout session inteiro (item 7 — auto-pause).

---

## Item 9 · IA cardio recommender (P3 stretch) 🔬

### Observação
> "Talvez um sistema inteligente para calcular se devo fazer cardio e quanto? Acho que isso pode ser opicional e deixar em stand by se for consumir muitos tokens."

### Pesquisa / metodologia 🔬
- **Não precisa de tokens nem IA externa.** Heurística pura resolve 90%:
  - Energy balance simples: déficit calórico declarado → cardio Z2 30-45min 3x/sem
  - Manutenção/superávit → 1-2 sessões Z2 curtas (15-20min) pra cardiovascular health (Helms 2018)
  - Steps < 7000/dia média 3 dias → sugere cardio extra
- **Recovery-aware:** se sono <6h média semana ou volume de treino na semana >meta, **reduzir** cardio.
- **Modelo Polarized vs SIT** (Seiler 2010): pra hipertrofia + manutenção, Zona 2 estável > HIIT (que compete com recovery muscular).

### Recomendação
Implementar **sem IA**, regra de decisão em ~20 linhas JS:
```js
function cardioRecommendation(steps7d, sleep7d, weeklyVolume, goal) {
  if (goal === 'cut' && avg(steps7d) < 8000) return {z2: 35, freq: 3, why: 'déficit + steps baixos'};
  if (avg(sleep7d) < 6) return {z2: 15, freq: 2, why: 'recovery limitado, reduzir cardio'};
  // ... mais regras
}
```
Surface no card "Antes do treino" (item 4) ou em aba Corpo.

### Checklist
- [ ] **P3** Adicionar campo "goal" (cut/maintain/bulk) em meta
- [ ] **P3** Função `cardioRecommendation(...)` heurística
- [ ] **P3** Card de recomendação na aba Hoje

### Audit derivado 🔍
- Mesmo padrão (heurística > IA) aplica em outras "perguntas inteligentes" — não cair na armadilha de chamar API toda hora pra coisa que é regra-de-bolso.

---

## Item 10 · Celebração ao completar treino (P2 UX) 🔬

### Observação
> "Ao completar a última série deve ter algum pop up de celebração e dia finalizado, dar ok, pegar algum registro, mostrar um resumo e voltar pra home"

### Pesquisa / metodologia 🔬
- **Variable reward** (Skinner; Eyal, *Hooked*): celebrações ao fechar loop são o principal driver de retorno em apps de hábito. Apple Closing Rings é o caso de uso mais estudado.
- **Self-Determination Theory** (Deci & Ryan): competence + autonomy + relatedness. Resumo de sessão = feedback de competência.
- **Padrão de design** (Duolingo, Apple Watch, Strong):
  1. Animação curta (1-2s) — não pode ser longa, fica chata na 50ª vez
  2. Métrica única em destaque (PR? volume? duração?)
  3. Stat blocks abaixo (3-5 números)
  4. CTA de fechar/compartilhar
- **Trigger correto:** detecção de "última série da última exercício do dia" — todos os sets checados ✓.

### Recomendação
**Detecção:** ao checar último ✓, computa se TODOS os exercícios do dia têm pelo menos 1 set válido. Se sim, dispara `celebrate()`.

**UI Celebration modal:**
- Título grande: "Treino [A/B/C/D] completo 💪" (sem emoji se preferir minimalista)
- 1 destaque hero rotativo:
  - Se PR detectado: "🏆 PR novo: Supino 24kg × 8 (e1RM 28.5kg)"
  - Senão se progressão: "↑ +1 rep no Supino vs semana passada"
  - Senão: "✓ X sets · Y kg movidos"
- 4 stat blocks:
  - Duração: `1:14:23` (do item 7)
  - Sets totais: `18`
  - Volume movido: `4520 kg`
  - Streak: `🔥 12`
- CTA: "OK" → volta pra Home
- Secundário: "Ver resumo completo" → expand pra modal maior com lista de exercícios

**Animação:** fade-in + scale 0.95→1.0 em 200ms. Confetti uma vez quando é PR (1.5s).

**Side-effect:** dispara `endSession()` (item 7) + persiste no `history` da session.

### Checklist
- [ ] **P2** Função `isWorkoutComplete()` — todos os exercícios com ≥1 set válido
- [ ] **P2** Componente `<div class="celebration">` + animação CSS
- [ ] **P2** Hero rotativo: PR > progressão > completion
- [ ] **P2** 4 stat blocks (depende item 7 pra duração)
- [ ] **P3** Confetti em PR
- [ ] **P3** "Ver resumo completo" modal

### Audit derivado 🔍
- Lacuna: hoje não há **nenhuma** celebração — nem mesmo pra PRs. O badge PR dourado existe mas é discreto. Considerar mini-toast no momento do PR (não no fim).
- 🤖 Mesmo padrão se replica trivialmente no Android.

---

## Cross-cutting audits derivados desta sessão

### A. Audit imagens (a partir do item 5)
Auditar todos os 40+ exercícios do ABCD vs imagem mostrada. Criar `IMAGE_AUDIT.md` com cada uma. Priorizar exercícios prioritários do Lucas (ombro_lat, peito_sup, biceps, triceps).

### B. Audit botões pós-ação (a partir do item 3)
Cada botão do app + estado pós-clique. Procurar outros casos onde "estado idle" e "estado pronto" são visualmente iguais. Possíveis suspeitos:
- Botão "Feito" do alerta de deload
- Botão "+ Alimento" depois de adicionar
- Sets log: ✓ não tem feedback além do check
- Botão de upload de foto

### C. Audit foreground-only (a partir do item 1)
Mapear o que o app assume estar em foreground:
- Timer
- Alertas/banners (deload, plateau, troca)
- Streak (zera silenciosamente)

Decidir quais migram pra push notification.

### D. Audit storage resilience (a partir do item 2)
- Toda função que escreve em localStorage tem rollback?
- Quota check no boot?
- Backup automático lembrado?

### E. Audit surfacing contextual (a partir do item 4)
- Quais infos do app são "puxe pra ver" e poderiam ser "vem até você"?
- Aba Mais: princípios provavelmente nunca relidos depois do dia 1
- Aba Corpo: stats raramente checadas exceto domingo

---

## Checklist consolidada (priorizada)

### P0 — Blockers (fix antes do próximo treino, ~2026-07-02)
- [ ] Item 1: Notification API + audio file resiliente + Web Push avaliação 🍎
- [ ] Item 2: `navigator.storage.persist()` + backup snapshot dia 1 + confirmar PWA instalada 🍎
- [ ] Item 3: Refator estado do timer (idle/running/paused/done) + botão "Fechar" no done
- [ ] Item 5: Corrigir mapping imagem da Elevação lateral halter

### P1 — UX significativo (próximas 2 semanas)
- [ ] Item 1: Timer minimizável (mini-widget)
- [ ] Item 4: Card "Antes do treino" contextual na aba Hoje
- [ ] Item 5: Audit completo de TODAS as imagens
- [ ] Item 7: Workout session duration tracking (start/pause/stop)

### P2 — Improvements (próximo mês)
- [ ] Item 4: Cards Durante/Depois do treino
- [ ] Item 6: FAB Speed Dial 4 ações
- [ ] Item 8: Auto-close timer com visibilitychange smart
- [ ] Item 10: Celebração ao completar treino

### P3 — Stretch
- [ ] Item 1: Web Push remoto via Cloudflare Worker
- [ ] Item 4: Algoritmo de rotação spaced repetition dos princípios
- [ ] Item 9: Cardio recommendation heurístico
- [ ] Item 10: Confetti em PR + modal expandido

---

## Próximos passos pra próxima sessão

1. **Lucas exporta backup do dia 1** (botão na aba Mais → Backup → Exportar) — me envia o JSON
2. **Lucas confirma:** o app foi adicionado à Home Screen ou está sendo aberto via Safari?
3. Decidir junto com o Lucas: avançar pra implementação P0 ou rodar antes os **5 cross-cutting audits** (A-E acima)
4. Eu trago `IMAGE_AUDIT.md` + `BUTTON_AUDIT.md` pra revisar antes de codar

---

## Princípios derivados desta sessão (pra futuro Claude)

1. **Web/PWA no iOS é hostil por default.** Sempre assumir background ≠ funcional, presumir ITP, presumir API faltando (vibrate, FSA). Documentar em PLATFORM_NOTES.md.
2. **Foreground-only ≠ aceitável.** Se feature precisa funcionar bloqueado, planejar push notification, não wake lock.
3. **Heurística > IA externa** pra decisões com regras conhecidas.
4. **Cada feedback gera um audit transversal** — bug específico aponta padrão geral.
5. **Surfacing > documentação.** Info que mora em aba Mais só ajuda no dia 1.
