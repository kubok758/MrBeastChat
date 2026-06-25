// Cloudflare Worker proxy для MrBeastChat.
// Нужен только если GitHub Pages/браузер режет прямой запрос к OpenModel по CORS.

const OPENMODEL_URL = 'https://api.openmodel.ai/v1/messages';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, X-Api-Key, Authorization, anthropic-version'
};

export default {
  async fetch(request) {
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders });
    }

    if (request.method !== 'POST') {
      return new Response('Use POST', { status: 405, headers: corsHeaders });
    }

    const apiKey = request.headers.get('X-Api-Key') || request.headers.get('Authorization')?.replace(/^Bearer\s+/i, '');
    if (!apiKey) {
      return json({ error: { message: 'Missing OpenModel API key' } }, 401);
    }

    const body = await request.text();

    const upstream = await fetch(OPENMODEL_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Api-Key': apiKey,
        'anthropic-version': '2023-06-01'
      },
      body
    });

    const responseHeaders = new Headers(corsHeaders);
    responseHeaders.set('Content-Type', upstream.headers.get('Content-Type') || 'application/json');

    return new Response(upstream.body, {
      status: upstream.status,
      statusText: upstream.statusText,
      headers: responseHeaders
    });
  }
};

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  });
}
