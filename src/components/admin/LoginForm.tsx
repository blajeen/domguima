"use client";

import { useActionState } from "react";
import { loginAction } from "@/app/painel/actions";
import { FormMessage, SubmitButton, fieldClass, labelClass } from "./FormControls";

export function LoginForm({ configured }: { configured: boolean }) {
  const [state, action] = useActionState(loginAction, {});
  return (
    <form action={action} className="space-y-4">
      <div>
        <label htmlFor="username" className={labelClass}>Usuário</label>
        <input id="username" name="username" type="text" autoComplete="username" required className={fieldClass} disabled={!configured} />
      </div>
      <div>
        <label htmlFor="password" className={labelClass}>Senha</label>
        <input id="password" name="password" type="password" autoComplete="current-password" minLength={8} required className={fieldClass} disabled={!configured} />
      </div>
      <FormMessage state={state} />
      <SubmitButton className="w-full" pendingLabel="Entrando...">Entrar no painel</SubmitButton>
    </form>
  );
}
