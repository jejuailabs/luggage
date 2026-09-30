"use client";
/* eslint-disable @next/next/no-img-element -- Map tiles use the provider's cache and URL directly. */

import { useEffect, useMemo, useRef, useState } from "react";

type Point = { latitude: number; longitude: number };

// Illustrative points; this is not a road itinerary or a real vehicle track.
const route: Point[] = [
  { latitude: 33.253, longitude: 126.561 },
  { latitude: 33.283, longitude: 126.577 },
  { latitude: 33.319, longitude: 126.599 },
  { latitude: 33.355, longitude: 126.610 },
  { latitude: 33.396, longitude: 126.604 },
  { latitude: 33.434, longitude: 126.576 },
  { latitude: 33.468, longitude: 126.539 },
  { latitude: 33.490, longitude: 126.512 },
  { latitude: 33.511, longitude: 126.493 },
];
const zoom = 11;
const demoScale = 0.78;
const demoCenter = { latitude: 33.382, longitude: 126.525 };

function world(point: Point) {
  const latitude = Math.max(-85.0511, Math.min(85.0511, point.latitude)) * Math.PI / 180;
  const extent = 256 * 2 ** zoom;
  return { x: (point.longitude + 180) / 360 * extent, y: (1 - Math.log(Math.tan(latitude) + 1 / Math.cos(latitude)) / Math.PI) / 2 * extent };
}

function onRoute(progress: number): Point {
  const segment = Math.min(route.length - 2, Math.floor(progress * (route.length - 1)));
  const portion = Math.min(1, progress * (route.length - 1) - segment);
  const a = route[segment]!;
  const b = route[segment + 1]!;
  return { latitude: a.latitude + (b.latitude - a.latitude) * portion, longitude: a.longitude + (b.longitude - a.longitude) * portion };
}

export function RealMap({ demo, location, progress, labels }: { demo: boolean; location?: Point | null; progress: number; labels: { pickup: string; airport: string; demo: string; live: string; unavailable: string } }) {
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(390);
  const [tileError, setTileError] = useState(false);
  const height = width < 640 ? 440 : 520;
  const center = demo ? demoCenter : location ?? demoCenter;
  const centerPixel = world(center);
  const scale = demo ? demoScale : 1;
  const tileSize = 256 * scale;
  const project = (point: Point) => {
    const pixel = world(point);
    return { x: width / 2 + (pixel.x - centerPixel.x) * scale, y: height / 2 + (pixel.y - centerPixel.y) * scale };
  };
  const tiles = useMemo(() => {
    const minX = Math.floor((centerPixel.x - width / (2 * scale)) / 256);
    const maxX = Math.floor((centerPixel.x + width / (2 * scale)) / 256);
    const minY = Math.floor((centerPixel.y - height / (2 * scale)) / 256);
    const maxY = Math.floor((centerPixel.y + height / (2 * scale)) / 256);
    const result: { x: number; y: number; left: number; top: number }[] = [];
    for (let y = minY; y <= maxY; y++) for (let x = minX; x <= maxX; x++) result.push({ x, y, left: width / 2 + (x * 256 - centerPixel.x) * scale, top: height / 2 + (y * 256 - centerPixel.y) * scale });
    return result;
  }, [centerPixel.x, centerPixel.y, height, scale, width]);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    const observer = new ResizeObserver(([entry]) => { if (entry) setWidth(Math.round(entry.contentRect.width)); });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  const projectedRoute = route.map(project);
  const marker = project(demo ? onRoute(progress) : location ?? demoCenter);
  const allPoints = projectedRoute.map((point) => `${point.x},${point.y}`).join(" ");
  const traversedPoints = [...route.slice(0, Math.floor(progress * (route.length - 1)) + 1), onRoute(progress)].map(project).map((point) => `${point.x},${point.y}`).join(" ");

  return <div ref={ref} className="tracking-map__real" style={{ height }} data-testid="tracking-real-map" role="img" aria-label={demo ? labels.demo : labels.live}>
    <div className="tracking-map__tiles" aria-hidden="true">{tiles.map((tile) => <img
      key={`${zoom}-${tile.x}-${tile.y}`}
      src={`https://tile.openstreetmap.org/${zoom}/${tile.x}/${tile.y}.png`}
      alt=""
      width={Math.ceil(tileSize + 1)}
      height={Math.ceil(tileSize + 1)}
      style={{ left: tile.left, top: tile.top, width: tileSize + 1, height: tileSize + 1 }}
      onError={() => setTileError(true)}
    />)}</div>
    {tileError ? <div className="tracking-map__tile-error" role="status">{labels.unavailable}</div> : null}
    {demo ? <svg className="tracking-map__overlay" viewBox={`0 0 ${width} ${height}`} aria-hidden="true">
      <polyline points={allPoints} fill="none" stroke="#fff" strokeOpacity=".95" strokeWidth="9" strokeLinecap="round" strokeLinejoin="round" />
      <polyline points={allPoints} fill="none" stroke="#176750" strokeOpacity=".65" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" strokeDasharray="7 9" />
      <polyline points={traversedPoints} fill="none" stroke="#075d49" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" />
      {projectedRoute.slice(1, -1).map((point, index) => <circle key={index} cx={point.x} cy={point.y} r="5" className="tracking-map__waypoint" style={{ animationDelay: `${index * .35}s` }} />)}
      <circle cx={projectedRoute[0]?.x} cy={projectedRoute[0]?.y} r="11" fill="#fff" stroke="#145d49" strokeWidth="4" />
      <circle cx={projectedRoute.at(-1)?.x} cy={projectedRoute.at(-1)?.y} r="11" fill="#fff" stroke="#145d49" strokeWidth="4" />
    </svg> : null}
    <div className="tracking-map__marker" style={{ left: marker.x, top: marker.y }} data-testid="tracking-marker"><span /></div>
    {demo ? <>
      <span className="tracking-map__place tracking-map__place--pickup" style={{ left: projectedRoute[0]?.x, top: projectedRoute[0]?.y }}>{labels.pickup}</span>
      <span className="tracking-map__place tracking-map__place--airport" style={{ left: projectedRoute.at(-1)?.x, top: projectedRoute.at(-1)?.y }}>{labels.airport}</span>
    </> : null}
    <span className="tracking-map__watermark">{demo ? labels.demo : labels.live}</span>
    <a className="tracking-map__attribution" href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">© OpenStreetMap contributors</a>
  </div>;
}
