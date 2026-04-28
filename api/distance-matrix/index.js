module.exports = async function (context, req) {
  const origins = req.query.origins;
  const destinations = req.query.destinations;
  const departureTime = req.query.departure_time || 'now';

  if (!origins || !destinations) {
    context.res = { status: 400, body: { error: 'origins and destinations are required' } };
    return;
  }

  const apiKey = process.env.GOOGLE_MAPS_API_KEY;
  if (!apiKey) {
    context.res = { status: 500, body: { error: 'API key not configured' } };
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
