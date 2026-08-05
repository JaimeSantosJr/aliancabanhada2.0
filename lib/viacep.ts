export type ViaCepResult = {
  cep: string
  logradouro: string
  complemento: string
  bairro: string
  localidade: string
  uf: string
  erro?: boolean
}

export async function fetchAddressByCep(raw: string): Promise<ViaCepResult | null> {
  const cep = raw.replace(/\D/g, '')
  if (cep.length !== 8) return null
  const res = await fetch(`https://viacep.com.br/ws/${cep}/json/`)
  if (!res.ok) return null
  const data = (await res.json()) as ViaCepResult
  if (data.erro) return null
  return data
}

export function formatCep(value: string) {
  const digits = value.replace(/\D/g, '').slice(0, 8)
  if (digits.length <= 5) return digits
  return `${digits.slice(0, 5)}-${digits.slice(5)}`
}
