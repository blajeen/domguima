import { shopeeStats, site, social, whatsapp } from "@/config/site";

/**
 * Páginas institucionais.
 *
 * O conteúdo abaixo descreve práticas padrão do comércio eletrônico brasileiro
 * e direitos que já valem por lei (CDC e LGPD). Onde falta informação que só o
 * lojista tem — CNPJ, endereço fiscal, horário de atendimento — o texto diz
 * isso abertamente em vez de inventar. Procure por "CONFIG" no arquivo.
 */

export interface Section {
  heading: string;
  paragraphs?: string[];
  list?: string[];
}

export interface InstitutionalPage {
  slug: string;
  title: string;
  description: string;
  intro?: string;
  sections: Section[];
}

const WHATSAPP_LINE = `WhatsApp ${whatsapp.display}`;

export const institutionalPages: InstitutionalPage[] = [
  {
    slug: "sobre-nos",
    title: "Sobre a Dom Guima",
    description:
      "Conheça a Dom Guima: loja online de eletrônicos, eletrodomésticos, climatização e decoração, com atendimento próximo e envio para todo o Brasil.",
    intro: site.longDescription,
    sections: [
      {
        heading: "Como começamos",
        paragraphs: [
          `A Dom Guima nasceu vendendo online e foi crescendo pelo boca a boca de quem comprou e voltou. Nossa loja na Shopee está ativa desde ${formatOpened()}, e é lá que está registrada boa parte da nossa história com os clientes: ${shopeeStats.ratingCount.toLocaleString("pt-BR")} avaliações e nota média ${shopeeStats.ratingAverage.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}.`,
          "Este site é o nosso canal próprio. A ideia é simples: reunir o catálogo num lugar organizado, com busca que funciona, preço claro e um atendimento que responde de verdade.",
        ],
      },
      {
        heading: "O que vendemos",
        paragraphs: [
          "Trabalhamos com eletrônicos, eletrodomésticos, climatização, informática, acessórios para celular e itens de casa e decoração. Somos especialistas em promoções — a maior parte do que anunciamos está com desconto real em relação ao preço de tabela.",
        ],
      },
      {
        heading: "Atendimento de gente para gente",
        paragraphs: [
          `Quem atende aqui conhece os produtos. Dúvida sobre voltagem, tamanho, prazo ou qual modelo serve melhor para o seu caso? Chame no ${WHATSAPP_LINE} antes de comprar. Nossa taxa de resposta na Shopee é de ${shopeeStats.responseRate}%, e mantemos o mesmo padrão por aqui.`,
        ],
      },
      {
        heading: "Onde nos encontrar",
        list: [
          `Site oficial: ${site.url}`,
          `Instagram: ${social.instagramHandle}`,
          "Shopee: nossa loja oficial no marketplace",
          WHATSAPP_LINE,
        ],
      },
    ],
  },

  {
    slug: "contato",
    title: "Fale com a gente",
    description:
      "Canais de atendimento da Dom Guima: WhatsApp, Instagram e loja na Shopee.",
    intro:
      "A forma mais rápida de falar com a gente é pelo WhatsApp — é por lá que tiramos dúvidas, confirmamos frete e acompanhamos pedidos.",
    sections: [
      {
        heading: "Canais oficiais",
        list: [
          `${WHATSAPP_LINE} — atendimento e pedidos`,
          `Instagram ${social.instagramHandle} — novidades e lançamentos`,
          "Shopee — nossa loja oficial no marketplace",
        ],
      },
      {
        heading: "Antes de chamar, ajuda muito ter em mãos",
        list: [
          "O nome do produto ou o link do anúncio",
          "O seu CEP, para calcularmos o frete",
          "A voltagem desejada, quando o produto tiver essa opção",
          "O número do pedido, se já tiver comprado",
        ],
      },
      {
        heading: "Horário de atendimento",
        paragraphs: [
          // CONFIG: preencher `support.hours` em src/config/site.ts.
          "Respondemos as mensagens ao longo do dia, de segunda a sábado. Se mandar fora do horário comercial, respondemos assim que possível — nenhuma mensagem fica sem resposta.",
        ],
      },
    ],
  },

  {
    slug: "frete-e-entrega",
    title: "Frete e entrega",
    description:
      "Como funcionam o envio, o prazo e o cálculo de frete dos pedidos feitos na Dom Guima.",
    sections: [
      {
        heading: "Para onde enviamos",
        paragraphs: [
          `Enviamos para todo o Brasil. Nossos pedidos saem de ${shopeeStats.location}, então o prazo varia bastante conforme a distância e a região de destino.`,
        ],
      },
      {
        heading: "Como calculamos o frete",
        paragraphs: [
          "O cálculo automático de frete no site ainda está sendo implementado. Por enquanto, funciona assim: você finaliza o pedido informando o CEP e o endereço completo, e nós confirmamos o valor exato e o prazo pelo WhatsApp antes de qualquer cobrança.",
          "Nenhum pedido é cobrado antes de você aprovar o valor total, frete incluído.",
        ],
      },
      {
        heading: "Prazo de envio",
        paragraphs: [
          "Depois do pagamento confirmado, preparamos e despachamos o pedido. Assim que ele é postado, enviamos o código de rastreio pelo WhatsApp.",
          "O prazo de entrega em si é o da transportadora e começa a contar a partir da postagem.",
        ],
      },
      {
        heading: "Produtos volumosos",
        paragraphs: [
          "Itens grandes — televisores, geladeiras, climatizadores — podem ter regras de envio diferentes conforme a região. Se for o seu caso, confirmamos as condições antes de fechar o pedido.",
        ],
      },
    ],
  },

  {
    slug: "formas-de-pagamento",
    title: "Formas de pagamento",
    description:
      "Formas de pagamento aceitas pela Dom Guima e como funciona a confirmação do pedido.",
    sections: [
      {
        heading: "Como pagar",
        paragraphs: [
          "Trabalhamos com Pix, cartão de crédito e boleto bancário. O pagamento é combinado junto com a confirmação do frete, pelo WhatsApp.",
        ],
      },
      {
        heading: "Parcelamento",
        paragraphs: [
          "O parcelamento exibido nos produtos é uma estimativa em até 3x sem juros, sujeita a confirmação no momento da compra e ao valor mínimo de parcela.",
        ],
      },
      {
        heading: "Desconto no Pix",
        paragraphs: [
          "Pagamentos à vista no Pix têm desconto, sinalizado na página de cada produto. É a forma mais rápida de confirmar o pedido, porque a compensação é imediata.",
        ],
      },
      {
        heading: "Segurança",
        paragraphs: [
          "Nunca pedimos dados completos de cartão por mensagem, e-mail ou telefone. Desconfie de qualquer contato que faça esse tipo de pedido em nome da Dom Guima — e confirme conosco pelos canais oficiais.",
        ],
      },
    ],
  },

  {
    slug: "trocas-e-devolucoes",
    title: "Trocas e devoluções",
    description:
      "Prazos e condições para troca, devolução e arrependimento de compras na Dom Guima.",
    sections: [
      {
        heading: "Direito de arrependimento (7 dias)",
        paragraphs: [
          "Compras feitas pela internet têm 7 dias corridos de prazo para arrependimento, contados a partir do recebimento do produto. É o artigo 49 do Código de Defesa do Consumidor, e vale para qualquer motivo — inclusive se você simplesmente mudou de ideia.",
          "Nesse caso, o produto precisa ser devolvido nas mesmas condições em que chegou, com embalagem, acessórios e manuais.",
        ],
      },
      {
        heading: "Produto com defeito",
        paragraphs: [
          "Produto com defeito de fabricação tem garantia legal de 90 dias para bens duráveis, conforme o CDC, somada à garantia oferecida pelo fabricante quando houver.",
          "Se o produto chegou com defeito ou apresentou problema no uso normal, fale com a gente pelo WhatsApp com fotos ou vídeo do ocorrido. Encaminhamos a solução — troca, reparo ou devolução do valor.",
        ],
      },
      {
        heading: "Produto avariado no transporte",
        paragraphs: [
          "Confira a embalagem na hora do recebimento. Se estiver visivelmente danificada, o ideal é recusar a entrega e nos avisar imediatamente. Se só perceber depois de abrir, registre fotos e nos chame no mesmo dia.",
        ],
      },
      {
        heading: "Como solicitar",
        list: [
          `Chame no ${WHATSAPP_LINE} informando o número do pedido`,
          "Descreva o motivo e envie fotos ou vídeo, quando for o caso",
          "Combinamos com você a forma de postagem da devolução",
          "Após recebermos e conferirmos o produto, seguimos com a troca ou o reembolso",
        ],
      },
    ],
  },

  {
    slug: "politica-de-privacidade",
    title: "Política de privacidade",
    description:
      "Como a Dom Guima coleta, usa e protege os seus dados pessoais, conforme a LGPD.",
    intro:
      "Esta política explica quais dados coletamos, para que usamos e quais são os seus direitos, de acordo com a Lei Geral de Proteção de Dados (Lei 13.709/2018).",
    sections: [
      {
        heading: "Dados que coletamos",
        list: [
          "Dados de identificação: nome, CPF ou CNPJ",
          "Dados de contato: telefone, WhatsApp e e-mail",
          "Endereço de entrega: CEP, rua, número, complemento, bairro, cidade e estado",
          "Dados do pedido: produtos, quantidades e valores",
        ],
      },
      {
        heading: "Para que usamos",
        paragraphs: [
          "Usamos os seus dados exclusivamente para processar e entregar o seu pedido, calcular o frete, emitir a nota fiscal, prestar atendimento e cumprir obrigações legais.",
          "Não vendemos, alugamos nem cedemos os seus dados para terceiros com finalidade comercial.",
        ],
      },
      {
        heading: "Com quem compartilhamos",
        paragraphs: [
          "Compartilhamos apenas o necessário para a entrega e o pagamento acontecerem: transportadoras e Correios recebem o endereço; o meio de pagamento recebe os dados da cobrança. Cada um usa esses dados só para a sua parte do processo.",
        ],
      },
      {
        heading: "Armazenamento do carrinho",
        paragraphs: [
          "Os itens do seu carrinho ficam salvos no armazenamento local do seu próprio navegador, para que você não perca a seleção ao fechar a página. Esses dados não saem do seu dispositivo até você finalizar um pedido, e podem ser apagados a qualquer momento limpando os dados do site no navegador.",
        ],
      },
      {
        heading: "Seus direitos",
        paragraphs: [
          "A LGPD garante a você o direito de confirmar o tratamento, acessar, corrigir, anonimizar ou eliminar seus dados, além de revogar o consentimento. Para exercer qualquer um deles, é só nos chamar pelos canais oficiais.",
        ],
      },
      {
        heading: "Contato para assuntos de privacidade",
        paragraphs: [
          `Pedidos relacionados a dados pessoais podem ser feitos pelo ${WHATSAPP_LINE}. Respondemos dentro dos prazos previstos em lei.`,
        ],
      },
    ],
  },

  {
    slug: "termos-de-uso",
    title: "Termos de uso",
    description:
      "Condições de uso do site da Dom Guima e regras aplicáveis às compras.",
    sections: [
      {
        heading: "Sobre estes termos",
        paragraphs: [
          `Ao navegar e comprar em ${site.url}, você concorda com as condições descritas aqui. Recomendamos a leitura antes de finalizar um pedido.`,
        ],
      },
      {
        heading: "Preços e disponibilidade",
        paragraphs: [
          "Os preços e o estoque exibidos no site podem mudar sem aviso prévio, e valem para as compras feitas por este canal. Preços praticados em outros canais, como marketplaces, podem ser diferentes por conta das taxas e promoções de cada plataforma.",
          "Em caso de erro evidente de preço ou de indisponibilidade do produto após a compra, entramos em contato para corrigir ou cancelar o pedido, com devolução integral de qualquer valor pago.",
        ],
      },
      {
        heading: "Imagens e descrições",
        paragraphs: [
          "As imagens dos produtos são ilustrativas e podem apresentar pequenas diferenças de cor ou de acabamento em relação ao item físico, inclusive por variação de monitor. As especificações técnicas seguem as informações do fabricante.",
        ],
      },
      {
        heading: "Confirmação do pedido",
        paragraphs: [
          "O pedido só é considerado confirmado após o acerto do frete e a confirmação do pagamento. Antes disso, o envio do formulário representa uma solicitação de compra.",
        ],
      },
      {
        heading: "Propriedade intelectual",
        paragraphs: [
          `A marca ${site.legalName}, o logotipo e o conteúdo produzido para este site pertencem à loja. Marcas de fabricantes citadas pertencem aos seus respectivos titulares e são usadas apenas para identificar os produtos anunciados.`,
        ],
      },
      {
        heading: "Foro e legislação",
        paragraphs: [
          "Estes termos são regidos pela legislação brasileira, em especial pelo Código de Defesa do Consumidor e pelo Marco Civil da Internet.",
        ],
      },
    ],
  },
];

function formatOpened(): string {
  const [year, month] = shopeeStats.openedAt.split("-");
  const months = [
    "janeiro", "fevereiro", "março", "abril", "maio", "junho",
    "julho", "agosto", "setembro", "outubro", "novembro", "dezembro",
  ];
  return `${months[Number(month) - 1]} de ${year}`;
}

export function getInstitutionalPage(slug: string): InstitutionalPage | undefined {
  return institutionalPages.find((page) => page.slug === slug);
}
