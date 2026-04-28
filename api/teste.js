export default async function handler(req, res) {
  const token  = (process.env.TWO_AUTH_TOKEN || '').trim();
  const cpfRaw = req.query.cpf || '53944108876';

  const cpf = cpfRaw.replace(/\D/g, '');

  const agora = new Date();
  const partes = new Intl.DateTimeFormat('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hour12: false,
  }).formatToParts(agora);

  const p = {};
  partes.forEach(({ type, value }) => { p[type] = value; });

  const DataMarcacao = `${p.year}-${p.month}-${p.day}`;  // 2026-04-28
  const HoraMarcacao = `${p.hour}:${p.minute}`;           // 13:16

  const payload = [{
    CPF:           cpf,
    DataMarcacao,
    HoraMarcacao,
    NumeroREP:     'CONTROLID',
    NSR:           '0',
  }];

  const r = await fetch('https://api1.tradingworks.net/v1/attendances/add', {
    method: 'POST',
    headers: { 'AUTH-TOKEN': token, 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  const texto = await r.text();
  let resultado;
  try { resultado = JSON.parse(texto); } catch { resultado = texto || '(vazio)'; }

  return res.status(200).json({
    endpoint:        'attendances/add',
    payload_enviado: payload,
    http_status:     r.status,
    resposta_two:    resultado,
  });
}
