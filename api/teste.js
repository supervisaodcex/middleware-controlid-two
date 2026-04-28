export default async function handler(req, res) {
  const token  = (process.env.TWO_AUTH_TOKEN || '').trim();
  const cpfRaw = req.query.cpf  || '53944108876';
  const nome   = req.query.nome || 'João Silva';

  const nums    = cpfRaw.replace(/\D/g, '').padStart(11, '0').slice(-11);
  const cpfMask = `${nums.slice(0,3)}.${nums.slice(3,6)}.${nums.slice(6,9)}-${nums.slice(9)}`;

  const agora   = new Date();
  const dataStr = agora.toISOString().split('T')[0];
  const horaStr = agora.toTimeString().slice(0, 5);
  const base    = { PersonalDocument: cpfMask, Name: nome };

  const variacoes = [
    { nome: 'DataMarcacao + HoraMarcacao', payload: [{ ...base, DataMarcacao: dataStr, HoraMarcacao: horaStr }] },
    { nome: 'Data + Horario',              payload: [{ ...base, Data: dataStr, Horario: horaStr }] },
    { nome: 'BaseDate + EventTime',        payload: [{ ...base, BaseDate: dataStr, EventTime: horaStr }] },
    { nome: 'date + time',                 payload: [{ ...base, date: dataStr, time: horaStr }] },
    { nome: 'EventDateTime combinado',     payload: [{ ...base, EventDateTime: `${dataStr}T${horaStr}:00` }] },
  ];

  const resultados = [];
  for (const v of variacoes) {
    const r = await fetch('https://api1.tradingworks.net/v1/timecardcostcenter/addattendance', {
      method: 'POST',
      headers: { 'AUTH-TOKEN': token, 'Content-Type': 'application/json' },
      body: JSON.stringify(v.payload),
    });
    const texto = await r.text();
    let resp;
    try { resp = JSON.parse(texto); } catch { resp = texto || '(vazio)'; }
    resultados.push({ variacao: v.nome, status: r.status, resposta: resp });
  }

  return res.status(200).json({ resultados });
}
