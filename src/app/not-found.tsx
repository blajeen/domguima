import Link from "next/link";
import { categories } from "@/lib/catalog/categories";

export default function NotFound() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-20 text-center">
      <p className="text-6xl font-extrabold tracking-tight text-gold-400">404</p>
      <h1 className="mt-3 text-2xl font-extrabold tracking-tight text-ink-900 sm:text-3xl">
        Não encontramos esta página
      </h1>
      <p className="mx-auto mt-2 max-w-md text-sm text-ink-500">
        O link pode estar quebrado ou o produto pode ter saído do ar. Mas tem
        bastante coisa boa por aqui:
      </p>

      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <Link
          href="/ofertas"
          className="rounded-xl bg-brand-700 px-6 py-3 text-sm font-extrabold text-white transition-colors hover:bg-brand-600"
        >
          Ver ofertas
        </Link>
        <Link
          href="/"
          className="rounded-xl border border-ink-200 px-6 py-3 text-sm font-semibold text-ink-700 transition-colors hover:border-gold-400 hover:bg-gold-50"
        >
          Voltar à home
        </Link>
      </div>

      <div className="mt-10 flex flex-wrap justify-center gap-2">
        {categories.map((category) => (
          <Link
            key={category.id}
            href={`/categoria/${category.slug}`}
            className="rounded-full border border-ink-200 bg-white px-4 py-2 text-sm font-medium text-ink-700 transition-colors hover:border-gold-400 hover:bg-gold-50"
          >
            <span aria-hidden className="mr-1">
              {category.icon}
            </span>
            {category.name}
          </Link>
        ))}
      </div>
    </div>
  );
}
