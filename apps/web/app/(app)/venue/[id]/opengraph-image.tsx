import { ImageResponse } from 'next/og';

export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default function VenueOpenGraphImage({ params }: { params: { id: string } }) {
  return new ImageResponse(<div style={{ height: '100%', width: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', padding: 72, background: '#0A0A0B', color: '#FAFAFA' }}><div style={{ display: 'flex', color: '#34D399', fontSize: 32, fontWeight: 700 }}>RALLY</div><div style={{ display: 'flex', flexDirection: 'column' }}><div style={{ display: 'flex', fontSize: 64, fontWeight: 700, lineHeight: 1.05 }}>Chicago venue</div><div style={{ display: 'flex', marginTop: 24, color: '#A1A1AA', fontSize: 30 }}>Rank the run. Find the next game.</div></div><div style={{ display: 'flex', color: '#71717A', fontSize: 20 }}>Venue {params.id.slice(0, 8)}</div></div>, size);
}
