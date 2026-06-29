# Treino · ABCD Push/Pull

App pessoal de academia. Single-page web (PWA instalável), funciona offline depois da 1ª carga.

## Estrutura

```
~/Documents/MeuTreino/
├── index.html                ← o app inteiro (HTML + CSS + JS vanilla)
├── manifest.json             ← PWA manifest (instalável no iPhone)
├── sw.js                     ← service worker (cache offline + fotos)
├── icon-192.png              ← ícone PWA 192px
├── icon-512.png              ← ícone PWA 512px
├── icon-512-maskable.png     ← ícone com safe zone (Android maskable)
├── apple-touch-icon.png      ← ícone home screen iOS (180px)
└── HANDOFF.md                ← este arquivo
```

## Como rodar AGORA, antes de subir online

### Opção A — testar no Mac (browser)
```
open ~/Documents/MeuTreino/index.html
```
Funciona, mas com 2 ressalvas:
- localStorage em `file://` no Safari pode ser limpo pelo iOS sem aviso
- Service worker NÃO registra em `file://` (precisa de http/https)

### Opção B — testar no iPhone via servidor local (LAN)
No Mac:
```
cd ~/Documents/MeuTreino && python3 -m http.server 8080
```
No iPhone (na mesma rede WiFi): abre `http://IP-DO-MAC:8080` no Safari.
Pra descobrir o IP: System Settings → Wi-Fi → (i) ao lado da rede → IP Address.

### Opção C — RECOMENDADA: GitHub Pages (deploy permanente, grátis)

Resolve todos os problemas: persiste localStorage de verdade, instala como app real, funciona offline com SW, atualiza com um `git push`.

#### Setup (uma vez):
1. Cria o repo no GitHub: https://github.com/new
   - Nome: `meu-treino` (ou o que preferir)
   - Visibilidade: privado tá ok (Pages funciona em privado se tiver Pro; senão usa público)
2. No terminal:
```
cd ~/Documents/MeuTreino
git add .
git commit -m "Setup inicial: app ABCD com PWA"
git branch -M main
git remote add origin git@github.com:SEU-USUARIO/meu-treino.git
git push -u origin main
```
3. No GitHub: Settings → Pages → Source: `main` / `(root)` → Save
4. Espera 1-2min. URL fica: `https://SEU-USUARIO.github.io/meu-treino/`

#### Instalar no iPhone:
- Abre essa URL no Safari
- Toca em Compartilhar ↑ → "Adicionar à Tela de Início"
- Renomeia se quiser → Adicionar
- Pronto: vira app fullscreen, abre offline depois da 1ª carga

#### Pra atualizar depois:
```
cd ~/Documents/MeuTreino
# edita o arquivo
git add . && git commit -m "..." && git push
```
GitHub Pages rebuilda em ~1min. No iPhone, próxima abertura puxa a versão nova (SW atualiza em background).

## Estrutura do código

`index.html` é tudo: HTML + CSS + JS inline. Sem dependências, sem build step.

Sessões principais:
- `:root` CSS — variáveis de cor, raios, sombras
- header / cards / nav — estilos liquid glass
- `WK` — dados dos 4 treinos
- `PHOTO_ID` — mapeia exercício → ID no Free Exercise DB
- `render*()` — renderers das 3 telas (treino / princ / mais)
- timer — overlay com ring SVG + Web Audio bip

### Persistência
- chave: `meutreino_logs_v1`
- formato: `{ "A_0": [{date:"2026-06-28", sets:[{kg,reps,done}]}], ... }`

### Fotos
- fonte: github.com/yuhonas/free-exercise-db (CC0)
- URL padrão: `https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/{ID}/0.jpg`
- service worker cacheia tudo na 1ª carga; offline depois

## Ícones placeholder
Os PNGs gerados agora são minimalistas (gradiente coral + letra "T"). Pra um app real, dá pra substituir por algo mais elaborado depois — só sobrescrever os 4 PNGs mantendo os nomes.

## Editar o programa
Pra trocar exercícios, mudar séries/reps ou ajustar deixas: editar o objeto `WK` no `index.html` (linha ~440 mais ou menos). Pra trocar a foto de um exercício, atualizar a chave correspondente em `PHOTO_ID`. Lista completa de IDs disponíveis no Free Exercise DB:
```
curl -s "https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/dist/exercises.json" | grep -oE '"id": "[^"]*"' | sort -u
```
