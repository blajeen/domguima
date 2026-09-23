import Link from "next/link";
import { ButtonLink, chipStyles } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { categories, categoryIcon } from "@/lib/catalog/categories";

export default function NotFound() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-20 text-center">
      <p className="text-5xl font-bold leading-none tabular-nums text-ouro-texto">404</p>
      <h1 className="mt-4 text-balance text-titulo-lg font-bold text-grafite-900 sm:text-4xl">
        Não encontramos esta página
      </h1>
      <p className="mx-auto mt-2 max-w-md text-base text-ink-600">
        O link pode estar quebrado ou o produto pode ter saído do ar. Mas tem
        bastante coisa boa por aqui:
      </p>

      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <ButtonLink href="/ofertas" size="lg">
          Ver ofertas
        </ButtonLink>
        <ButtonLink href="/" variant="secundario" size="lg">
          Voltar à home
        </ButtonLink>
      </div>

      <div className="mt-10 flex flex-wrap justify-center gap-2">
        {categories.map((category) => (
          <Link
            key={category.id}
            href={`/categoria/${category.slug}`}
            className={chipStyles}
          >
            <Icon name={categoryIcon(category)} size={18} className="text-ink-500" />
            {category.name}
          </Link>
        ))}
      </div>
    </div>
  );
}
