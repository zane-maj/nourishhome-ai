const http = require('http');
const https = require('https');

const PORT = process.env.PORT || 3000;
const API_KEY = process.env.ANTHROPIC_API_KEY || '';

const SYSTEM_PROMPT = `You are NourishHome AI -- a highly knowledgeable family food and fitness expert built into the NourishHome Family Meal OS app.

You specialise in family meal planning, budget cooking for Irish families using Dunnes Stores, nutrition science, fitness training, supplements, weight loss and muscle building, and school lunchbox ideas.

When giving recipes format clearly with ingredients list then numbered method steps. At the end of any recipe add: RECIPE_SAVEABLE: [Recipe Name]

Be warm, direct and practical. Like a knowledgeable friend. Consider Irish family life, busy parents, EUR budgets.`;

const MODELS = ['claude-haiku-4-5-20251001', 'claude-haiku-4-5', 'claude-3-5-haiku-20241022', 'claude-3-haiku-20240307'];

function tryModel(modelIdx, messages, res) {
  if (modelIdx >= MODELS.length) {
    res.writeHead(200, {'Content-Type': 'application/json'});
    res.end(JSON.stringify({error: 'No working model found', ok: false}));
    return;
  }yu
  var model = MODELS[modelIdx];
  var payload = JSON.stringify({
    model: model,
    max_tokens: 1024,
    system: SYSTEM_PROMPT,
    messages: messages
  });

  var options = {
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

  var apiReq = https.request(options, function(apiRes) {
    var data = '';
    apiRes.on('data', function(chunk) { data += chunk; });
    apiRes.on('end', function() {
      try {
        var parsed = JSON.parse(data);
        if (parsed.error) {
          // Try next model
          console.log('Model ' + model + ' failed: ' + parsed.error.message + ' -- trying next');
          tryModel(modelIdx + 1, messages, res);
          return;
        }
        var text = (parsed.content || []).filter(function(b){return b.type==='text';}).map(function(b){return b.text;}).join('');
        console.log('Success with model: ' + model);
        res.writeHead(200, {'Content-Type': 'application/json'});
        res.end(JSON.stringify({reply: text, ok: true, model: model}));
      } catch(e) {
        res.writeHead(500, {'Content-Type': 'application/json'});
        res.end(JSON.stringify({error: 'Parse error', ok: false}));
      }
    });
  });

  apiReq.on('error', function(e) {
    res.writeHead(500, {'Content-Type': 'application/json'});
    res.end(JSON.stringify({error: e.message, ok: false}));
  });

  apiReq.write(payload);
  apiReq.end();
}

var server = http.createServer(function(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }

  if (req.method === 'GET') {
    res.writeHead(200, {'Content-Type': 'application/json'});
    res.end(JSON.stringify({ok: true, status: 'NourishHome AI running', key: API_KEY ? 'yes' : 'no'}));
    return;
  }

  if (req.method !== 'POST') { res.writeHead(405); res.end(); return; }

  var body = '';
  req.on('data', function(chunk) { body += chunk.toString(); });
  req.on('end', function() {
    var input;
    try { input = JSON.parse(body); } catch(e) {
      res.writeHead(400, {'Content-Type': 'application/json'});
      res.end(JSON.stringify({error: 'Invalid JSON', ok: false}));
      return;
    }
    var messages = input.messages || [];
    if (!messages.length) {
      res.writeHead(400, {'Content-Type': 'application/json'});
      res.end(JSON.stringify({error: 'No messages', ok: false}));
      return;
    }
    // Start with first model, fall through on failure
    tryModel(0, messages, res);
  });
});

server.listen(PORT, function() {
  console.log('NourishHome AI Proxy on port ' + PORT);
  console.log('API key: ' + (API_KEY ? 'YES' : 'NO'));
});
