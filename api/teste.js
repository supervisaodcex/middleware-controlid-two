export default async function handler(req, res) {
  const token        = (process.env.TWO_AUTH_TOKEN || '').trim();
  const cpfRaw       = req.query.cpf          || '53944108876';
  const nome         = req.query.nome         || 'João Silva';
  const costCenter   = req.query.costcenter   || 'BRE_BLITZ_DIA';

  const nums    = cpfRaw.replace(/\D/g, '').padStart(11, '0').slice(-11);
  const cpfMask = `${nums.slice(0,3)}.${nums.slice(3,6)}.${nums.slice(6,9)}-${nums.slice(9)}`;

  const agora  = new Date();
  const partes = new Intl.DateTimeFormat('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    year: '2-digit', month: 'numeric', day: 'numeric',
    hour: '2-digit', minute: '2-digit', hour12: false,
  }).formatToParts(agora);
  const p = {};
  partes.forEach(({ type, value }) => { p[type] = value; });

  const baseDate = `${p.month}/${p.day}/${p.year}`;
  const hora     = `${p.hour}:${p.minute}`;

  const payload = [{
    PersonalDocument: cpfMask,
    Name:             nome,
    BaseDate:         baseDate,
    In:               hora,
    Out:              hora,   // mesmo horário — aceito pela API
    InPause:          '',
    OutPause:         '',
    CostCenterCode:   costCenter,
    LocaleCode:       '',
  }];

  const r = await fetch('https://api1.tradingworks.net/v1/timecardcostcenter/addattendance', {
    method: 'POST',
    headers: { 'AUTH-TOKEN': token, 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  const texto = await r.text();
  let resultado;
  try { resultado = JSON.parse(texto); } catch { resultado = texto || '(vazio)'; }

  return res.status(200).json({
    payload_enviado: payload,
    http_status:     r.status,
    resposta_two:    resultado,
  });
}
