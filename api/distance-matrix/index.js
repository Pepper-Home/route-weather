const { app } = require('@azure/functions');

app.http('distance-matrix', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'distance-matrix',
  handler: async (request, context) => {
    const origins = request.query.get('origins');
    const destinations = request.query.get('destinations');
    const departureTime = request.query.get('departure_time') || 'now';

    if (!origins || !destinations) {
      return { status: 400, body: JSON.stringify({ error: 'origins and destinations are required' }) };
    }

    const apiKey = process.env.GOOGLE_MAPS_API_KEY;
    if (!apiKey) {
      return { status: 500, body: JSON.stringify({ error: 'API key not configured' }) };
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

      return {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      };
    } catch (e) {
      return { status: 502, body: JSON.stringify({ error: 'Google API request failed', details: e.message }) };
    }
  }
});
