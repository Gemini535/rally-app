import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const dataDir = join(process.cwd(), 'scripts', 'data');
const query = `[out:json][timeout:120];
(
  nwr["leisure"="pitch"](41.6445,-87.9401,42.0230,-87.5237);
  nwr["leisure"="track"]["sport"](41.6445,-87.9401,42.0230,-87.5237);
  nwr["leisure"="sports_centre"]["sport"](41.6445,-87.9401,42.0230,-87.5237);
  nwr["sport"~"^(basketball|tennis|soccer|volleyball|baseball|softball|running|pickleball|skateboard|american_football|handball)$"](41.6445,-87.9401,42.0230,-87.5237);
);
out center tags;`;

async function fetchWithRetry(url: string, init: RequestInit) {
  let error: unknown;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try { const response = await fetch(url, init); if (response.ok) return response; error = new Error(`${response.status} ${response.statusText}`); } catch (cause) { error = cause; }
    await new Promise((resolve) => setTimeout(resolve, 1_000 * 2 ** attempt));
  }
  throw error;
}

async function main() {
  await mkdir(dataDir, { recursive: true });
  const overpass = await fetchWithRetry('https://overpass-api.de/api/interpreter', { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ data: query }) });
  await writeFile(join(dataDir, 'chicago-venues.raw.json'), `${JSON.stringify(await overpass.json(), null, 2)}\n`);
  const neighborhoods = await fetchWithRetry('https://gisapps.chicago.gov/arcgis/rest/services/ExternalApps/extoperational/MapServer/0/query?where=1%3D1&outFields=*&f=geojson&outSR=4326', {});
  await writeFile(join(dataDir, 'chicago-neighborhoods.geojson'), `${JSON.stringify(await neighborhoods.json(), null, 2)}\n`);
  console.log('Saved Overpass venues and City of Chicago community-area GeoJSON.');
}

void main();
