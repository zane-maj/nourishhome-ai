const http = require('http');
const https = require('https');

const PORT = process.env.PORT || 3000;
const API_KEY = process.env.ANTHROPIC_API_KEY || '';

const SYSTEM_PROMPT = `You are NourishHome AI -- a highly knowledgeable family food and fitness expert built into the NourishHome Family Meal OS app.

You specialise in:
- Family meal planning and recipe creation (Irish/UK families, Dunnes Stores ingredients)
- Budget-friendly cooking (meals under EUR 5 per serving)
- Nutrition science and macro tracking
- Fitness training, gym programming, progressive overload
- Supplements (evidence-based, honest about what works)
- Weight loss, muscle building, body recomposition
- School lunchbox ideas (nut-free, kid-friendly, budget)
- Food waste reduction and batch cooking

When giving recipes, ALWAYS format clearly with:
## Recipe Name
Serves X | Cook time | Kcal | Protein

**Ingredients**
- ingredient list

**Method**
1. numbered steps

**Tip:** one practical tip

At the end of ANY recipe response, add exactly: RECIPE_SAVEABLE: [Recipe Name]

Be warm, direct and practical. Like a knowledgeable friend, not a textbook.
Consider Irish family life: busy parents, school runs, Dunnes Stores, EUR budgets.
For fitness: real people with real lives, not gym obsessives.
For supplements: honest and evidence-based only.`;

const server = http.createServer((req, res) => {
  // CORS - allow ALL origins
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-api-key');
  res.setHeader('Access-Control-Max-Age', '86400');

  // Handle preflight
  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  // Health check
  if (req.method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ok: true, status: 'NourishHome AI Proxy is running', apiKey: API_KEY ? 'configured' : 'missing' }));
    return;
  }

  if (req.method !== 'POST') {
    res.writeHead(405);
    res.end(JSON.stringify({ error: 'Method not allowed', ok: false }));
    return;
  }

  let body = '';
  req.on('data', chunk => { body += chunk.toString(); });
  req.on('end', () => {
    let input;
    try {
      input = JSON.parse(body);
    } catch (e) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Invalid JSON', ok: false }));
      return;
    }

    const messages = input.messages || [];
    if (!messages.length) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'No messages provided', ok: false }));
      return;
    }

    const payload = JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1024,
      system: SYSTEM_PROMPT,
      messages: messages
    });

    const options = {
      hostname: 'api.anthropic.com',
      path: '/v1/messages',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': API_KEY,
        'anthropic-version': '2023-06-01',
        'Content-Length': Buffer.byteLength(payload)
      }
    };

    const apiReq = https.request(options, (apiRes) => {
      let data = '';
      apiRes.on('data', chunk => { data += chunk; });
      apiRes.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          if (parsed.error) {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: parsed.error.message, ok: false }));
            return;
          }
          const text = (parsed.content || [])
            .filter(b => b.type === 'text')
            .map(b => b.text)
            .join('');
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ reply: text, ok: true }));
        } catch (e) {
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Failed to parse API response', ok: false }));
        }
      });
    });

    apiReq.on('error', (e) => {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: e.message, ok: false }));
    });

    apiReq.write(payload);
    apiReq.end();
  });
});

server.listen(PORT, () => {
  console.log('NourishHome AI Proxy running on port ' + PORT);
  console.log('API key configured: ' + (API_KEY ? 'YES' : 'NO'));
});
