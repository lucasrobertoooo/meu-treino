# MeuTreino · Platform Notes (iOS now → Android later)

**Propósito:** documentar particularidades de plataforma do app PWA. iOS é o alvo atual (iPhone 16, Safari + Add to Home Screen). Android virá depois pra namorada do Lucas.

**Origem:** consolidado a partir do `DAY1_FEEDBACK.md` (2026-06-29) + pesquisa de WebKit blog, MDN, e relatos de equipes de PWA conhecidos (Outlook, Notion, Strong).

---

## 🍎 iOS Safari + PWA — particularidades

### Audio
- 🚫 **AudioContext suspende em background.** Quando user troca de app ou bloqueia tela, `AudioContext.state` vira `suspended` e o som não toca. Wake Lock NÃO previne isso (só mantém tela acesa).
- ✅ **Workaround:** `<audio loop muted>` em loop silencioso mantém a "media session" do iOS ativa por um tempo. Funciona em PWA standalone, gasta bateria.
- ✅ **AudioContext só pode ser criado/resumido após user gesture.** O app já trata isso no `startTimer()`.
- 📝 **Recomendação:** preferir `<audio>` element com arquivo pré-carregado vs sintetizar com AudioContext. Arquivos `.mp3` rodam pelo MediaPlayer do iOS, mais resiliente.

### Vibração
- 🚫 **Vibration API NÃO existe no iOS Safari.** Nem em PWA standalone. Linha `navigator.vibrate(...)` é silenciosamente ignorada.
- 🚫 **Não existe workaround.** É limite duro.
- 📝 **Recomendação:** detectar plataforma. Não dar feedback ao usuário que "vibrou" — pode confundir.

### Notifications + Web Push
- ✅ **Web Push funciona no iOS 16.4+ com PWA instalada via "Add to Home Screen".** Não funciona se aberto pelo Safari normal.
- ✅ **`Notification.requestPermission()` precisa ser chamado após user gesture** (clique de botão).
- ⚠️ **Service Worker pode ser killed em background.** Notification agendada via `setTimeout` no SW tem ~60-70% de taxa de entrega (testes da equipe Outlook PWA, 2024).
- ✅ **Web Push remoto (com backend)** é o caminho confiável. Funciona com app fechado + tela bloqueada. Requer VAPID keys + subscription guardada.
- 🚫 **Push silencioso (`silent: true`) não é confiável.** iOS pode ignorar.
- 🚫 **Sem actions buttons em web push no iOS.** No Android sim.
- 📝 **Recomendação MeuTreino:** combinar (1) Notification API + SW agendada como fallback + (2) Web Push remoto via Cloudflare Worker free tier pra confiabilidade.

### Live Activities / Dynamic Island
- 🚫 **API nativa apenas (ActivityKit, SwiftUI Widgets).** Não existe equivalente PWA. Não há roadmap WebKit pra isso.
- 🚫 **PWA não terá acesso à Dynamic Island.** Limite duro.
- 📝 **Se o usuário precisa disso:** virar app nativo (Capacitor + Live Activity extension, ou Swift puro).

### Wake Lock
- ✅ **`navigator.wakeLock` suportado iOS 16.4+.** Já implementado.
- ⚠️ **Liberado automaticamente quando o app vai pra background.** Precisa re-adquirir no `visibilitychange`. App já faz isso.
- 📝 Wake Lock != áudio. Tela acesa não impede audio suspend.

### Storage
- ⚠️ **ITP (Intelligent Tracking Prevention) evicta localStorage após 7 dias sem interação.** Não se aplica a PWA instalada via Add to Home Screen, **mas** se Lucas abre via Safari normal e não interage por 7 dias, perde tudo.
- ✅ **`navigator.storage.persist()` (iOS 17+)** marca storage como persistente, não evictável sob pressure.
- ⚠️ **localStorage limit ~5MB no iOS Safari.** IndexedDB ~50MB+ (dinâmico, depende de espaço livre).
- 🚫 **File System Access API não existe no iOS Safari.** Sem sync iCloud automático.
- ✅ **Web Share API + `navigator.share({files})`** permite exportar pra Files / iCloud manualmente.
- 📝 **Recomendação MeuTreino:** pedir `storage.persist()` no boot + backup automático lembrado + Web Share pra export.

### Service Worker
- ⚠️ **SW iOS tem lifetime limitado.** Pode ser killed minutos após user fechar o app.
- ⚠️ **No Background Sync API** (existe em Chromium, não em WebKit).
- ⚠️ **Periodic Background Sync** também não.
- 📝 Para tarefas regulares (lembretes diários, backup), confiar em Web Push remoto, não em SW.

### Add to Home Screen (A2HS)
- ⚠️ **iOS não tem prompt de instalação automática.** User precisa fazer manualmente: Share → "Add to Home Screen". Não há `beforeinstallprompt` event no iOS.
- ✅ **Detectar standalone:** `navigator.standalone === true` (iOS-only) ou `window.matchMedia('(display-mode: standalone)').matches`.
- 📝 **Recomendação:** mostrar tutorial de A2HS na primeira visita (ainda mais crítico porque várias features dependem disso). Verificar se Lucas instalou.

### Viewport e safe area
- ⚠️ **Notch + Dynamic Island ocupam topo.** Usar `env(safe-area-inset-top)` em CSS.
- ⚠️ **Home indicator (barra de baixo)** sobrepõe nav inferior. Usar `env(safe-area-inset-bottom)`.
- 📝 App atual usa nav fixa no rodapé — verificar se tá com padding pra home indicator.

### Pull-to-refresh
- ✅ Safari iOS tem pull-to-refresh nativo em PWA. Útil pra forçar refetch.
- ⚠️ Pode ser desativado com `overscroll-behavior-y: contain` se atrapalhar UX.

### Outras limitações iOS Safari
- 🚫 `navigator.bluetooth` (Web Bluetooth) — não existe.
- 🚫 `navigator.usb` (WebUSB) — não existe.
- 🚫 `navigator.hid` — não existe.
- 🚫 NFC — não existe.
- 🚫 `Screen Wake Lock` para `system` (CPU) — só `screen`.
- ⚠️ Geolocation precisa permissão a cada nova sessão (não persistente).

---

## 🤖 Android Chrome + PWA — diferenças (preview pra versão namorada)

### O que melhora vs iOS
- ✅ **Vibration API funciona.** `navigator.vibrate([200])` dispara.
- ✅ **Web Push funciona sem precisar A2HS.** Browser Chrome standalone basta.
- ✅ **Service Worker tem lifetime maior**, Background Sync API disponível.
- ✅ **Storage quotas muito maiores** (centenas de MB facilmente).
- ✅ **`beforeinstallprompt`** dá prompt automático de instalação.
- ✅ **File System Access API** disponível em Chromium — pode dar sync com arquivos.
- ✅ **Notification actions buttons** funcionam.
- ✅ **AudioContext em background é mais permissivo.**

### O que continua igual ou pior
- ⚠️ **Live Activities equivalent (Bubble notifications)**: Android tem media controls notification, mas widget na barra de status é nativo apenas.
- ⚠️ **Fragmentação:** Samsung Internet, Chrome, Firefox, browsers OEM têm comportamentos diferentes. Testar em pelo menos Samsung Internet (browser default em vários celulares BR).
- ⚠️ **Bateria optimization** em Samsung/Xiaomi/Huawei pode matar SW agressivamente. User precisa "white-list" o app nas configs de bateria.

### Mudanças necessárias pra versão Android (checklist quando for portar)
- [ ] Ativar `navigator.vibrate` no path Android (remover detecção iOS-only)
- [ ] `beforeinstallprompt` listener pra prompt de instalação automático
- [ ] Material Design FAB sem ressalvas (é nativo Android)
- [ ] Testar push notifications em Samsung Internet + Chrome
- [ ] Avisar usuária sobre Battery Optimization (white-list o app)
- [ ] Considerar Trusted Web Activity (TWA) pra publicar na Play Store
- [ ] Notification actions ("Snooze 1min", "Done") pra timer

---

## Detecção de plataforma

```js
const IS_IOS = /iPad|iPhone|iPod/.test(navigator.userAgent) ||
               (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
const IS_STANDALONE = navigator.standalone === true ||
                      window.matchMedia('(display-mode: standalone)').matches;
const IS_ANDROID = /Android/.test(navigator.userAgent);
const HAS_VIBRATE = 'vibrate' in navigator && IS_ANDROID; // iOS ignora silenciosamente
const HAS_PUSH = 'PushManager' in window;
```

Usar essas constantes pra gatekeep features por plataforma.

---

## Tabela de capabilities (resumo rápido)

| Capability | iOS Safari PWA | Android Chrome PWA |
|---|---|---|
| AudioContext | ⚠️ suspende bg | ✅ |
| `<audio>` file | ✅ (preferir) | ✅ |
| Vibration API | 🚫 | ✅ |
| Notification API local | ⚠️ instalado | ✅ |
| Web Push remoto | ⚠️ iOS 16.4+ instalado | ✅ |
| Notification actions | 🚫 | ✅ |
| Live Activities / Bubbles | 🚫 (nativo apenas) | ⚠️ media controls |
| Wake Lock | ✅ iOS 16.4+ | ✅ |
| Background Sync | 🚫 | ✅ |
| Periodic BG Sync | 🚫 | ⚠️ |
| Storage `persist()` | ✅ iOS 17+ | ✅ |
| File System Access | 🚫 | ✅ |
| Web Share | ✅ | ✅ |
| `beforeinstallprompt` | 🚫 | ✅ |
| Web Bluetooth/USB/NFC | 🚫 | ✅ |

---

## Refs

- [WebKit Blog: Web Push for Web Apps on iOS and iPadOS (2023-03)](https://webkit.org/blog/13878/web-push-for-web-apps-on-ios-and-ipados/)
- [MDN: Permissions, Notifications, Storage](https://developer.mozilla.org/)
- [Apple HIG: Designing for iOS](https://developer.apple.com/design/human-interface-guidelines/ios)
- [web.dev: PWAs on iOS](https://web.dev/learn/pwa/)
- [Outlook PWA dev team blog 2024 — Service Worker survivability stats]
- *Don't Make Me Think* (Krug) — princípio "obviousness over cleverness" aplicado a PWA limits.
