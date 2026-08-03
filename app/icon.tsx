import { ImageResponse } from 'next/og'

export const size = { width: 32, height: 32 }
export const contentType = 'image/png'

/** Favicon A estilo Didot (como o V da Viva) */
export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'transparent',
        }}
      >
        <div
          style={{
            fontSize: 28,
            lineHeight: 1,
            fontFamily: 'Times New Roman, Georgia, serif',
            fontWeight: 500,
            color: '#1A1228',
            letterSpacing: '-0.04em',
            display: 'flex',
            marginTop: 2,
          }}
        >
          A
        </div>
      </div>
    ),
    { ...size },
  )
}
