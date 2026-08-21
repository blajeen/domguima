"use client";

import Link from "next/link";
import { useEffect } from "react";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Em produção, ligue aqui o seu serviço de monitoramento (Sentry etc).
    console.error(error);
  }, [error]);

  return (
    <div className="mx-auto max-w-2xl px-4 py-20 text-center">
      <p className="text-5xl" aria-hidden>
        ⚠️
      </p>
      <h1 className="mt-4 text-2xl font-extrabold tracking-tight text-ink-900">
        Algo deu errado por aqui
      </h1>
      <p className="mx-auto mt-2 max-w-md text-sm text-ink-500">
        Tivemos um problema ao carregar esta página. Tente de novo — se
        continuar, fale com a gente pelo WhatsApp.
      </p>
      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <button
          type="button"
          onClick={reset}
          className="rounded-xl bg-brand-700 px-6 py-3 text-sm font-extrabold text-white transition-colors hover:bg-brand-600"
        >
          Tentar novamente
        </button>
        <Link
          href="/"
          className="rounded-xl border border-ink-200 px-6 py-3 text-sm font-semibold text-ink-700 transition-colors hover:border-gold-400 hover:bg-gold-50"
        >
          Voltar à home
        </Link>
      </div>
    </div>
  );
}
