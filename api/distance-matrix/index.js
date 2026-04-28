// Lightweight Key Vault access via REST — no Azure SDK needed
// Uses the MI token endpoint directly to avoid 30MB SDK dependency

let cachedApiKey = null;
let cacheExpiry = 0;
const CACHE_TTL = 60 * 60 * 1000; // 1 hour
const KV_SECRET_URL = 'https://kv-route-weather.vault.azure.net/secrets/GoogleMapsApiKey?api-version=7.4';

async function getMIToken() {
  const endpoint = process.env.IDENTITY_ENDPOINT;
  const header = process.env.IDENTITY_HEADER;

  if (!endpoint || !header) {
    throw new Error('Managed Identity not available: IDENTITY_ENDPOINT or IDENTITY_HEADER missing');
  }

  const url = `${endpoint}?resource=https://vault.azure.net&api-version=2019-08-01`;
  const res = await fetch(url, { headers: { 'X-IDENTITY-HEADER': header } });
  if (!res.ok) throw new Error(`MI token request failed: ${res.status}`);

  const data = await res.json();
  return data.access_token;
}

async function getApiKey() {
  if (cachedApiKey && Date.now() < cacheExpiry) return cachedApiKey;

  const token = await getMIToken();
  const res = await fetch(KV_SECRET_URL, {
    headers: { 'Authorization': `Bearer ${token}` }
  });

  if (!res.ok) throw new Error(`Key Vault request failed: ${res.status}`);

  const data = await res.json();
  cachedApiKey = data.value;
  cacheExpiry = Date.now() + CACHE_TTL;
  return cachedApiKey;
}

module.exports = async function (context, req) {
  try {
    // Diagnostic mode
    if (req.query.diag === 'true') {
      context.res = {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          hasIdentityEndpoint: !!process.env.IDENTITY_ENDPOINT,
          hasIdentityHeader: !!process.env.IDENTITY_HEADER,
          nodeVersion: process.version
        })
      };
      return;
    }

    const origins = req.query.origins;
    const destinations = req.query.destinations;
    const departureTime = req.query.departure_time || 'now';

    if (!origins || !destinations) {
      context.res = { status: 400, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ error: 'origins and destinations are required' }) };
      return;
    }

    let apiKey;
    try {
      apiKey = await getApiKey();
    } catch (e) {
      context.res = { status: 500, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ error: 'Failed to retrieve API key', details: e.message }) };
      return;
    }

    const params = new URLSearchParams({
      origins,
      destinations,
      departure_time: departureTime,
      units: 'imperial',
      key: apiKey
    });

    const res = await fetch(`https://maps.googleapis.com/maps/api/distancematrix/json?${params}`);
    const data = await res.json();

    context.res = {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    };
  } catch (e) {
    context.res = {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Unhandled error', details: e.message })
    };
  }
};
