'use client'

import { getMercadoPagoPublicKey } from '@/lib/mercado-pago-public'
import { initMercadoPago, Payment, StatusScreen } from '@mercadopago/sdk-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { toast } from 'sonner'

type Props = {
  orderId: string
  amount: number
  payerEmail?: string | null
  payerName?: string | null
  onPaid: () => void
}

type PixData = {
  qrCode: string | null
  qrBase64: string | null
  ticketUrl: string | null
}

let mpInitializedKey: string | null = null

export default function MpPaymentBrick({
  orderId,
  amount,
  payerEmail,
  payerName,
  onPaid,
}: Props) {
  const [ready, setReady] = useState(false)
  const [paymentId, setPaymentId] = useState<string | null>(null)
  const [pix, setPix] = useState<PixData | null>(null)
  const [error, setError] = useState<string | null>(null)
  const publicKey = getMercadoPagoPublicKey()
  const onPaidRef = useRef(onPaid)
  const errorToastAt = useRef(0)
  onPaidRef.current = onPaid

  const stableAmount = useMemo(() => Number(Number(amount).toFixed(2)), [amount])
  const email = (payerEmail || '').trim()

  const initialization = useMemo(() => {
    const base: {
      amount: number
      payer?: { email: string; firstName?: string }
    } = { amount: stableAmount }
    if (email) {
      base.payer = {
        email,
        ...(payerName ? { firstName: payerName.split(' ')[0] } : {}),
      }
    }
    return base
  }, [stableAmount, email, payerName])

  const customization = useMemo(
    () => ({
      paymentMethods: {
        creditCard: 'all' as const,
        debitCard: 'all' as const,
        maxInstallments: 12,
      },
      visual: {
        hidePaymentButton: false,
      },
    }),
    [],
  )

  useEffect(() => {
    if (!publicKey) {
      setError('Chave pública do Mercado Pago não configurada.')
      return
    }
    if (mpInitializedKey !== publicKey) {
      initMercadoPago(publicKey, { locale: 'pt-BR' })
      mpInitializedKey = publicKey
    }
    setReady(true)
  }, [publicKey])

  const copyPix = async () => {
    if (!pix?.qrCode) return
    try {
      await navigator.clipboard.writeText(pix.qrCode)
      toast.success('Código PIX copiado.')
    } catch {
      toast.error('Não foi possível copiar.')
    }
  }

  const onSubmit = useCallback(
    async (param: { formData: Record<string, unknown> }) => {
      const formData = { ...(param.formData as Record<string, unknown>) }
      // Garante e-mail do pedido no payer (Brick às vezes deixa editar)
      if (email) {
        const payer =
          formData.payer && typeof formData.payer === 'object'
            ? { ...(formData.payer as Record<string, unknown>) }
            : {}
        if (!payer.email) payer.email = email
        formData.payer = payer
      }

      const res = await fetch('/api/payments/mercadopago', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId, ...formData }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error || 'Pagamento não processado.')
        throw new Error(data.error || 'payment_failed')
      }

      if (data.status === 'approved' || data.alreadyPaid) {
        toast.success('Pagamento aprovado!')
        onPaidRef.current()
        return
      }

      if (data.status === 'rejected') {
        toast.error('Pagamento recusado. Tente outro cartão ou PIX.')
        throw new Error('rejected')
      }

      setPix({
        qrCode: data.pixQrCode || null,
        qrBase64: data.pixQrBase64 || null,
        ticketUrl: data.ticketUrl || null,
      })
      setPaymentId(data.id)
      if (data.status === 'pending' || data.status === 'in_process') {
        toast.message('Pagamento pendente. Aguarde a confirmação.')
      }
    },
    [orderId, email],
  ) as never

  const onError = useCallback((err: unknown) => {
    console.error('mp brick error', err)
    const now = Date.now()
    if (now - errorToastAt.current < 8000) return
    errorToastAt.current = now
    toast.error(
      (err as { message?: string })?.message ||
        'Não foi possível carregar o formulário. Recarregue a página.',
    )
  }, [])

  if (error) return <p className="muted">{error}</p>
  if (!ready) return <p className="muted">Carregando formulário seguro...</p>

  if (paymentId) {
    return (
      <div className="pay-card-panel">
        {pix?.qrBase64 || pix?.qrCode ? (
          <div>
            <h3>PIX gerado</h3>
            <p className="muted">Escaneie ou copie o código abaixo.</p>
            {pix.qrBase64 ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={`data:image/png;base64,${pix.qrBase64}`}
                alt="QR Code PIX"
                width={220}
                height={220}
              />
            ) : null}
            {pix.qrCode ? (
              <>
                <textarea readOnly value={pix.qrCode} rows={3} />
                <button type="button" className="btn" onClick={copyPix}>
                  Copiar código PIX
                </button>
              </>
            ) : null}
          </div>
        ) : (
          <p className="muted">Pagamento em processamento...</p>
        )}
        {/^\d+$/.test(paymentId) ? (
          <StatusScreen
            initialization={{ paymentId }}
            onReady={() => undefined}
            onError={() => undefined}
          />
        ) : null}
      </div>
    )
  }

  return (
    <div className="pay-card-panel" id="mp-payment-brick-root">
      {email ? (
        <p className="pay-payer-hint">
          Pagamento vinculado a <strong>{email}</strong>
          <span className="muted"> · CPF/CNPJ continua sendo pedido por segurança do cartão</span>
        </p>
      ) : null}
      <Payment
        key={`pay-${orderId}-${stableAmount}-${email}`}
        initialization={initialization}
        customization={customization}
        onSubmit={onSubmit}
        onError={onError}
        onReady={() => undefined}
      />
    </div>
  )
}
