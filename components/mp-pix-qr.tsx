'use client'

import { useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'

type Props = {
  orderId: string
  onPaid?: () => void
}

type PixState = {
  qrCode: string | null
  qrBase64: string | null
  ticketUrl: string | null
  paymentId: string | null
}

export default function MpPixQr({ orderId, onPaid }: Props) {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [pix, setPix] = useState<PixState | null>(null)
  const started = useRef(false)

  useEffect(() => {
    if (started.current) return
    started.current = true

    const run = async () => {
      setLoading(true)
      setError(null)
      try {
        const res = await fetch('/api/payments/mercadopago', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            orderId,
            payment_method_id: 'pix',
            payment_type_id: 'bank_transfer',
            mode: 'pix',
          }),
        })
        const data = await res.json()
        if (!res.ok) {
          throw new Error(data.error || 'Não foi possível gerar o PIX.')
        }
        if (data.status === 'approved' || data.alreadyPaid) {
          toast.success('Pagamento já confirmado!')
          onPaid?.()
          return
        }
        if (!data.pixQrCode && !data.pixQrBase64) {
          throw new Error('PIX gerado sem QR Code. Tente novamente.')
        }
        setPix({
          qrCode: data.pixQrCode || null,
          qrBase64: data.pixQrBase64 || null,
          ticketUrl: data.ticketUrl || null,
          paymentId: data.id || null,
        })
      } catch (e) {
        setError((e as Error).message || 'Erro ao gerar PIX.')
      } finally {
        setLoading(false)
      }
    }

    run()
  }, [orderId, onPaid])

  const copyPix = async () => {
    if (!pix?.qrCode) return
    try {
      await navigator.clipboard.writeText(pix.qrCode)
      toast.success('Código PIX copiado.')
    } catch {
      toast.error('Não foi possível copiar. Selecione e copie manualmente.')
    }
  }

  if (loading) {
    return <p className="muted">Gerando QR Code PIX...</p>
  }

  if (error) {
    return (
      <div>
        <p className="muted" style={{ marginBottom: 12 }}>{error}</p>
        <button
          type="button"
          className="btn"
          onClick={() => {
            started.current = false
            setError(null)
            setLoading(true)
            // retrigger effect
            started.current = false
            void (async () => {
              started.current = true
              setLoading(true)
              try {
                const res = await fetch('/api/payments/mercadopago', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    orderId,
                    payment_method_id: 'pix',
                    payment_type_id: 'bank_transfer',
                    mode: 'pix',
                  }),
                })
                const data = await res.json()
                if (!res.ok) throw new Error(data.error || 'Falha ao gerar PIX.')
                setPix({
                  qrCode: data.pixQrCode || null,
                  qrBase64: data.pixQrBase64 || null,
                  ticketUrl: data.ticketUrl || null,
                  paymentId: data.id || null,
                })
                setError(null)
              } catch (e) {
                setError((e as Error).message)
              } finally {
                setLoading(false)
              }
            })()
          }}
        >
          Tentar gerar PIX de novo
        </button>
      </div>
    )
  }

  if (!pix) return null

  return (
    <div className="mp-pix-panel">
      <h3 style={{ marginBottom: 8 }}>Pague com PIX</h3>
      <p className="muted" style={{ marginBottom: 16 }}>
        Escaneie o QR Code no app do banco. O pedido atualiza automaticamente após o pagamento.
      </p>
      {pix.qrBase64 ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={
            pix.qrBase64.startsWith('data:')
              ? pix.qrBase64
              : `data:image/png;base64,${pix.qrBase64}`
          }
          alt="QR Code PIX"
          width={240}
          height={240}
          style={{ display: 'block', marginBottom: 16, background: '#fff', padding: 8 }}
        />
      ) : null}
      {pix.qrCode ? (
        <>
          <label className="muted" style={{ display: 'block', marginBottom: 6, fontSize: 13 }}>
            Ou copie o código PIX (copia e cola)
          </label>
          <textarea
            readOnly
            value={pix.qrCode}
            rows={4}
            style={{ width: '100%', fontSize: 12, marginBottom: 10 }}
          />
          <button type="button" className="btn" onClick={copyPix}>
            Copiar código PIX
          </button>
        </>
      ) : null}
      {pix.ticketUrl ? (
        <p style={{ marginTop: 12 }}>
          <a href={pix.ticketUrl} target="_blank" rel="noreferrer" className="btn btn-outline">
            Abrir PIX no Mercado Pago
          </a>
        </p>
      ) : null}
    </div>
  )
}
