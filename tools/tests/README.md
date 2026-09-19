# Testes dos dois apps (MeuTreino e Treino-Ela)

Rodam em node com jsdom (usa o jsdom instalado em `~/Developer/bussola/node_modules` — ajuste
o caminho em `harness.js` se mudar). localStorage, IndexedDB e o Worker são falsos, em memória.

```bash
cd ~/Documents/MeuTreino/tools/tests && node suite.js && node t_sync.js && node t_sync2.js && node t_413.js
```

- `suite.js` — regressão: boot, telas, timer, Atalho iOS, import não destrutivo, sync básico
- `t_sync.js` — dois aparelhos (Android com dados → nuvem → iPhone limpo), foto, lápide, offline
- `t_sync2.js` — conflito (vence quem sincronizou por último), apagar/recriar, repouso sem ping-pong, teto de foto, `prog` dela
- `t_413.js` — Worker antigo (4MB) → app cai pro teto de 3,5MB e lembra

Limitação do harness: `const`/`let` de módulo (ST, WK) não são alcançáveis de fora — verifique
pelo localStorage (`w._ls('logs')`) e pelo innerHTML; chame funções de render direto.
Rode e LEIA o resultado antes de cada push — já saiu push com a suíte falhando.
