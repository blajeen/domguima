"use client";

import Image from "next/image";
import { ViewTransition, useEffect, useLayoutEffect, useRef, useState } from "react";
import { IconButton } from "@/components/ui/IconButton";
import type { ProductImage } from "@/lib/catalog/types";
import { useVariantImage } from "./VariantImageContext";

// Largura do palco em cada faixa de tela, com e sem a coluna de miniaturas
// (4rem + vão no sm, 5rem + vão no lg). Ver o grid da página de produto.
const SIZES_COM_MINIATURAS =
  "(min-width: 1280px) 504px, (min-width: 1024px) 444px, (min-width: 640px) 592px, calc(100vw - 2rem)";
const SIZES_SEM_MINIATURAS =
  "(min-width: 1280px) 600px, (min-width: 1024px) 540px, (min-width: 640px) 672px, calc(100vw - 2rem)";

/**
 * Galeria do produto. Uma árvore só para celular e computador: um trilho com
 * rolagem nativa e snap (o swipe é o do sistema) mostra uma foto por vez. Só a
 * foto que abre a página é prioritária; antes havia uma versão de computador e
 * outra de celular, escondidas por CSS, e as duas baixavam a foto principal.
 *
 *  - Celular: contador "1 / N" e setas numa pílula de vidro sobre a foto.
 *  - A partir de sm: miniaturas na lateral e zoom que segue o mouse.
 *
 * Foto que não carrega sai da galeria (miniatura e slide): nada de quadro em
 * branco no lugar dela.
 */
export function ProductGallery({
  images,
  nomeTransicao,
}: {
  /** Fotos já filtradas por `fotosDaGaleria`, na ordem do cadastro. */
  images: ProductImage[];
  /** Nome da View Transition que liga esta foto à do card (`nomeFotoProduto`). */
  nomeTransicao: string;
}) {
  const { pedido, liberar } = useVariantImage();
  const [falhas, setFalhas] = useState<ReadonlySet<string>>(() => new Set());
  // A página abre na foto da opção marcada (o servidor já escolheu qual). Fica
  // guardado: é a posição inicial do trilho e a foto que ganha prioridade.
  const [inicio] = useState(() =>
    Math.max(0, images.findIndex((image) => image.src === pedido?.src)),
  );
  const [ativa, setAtiva] = useState(inicio);
  const trilhoRef = useRef<HTMLDivElement>(null);
  const cursor = useRef({ x: 0, y: 0 });
  const quadro = useRef<number | null>(null);

  const fotos = falhas.size > 0 ? images.filter((image) => !falhas.has(image.src)) : images;
  const total = fotos.length;
  const atual = Math.min(ativa, Math.max(total - 1, 0));
  const temVarias = total > 1;
  // Foto pedida pelo seletor: a da opção marcada ou, se ela não tem foto na
  // galeria, a capa. Sem voltar para a capa, ficaria à vista a foto da cor
  // escolhida antes. -1: o cliente mexeu na galeria depois do pedido.
  const indiceDoPedido = pedido
    ? Math.max(0, fotos.findIndex((foto) => foto.src === pedido.src))
    : -1;

  // Posição inicial antes da pintura, onde o navegador não aplica o
  // scroll-initial-target do slide (ver abaixo): sem isso a foto da opção
  // marcada apareceria depois da primeira, com um pulo.
  useLayoutEffect(() => {
    const trilho = trilhoRef.current;
    if (trilho && inicio > 0) rolar(trilho, inicio, "instant");
  }, [inicio]);

  // Cada escolha no seletor leva o trilho até a foto pedida, mesmo repetindo
  // a opção (o pedido é um objeto novo a cada clique). O índice exibido
  // acompanha pelo evento de rolagem.
  useEffect(() => {
    const trilho = trilhoRef.current;
    if (!trilho || indiceDoPedido < 0) return;
    rolar(trilho, indiceDoPedido, comportamento());
  }, [pedido, indiceDoPedido]);

  useEffect(() => {
    return () => {
      if (quadro.current !== null) cancelAnimationFrame(quadro.current);
    };
  }, []);

  if (total === 0) {
    return (
      <div className="flex aspect-square items-center justify-center rounded-card border border-fio bg-white p-8 text-center">
        <div>
          <Image
            src="/brand/logo-dom-guima.png"
            alt=""
            width={72}
            height={72}
            className="mx-auto size-16 object-contain opacity-35"
          />
          <p className="mt-3 text-sm font-semibold text-grafite-900">
            Fotos deste produto em preparação
          </p>
          <p className="mt-1 text-xs text-ink-500">
            Confira a descrição e as especificações abaixo.
          </p>
        </div>
      </div>
    );
  }

  function marcarFalha(src: string) {
    setFalhas((anterior) => new Set(anterior).add(src));
  }

  /**
   * Leva o trilho até a foto pedida pelo cliente (seta, miniatura ou hover da
   * miniatura). A escolha dele vence a foto da opção marcada no seletor.
   */
  function irPara(indice: number, modo: ScrollBehavior) {
    const trilho = trilhoRef.current;
    if (!trilho) return;
    liberar();
    const destino = Math.min(Math.max(indice, 0), total - 1);
    rolar(trilho, destino, modo);
    setAtiva(destino);
  }

  function aoRolar(event: React.UIEvent<HTMLDivElement>) {
    const trilho = event.currentTarget;
    if (trilho.clientWidth > 0) setAtiva(Math.round(trilho.scrollLeft / trilho.clientWidth));
  }

  // O zoom é CSS (scale no hover do mouse); aqui só a origem acompanha o
  // cursor, gravada direto no estilo uma vez por quadro, sem re-render.
  function aoMoverMouse(event: React.MouseEvent<HTMLDivElement>) {
    const palco = event.currentTarget;
    cursor.current = { x: event.clientX, y: event.clientY };
    if (quadro.current !== null) return;
    quadro.current = requestAnimationFrame(() => {
      quadro.current = null;
      const caixa = palco.getBoundingClientRect();
      if (caixa.width === 0 || caixa.height === 0) return;
      palco.style.setProperty("--zoom-x", `${((cursor.current.x - caixa.left) / caixa.width) * 100}%`);
      palco.style.setProperty("--zoom-y", `${((cursor.current.y - caixa.top) / caixa.height) * 100}%`);
    });
  }

  return (
    <div
      className={
        temVarias
          ? "sm:grid sm:grid-cols-[4rem_minmax(0,1fr)] sm:gap-4 lg:grid-cols-[5rem_minmax(0,1fr)]"
          : undefined
      }
    >
      {temVarias && (
        // A coluna tem a altura do palco; com muitas fotos, a lista rola por
        // dentro em vez de esticar a página.
        <div className="relative hidden sm:block">
          <ul
            aria-label="Miniaturas das fotos"
            className="absolute inset-0 flex flex-col gap-2 overflow-y-auto [scrollbar-width:none]"
          >
            {fotos.map((foto, i) => (
              <li key={foto.src} className="shrink-0">
                <button
                  type="button"
                  onClick={() => irPara(i, "instant")}
                  onMouseEnter={() => irPara(i, "instant")}
                  aria-label={`Ver foto ${i + 1} de ${total}`}
                  aria-current={i === atual ? "true" : undefined}
                  className={`relative block aspect-square w-full overflow-hidden rounded-card border bg-white transition-colors duration-(--duracao-toque) focus-visible:-outline-offset-2 ${
                    i === atual
                      ? "border-grafite-900 ring-1 ring-inset ring-grafite-900"
                      : "border-fio hover:border-grafite-700"
                  }`}
                >
                  <Image
                    src={foto.src}
                    alt=""
                    fill
                    sizes="80px"
                    onError={() => marcarFalha(foto.src)}
                    className="object-contain p-1"
                  />
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div
        onMouseMove={aoMoverMouse}
        className="group/palco relative min-w-0 overflow-hidden rounded-card border border-fio bg-white"
      >
        <div
          ref={trilhoRef}
          onScroll={aoRolar}
          // Arrastar a galeria também vence a foto da cor: sem isso, uma foto
          // que falhasse depois faria o trilho voltar sozinho para ela.
          onPointerDown={liberar}
          role="region"
          aria-roledescription="galeria"
          aria-label="Fotos do produto"
          tabIndex={0}
          className="scroll-row w-full focus-visible:-outline-offset-2"
          style={{ gridAutoColumns: "100%" }}
        >
          {fotos.map((foto, i) => (
            <div
              key={foto.src}
              className="group/foto relative aspect-square overflow-hidden"
              // Abrindo numa foto que não é a capa, o trilho já nasce nela no
              // HTML do servidor (Chrome 133+): a foto prioritária é a que
              // aparece no primeiro paint. Nos outros, o useLayoutEffect leva.
              style={i === inicio && inicio > 0 ? { scrollInitialTarget: "nearest" } : undefined}
            >
              {/* Só a foto à vista leva o nome da transição: é ela que "voa"
                  de volta para o card, e o nome não pode se repetir. */}
              <ViewTransition
                name={i === atual ? nomeTransicao : undefined}
                share="morph"
                default="none"
              >
                <Image
                  src={foto.src}
                  alt={foto.alt}
                  fill
                  // Só a foto que abre a página é prioritária (é o LCP); as
                  // outras esperam o trilho chegar perto delas.
                  loading={i === inicio ? "eager" : "lazy"}
                  fetchPriority={i === inicio ? "high" : undefined}
                  sizes={temVarias ? SIZES_COM_MINIATURAS : SIZES_SEM_MINIATURAS}
                  onError={() => marcarFalha(foto.src)}
                  className="origin-[var(--zoom-x,50%)_var(--zoom-y,50%)] object-contain p-4 transition-[scale] duration-(--duracao-entrada) ease-out sm:p-6 so-mouse:cursor-zoom-in so-mouse:group-hover/foto:scale-200"
                />
              </ViewTransition>
            </div>
          ))}
        </div>

        {temVarias && (
          <>
            {/* Celular: uma pílula grafite só, com as setas e o contador. Sólida,
                não vidro: as fotos de produto têm fundo branco, e vidro sobre
                branco vira cinza (a mesma decisão da pílula do banner da home). */}
            <div className="absolute bottom-3 right-3 flex items-center rounded-pill bg-grafite-900 sm:hidden">
              <IconButton
                icon="seta-esquerda"
                label="Foto anterior"
                variant="dentro-do-vidro"
                disabled={atual === 0}
                onClick={() => irPara(atual - 1, comportamento())}
              />
              <span aria-hidden className="min-w-10 text-center text-xs font-semibold tabular-nums text-papel">
                {atual + 1} / {total}
              </span>
              <IconButton
                icon="seta-direita"
                label="Próxima foto"
                variant="dentro-do-vidro"
                disabled={atual === total - 1}
                onClick={() => irPara(atual + 1, comportamento())}
              />
            </div>
            {/* Só no celular, onde as setas trocam a foto. No computador a
                miniatura marcada (aria-current) basta, e o aviso falaria a
                cada hover do mouse nas miniaturas. */}
            <p className="sr-only sm:hidden" aria-live="polite">
              Foto {atual + 1} de {total}
            </p>
          </>
        )}

        {/* Com mouse: a dica some enquanto o zoom está ativo. */}
        <span className="pointer-events-none absolute bottom-3 right-3 hidden rounded-pill bg-grafite-900 px-3 py-1.5 text-xs font-medium text-papel so-mouse:sm:block so-mouse:group-hover/palco:invisible">
          Passe o mouse para ampliar
        </span>
      </div>
    </div>
  );
}

function rolar(trilho: HTMLElement, indice: number, modo: ScrollBehavior) {
  trilho.scrollTo({ left: indice * trilho.clientWidth, behavior: modo });
}

/**
 * Deslizar só no celular, onde a galeria é um carrossel, e só para quem não
 * pediu menos movimento. Com miniaturas, a troca é imediata como antes.
 */
function comportamento(): ScrollBehavior {
  const imediato = window.matchMedia(
    "(min-width: 40rem), (prefers-reduced-motion: reduce)",
  ).matches;
  return imediato ? "instant" : "smooth";
}
