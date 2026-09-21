/* eslint-disable @typescript-eslint/no-explicit-any, @next/next/no-img-element */
"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import type { Locale } from "@/lib/i18n/locale";
import type { PublicEventDiscoveryItem } from "@/lib/server/public-events";
import { eventName } from "@/lib/i18n/event-content";
import { formatEventDateTime } from "@/lib/format-event-time";

declare global {
  interface Window { L?: any; }
}

function EventCover({ event, locale }: { event: PublicEventDiscoveryItem; locale: Locale }) {
  const name = eventName(event, locale);
  if (event.cover_image_url) {
    return <img src={event.cover_image_url} alt="" className="aspect-[16/9] w-full object-cover" />;
  }
  return (
    <div className="flex aspect-[16/9] flex-col justify-between bg-[var(--accent-tint)] p-5">
      <span className="text-xs font-semibold uppercase tracking-wide text-[var(--ink)]">ProMedia Events</span>
      <strong className="heading-display line-clamp-3 text-xl text-[var(--ink)]">{name}</strong>
      <span className="text-xs text-[var(--muted)]">{event.start_date}</span>
    </div>
  );
}

function EventMap({ events, locale }: { events: PublicEventDiscoveryItem[]; locale: Locale }) {
  const el = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const mapped = events.filter((e) => e.latitude !== null && e.longitude !== null);
    if (!el.current || mapped.length === 0) return;
    let map: any;
    const init = () => {
      if (!el.current || !window.L) return;
      map = window.L.map(el.current, { scrollWheelZoom: false });
      window.L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      }).addTo(map);
      const bounds: any[] = [];
      for (const event of mapped) {
        const point = [event.latitude, event.longitude];
        bounds.push(point);
        window.L.marker(point).addTo(map).bindPopup(
          '<strong>' + eventName(event, locale).replace(/[&<>"']/g, "") + '</strong><br><a href="/e/' + encodeURIComponent(event.slug) + '">Open</a>'
        );
      }
      if (bounds.length === 1) map.setView(bounds[0], 11);
      else map.fitBounds(bounds, { padding: [30, 30] });
    };
    const existing = document.querySelector<HTMLScriptElement>('script[data-promedia-leaflet]');
    if (window.L) init();
    else {
      if (!document.querySelector('link[data-promedia-leaflet]')) {
        const link = document.createElement("link");
        link.rel = "stylesheet"; link.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"; link.dataset.promediaLeaflet = "1";
        document.head.appendChild(link);
      }
      if (existing) existing.addEventListener("load", init, { once: true });
      else {
        const script = document.createElement("script");
        script.src = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"; script.dataset.promediaLeaflet = "1";
        script.onload = init; document.body.appendChild(script);
      }
    }
    return () => { if (map) map.remove(); };
  }, [events, locale]);
  if (!events.some((e) => e.latitude !== null && e.longitude !== null)) return null;
  return <div ref={el} className="mt-5 h-80 w-full overflow-hidden rounded-2xl border border-[var(--border)]" />;
}

export function EventDiscovery({ events, locale, labels }: {
  events: PublicEventDiscoveryItem[]; locale: Locale;
  labels: { heading: string; all: string; online: string; offline: string; hybrid: string; city: string; map: string; empty: string; open: string; };
}) {
  const [format, setFormat] = useState("all");
  const [city, setCity] = useState("all");
  const cities = useMemo(() => Array.from(new Set(events.map((e) => e.city).filter(Boolean) as string[])).sort(), [events]);
  const filtered = useMemo(() => events.filter((e) =>
    (format === "all" || e.event_format === format) && (city === "all" || e.city === city)
  ), [events, format, city]);

  return (
    <section className="mt-16">
      <h2 className="heading-display text-xl">{labels.heading}</h2>
      <div className="mt-4 flex flex-wrap gap-3">
        <select aria-label={labels.heading} value={format} onChange={(e) => setFormat(e.target.value)} className="rounded-full border border-[var(--border)] bg-white px-4 py-2 text-sm">
          <option value="all">{labels.all}</option><option value="offline">{labels.offline}</option><option value="online">{labels.online}</option><option value="hybrid">{labels.hybrid}</option>
        </select>
        {cities.length > 0 && <select aria-label={labels.city} value={city} onChange={(e) => setCity(e.target.value)} className="rounded-full border border-[var(--border)] bg-white px-4 py-2 text-sm">
          <option value="all">{labels.city}: {labels.all}</option>{cities.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>}
      </div>
      {filtered.length === 0 ? <p className="mt-6 text-sm text-muted">{labels.empty}</p> : <>
        <div className="mt-5 grid gap-5 sm:grid-cols-2">{filtered.map((event) => (
          <Link key={event.id} href={`/e/${event.slug}`} className="overflow-hidden rounded-2xl border border-[var(--border)] bg-white">
            <EventCover event={event} locale={locale} />
            <div className="p-5"><p className="heading-display text-lg">{eventName(event, locale)}</p>
              <p className="mt-2 text-sm text-muted">{formatEventDateTime(event.start_date, event.start_time, event.timezone)}</p>
              <p className="mt-1 text-sm text-muted">{event.event_format === "online" ? labels.online : [event.city, event.region].filter(Boolean).join(", ")}</p>
              <p className="mt-3 text-xs text-muted">{event.organization_name}</p>
            </div>
          </Link>
        ))}</div>
        {filtered.some((e) => e.latitude !== null && e.longitude !== null) && (
          <><h3 className="mt-10 heading-display text-lg">{labels.map}</h3><EventMap events={filtered} locale={locale} /></>
        )}
      </>}
    </section>
  );
}
