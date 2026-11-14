import Image from "next/image";
import Link from "next/link";
import { ConteudoAbas } from "./ConteudoAbas";
import { AdminPageHeader, PanelCard } from "@/components/admin/AdminShell";
import { ArteExemplo, CopiarTexto } from "@/components/admin/ConteudoCliente";
import { EXEMPLOS, FORMATOS, promptCodex } from "@/lib/content/exemplosConteudo";

// Arquivos do brand kit em public/brand/kit (origem: dom-guima-brand-kit-completo.zip).
const KIT = "/brand/kit";
const LOGOS = [
  { file: "logos/logo-dourada-transparente.png", label: "Logo dourada (transparente)", bg: "#1c1d21" },
  { file: "logos/emblema-dg-asas-transparente.png", label: "Emblema DG com asas", bg: "#1c1d21" },
  { file: "logos/logo-fundo-grafite.png", label: "Logo no grafite", bg: "#1c1d21" },
  { file: "logos/logo-fundo-off-white.png", label: "Logo no claro", bg: "#f5f2eb" },
  { file: "perfil/instagram-1080.png", label: "Foto de perfil do Instagram", bg: "#1c1d21" },
];
const CORES = [
  ["#1C1D21", "Grafite (fundo)"],
  ["#111216", "Preto"],
  ["#23252A", "Painel / cartão"],
  ["#DBB96E", "Dourado"],
  ["#F5F2EB", "Off-white (texto)"],
  ["#454039", "Borda"],
];
const PECAS = ["01-como-comprar", "02-catalogo", "03-entregas", "04-avaliacoes", "05-compra-segura", "06-shopee", "07-encomendas"];
const TEMPLATES = [
  { file: "templates/template-feed-quadrado.png", label: "Feed 1:1", w: 1080, h: 1080 },
  { file: "templates/template-feed-retrato.png", label: "Feed 4:5", w: 1080, h: 1350 },
  { file: "templates/template-story.png", label: "Story", w: 1080, h: 1920 },
  { file: "templates/template-capa-reels.png", label: "Capa de Reels", w: 1080, h: 1920 },
  { file: "templates/fundo-grafite-texturizado.png", label: "Fundo grafite", w: 1254, h: 1254 },
];
const BANNERS = [
  { file: "banners/capa-site.png", label: "Capa 1920 × 640", w: 1920, h: 640 },
  { file: "banners/compartilhamento.png", label: "Compartilhamento 1200 × 630", w: 1200, h: 630 },
];
const REGRAS = [
  "Atendimento em Uberlândia e região. Não anunciar envio nacional.",
  "Preço, estoque, pagamento, prazo, garantia e entrega só depois de confirmar com a equipe.",
  "Não inventar avaliações, notas ou depoimentos.",
  "Não redesenhar a logo: use os PNGs do kit, com área livre de 15% da largura do símbolo.",
  "Arial Bold em títulos e chamadas; Arial Regular nos textos.",
  "Fundo grafite com detalhes dourados; texto off-white. Na versão clara, a logo vai sobre placa escura.",
];

function Baixar({ file }: { file: string }) {
  return (
    <a href={`${KIT}/${file}`} download className="text-xs font-bold text-gold-700 hover:underline">
      Baixar PNG
    </a>
  );
}

function Titulo({ children }: { children: React.ReactNode }) {
  return <h2 className="mb-4 text-lg font-black text-ink-900">{children}</h2>;
}

export default function ConteudoPage() {
  return (
    <>
      <AdminPageHeader eyebrow="Divulgacao" title="Conteúdo" description="Brand kit da Dom Guima e posts de exemplo com legenda pronta para o Instagram." />

      <ConteudoAbas ativa="kit" />

      <div id="brand-kit" className="grid gap-6">
        <PanelCard>
          <Titulo>Logos</Titulo>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
            {LOGOS.map((l) => (
              <figure key={l.file} className="grid gap-2">
                <div className="flex aspect-square items-center justify-center rounded-xl p-3" style={{ background: l.bg }}>
                  <Image src={`${KIT}/${l.file}`} alt={l.label} width={300} height={300} className="h-full w-full object-contain" />
                </div>
                <figcaption className="grid gap-0.5 text-xs">
                  <span className="font-semibold">{l.label}</span>
                  <Baixar file={l.file} />
                </figcaption>
              </figure>
            ))}
          </div>
        </PanelCard>

        <PanelCard>
          <Titulo>Cores e tipografia</Titulo>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            {CORES.map(([hex, nome]) => (
              <div key={hex} className="text-xs">
                <div className="mb-1.5 h-14 rounded-lg border border-ink-200" style={{ background: hex }} />
                <p className="font-bold">{hex}</p>
                <p className="text-ink-500">{nome}</p>
              </div>
            ))}
          </div>
          <div className="mt-5 grid gap-4 sm:grid-cols-2" style={{ fontFamily: "Arial, Helvetica, sans-serif" }}>
            <div>
              <p className="text-xs font-bold uppercase text-ink-500">Títulos e chamadas</p>
              <p className="text-2xl font-bold">ARIAL BOLD</p>
            </div>
            <div>
              <p className="text-xs font-bold uppercase text-ink-500">Textos</p>
              <p className="text-2xl">Arial Regular</p>
            </div>
          </div>
        </PanelCard>

        <PanelCard>
          <Titulo>Regras da marca</Titulo>
          <ul className="grid list-disc gap-2 pl-5 text-sm">
            {REGRAS.map((r) => <li key={r}>{r}</li>)}
          </ul>
        </PanelCard>

        <PanelCard>
          <Titulo>Stories prontos e capas de destaques</Titulo>
          <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 lg:grid-cols-7">
            {PECAS.map((p) => (
              <figure key={p} className="grid gap-2">
                <Image src={`${KIT}/stories/${p}.png`} alt={`Story ${p}`} width={1080} height={1920} sizes="(min-width: 1024px) 12vw, 30vw" className="h-auto w-full rounded-lg" />
                <Image src={`${KIT}/destaques/${p}.png`} alt={`Destaque ${p}`} width={1254} height={1254} sizes="80px" className="mx-auto h-16 w-16 rounded-full" />
                <figcaption className="grid gap-0.5 text-center text-[11px]">
                  <span className="font-semibold">{p.slice(3).replace(/-/g, " ")}</span>
                  <Baixar file={`stories/${p}.png`} />
                  <Baixar file={`destaques/${p}.png`} />
                </figcaption>
              </figure>
            ))}
          </div>
        </PanelCard>

        <PanelCard>
          <Titulo>Templates (fundo sem texto)</Titulo>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
            {TEMPLATES.map((t) => (
              <figure key={t.file} className="grid gap-2">
                <Image src={`${KIT}/${t.file}`} alt={t.label} width={t.w} height={t.h} sizes="(min-width: 1024px) 18vw, 45vw" className="h-auto w-full rounded-lg" />
                <figcaption className="grid gap-0.5 text-xs">
                  <span className="font-semibold">{t.label}</span>
                  <Baixar file={t.file} />
                </figcaption>
              </figure>
            ))}
          </div>
        </PanelCard>

        <PanelCard>
          <Titulo>Banners</Titulo>
          <div className="grid gap-4 sm:grid-cols-2">
            {BANNERS.map((b) => (
              <figure key={b.file} className="grid gap-2">
                <Image src={`${KIT}/${b.file}`} alt={b.label} width={b.w} height={b.h} sizes="(min-width: 640px) 40vw, 90vw" className="h-auto w-full rounded-lg" />
                <figcaption className="flex justify-between text-xs">
                  <span className="font-semibold">{b.label}</span>
                  <Baixar file={b.file} />
                </figcaption>
              </figure>
            ))}
          </div>
        </PanelCard>
      </div>

      <section id="exemplos" className="mt-10">
        <h2 className="mb-1 text-xl font-black text-ink-900">10 exemplos de posts</h2>
        <p className="mb-5 max-w-2xl text-sm text-ink-500">Legenda pronta para copiar. A arte é gerada no Codex: copie o prompt e cole lá; ele salva em public/brand/exemplos.</p>
        <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
          {EXEMPLOS.map((e) => {
            const f = FORMATOS[e.formato];
            return (
              <PanelCard key={e.id} className="grid content-start gap-3">
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-wider text-gold-700">{f.label}</p>
                  <h3 className="font-black">{e.titulo}</h3>
                </div>
                <div className="mx-auto w-full max-w-[260px]">
                  <ArteExemplo src={`/brand/exemplos/${e.id}.png`} alt={e.titulo} w={f.w} h={f.h} />
                </div>
                <p className="whitespace-pre-line text-sm text-ink-700">{e.legenda}</p>
                <div className="flex flex-wrap gap-3">
                  <CopiarTexto texto={e.legenda} rotulo="Copiar legenda" />
                  <CopiarTexto texto={promptCodex(e)} rotulo="Copiar prompt do Codex" />
                  <Link href={`/painel/conteudo/calendario?exemplo=${e.id}`} className="rounded-lg bg-ink-900 px-3 py-1.5 text-xs font-bold text-white">Planejar no calendário</Link>
                </div>
                <details className="text-xs">
                  <summary className="cursor-pointer font-bold text-ink-500">Ver prompt</summary>
                  <pre className="mt-2 whitespace-pre-wrap rounded-lg bg-ink-50 p-3 text-[11px] text-ink-700">{promptCodex(e)}</pre>
                </details>
              </PanelCard>
            );
          })}
        </div>
      </section>
    </>
  );
}
