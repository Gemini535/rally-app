import type { ReactNode } from 'react';
const colors: Record<string, string> = { basketball: '#F97316', pickleball: '#A3E635', tennis: '#84CC16', soccer: '#38BDF8', volleyball: '#A78BFA', baseball: '#F472B6', softball: '#FB7185', running_track: '#22D3EE', golf_range: '#34D399', skate: '#FBBF24', football: '#60A5FA', handball: '#F87171' };
export function SportThemeProvider({ sport, children }: { sport: string; children: ReactNode }) { return <div style={{ '--sport-accent': colors[sport] ?? '#A1A1AA' } as React.CSSProperties}>{children}</div>; }
