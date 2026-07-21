'use client';

import Image from 'next/image';
import { useState } from 'react';

const fallback = '/seed-photos/placeholder.svg';

/** Keeps local seed-photo gaps from turning a venue card into a broken image. */
export function VenuePhoto({ src, alt, className, sizes, priority = false }: { src: string | null; alt: string; className?: string; sizes: string; priority?: boolean }) {
  const [imageSrc, setImageSrc] = useState(src ?? fallback);
  return <Image src={imageSrc} alt={alt} fill unoptimized priority={priority} sizes={sizes} className={className} onError={() => setImageSrc(fallback)} />;
}
