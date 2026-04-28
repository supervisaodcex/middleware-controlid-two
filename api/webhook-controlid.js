// api/webhook-controlid.js
const TWO_AUTH_TOKEN = process.env.TWO_AUTH_TOKEN;
const TWO_API_URL    = 'https://api1.tradingworks.net/v1/timecardcostcenter/addattendance';
const TIMEZONE       = 'America/Sao_Paulo';

export const config = {
  api: { bodyParser: false },
};

function lerBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', chunk => (data += chunk.toString()));
    req.on('end', () => {
      try { resolve(data ? JSON.parse(data) : {}); }
      catch (e) { reject(new Error('JSON inválido: ' + data)); }
    });
    req.on('error', reject);
  });
}

function formatarCPF(valor) {
  const nums = String(valor).replace(/\D/g, '').padStart(11, '0').slice(-11);
  return `${nums.slice(0,3)}.${nums.slice(3,6)}.${nums.slice(6,9)}-${nums.slice(9)}`;
}

function formatarDataHoraBR(timestamp) {
  const d = new Date(timestamp);
  const partes = new Intl.DateTimeFormat('pt-BR', {
    timeZone: TIMEZONE,
    year:   '2-digit',
    month:  'numeric',
    day:    'numeric',
    hour:   '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(d);

  const p = {};
  partes.forEach(({ type, value }) => { p[type] = value; });

  return {
    baseDate: `${p.month}/${p.day}/${p.year}`,  // 4/28/26
    horaIn:   `${p.hour}:${p.minute}`,           // 13:14
  };
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
        error:            'CPF não encontrado no payload',
        campos_recebidos: Object.keys(evento),
      });
    }

    const nome =
      evento.name         ||
      evento.Name         ||
      evento.person?.name ||
      evento.nome         ||
      '';

    const timestampBruto =
      evento.time      ||
      evento.dateTime  ||
      evento.date_time ||
      evento.timestamp ||
      new Date().toISOString();

    const { baseDate, horaIn } = formatarDataHoraBR(timestampBruto);

    const payload = [{
      PersonalDocument: formatarCPF(cpfBruto),
      Name:             nome,
      BaseDate:         baseDate,
      In:               horaIn,
      Out:              '',
      InPause:          '',
      OutPause:         '',
      CostCenterCode:   evento.CostCenterCode || '',
      LocaleCode:       evento.LocaleCode     || '',
    }];

    console.log('📤 Enviando para TWO:', JSON.stringify(payload, null, 2));

    const response = await fetch(TWO_API_URL, {
      method: 'POST',
      headers: { 'AUTH-TOKEN': TWO_AUTH_TOKEN, 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    const texto = await response.text();
    let resultado;
    try { resultado = JSON.parse(texto); } catch { resultado = texto || '(vazio)'; }

    console.log('✅ Resposta TWO:', JSON.stringify(resultado, null, 2));
    return res.status(200).json({ ok: true, two_response: resultado });

  } catch (err) {
    console.error('❌ Erro:', err.message);
    return res.status(500).json({ error: err.message });
  }
}
