# Tour interior do hero (sequência de frames)

O hero do site é um "tour" da casa controlado pelo scroll: um `<canvas>` que troca de frame conforme a rolagem (mesma técnica da página dos AirPods). Enquanto `manifest.json` estiver com `count: 0`, o site usa a imagem estática `assets/gen/hero-mansao*.jpg` com um leve zoom.

Os prompts para gerar o vídeo no Google Flow estão em `prompts/TOUR-HERO-FLOW.md` (raiz do projeto).

## 1. Gerar os frames com ffmpeg

Rode a partir da pasta `site/` (onde ficam `assets/` e `index.html`). O vídeo do Flow deve ter cerca de 30 a 48 s, por isso a taxa é baixa (não use 24 fps, geraria ~1000 frames):

```bash
# Desktop (16:9): ~150 a 200 frames
ffmpeg -i hero-tour.mp4 -vf "fps=5,scale=1920:-2" -c:v libwebp -quality 72 assets/tour/desktop/frame_%04d.webp

# Mobile (9:16): ~120 a 150 frames
ffmpeg -i hero-tour-mobile.mp4 -vf "fps=4,scale=900:-2" -c:v libwebp -quality 70 assets/tour/mobile/frame_%04d.webp
```

Os arquivos precisam se chamar `frame_0001.webp`, `frame_0002.webp`, ... (4 dígitos, começando em 1).

Metas: entre ~120 e ~200 frames por versão e menos de 25 MB no total (desktop + mobile). Se passar, reduza `-quality` (ex.: 65) ou a largura (`scale=1600:-2`), ou baixe o `fps`.

## 2. Contar os frames e atualizar o manifest

PowerShell (na pasta `site/`):

```powershell
(Get-ChildItem assets/tour/desktop -Filter frame_*.webp).Count
(Get-ChildItem assets/tour/mobile  -Filter frame_*.webp).Count
```

Bash:

```bash
ls assets/tour/desktop/frame_*.webp | wc -l
ls assets/tour/mobile/frame_*.webp | wc -l
```

Coloque os números em `assets/tour/manifest.json`:

```json
{
  "desktop": { "count": 180, "path": "assets/tour/desktop/frame_", "ext": ".webp", "pad": 4 },
  "mobile":  { "count": 130, "path": "assets/tour/mobile/frame_",  "ext": ".webp", "pad": 4 }
}
```

## 3. Como o site usa os frames

- O frame 1 carrega na hora; os demais vêm em segundo plano (primeiro frames espaçados, depois o preenchimento). Durante o carregamento o scrub usa o frame carregado mais próximo.
- Desktop: hero com 500vh de rolagem. Mobile (até 833 px): 350vh.
- Se `manifest.json` faltar, ou `count` for 0, ou o usuário preferir movimento reduzido, entra o fallback com a foto estática.
- Legendas do tour (Chegada, Estar, Cozinha & Jantar, Suíte, Vista e a frase final) ficam no HTML (`.hero__chapters`) e entram nos intervalos definidos em `js/main.js`.
- Teste local: `python -m http.server 5530` dentro de `site/`.
