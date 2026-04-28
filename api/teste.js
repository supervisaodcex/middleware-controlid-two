export default async function handler(req, res) {
  const token  = (process.env.TWO_AUTH_TOKEN || '').trim();
  const cpfRaw = req.query.cpf  || '53944108876';
  const nome   = req.query.nome || 'Colaborador Teste';

  const nums    = cpfRaw.replace(/\D/g, '').padStart(11, '0').slice(-11);
  const cpfMask = `${nums.slice(0,3)}.${nums.slice(3,6)}.${nums.slice(6,9)}-${nums.slice(9)}`;

  const agora = new Date();
  const payload = [{
    PersonalDocument: cpfMask,
    Name:             nome,
    data:             agora.toISOString().split('T')[0],
    horario:          agora.toTimeString().slice(0, 5),
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
