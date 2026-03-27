import { ImageResponse } from 'next/og'
import { NextRequest } from 'next/server'

export const runtime = 'edge'

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl
  const puzzleNumber = searchParams.get('n') || '?'

  return new ImageResponse(
    (
      <div
        style={{
          width: '1200px',
          height: '630px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
          fontFamily: 'sans-serif',
        }}
      >
        {/* Green accent bar */}
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '8px', background: '#00843d' }} />

        {/* Trophy icon placeholder */}
        <div
          style={{
            width: '100px',
            height: '100px',
            borderRadius: '50%',
            background: '#00843d',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '52px',
            marginBottom: '24px',
          }}
        >
          🏆
        </div>

        {/* Title */}
        <div
          style={{
            fontSize: '64px',
            fontWeight: 800,
            color: '#ffffff',
            letterSpacing: '-2px',
            marginBottom: '8px',
          }}
        >
          Znam Gościa
        </div>

        {/* Puzzle number */}
        <div
          style={{
            fontSize: '28px',
            color: '#00843d',
            fontWeight: 600,
            marginBottom: '24px',
          }}
        >
          #{puzzleNumber}
        </div>

        {/* Tagline */}
        <div
          style={{
            fontSize: '24px',
            color: '#94a3b8',
            textAlign: 'center',
            maxWidth: '700px',
          }}
        >
          Zgadnij zawodnika polskiej Ekstraklasy!
        </div>

        {/* URL */}
        <div
          style={{
            position: 'absolute',
            bottom: '32px',
            fontSize: '20px',
            color: '#475569',
          }}
        >
          znamgoscia.pl
        </div>
      </div>
    ),
    { width: 1200, height: 630 }
  )
}
