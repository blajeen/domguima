# Padrão de qualidade das imagens

Auditoria atualizada em 20/08/2026 sobre os assets da Dom Guima.

## Direção de produto

A imagem principal deve ajudar o cliente a reconhecer o produto rapidamente,
comparar opções e confiar que receberá o item anunciado. A prioridade de fonte é:

1. catálogo de fotos enviado pelo dono da Dom Guima;
2. foto oficial do fabricante, quando o modelo coincide;
3. foto verificada do anúncio da própria loja;
4. foto técnica pesquisada e revisada;
5. ilustração explicitamente identificada, somente quando não há foto segura.

Não alteramos modelo, capacidade, cor, controles, acessórios, logotipos ou
proporções. Imagens sem correspondência exata ficam fora do site.

## Especificação da capa

- Arquivo: `cover.webp`
- Canvas: 1200 × 1200 px
- Perfil: sRGB
- Qualidade WebP: 88–90
- Nitidez: leve, somente após o redimensionamento
- Foto do catálogo do dono: composição original em enquadramento quadrado e
  preenchimento integral do card, preservando a direção de arte de estúdio
- Foto técnica comum: produto centralizado em área de até 960 × 960 px sobre
  canvas transparente
- Galeria: fotos do dono em `owner-1.webp`, `owner-2.webp` etc.; fotos oficiais
  e técnicas continuam como `1.jpg`, `2.jpg` etc.

## Resultado atual

- 72 arquivos recebidos no catálogo do dono foram revisados em pranchas;
- 65 imagens foram associadas com segurança a 60 produtos;
- 7 imagens não foram publicadas por serem genéricas, divergirem em capacidade
  ou pertencerem a tamanhos/modelos ausentes no catálogo atual;
- 89 capas foram geradas e conferidas em seis pranchas de contato;
- a LES11 possui cinco imagens oficiais da Electrolux na galeria, além da foto
  do catálogo do dono;
- o climatizador Philco PCL05A foi corrigido e aparece completo;
- todas as capas têm exatamente 1200 × 1200 px.

## Casos não publicados automaticamente

- Lixeira Tramontina de 7 L: o produto cadastrado é de 5 L.
- TVs LG de 50" e Samsung de 65", além da Toshiba de 50": não existe produto
  exatamente correspondente no catálogo atual.
- Kit Tramontina genérico e foto de conjunto Stanley: não identificam um único
  SKU com segurança.
- Selo `esgotado`: é material de comunicação, não foto de produto.

## Manutenção

Ao receber uma nova versão do catálogo do dono, execute:

```bash
node scripts/import-owner-catalog-images.mjs
npm run images:standardize
npm run images:audit
```

Depois rode `npm run lint`, `npm run build` e faça a inspeção visual das pranchas
em `.image-audit/` antes da publicação.
