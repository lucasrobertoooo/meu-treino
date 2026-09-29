# Testes dos dois apps (MeuTreino e Treino-Ela)

Rodam em node com jsdom (usa o jsdom instalado em `~/Developer/bussola/node_modules` — ajuste
o caminho em `harness.js` se mudar). localStorage, IndexedDB e o Worker são falsos, em memória.

```bash
cd ~/Documents/MeuTreino/tools/tests && node suite.js && node t_sync.js && node t_sync2.js && node t_413.js && node t_ordem.js && node t_carga.js && node t_pausa.js && node t_meta.js && node t_audit.js
```

- `suite.js` — regressão: boot, telas, timer, Atalho iOS, import não destrutivo, sync básico
- `t_sync.js` — dois aparelhos (Android com dados → nuvem → iPhone limpo), foto, lápide, offline
- `t_sync2.js` — conflito (vence quem sincronizou por último), apagar/recriar, repouso sem ping-pong, teto de foto, `prog` dela
- `t_413.js` — Worker antigo (4MB) → app cai pro teto de 3,5MB e lembra
- `t_audit.js` — achados da auditoria de 29/09: histórico de sessão malformado, descanso do cardio, modelo de duração, campos mortos
- `t_meta.js` — invariante da dupla progressão: varre TODA meta (exercício × fase × faixa × ordem) e nenhuma pode subir peso e reps juntos. Rodar com `node --max-old-space-size=4096`
- `t_pausa.js` — pausa de 7+ dias recomeça o mesociclo; migração da âncora não muda a semana de ninguém
- `t_carga.js` — mudança grande de carga: baixar de propósito não vira "travado"/"trocar"; subir muito cai em "tentando"
- `t_ordem.js` — ordem do dia e troca de exercício: escopo (hoje/sempre), reversão, chave de log do substituto, meta recalculada pela posição, travado falso evitado (com controle)

Limitação do harness: `const`/`let` de módulo (ST, WK) não são alcançáveis de fora — verifique
pelo localStorage (`w._ls('logs')`) e pelo innerHTML; chame funções de render direto.
Rode e LEIA o resultado antes de cada push — já saiu push com a suíte falhando.

**Ao aplicar um patch nos DOIS apps**: grave o arquivo a cada substituição (um `exit` no meio
descarta tudo em silêncio — já aconteceu duas vezes) e confira a paridade dos dois arquivos
depois, com `grep -c` das assinaturas novas.
