import { CircleDot } from 'lucide-react';
export function SportChip({ name, color }: { name: string; color: string }) { return <span className="inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-medium" style={{ backgroundColor: `${color}22`, color }}><CircleDot size={12} />{name}</span>; }
