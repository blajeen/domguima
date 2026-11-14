import Link from "next/link";
import { excluirPostagemAction } from "@/app/painel/actions";
import { AdminPageHeader, PanelCard } from "@/components/admin/AdminShell";
import { PostagemForm } from "@/components/admin/ConteudoCliente";
import { ConteudoAbas } from "../ConteudoAbas";
import { readCatalogState } from "@/lib/admin/catalog-store";
import { EXEMPLOS, FORMATOS } from "@/lib/content/exemplosConteudo";

type Params = Record<string, string | string[] | undefined>;

const FUSO = "America/Sao_Paulo";
const pad = (n: number) => String(n).padStart(2, "0");
const mesDe = (d: Date) => `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}`;
const somaMes = (mes: string, n: number) => mesDe(new Date(Date.UTC(Number(mes.slice(0, 4)), Number(mes.slice(5)) - 1 + n, 1)));
const SEMANA = ["seg", "ter", "qua", "qui", "sex", "sáb", "dom"];

/** Artes que o site já serve, para sugerir no campo de imagem. */
const ARTES = [
  ...EXEMPLOS.map((e) => `/brand/exemplos/${e.id}.png`),
  ...["01-como-comprar", "02-catalogo", "03-entregas", "04-avaliacoes", "05-compra-segura", "06-shopee", "07-encomendas"].map((p) => `/brand/kit/stories/${p}.png`),
];

export default async function CalendarioPage({ searchParams }: { searchParams: Promise<Params> }) {
  const sp = await searchParams;
  const texto = (k: string) => (typeof sp[k] === "string" ? (sp[k] as string) : "");
  const hoje = new Date().toLocaleDateString("en-CA", { timeZone: FUSO });
  const mes = /^\d{4}-(0[1-9]|1[0-2])$/.test(texto("mes")) ? texto("mes") : hoje.slice(0, 7);
  const postagens = [...(await readCatalogState()).operations.postagens].sort((a, b) => `${a.dia}${a.hora}`.localeCompare(`${b.dia}${b.hora}`));
  const doMes = postagens.filter((p) => p.dia.startsWith(mes));

  const editando = postagens.find((p) => p.id === texto("editar"));
  const exemplo = EXEMPLOS.find((e) => e.id === texto("exemplo"));
  const dia = /^\d{4}-\d{2}-\d{2}$/.test(texto("dia")) ? texto("dia") : hoje;
  const inicial = editando ?? {
    dia,
    hora: "",
    formato: exemplo?.formato ?? "feed-retrato",
    titulo: exemplo?.titulo ?? "",
    legenda: exemplo?.legenda ?? "",
    imagem: exemplo ? `/brand/exemplos/${exemplo.id}.png` : "",
    status: "planejado" as const,
    link: "",
  };

  // Grade do mês com a semana começando na segunda.
  const primeiro = new Date(`${mes}-01T00:00:00Z`);
  const dias = new Date(Date.UTC(primeiro.getUTCFullYear(), primeiro.getUTCMonth() + 1, 0)).getUTCDate();
  const vazios = (primeiro.getUTCDay() + 6) % 7;
  const celulas: (string | null)[] = [...Array(vazios).fill(null), ...Array.from({ length: dias }, (_, i) => `${mes}-${pad(i + 1)}`)];
  while (celulas.length % 7) celulas.push(null);
  const nomeMes = new Date(`${mes}-15T00:00:00Z`).toLocaleDateString("pt-BR", { month: "long", year: "numeric", timeZone: "UTC" });
  const selo = (status: string) => (status === "publicado" ? "bg-success-light text-success" : "bg-gold-100 text-gold-800");

  return (
    <>
      <AdminPageHeader eyebrow="Divulgacao" title="Conteúdo" description="Planeje as postagens do Instagram no calendário do mês." />
      <ConteudoAbas ativa="calendario" />

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
        <PanelCard>
          <div className="mb-4 flex items-center justify-between gap-3">
            <Link href={`?mes=${somaMes(mes, -1)}`} className="rounded-lg border border-ink-200 px-3 py-1.5 text-sm font-bold" aria-label="Mês anterior">←</Link>
            <h2 className="text-lg font-black capitalize">{nomeMes}</h2>
            <Link href={`?mes=${somaMes(mes, 1)}`} className="rounded-lg border border-ink-200 px-3 py-1.5 text-sm font-bold" aria-label="Próximo mês">→</Link>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] table-fixed border-collapse text-xs">
              <thead>
                <tr>{SEMANA.map((d) => <th key={d} scope="col" className="pb-2 text-left font-bold uppercase text-ink-500">{d}</th>)}</tr>
              </thead>
              <tbody>
                {Array.from({ length: celulas.length / 7 }, (_, s) => (
                  <tr key={s}>
                    {celulas.slice(s * 7, s * 7 + 7).map((d, i) => (
                      <td key={i} className={`h-24 border border-ink-100 p-1 align-top ${d === hoje ? "bg-gold-50" : ""}`}>
                        {d && (
                          <>
                            <Link href={`?mes=${mes}&dia=${d}`} className="block font-bold text-ink-500 hover:text-gold-700" title="Planejar neste dia">{Number(d.slice(8))}</Link>
                            {doMes.filter((p) => p.dia === d).map((p) => (
                              <Link key={p.id} href={`?mes=${mes}&editar=${p.id}`} className={`mt-1 block truncate rounded px-1 py-0.5 font-semibold ${selo(p.status)}`}>
                                {p.hora && `${p.hora} `}{p.titulo}
                              </Link>
                            ))}
                          </>
                        )}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <h3 className="mb-2 mt-6 font-black">Postagens do mês · {doMes.length}</h3>
          {doMes.length ? (
            <ul className="grid gap-2">
              {doMes.map((p) => (
                <li key={p.id} className="flex flex-wrap items-center gap-2 rounded-lg border border-ink-100 p-2 text-sm">
                  <span className="font-bold">{p.dia.slice(8)}/{p.dia.slice(5, 7)}{p.hora && ` ${p.hora}`}</span>
                  <Link href={`?mes=${mes}&editar=${p.id}`} className="font-semibold hover:underline">{p.titulo}</Link>
                  <span className="text-xs text-ink-500">{FORMATOS[p.formato].label}</span>
                  <span className={`rounded px-1.5 py-0.5 text-[11px] font-bold ${selo(p.status)}`}>{p.status === "publicado" ? "Publicado" : "Planejado"}</span>
                  {p.link && <a href={p.link} target="_blank" rel="noopener noreferrer" className="text-xs font-bold text-gold-700 hover:underline">Ver no Instagram</a>}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-ink-500">Nada planejado neste mês. Clique num dia ou use um dos 10 exemplos.</p>
          )}
        </PanelCard>

        <PanelCard className="h-fit">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-lg font-black">{editando ? "Editar postagem" : "Nova postagem"}</h2>
            {editando && <Link href={`?mes=${mes}`} className="text-xs font-bold text-ink-500 hover:underline">+ Nova</Link>}
          </div>
          <PostagemForm key={editando?.id ?? `${dia}-${exemplo?.id ?? ""}`} inicial={inicial} imagens={ARTES} />
          {editando && (
            <form action={excluirPostagemAction} className="mt-3">
              <input type="hidden" name="id" value={editando.id} />
              <input type="hidden" name="mes" value={mes} />
              <button className="text-xs font-bold text-red-700 hover:underline">Excluir postagem</button>
            </form>
          )}
        </PanelCard>
      </div>
    </>
  );
}
