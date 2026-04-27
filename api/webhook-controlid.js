// ============================================================
//  VERCEL SERVERLESS — Control iD (iDSecure) → TWO
//  Arquivo: api/webhook-controlid.js
// ============================================================

const TWO_AUTH_TOKEN = process.env.TWO_AUTH_TOKEN;
const TWO_API_URL = 'https://api1.tradingworks.net/v1/attendances/add';

// Lê o body bruto da requisição (necessário no Vercel)
async function lerBody(req) {
  return new Promise((resolve, reject) => {
    if (req.body && typeof req.body === 'object') {
      return resolve(req.body);
    }
    let data = '';
    req.on('data', chunk => { data += chunk; });
    req.on('end', () => {
      try {
        resolve(data ? JSON.parse(data) : {});
      } catch (e) {
        reject(new Error('JSON inválido no body: ' + data));
      }
    });
    req.on('error', reject);
  });
}

export default async function handler(req, res) {

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método não permitido' });
  }

  try {
    const evento = await lerBody(req);

    console.log('📥 Webhook recebido do iDSecure:', JSON.stringify(evento, null, 2));

    // --- Extrai o CPF ---
    const cpfBruto =
      evento.cpf        ||
      evento.document   ||
      evento.person?.cpf ||
      evento.user?.cpf  ||
      null;

    if (!cpfBruto) {
      console.error('❌ CPF não encontrado. Campos recebidos:', Object.keys(evento));
      return res.status(400).json({ error: 'CPF não encontrado no payload' });
    }

    const cpf = cpfBruto.replace(/\D/g, '');

    // --- Extrai data e hora ---
    const timestampBruto =
      evento.time       ||
      evento.dateTime   ||
      evento.date_time  ||
      evento.timestamp  ||
      null;

    if (!timestampBruto) {
      console.error('❌ Data/hora não encontrada. Campos recebidos:', Object.keys(evento));
      return res.status(400).json({ error: 'Data/hora não encontrada no payload' });
    }

    const dataHora = new Date(timestampBruto);
    const DataMarcacao = dataHora.toISOString().split('T')[0]; // "2024-10-01"
    const HoraMarcacao = dataHora.toTimeString().slice(0, 5);  // "14:56"

    // --- Monta payload para o TWO ---
    const payloadTWO = [{
      NumeroREP: evento.deviceId || evento.device_id || '',
      NSR:       String(evento.id || evento.logId || ''),
      CPF:       cpf,
      DataMarcacao,
      HoraMarcacao,
    }];

    console.log('📤 Enviando para TWO:', JSON.stringify(payloadTWO, null, 2));

    // --- Chama API do TWO ---
    const response = await fetch(TWO_API_URL, {
      method: 'POST',
      headers: {
        'AUTH-TOKEN':   TWO_AUTH_TOKEN,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payloadTWO),
    });

    const resultado = await response.json();
    console.log('✅ Resposta do TWO:', JSON.stringify(resultado, null, 2));

    return res.status(200).json({ ok: true, two_response: resultado });

  } catch (err) {
    console.error('❌ Erro:', err.message);
    return res.status(500).json({ error: err.message });
  }
}
