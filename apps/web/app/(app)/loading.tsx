export default function AppLoading() {
  return <main className="min-h-dvh animate-pulse p-5 lg:grid lg:grid-cols-[minmax(0,1fr)_440px] lg:gap-4"><div className="hidden rounded-card bg-rally-elevated lg:block" /><section className="mx-auto w-full max-w-2xl space-y-4"><div className="h-4 w-24 rounded bg-rally-elevated" /><div className="h-9 w-56 rounded bg-rally-elevated" />{Array.from({ length: 5 }, (_, index) => <div key={index} className="h-24 rounded-card border border-rally-border bg-rally-surface" />)}</section></main>;
}
