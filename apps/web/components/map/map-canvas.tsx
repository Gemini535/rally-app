'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Map, { Marker, NavigationControl, type MapRef, type ViewStateChangeEvent } from 'react-map-gl';
import useSupercluster from 'use-supercluster';
import { MapPin } from 'lucide-react';
import type { VenueCard } from '@rally/shared';
import 'mapbox-gl/dist/mapbox-gl.css';

type VenuePoint = { type: 'Feature'; properties: { venue: VenueCard }; geometry: { type: 'Point'; coordinates: [number, number] } };
const chicago = { latitude: 41.8781, longitude: -87.6298, zoom: 11.8 };

export function MapCanvas({ venues, selected, onSelect, center }: { venues: VenueCard[]; selected?: string; onSelect: (venue: VenueCard) => void; center?: { lat: number; lng: number } }) {
  const mapRef = useRef<MapRef>(null);
  const [bounds, setBounds] = useState<[number, number, number, number]>([-87.9, 41.8, -87.5, 42]);
  const [zoom, setZoom] = useState(chicago.zoom);
  const points = useMemo<VenuePoint[]>(() => venues.map((venue) => ({ type: 'Feature', properties: { venue }, geometry: { type: 'Point', coordinates: [venue.lng, venue.lat] } })), [venues]);
  const { clusters, supercluster } = useSupercluster({ points, bounds, zoom, options: { radius: 60, maxZoom: 16 } });
  const mapToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
  useEffect(() => { const venue = venues.find((item) => item.id === selected); if (venue) mapRef.current?.flyTo({ center: [venue.lng, venue.lat], zoom: Math.max(14, zoom), duration: 550 }); }, [selected, venues, zoom]);
  const updateViewport = (event: ViewStateChangeEvent) => { const current = event.target.getBounds(); if (current) setBounds([current.getWest(), current.getSouth(), current.getEast(), current.getNorth()]); setZoom(event.viewState.zoom); };
  if (!mapToken) return <FallbackMap venues={venues} selected={selected} onSelect={onSelect} />;
  return <Map ref={mapRef} initialViewState={center ? { latitude: center.lat, longitude: center.lng, zoom: 12 } : chicago} onMoveEnd={updateViewport} mapStyle="mapbox://styles/mapbox/navigation-night-v1" mapboxAccessToken={mapToken} style={{ width: '100%', height: '100%' }}><NavigationControl position="top-right" />{clusters.map((cluster) => { const [lng, lat] = cluster.geometry.coordinates as [number, number]; const properties = cluster.properties as { cluster?: boolean; cluster_id?: number; point_count_abbreviated?: string | number; venue?: VenueCard }; if (properties.cluster && properties.cluster_id !== undefined) { const clusterId = properties.cluster_id; return <Marker key={`cluster-${clusterId}`} longitude={lng} latitude={lat}><button aria-label={`${properties.point_count_abbreviated} venues`} onClick={() => mapRef.current?.easeTo({ center: [lng, lat], zoom: supercluster?.getClusterExpansionZoom(clusterId) ?? zoom + 1 })} className="grid size-11 place-items-center rounded-full border-2 border-rally-base bg-rally-elevated text-sm font-semibold">{properties.point_count_abbreviated}</button></Marker>; } const venue = properties.venue; return venue ? <VenuePin key={venue.id} venue={venue} selected={selected === venue.id} onSelect={onSelect} /> : null; })}</Map>;
}

function VenuePin({ venue, selected, onSelect }: { venue: VenueCard; selected: boolean; onSelect: (venue: VenueCard) => void }) { return <Marker longitude={venue.lng} latitude={venue.lat} anchor="bottom"><button aria-label={venue.name} onClick={() => onSelect(venue)} className={`relative grid size-10 place-items-center rounded-full border-2 border-rally-base text-white transition-transform ${selected ? 'scale-125' : ''}`} style={{ backgroundColor: venue.sports[0]?.colorHex }}><MapPin size={18} />{venue.live?.activeCount ? <span className="absolute -inset-1 -z-10 animate-ping rounded-full bg-rose-400/60" /> : null}</button></Marker>; }
function FallbackMap({ venues, selected, onSelect }: { venues: VenueCard[]; selected?: string; onSelect: (venue: VenueCard) => void }) { return <div className="relative h-full w-full overflow-hidden bg-[#101419]" aria-label="Venue map"><div className="absolute inset-0 opacity-30 [background-image:linear-gradient(#26323a_1px,transparent_1px),linear-gradient(90deg,#26323a_1px,transparent_1px)] [background-size:48px_48px]" />{venues.slice(0, 12).map((venue, index) => <button key={venue.id} aria-label={venue.name} onClick={() => onSelect(venue)} className={`absolute grid size-9 place-items-center rounded-full border-2 border-rally-base text-white ${selected === venue.id ? 'scale-125' : ''}`} style={{ left: `${14 + (index % 4) * 22}%`, top: `${25 + Math.floor(index / 4) * 22}%`, backgroundColor: venue.sports[0]?.colorHex }}><MapPin size={16} />{venue.live?.activeCount ? <span className="absolute -inset-1 -z-10 animate-ping rounded-full bg-rose-400/60" /> : null}</button>)}<p className="absolute bottom-4 left-4 rounded-control border border-rally-border bg-rally-surface/90 px-3 py-2 text-xs text-rally-secondary">Add NEXT_PUBLIC_MAPBOX_TOKEN for the live map</p></div>; }
