// Exemplos de posts do Dom Guima para a aba Conteúdo do painel, no modelo dos
// exemplos do Content Creator da Stellarby. A arte de cada um é gerada fora
// (Codex) com o `prompt` e salva em public/brand/exemplos/<id>.png; enquanto o
// arquivo não existe, o painel mostra o prompt para copiar.
// Regras da marca (LEIA-ME do kit): só Uberlândia e região, sem envio nacional,
// sem preço/estoque/prazo antes da confirmação, sem avaliações inventadas.

export type FormatoExemplo = "feed-quadrado" | "feed-retrato" | "story" | "capa-reels";

export const FORMATOS: Record<FormatoExemplo, { label: string; w: number; h: number; template: string }> = {
  "feed-quadrado": { label: "Feed 1:1", w: 1080, h: 1080, template: "/brand/kit/templates/template-feed-quadrado.png" },
  "feed-retrato": { label: "Feed 4:5", w: 1080, h: 1350, template: "/brand/kit/templates/template-feed-retrato.png" },
  story: { label: "Story 9:16", w: 1080, h: 1920, template: "/brand/kit/templates/template-story.png" },
  "capa-reels": { label: "Capa de Reels 9:16", w: 1080, h: 1920, template: "/brand/kit/templates/template-capa-reels.png" },
};

export type ExemploConteudo = {
  id: string;
  titulo: string;
  formato: FormatoExemplo;
  /** Legenda pronta para o Instagram. */
  legenda: string;
  /** Textos exatos da arte, na ordem de leitura. */
  textos: string[];
  /** Ícone dourado que entra no canto superior direito. */
  icone: string;
};

export const EXEMPLOS: ExemploConteudo[] = [
  {
    id: "01-boas-vindas",
    titulo: "Boas-vindas à loja",
    formato: "feed-quadrado",
    textos: ["DOM GUIMA", "Empório das Ofertas", "Atendimento em Uberlândia e região"],
    icone: "a single elegant gold open door with soft light coming out",
    legenda: "Seja bem-vindo à Dom Guima, o Empório das Ofertas de Uberlândia! ✨\n\nEletros, utilidades e muito mais, com atendimento de perto pelo WhatsApp.\n\nSiga o perfil e ative as notificações para ver as novidades primeiro. #Uberlandia #DomGuima",
  },
  {
    id: "02-chegou-novidade",
    titulo: "Chegou novidade",
    formato: "feed-retrato",
    textos: ["CHEGOU", "NOVIDADE", "Peça detalhes pelo WhatsApp"],
    icone: "a closed premium gold gift box with a simple ribbon",
    legenda: "Chegou novidade na Dom Guima! 📦\n\nQuer saber cores, modelos e disponibilidade? Chama a gente no WhatsApp que a equipe confirma tudo pra você.\n\n#Uberlandia #Novidade #DomGuima",
  },
  {
    id: "03-oferta-da-semana",
    titulo: "Oferta da semana",
    formato: "feed-retrato",
    textos: ["OFERTA", "DA SEMANA", "Consulte o valor no WhatsApp", "Válida enquanto durar o estoque"],
    icone: "a simple gold price tag with no text or numbers",
    legenda: "Oferta da semana chegando! 🔥\n\nPergunte o valor e a disponibilidade no WhatsApp. A equipe confirma tudo antes de fechar.\n\nAtendimento em Uberlândia e região. #Oferta #Uberlandia",
  },
  {
    id: "04-como-comprar",
    titulo: "Como comprar",
    formato: "feed-retrato",
    textos: ["COMO COMPRAR", "1. Acesse o site pelo link da bio", "2. Escolha o produto e as opções", "3. Envie o pedido pelo WhatsApp", "4. A equipe confirma com você"],
    icone: "a simple gold shopping cart",
    legenda: "Comprar na Dom Guima é simples: 👇\n\n1. Acesse o site pelo link da bio\n2. Escolha o produto e as opções\n3. Envie o pedido pelo WhatsApp\n4. A equipe confirma valor, disponibilidade e entrega\n\n#DomGuima #Uberlandia",
  },
  {
    id: "05-entregas",
    titulo: "Entregas na região",
    formato: "feed-quadrado",
    textos: ["ENTREGAS", "Uberlândia e região", "Combine o prazo com a equipe"],
    icone: "a simple compact modern gold delivery truck",
    legenda: "Atendemos Uberlândia e região! 🚚\n\nO prazo e a forma de entrega são combinados com a equipe no WhatsApp, conforme o seu endereço.\n\n#Uberlandia #Entrega",
  },
  {
    id: "06-encomendas",
    titulo: "Encomendas",
    formato: "feed-retrato",
    textos: ["NÃO ACHOU?", "A gente procura", "pra você", "Fale com a equipe no WhatsApp"],
    icone: "a gold magnifying glass",
    legenda: "Procurando algo que não está no site? 🔎\n\nManda pra gente no WhatsApp o que você precisa. A equipe verifica se consegue trazer e te responde.\n\n#Encomendas #Uberlandia #DomGuima",
  },
  {
    id: "07-catalogo",
    titulo: "Catálogo no site",
    formato: "story",
    textos: ["CATÁLOGO", "COMPLETO", "Todos os produtos no site", "Link na bio"],
    icone: "an open premium catalog booklet with a clean gold cover and blank pages",
    legenda: "O catálogo completo está no site, com fotos e opções de cada produto. Link na bio! 📖",
  },
  {
    id: "08-conte-como-foi",
    titulo: "Convite para avaliar",
    formato: "story",
    textos: ["COMPROU COM A", "GENTE?", "Conte como foi a sua experiência", "Sua opinião ajuda a loja a melhorar"],
    icone: "a gold speech bubble with no text inside",
    legenda: "Comprou na Dom Guima? Conta pra gente como foi! 💬 Responda este story ou marque @ quando receber.",
  },
  {
    id: "09-capa-reels-chegou",
    titulo: "Capa de Reels: chegou na loja",
    formato: "capa-reels",
    textos: ["CHEGOU", "NA LOJA", "Veja de perto"],
    icone: "a gold open cardboard box seen from above",
    legenda: "Abrindo o que acabou de chegar na Dom Guima! 🎬 Gostou de algum? Chama no WhatsApp para confirmar a disponibilidade.\n\n#Unboxing #Uberlandia #DomGuima",
  },
  {
    id: "10-fale-com-a-gente",
    titulo: "Fale com a gente",
    formato: "story",
    textos: ["FALE COM", "A GENTE", "Atendimento pelo WhatsApp", "Uberlândia e região"],
    icone: "a gold smartphone with a chat bubble on screen, no text",
    legenda: "Dúvida sobre algum produto? Fale com a gente no WhatsApp! 📲 Atendimento em Uberlândia e região.",
  },
];

/** Prompt para gerar a arte de um exemplo no Codex, a partir do template do kit. */
export function promptCodex(e: ExemploConteudo) {
  const f = FORMATOS[e.formato];
  return [
    `Crie a arte "${e.titulo}" do Dom Guima no repositório deste site.`,
    "",
    `1. Base: public${f.template} (${f.w}x${f.h}). Com a ferramenta de imagem, edite essa base acrescentando SOMENTE ${e.icone} no canto superior direito (região x 70-94%, y 12-28%), no mesmo estilo dourado escovado, discreto e escultural das artes do kit. Preserve exatamente o fundo grafite texturizado, as linhas douradas, a logo DG SHOP original (sem redesenhar), a iluminação e as áreas vazias. Sem texto, sem letras, sem números, sem logo nova. Referência de estilo: public/brand/kit/stories/01-como-comprar.png.`,
    `2. Textos exatos, aplicados por código (Pillow ou Playwright), nunca pela ferramenta de imagem, alinhados à esquerda na margem da logo, abaixo dela:`,
    ...e.textos.map((t, i) => `   - ${i === 0 ? "Título" : "Linha"}: "${t}"`),
    "   Títulos em Arial Bold, caixa alta, off-white #F5F2EB; linhas de apoio em Arial Regular #F5F2EB; uma linha curta dourada #DBB96E separando título e apoio. Nada de texto encostado nas bordas ou sobre a linha dourada vertical.",
    `3. Salve em public/brand/exemplos/${e.id}.png, exatamente ${f.w}x${f.h}, PNG abaixo de 1,5 MB. Não altere nenhum outro arquivo.`,
    "4. Abra a imagem e confira: logo intacta, textos legíveis e sem erro de acentuação, nada cortado.",
  ].join("\n");
}
