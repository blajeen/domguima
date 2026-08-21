# Dom Guima — Loja Virtual

E-commerce próprio da **Dom Guima** (`DOM GUIMA SHOP` — *Empório das Ofertas*), loja de
eletrônicos, eletrodomésticos, climatização e decoração de Minas Gerais, que já vende
pela Shopee, pelo Instagram e pelo WhatsApp.

**Stack:** Next.js 16 (App Router) · React 19 · TypeScript · Tailwind CSS 4
Sem biblioteca de UI, sem carrossel de terceiros, sem gerenciador de estado externo —
carrosséis usam scroll nativo com snap e o carrinho usa `useSyncExternalStore` sobre o
`localStorage`.

```bash
npm install
npm run dev          # http://localhost:3000
```

---

## ⚠️ Leia primeiro: o que é dado real e o que não é

Esta é a regra mais importante do projeto. **Nada aqui inventa informação sobre a
Dom Guima.** Todo produto carrega o campo `dataSource`, e as seções que dependem de
integração externa só aparecem quando a integração existe de verdade.

### Dados REAIS (coletados das fontes oficiais em 19/08/2026)

| Dado | Valor | Fonte |
| --- | --- | --- |
| Nome da loja | DOM GUIMA SHOP | API da Shopee |
| Slogan público | Empório das Ofertas | título da loja na Shopee |
| Nota média | 4,88 | API da Shopee |
| Avaliações | 3.239 (3.154 boas · 55 neutras · 30 ruins) | API da Shopee |
| Seguidores na Shopee | 1.850 | API da Shopee |
| Itens anunciados | 79 | API da Shopee |
| Taxa de resposta | 93% | API da Shopee |
| Loja aberta em | maio/2022 | API da Shopee |
| Localização | Minas Gerais | API da Shopee |
| Seguidores no Instagram | 7.624 | perfil público |
| Segmentos | Smart TVs, celulares, eletrodomésticos, climatização, decoração | descrição da própria loja |
| WhatsApp | +55 34 9874-8425 | confirmado pelo lojista em 20/08/2026 |
| Produto real | Ferro a Vapor Arno Essentialgliss FV1051B2 | anúncio ativo (item `23498051812`) |

O produto da Arno vem com **preço, fotos, estoque, nota, nº de vendas e variação de
voltagem reais**, lidos da API. As 5 fotos estão em `public/produtos/`.

Esses números são um retrato daquele dia — `verifiedAt` em `src/config/site.ts` registra
a data. Rode `npm run import:shopee` para atualizá-los.

### Dados de VITRINE (substituir por produtos reais)

Os outros **40 produtos** têm `dataSource: "placeholder"`. Eles existem para a loja não
ficar vazia e representam os segmentos que a Dom Guima realmente declara vender — mas
**não são anúncios reais**. Por isso:

- não têm marca (nada de "Samsung" ou "Philco" inventado);
- não têm nota nem estrelas (a UI simplesmente não exibe avaliação sem nota real);
- não têm contagem de vendas — "mais vendido" é uma marcação manual (`isBestSeller`);
- usam ilustrações de linha em `public/placeholder/`, não fotos de produto.

Trocar tudo isso por catálogo real é **um comando** (veja abaixo).

### O que NÃO existe no projeto

Nenhuma avaliação fictícia, nenhum depoimento inventado, nenhum "10 anos de mercado",
nenhum pagamento simulado e nenhum Pix falso.

---

## Importar o catálogo real da Shopee

```bash
npm run import:shopee
```

O script lê a loja oficial, converte os produtos, baixa as imagens para
`public/produtos/<slug>/` e grava `src/lib/catalog/shopee-catalog.json`. **Assim que esse
arquivo tiver produtos, ele vira o catálogo do site** e os itens de vitrine somem
sozinhos — nenhum componente precisa mudar.

A Shopee protege a listagem com antibot, então a chamada anônima traz só as estatísticas
da loja. Para trazer os 79 produtos, é preciso o cookie de uma sessão logada:

1. abra `shopee.com.br/domguima` **logado** no Chrome ou Edge;
2. tecle **F12** → aba **Network** → digite `search_items` no filtro;
3. role a página da loja até carregarem produtos — uma linha `search_items` aparece;
4. clique nela → **Headers** → **Request Headers** → botão direito em `Cookie:` → **Copy value**;
5. cole num arquivo `shopee-cookie.txt` na **raiz do projeto**;
6. rode `npm run import:shopee`.

O arquivo já está no `.gitignore`. Preferimos arquivo a variável de ambiente porque o
cookie não passa pelo terminal — nada de aspas quebrando no PowerShell nem cookie no
histórico de comandos.

### Quanto tempo o cookie dura

Enquanto a sua sessão da Shopee continuar viva — normalmente **semanas**. Você reusa o
mesmo arquivo em todas as importações; não precisa copiar de novo a cada atualização.

Ele para de valer quando você sai da conta, troca a senha ou a Shopee expira a sessão.
Para saber sem precisar rodar o import inteiro:

```bash
npm run check:shopee     # responde em segundos se o cookie ainda vale
```

Guarde o arquivo se o computador for só seu — é o uso prático. Apague se a máquina for
compartilhada ou se você não for importar tão cedo: quem tiver acesso à pasta consegue
agir como você na Shopee enquanto o cookie estiver válido.

O script se recusa a sobrescrever o catálogo se não conseguir uma listagem completa, então
uma tentativa sem cookie nunca deixa a loja com menos produtos do que já tinha.

Ele também imprime as estatísticas atualizadas da loja para você colar em
`src/config/site.ts`.

---

## Configuração

Copie `.env.example` para `.env.local`. **Nada é obrigatório para o site rodar** — cada
integração desligada apenas esconde a sua seção, em vez de mostrar promessa vazia.

| Variável | Para quê | Sem ela |
| --- | --- | --- |
| `NEXT_PUBLIC_SITE_URL` | canonical, sitemap, Open Graph, JSON-LD | usa `domguima.com.br` |
| `NEXT_PUBLIC_WHATSAPP_NUMBER` | botão flutuante, "comprar pelo WhatsApp", checkout | usa o número da bio do Instagram |
| `NEXT_PUBLIC_GOOGLE_PROFILE_URL` | sobrescreve o perfil público do Google já configurado | usa o link verificado no código |
| `INSTAGRAM_ACCESS_TOKEN` + `INSTAGRAM_USER_ID` | grade de posts reais | mostra o convite para seguir |

A chave do Instagram é **server-side** — nunca use o prefixo `NEXT_PUBLIC_` nela.
As métricas do Google são um retrato público datado em `src/config/site.ts` e
levam ao perfil oficial; não dependem de API.

### Pendências do lojista (procure por `CONFIG` no código)

- [x] Número de WhatsApp confirmado: +55 34 9874-8425
- [ ] Domínio definitivo em `NEXT_PUBLIC_SITE_URL`
- [ ] `support.hours` e `support.email` em `src/config/site.ts` (hoje `null`, então não aparecem)
- [ ] CNPJ e endereço fiscal para o rodapé e as páginas institucionais
- [ ] Atualizar periodicamente a nota e a quantidade pública do Google
- [ ] Confirmar as regras comerciais em `commerce` (parcelamento e desconto no Pix)

---

## Painel administrativo

O painel fica em `/painel` e gerencia produtos, preços, fotos, estoque,
categorias, ofertas, dados da loja e a exportação do catálogo em PDF. Existe
uma única conta de proprietário e não há cadastro público. Em produção, os
dados e imagens ficam no Vercel Blob; localmente, ficam em arquivos ignorados
pelo Git.

### Configuração inicial

1. Gere a conta local. A senha é convertida em hash e não fica gravada no
   código nem no arquivo de configuração:

```bash
npm run setup:admin
```

2. Reinicie o Next.js e entre em `/painel/login`.
3. No painel, abra Configurações e digite `IMPORTAR` na importação inicial.
4. Para produção, conecte um Vercel Blob **público** ao projeto. A Vercel cria
   `BLOB_READ_WRITE_TOKEN` automaticamente.
5. Cadastre na Vercel os três valores `ADMIN_*` gerados em `.env.local`:

```env
ADMIN_USERNAME=...
ADMIN_PASSWORD_HASH=...
ADMIN_SESSION_SECRET=...
```

O catálogo salvo no Blob é criptografado com AES-256-GCM usando o segredo da
sessão. As imagens são públicas porque aparecem na loja; cada arquivo recebe
um nome único. Toda Server Action revalida a sessão do proprietário antes de
escrever. No ambiente da Vercel, o painel recusa gravações se o Blob não estiver
conectado, evitando mostrar uma confirmação que seria perdida depois.

### Regras operacionais

- Produto novo começa como rascunho. É obrigatório adicionar uma foto antes de
  publicar.
- Marcar “Oferta” exige preço anterior maior que o preço atual.
- Produto removido é arquivado, não apagado definitivamente.
- Estoque de produto existente só muda em `/painel/estoque`, com motivo e
  histórico. Abrir o WhatsApp ou adicionar ao carrinho não reserva estoque.
- Em `/painel/catalogo-pdf`, filtre os produtos e clique em “Exportar / salvar
  PDF”; na janela do navegador escolha o destino “Salvar como PDF”.
- Alterações publicadas invalidam o cache do catálogo e aparecem na loja sem
  novo deploy.

### Curadoria inteligente dos banners

O hero da página inicial escolhe automaticamente dois produtos e reserva o
terceiro slide para a reputação verificada da loja. Só concorrem produtos
publicados, com estoque, foto e a opção “Pode aparecer no banner” marcada.

A pontuação combina:

- oferta real, sempre com preço anterior maior que o atual;
- publicação recente, apenas quando a data é conhecida pelo painel;
- reposição registrada por uma entrada de estoque;
- necessidade de giro, considerando quantidade disponível, vendas registradas
  e tempo desde a última venda;
- prioridade editorial de -100 a 100, configurável no cadastro do produto.

O algoritmo evita repetir produto e, quando possível, categoria. Termos
internos como “estoque parado” nunca aparecem para o cliente: a comunicação
pública usa oportunidade, novidade, reposição ou pronta entrega. Produtos
antigos importados sem uma data confiável não são anunciados como novidade.

## Arquitetura

```
src/
├── app/                        rotas (App Router)
│   ├── page.tsx                home
│   ├── produto/[slug]/         página de produto (41 rotas estáticas)
│   ├── categoria/[slug]/       vitrine por categoria
│   ├── busca/                  resultados com filtros
│   ├── ofertas/ mais-vendidos/ vitrines temáticas
│   ├── carrinho/ checkout/     fluxo de compra
│   ├── institucional/[slug]/   sobre, contato, frete, trocas, privacidade, termos
│   ├── api/sugestoes/          autocomplete (mantém o catálogo no servidor)
│   └── sitemap.ts robots.ts    SEO
├── components/
│   ├── layout/   Header, SearchBar, CategoryMenu, MobileMenu, Footer, WhatsAppFloat
│   ├── product/  ProductCard, ProductGrid, ProductCarousel, Gallery, Purchase
│   ├── catalog/  CatalogView + filtros (desktop e mobile compartilham o estado)
│   ├── home/     HeroBanner, CategoryStrip, TrustBar, Reviews, Instagram, Shopee
│   ├── cart/     CartDrawer
│   └── ui/       Drawer, Rating, Badge, Breadcrumbs, CarouselRow, Skeleton
├── lib/
│   ├── catalog/  types, categories, products, queries, filters, banners
│   ├── services/ instagram, shipping, payments, whatsapp
│   ├── store/    carrinho (store externo + provider)
│   ├── content/  textos institucionais
│   └── utils/    format, seo, validators
└── config/site.ts              ← toda a configuração da loja mora aqui
```

**Regra de ouro:** nenhum componente importa `products` direto. Tudo passa por
`lib/catalog/queries.ts`, então trocar o array por um banco de dados significa reescrever
um arquivo só.

---

## Integrações

| Integração | Estado |
| --- | --- |
| **Busca por CEP (BrasilAPI + ViaCEP)** | ✅ real, com fallback entre provedores — preenche o endereço no checkout |
| **WhatsApp** | ✅ real — mensagens prontas por produto, carrinho e pedido completo |
| **Catálogo Shopee** | ✅ importador pronto (`npm run import:shopee`) |
| **Google Reviews** | ✅ nota e quantidade públicas, datadas e com link para o perfil oficial |
| **Instagram** | 🔌 adaptador pronto (Graph API), aguardando token |
| **Cálculo de frete** | ✅ venda assistida — valor e prazo confirmados pelo WhatsApp |
| **Pagamento** | ✅ venda assistida — forma de pagamento confirmada pelo WhatsApp |

Sem gateway configurado, o checkout coleta os dados, valida CPF/CNPJ e endereço e
encaminha o pedido pelo WhatsApp — que é como a loja já vende hoje. **Não existe cobrança
simulada.**

---

## Testes

```bash
npm run dev                  # num terminal
npm run test:smoke           # noutro
```

Percorre a loja num navegador real e falha (exit 1) se algo quebrar: rotas fora do ar,
erro de console, exceção de JS, imagem quebrada, vazamento horizontal de 320px a 1920px,
fluxo de carrinho, validação do checkout, busca por CEP e autocomplete.

Estado atual: **todas as verificações passam**, zero erros de console.

```bash
npm run lint                 # ESLint — limpo
npm run build                # build de produção — limpo
npm run optimize:assets      # regenera ícones e prévia a partir de design/
npm run check:shopee         # o cookie da Shopee ainda vale?
```

---

## Artes da marca

| Arquivo | Onde aparece |
| --- | --- |
| `public/brand/logo-dom-guima.png` | header, rodapé, bloco do Instagram, JSON-LD |
| `public/brand/social-dom-guima.jpg` | prévia de link no WhatsApp, Facebook, X |
| `src/app/icon.png` · `apple-icon.png` · `favicon.ico` | aba do navegador e atalho no celular |

Os masters em alta ficam em `design/` — **fora de `public/`**, porque tudo que está
lá é publicado no deploy. Trocou alguma arte? Rode `npm run optimize:assets`, que
regenera os derivados e avisa se algum passar do peso recomendado.

A logo é PNG com transparência real (78% dos pixels), então funciona em fundo claro
e escuro sem placa por trás. A prévia social é JPEG de propósito: não tem
transparência e o PNG original pesava 1,4 MB — acima disso o WhatsApp costuma
desistir de renderizar a prévia, justo no canal onde a loja mais vende.

---

## Decisões que valem explicar

- **Preços em centavos.** Todo valor monetário é inteiro, para não somar float no carrinho.
- **Filtros na URL.** `?preco=150-300&marca=Arno&ordem=menor-preco` é compartilhável,
  funciona com o botão "voltar" e é indexável.
- **Carrinho via `useSyncExternalStore`.** O `localStorage` é um sistema externo; ler com a
  API própria do React evita descompasso na hidratação e ainda sincroniza entre abas.
- **Sem imagem no banner.** Os slides são gradiente + tipografia, então o LCP não espera
  download de arte.
- **`aggregateRating` só com nota real.** Marcar avaliação inventada no schema viola as
  diretrizes do Google e rende penalidade.
- **Identidade própria.** Dourado e grafite vieram da logo real da loja. A referência de
  UX foi a arquitetura de varejo brasileiro, não a identidade visual de ninguém.

---

## Roadmap

**Fase 1 — entregue.** Home, catálogo, categorias, busca com autocomplete, página de
produto, carrinho, checkout, WhatsApp, Instagram, Shopee, avaliações, responsividade,
SEO e dados estruturados.

**Operação definida.** A venda é assistida pelo WhatsApp: frete, pagamento e
acompanhamento são confirmados diretamente pela equipe. Login, gateway e cálculo
automático de frete são melhorias opcionais, não requisitos para publicar.

**Fase 3.** Painel administrativo, analytics, cupons, lista de desejos.

O código já está preparado para a Fase 2: as interfaces `PaymentProvider` e
`ShippingProvider` existem e o checkout consulta se estão configuradas.
