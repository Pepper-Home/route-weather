const { DefaultAzureCredential } = require('@azure/identity');
const { SecretClient } = require('@azure/keyvault-secrets');

// Cache the resolved key in memory (survives across function invocations in the same instance)
let cachedApiKey = null;
let cacheExpiry = 0;
const CACHE_TTL = 60 * 60 * 1000; // 1 hour

async function getApiKey() {
  if (cachedApiKey && Date.now() < cacheExpiry) return cachedApiKey;

  const credential = new DefaultAzureCredential();
  const client = new SecretClient('https://kv-route-weather.vault.azure.net', credential);
  const secret = await client.getSecret('GoogleMapsApiKey');
  cachedApiKey = secret.value;
  cacheExpiry = Date.now() + CACHE_TTL;
  return cachedApiKey;
}

module.exports = async function (context, req) {
  const origins = req.query.origins;
  const destinations = req.query.destinations;
  const departureTime = req.query.departure_time || 'now';

  if (!origins || !destinations) {
    context.res = { status: 400, body: { error: 'origins and destinations are required' } };
    return;
  }

  let apiKey;
  try {
    apiKey = await getApiKey();
  } catch (e) {
    context.res = { status: 500, body: { error: 'Failed to retrieve API key from Key Vault', details: e.message } };
    return;
  }

  const params = new URLSearchParams({
    origins,
    destinations,
    departure_time: departureTime,
    units: 'imperial',
    key: apiKey
  });

  try {
    const res = await fetch(`https://maps.googleapis.com/maps/api/distancematrix/json?${params}`);
    const data = await res.json();

    context.res = {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
      body: data
    };
  } catch (e) {
    context.res = { status: 502, body: { error: 'Google API request failed', details: e.message } };
  }
};
