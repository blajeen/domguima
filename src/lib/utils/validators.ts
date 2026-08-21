/** Validações do checkout. Tudo roda no cliente e não depende de biblioteca. */

export function onlyDigits(value: string): string {
  return value.replace(/\D/g, "");
}

/** Valida CPF pelos dois dígitos verificadores. */
export function isValidCPF(value: string): boolean {
  const cpf = onlyDigits(value);
  if (cpf.length !== 11) return false;
  // Rejeita sequências como 111.111.111-11, que passam no cálculo.
  if (/^(\d)\1{10}$/.test(cpf)) return false;

  for (const [length, position] of [
    [9, 10],
    [10, 11],
  ] as const) {
    let sum = 0;
    for (let i = 0; i < length; i++) {
      sum += Number(cpf[i]) * (position - i);
    }
    const remainder = (sum * 10) % 11 % 10;
    if (remainder !== Number(cpf[length])) return false;
  }
  return true;
}

/** Valida CNPJ pelos dois dígitos verificadores. */
export function isValidCNPJ(value: string): boolean {
  const cnpj = onlyDigits(value);
  if (cnpj.length !== 14) return false;
  if (/^(\d)\1{13}$/.test(cnpj)) return false;

  const check = (length: number) => {
    let sum = 0;
    let weight = length - 7;
    for (let i = 0; i < length; i++) {
      sum += Number(cnpj[i]) * weight;
      weight = weight === 2 ? 9 : weight - 1;
    }
    const remainder = sum % 11;
    return remainder < 2 ? 0 : 11 - remainder;
  };

  return check(12) === Number(cnpj[12]) && check(13) === Number(cnpj[13]);
}

export function isValidDocument(value: string): boolean {
  const digits = onlyDigits(value);
  if (digits.length === 11) return isValidCPF(digits);
  if (digits.length === 14) return isValidCNPJ(digits);
  return false;
}

export function formatDocument(value: string): string {
  const d = onlyDigits(value).slice(0, 14);
  if (d.length <= 11) {
    return d
      .replace(/(\d{3})(\d)/, "$1.$2")
      .replace(/(\d{3})(\d)/, "$1.$2")
      .replace(/(\d{3})(\d{1,2})$/, "$1-$2");
  }
  return d
    .replace(/(\d{2})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d)/, "$1/$2")
    .replace(/(\d{4})(\d{1,2})$/, "$1-$2");
}

/** Celular ou fixo brasileiro, com DDD. */
export function formatPhone(value: string): string {
  const d = onlyDigits(value).slice(0, 11);
  if (d.length <= 10) {
    return d.replace(/(\d{2})(\d)/, "($1) $2").replace(/(\d{4})(\d{1,4})$/, "$1-$2");
  }
  return d.replace(/(\d{2})(\d)/, "($1) $2").replace(/(\d{5})(\d{1,4})$/, "$1-$2");
}

export function isValidPhone(value: string): boolean {
  const d = onlyDigits(value);
  return d.length === 10 || d.length === 11;
}

export function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value.trim());
}
