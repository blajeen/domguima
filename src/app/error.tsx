"use client";

import { useEffect } from "react";
import { Button, ButtonLink } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";

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
      <Icon name="alerta" size={40} className="mx-auto text-ouro-texto" />
      <h1 className="mt-4 text-balance text-titulo-lg font-bold text-grafite-900 sm:text-4xl">
        Algo deu errado por aqui
      </h1>
      <p className="mx-auto mt-2 max-w-md text-base text-ink-600">
        Tivemos um problema ao carregar esta página. Tente de novo. Se
        continuar, fale com a gente pelo WhatsApp.
      </p>
      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <Button onClick={reset} size="lg">
          Tentar novamente
        </Button>
        <ButtonLink href="/" variant="secundario" size="lg">
          Voltar à home
        </ButtonLink>
      </div>
    </div>
  );
}
