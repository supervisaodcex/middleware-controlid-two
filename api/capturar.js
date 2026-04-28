// api/capturar.js
// Endpoint coringa — loga TUDO que chegar, de qualquer método
export const config = { api: { bodyParser: false } };

function lerBody(req) {
  return new Promise((resolve) => {
    let data = '';
    req.on('data', chunk => (data += chunk.toString()));
    req.on('end', () => resolve(data));
  });
}

export default async function handler(req, res) {
  const body = await lerBody(req);

  const log = {
    timestamp:  new Date().toISOString(),
    method:     req.method,
    url:        req.url,
    headers:    req.headers,
    body_raw:   body,
    body_json:  (() => { try { return JSON.parse(body); } catch { return null; } })(),
  };

  // Aparece nos logs do Vercel
  console.log('🔔 REQUISIÇÃO RECEBIDA:', JSON.stringify(log, null, 2));

  // Retorna 200 para o iDSecure não tentar reenviar
  return res.status(200).json({ recebido: true });
}
