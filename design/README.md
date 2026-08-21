# Artes originais

Masters em alta resolução. **Não ficam em `public/`** porque tudo que está lá é
publicado e baixado no deploy — e estes arquivos só servem de origem.

| Arquivo | Gera |
| --- | --- |
| `social-dom-guima-1200x630.png` | `public/brand/social-dom-guima.jpg` (prévia de link) |
| `favicon-dom-guima-512.png` | `src/app/icon.png` e `src/app/apple-icon.png` |

Trocou alguma arte? Regenere os derivados com:

```bash
npm run optimize:assets
```

A logo (`public/brand/logo-dom-guima.png`) fica em `public/` mesmo: ela é servida
via `next/image`, que redimensiona e converte para WebP/AVIF sob demanda — o
arquivo grande nunca chega ao navegador.
