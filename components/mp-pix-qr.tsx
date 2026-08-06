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
}

export default function MpPixQr({ orderId, onPaid }: Props) {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [pix, setPix] = useState<PixState | null>(null)
  const started = useRef(false)

  const generate = async () => {
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
      if (!res.ok) throw new Error(data.error || 'Não foi possível gerar o PIX.')
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
      })
    } catch (e) {
      setError((e as Error).message || 'Erro ao gerar PIX.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (started.current) return
    started.current = true
    void generate()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderId])

  const copyPix = async () => {
    if (!pix?.qrCode) return
    try {
      await navigator.clipboard.writeText(pix.qrCode)
      toast.success('Código PIX copiado.')
    } catch {
      toast.error('Não foi possível copiar.')
    }
  }

  if (loading) {
    return <p className="muted">Gerando QR Code PIX...</p>
  }

  if (error) {
    return (
      <div className="mp-pix-panel">
        <p className="muted" style={{ marginBottom: 12 }}>{error}</p>
        <button
          type="button"
          className="btn"
          onClick={() => {
            started.current = true
            void generate()
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
      <h3>Pague com PIX agora</h3>
      <p className="muted">
        Escaneie no app do banco. O status do pedido atualiza sozinho após o pagamento.
      </p>
      {pix.qrBase64 ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          className="mp-pix-qr-img"
          src={
            pix.qrBase64.startsWith('data:')
              ? pix.qrBase64
              : `data:image/png;base64,${pix.qrBase64}`
          }
          alt="QR Code PIX"
          width={240}
          height={240}
        />
      ) : null}
      {pix.qrCode ? (
        <>
          <label className="muted">Código copia e cola</label>
          <textarea readOnly value={pix.qrCode} rows={4} />
          <button type="button" className="btn" onClick={copyPix}>
            Copiar código PIX
          </button>
        </>
      ) : null}
      {pix.ticketUrl ? (
        <p style={{ marginTop: 12 }}>
          <a href={pix.ticketUrl} target="_blank" rel="noreferrer" className="btn btn-outline">
            Abrir no Mercado Pago
          </a>
        </p>
      ) : null}
    </div>
  )
}
