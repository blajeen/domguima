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
| `NEXT_PUBLIC_WHATSAPP_NUMBER` | número inicial da loja, usado até o painel gravar o seu | usa o número da bio do Instagram |
| `NEXT_PUBLIC_GOOGLE_PROFILE_URL` | sobrescreve o perfil público do Google já configurado | usa o link verificado no código |
| `INSTAGRAM_ACCESS_TOKEN` + `INSTAGRAM_USER_ID` | grade de posts reais | mostra o convite para seguir |
| `OPENAI_API_KEY` | pesquisa inteligente de modelo, descrição, especificações e sugestão de NCM no painel | o cadastro continua manual; o assistente pede configuração |
| `OPENAI_PRODUCT_RESEARCH_MODEL` | escolhe o modelo usado pelo assistente | usa o modelo padrão da aplicação |

A chave do Instagram é **server-side** — nunca use o prefixo `NEXT_PUBLIC_` nela.
As métricas do Google são um retrato público datado em `src/config/site.ts` e
levam ao perfil oficial; não dependem de API.

O WhatsApp da loja e o de cada atendente vivem no painel (**Configurações →
Loja e atendimento** e **Configurações → Atendentes**) — é de lá que saem todos
os botões do site. `NEXT_PUBLIC_WHATSAPP_NUMBER` só vale enquanto o painel não
tiver um número gravado; trocar de número depois disso é no painel, não na
Vercel.

### Assistente inteligente de cadastro

No topo do cadastro de produto há um campo **Código de barras ou modelo**:
escaneie o EAN/GTIN com o leitor (ou digite) e aperte Enter, ou informe o
modelo e clique em **Buscar e preencher**. O painel consulta duas fontes, cada
uma opcional:

| Variável | Fonte | O que traz |
| --- | --- | --- |
| `COSMOS_TOKEN` | Cosmos (Bluesoft), cadastro brasileiro de GTIN — token gratuito | nome, marca, NCM e peso, pelo código de barras |
| `OPENAI_API_KEY` | pesquisa na web priorizando o fabricante | nome, marca, modelo, descrição, especificações e fonte, pelo código ou pelo modelo |

Com as duas, o NCM e o peso vêm do cadastro do código de barras e o resto da
web. O resultado preenche **só os campos vazios**; o que já foi digitado é
mantido e pode ser substituído com um clique, e **Desfazer preenchimento**
volta tudo ao estado anterior. O NCM é sempre tratado como sugestão fiscal,
não como classificação definitiva.

As chaves ficam somente no servidor e nunca são enviadas ao navegador. A
pesquisa não altera preço, custo, estoque, fotos, status nem publica o produto.

Para o passo a passo operacional do comparativo de preços e da pesquisa com IA,
consulte o [Guia de pesquisa de produtos](docs/GUIA-PESQUISA-DE-PRODUTOS.md).

### Pendências do lojista (procure por `CONFIG` no código)

- [x] Número de WhatsApp confirmado: +55 34 9874-8425
- [ ] Domínio definitivo em `NEXT_PUBLIC_SITE_URL`
- [ ] `support.hours` e `support.email` em `src/config/site.ts` (hoje `null`, então não aparecem)
- [ ] CNPJ e endereço fiscal para o rodapé e as páginas institucionais
- [ ] Atualizar periodicamente a nota e a quantidade pública do Google
- [x] Parcelamento no cartão: o preço cadastrado é o à vista (Pix ou dinheiro) e o site calcula o parcelado de cada produto com a tabela da maquininha (1x a 18x, mandada pelo dono em 23/09/2026), editável em Configurações → Parcelamento no cartão, junto com o "em até Nx" anunciado no preço
- [ ] Confirmar com o dono: a chamada junto do preço fica em 12x (como na lista de vendas dele) ou vai até 18x? E a maquininha tem parcela mínima?

---

## Painel administrativo

O painel fica em `/painel` e cuida de duas frentes:

- **Catálogo:** produtos, preços, fotos, estoque, categorias, ofertas, dados da
  loja e a exportação do catálogo em PDF.
- **Operação comercial:** pedidos, **Atendimento** (a fila de conversas de
  WhatsApp e pedidos do site, com etapas até a venda), **Clientes** (quem já
  comprou, quem voltou e quem vale recontatar), **Tráfego** (de onde vêm os
  clientes) e **Relatórios**.

Não há cadastro público. Em produção, os dados ficam no **Supabase** (tabelas
e funções em `supabase/migrations/`) e as fotos no Storage do Supabase;
localmente, sem `SUPABASE_URL`, tudo vai para arquivos ignorados pelo Git
(`data/admin-catalog.json`, `data/admin-leads.json` e `public/uploads/`). Na
Vercel, sem o Supabase configurado, o painel recusa gravações em vez de mostrar
uma confirmação que seria perdida.

### Configuração inicial

1. Gere a conta do ambiente. A senha é convertida em hash e não fica gravada
   no código nem no arquivo de configuração:

```bash
npm run setup:admin
```

2. Reinicie o Next.js e entre em `/painel/login`.
3. No painel, abra Configurações e digite `IMPORTAR` na importação inicial.
4. Para produção, cadastre na Vercel `SUPABASE_URL` e `SUPABASE_SECRET_KEY`
   (somente servidor) e os três valores `ADMIN_*` gerados em `.env.local`:

```env
ADMIN_USERNAME=...
ADMIN_PASSWORD_HASH=...
ADMIN_SESSION_SECRET=...
```

Toda Server Action revalida a sessão antes de escrever. Não troque
`ADMIN_SESSION_SECRET` durante uma implantação: isso derruba todas as sessões
abertas.

### Quem entra no painel

Todo mundo que entra no painel vê e pode fazer tudo — um papel só, por decisão
do dono. As abas “Meus atendimentos” e “Puxar para mim” são só conveniência.

- **Conta do ambiente** (`ADMIN_USERNAME`): a rede de segurança. Continua
  valendo mesmo se a tabela de usuários sumir ou o banco cair.
- **Usuários do banco** (tabela `admin_users`), gerenciados pelo terminal:

```bash
npm run criar:usuario -- gabriel "Gabriel"                    # cria e sorteia a senha
npm run criar:usuario -- gabriel "Gabriel" --vendedor gabriel # cria já vinculado ao atendente
npm run criar:usuario -- gabriel --vendedor gabriel           # só vincula: senha e nome ficam
npm run criar:usuario -- gabriel                              # sorteia senha nova
npm run criar:usuario -- gabriel --desativar
npm run criar:usuario -- --listar
```

`--vendedor <id>` diz ao painel qual atendente (Configurações → Atendentes)
aquele login representa. O vínculo vai dentro da sessão: **depois do comando,
saia e entre de novo** no painel. A conta do ambiente não mora na tabela; para
vinculá-la, o comando exige `--senha "..."`, porque a senha do banco passa a
valer no lugar da senha do ambiente.

### Atendimento

Todo botão de WhatsApp do site passa por `/api/atendimentos/whatsapp`, que
registra o atendimento e só então abre o WhatsApp de quem vai atender — o
cliente sempre chega à conversa, mesmo com o banco fora do ar. O pedido do
checkout também vira atendimento, ligado ao pedido.

- **Quem recebe** (Configurações → Distribuição de novos atendimentos):
  *Cliente escolhe o atendente* (padrão; o pedido do site cai na fila livre),
  *Rodízio entre os atendentes* ou *Atendente com menos atendimentos em aberto*.
  Só entra no sorteio quem está ativo e com “Recebe atendimentos” ligado.
- **Fila livre:** atendimento sem dono. Cada linha tem “Puxar para mim”,
  “Transferir para…” e “Devolver à fila”.
- **Etapas:** Novo → Em atendimento → Orçamento enviado → Aguardando pagamento
  → Ganho ou Perdido (com motivo: preço, sem estoque, entrega ou frete, cliente
  não respondeu, comprou em outro lugar, outro). As etapas são do
  **atendimento**; o pedido mantém os próprios status (aguardando,
  finalizado, cancelado), que são os que mexem no estoque. Confirmar o pedido
  fecha o atendimento como Ganho; cancelar ou excluir fecha como Perdido.
- **Vincular a pedido** (número DG-…) e **Lançar pedido** a partir do
  atendimento.
- **Identificar cliente:** o clique no WhatsApp chega sem telefone. Quando a
  conversa revelar o telefone ou o CPF, informe em “Identificar cliente” na
  linha do atendimento: é o que faz aparecer a etiqueta “Recorrente” e o aviso
  de atendimento em aberto em Clientes.

### Clientes e recontato

A loja não tem cadastro de cliente: `/painel/clientes` reconhece quem comprou
pelo telefone ou CPF dos pedidos **finalizados** e separa em Cliente novo,
Recorrente (2 compras ou mais), VIP (3 compras ou R$ 3.000) e Inativo (mais de
120 dias sem comprar). As regras moram em `src/lib/admin/customers.ts`.

As **sugestões de recontato** listam quem comprou entre 60 e 180 dias atrás.
O botão abre o WhatsApp com uma mensagem pronta para revisar — nada é enviado
sozinho e não há cobrança recorrente. Quem pedir para não ser chamado recebe
**“Não quer recontato”** na linha do cliente e sai das sugestões (a política de
privacidade promete isso); “Permitir recontato” desfaz.

### Controle de tráfego

Só atribuição própria da loja, sem Google Analytics, Pixel nem contagem de
visitas. O site guarda no navegador a origem da primeira visita rastreável
(UTM, anúncio, site de origem) no cookie `domguima_origem` (90 dias), e ela
acompanha o atendimento e o pedido. `/painel/trafego` soma atendimentos,
pedidos e vendas por origem, campanha e página, e tem o gerador de links de
campanha (UTM) para bio, anúncios e grupos.

### Implantação do CRM (migrations)

As migrations **não rodam sozinhas**: cada arquivo de `supabase/migrations/` é
colado à mão no SQL Editor do Supabase, e não há tabela de controle dizendo o
que já foi aplicado. As três do CRM têm de entrar **nesta ordem e ANTES do
deploy do código**:

| Ordem | Arquivo | Sem ela |
| --- | --- | --- |
| 1 | `202609210001_atendentes.sql` | nenhum login pode ser vinculado a atendente (“Meus atendimentos” vazio) |
| 2 | `202609210002_atendimentos.sql` | nenhum atendimento é gravado: a fila e os cards de atendimento ficam zerados, e Clientes perde o aviso de atendimento em aberto |
| 3 | `202609210003_origem_do_pedido.sql` | a função antiga do banco **descarta** canal, origem e campanha dos pedidos novos — e não há como recuperar depois |

Cada arquivo pode ser rodado de novo sem efeito e traz no cabeçalho o motivo e
o bloco “Rollback”. O código sobrevive a subir antes do SQL (a loja e o login
continuam funcionando, o WhatsApp continua abrindo), mas o que for criado nesse
intervalo fica sem atendimento ou sem origem. Enquanto faltar alguma, as telas
do painel (início, Pedidos, Atendimento, Clientes e Tráfego) mostram uma faixa
amarela dizendo qual arquivo aplicar.

Depois de colar o SQL, confira contra o banco de verdade (usam o `.env.local`
e apagam tudo o que criam, com prefixo `zz-teste-`):

```bash
npm run verify:leads     # atendimentos: dedupe, rodízio, menos ocupado, puxar/transferir, etapas
npm run verify:ledger    # pedidos: concorrência, estoque, atribuição e canal/origem gravados
```

Por fim, vincule cada login ao seu atendente com
`npm run criar:usuario -- <usuario> --vendedor <atendente>` e peça para cada um
sair e entrar de novo.

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
fluxo de carrinho, validação do checkout, busca por CEP e autocomplete. Também confere o
WhatsApp do site: o diálogo “Atendimento no WhatsApp” abre, o clique num atendente
passa por `/api/atendimentos/whatsapp` e ela responde 302 para o `wa.me` do atendente
certo, e o pedido rápido é um POST (303). Essas chamadas vão marcadas para a rota **não
registrar** atendimento, e a aba aberta recebe uma página simulada: o smoke não suja a
fila do painel nem abre conversa.

Para incluir o painel (início, Pedidos, Atendimento, Clientes e Tráfego sem erro de
console ou de hidratação, sem aviso de migration faltando, e a seleção em massa de
pedidos), informe um login:

```bash
SMOKE_PAINEL_USUARIO=gabriel SMOKE_PAINEL_SENHA='...' npm run test:smoke
```

Sem essas variáveis, a parte do painel é pulada com aviso.

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
