'use client'

import { getMercadoPagoPublicKey } from '@/lib/mercado-pago-public'
import { initMercadoPago, Payment, StatusScreen } from '@mercadopago/sdk-react'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'

type Props = {
  orderId: string
  amount: number
  onPaid: () => void
}

type PixData = {
  qrCode: string | null
  qrBase64: string | null
  ticketUrl: string | null
}

let mpInitialized = false

export default function MpPaymentBrick({ orderId, amount, onPaid }: Props) {
  const [ready, setReady] = useState(false)
  const [paymentId, setPaymentId] = useState<string | null>(null)
  const [pix, setPix] = useState<PixData | null>(null)
  const [error, setError] = useState<string | null>(null)
  const publicKey = getMercadoPagoPublicKey()

  useEffect(() => {
    if (!publicKey) {
      setError('Chave pública do Mercado Pago não configurada.')
      return
    }
    if (!mpInitialized) {
      initMercadoPago(publicKey, { locale: 'pt-BR' })
      mpInitialized = true
    }
    setReady(true)
  }, [publicKey])

  const copyPix = async () => {
    if (!pix?.qrCode) return
    try {
      await navigator.clipboard.writeText(pix.qrCode)
      toast.success('Código PIX copiado.')
    } catch {
      toast.error('Não foi possível copiar. Copie manualmente.')
    }
  }

  if (error) {
    return <p className="muted">{error}</p>
  }

  if (!ready) {
    return <p className="muted">Carregando pagamento seguro...</p>
  }

  if (paymentId) {
    return (
      <div>
        {pix?.qrBase64 || pix?.qrCode ? (
          <div style={{ marginBottom: 20 }}>
            <h3 style={{ marginBottom: 8 }}>PIX gerado</h3>
            <p className="muted" style={{ marginBottom: 12 }}>
              Escaneie o QR Code ou copie o código. O status atualiza automaticamente após o pagamento.
            </p>
            {pix.qrBase64 ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={`data:image/png;base64,${pix.qrBase64}`}
                alt="QR Code PIX"
                width={220}
                height={220}
                style={{ display: 'block', marginBottom: 12 }}
              />
            ) : null}
            {pix.qrCode ? (
              <>
                <textarea
                  readOnly
                  value={pix.qrCode}
                  rows={3}
                  style={{ width: '100%', fontSize: 12, marginBottom: 8 }}
                />
                <button type="button" className="btn" onClick={copyPix}>
                  Copiar código PIX
                </button>
              </>
            ) : null}
            {pix.ticketUrl ? (
              <p style={{ marginTop: 12 }}>
                <a href={pix.ticketUrl} target="_blank" rel="noreferrer" className="btn btn-outline">
                  Abrir comprovante / boleto
                </a>
              </p>
            ) : null}
          </div>
        ) : null}
        <StatusScreen
          initialization={{ paymentId }}
          onReady={() => undefined}
          onError={() => toast.error('Erro ao carregar status do pagamento.')}
        />
      </div>
    )
  }

  return (
    <Payment
      initialization={{ amount: Number(amount.toFixed(2)) }}
      customization={{
        paymentMethods: {
          creditCard: 'all',
          debitCard: 'all',
          bankTransfer: 'all',
          ticket: 'all',
          maxInstallments: 12,
        },
      }}
      onSubmit={async ({ formData }) => {
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
          onPaid()
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
      }}
      onError={() => toast.error('Erro no formulário de pagamento.')}
      onReady={() => undefined}
    />
  )
}
