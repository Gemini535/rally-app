'use client';
import Link from 'next/link';
import { Map, Users, Plus, Trophy, User } from 'lucide-react';
import { usePathname } from 'next/navigation';
const tabs = [['/', Map, 'Map'], ['/feed', Users, 'Feed'], ['/search', Plus, 'Log'], ['/leaderboard', Trophy, 'Ranks'], ['/me', User, 'Profile']] as const;
export function AppShell({ children }: { children: React.ReactNode }) { const path = usePathname(); return <div className="min-h-dvh pb-16 lg:pl-20 lg:pb-0"><aside className="fixed inset-x-0 bottom-0 z-50 flex h-16 justify-around border-t border-rally-border bg-rally-surface/95 px-2 backdrop-blur lg:inset-y-0 lg:left-0 lg:right-auto lg:h-dvh lg:w-20 lg:flex-col lg:justify-center lg:border-r lg:border-t-0">{tabs.map(([href, Icon, label]) => <Link key={href} href={href} aria-label={label} className={`grid min-w-12 place-items-center gap-1 rounded-control p-2 text-xs ${path === href ? 'text-emerald-400' : 'text-rally-secondary'}`}><Icon size={20} /><span>{label}</span></Link>)}</aside>{children}</div>; }
