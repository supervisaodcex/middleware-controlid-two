// api/webhook-controlid.js

const TWO_AUTH_TOKEN = process.env.TWO_AUTH_TOKEN;
const TWO_API_URL = 'https://api1.tradingworks.net/v1/attendances/add';

// Desativa o body parser automático do Vercel
export const config = {
  api: { bodyParser: false },
};

function lerBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', chunk => (data += chunk.toString()));
    req.on('end', () => {
      try {
        resolve(data ? JSON.parse(data) : {});
      } catch (e) {
        reject(new Error('JSON inválido: ' + data));
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

    console.log('📥 Webhook recebido:', JSON.stringify(evento, null, 2));

    const cpfBruto =
      evento.cpf         ||
      evento.CPF         ||
      evento.document    ||
      evento.person?.cpf ||
      null;

    if (!cpfBruto) {
      return res.status(400).json({
        error: 'CPF não encontrado',
        campos_recebidos: Object.keys(evento),
      });
    }

    const cpf = String(cpfBruto).replace(/\D/g, '');

    const timestampBruto =
      evento.time      ||
      evento.dateTime  ||
      evento.date_time ||
      evento.timestamp ||
      new Date().toISOString();

    const dataHora     = new Date(timestampBruto);
    const DataMarcacao = dataHora.toISOString().split('T')[0];
    const HoraMarcacao = dataHora.toTimeString().slice(0, 5);

    const payloadTWO = [{
      NumeroREP: String(evento.deviceId || ''),
      NSR:       String(evento.id || ''),
      CPF:       cpf,
      DataMarcacao,
      HoraMarcacao,
    }];

    console.log('📤 Enviando para TWO:', JSON.stringify(payloadTWO, null, 2));

    const response = await fetch(TWO_API_URL, {
      method: 'POST',
      headers: {
        'AUTH-TOKEN':   TWO_AUTH_TOKEN,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payloadTWO),
    });

    const resultado = await response.json();
    console.log('✅ Resposta TWO:', JSON.stringify(resultado, null, 2));

    return res.status(200).json({ ok: true, two_response: resultado });

  } catch (err) {
    console.error('❌ Erro:', err.message);
    return res.status(500).json({ error: err.message });
  }
}
