export default async function handler(req, res) {
  const tokenDiarista = (process.env.TWO_AUTH_TOKEN || '').trim();
  const cpfRaw = req.query.cpf || '53944108876';
  const cpf    = cpfRaw.replace(/\D/g, '');

  const agora  = new Date();
  const partesBR = new Intl.DateTimeFormat('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hour12: false,
  }).formatToParts(agora);
  const p = {};
  partesBR.forEach(({ type, value }) => { p[type] = value; });

  const DataMarcacao = `${p.year}-${p.month}-${p.day}`;
  const HoraMarcacao = `${p.hour}:${p.minute}`;

  const mes  = String(agora.getUTCMonth() + 1);
  const dia  = String(agora.getUTCDate());
  const ano  = String(agora.getUTCFullYear()).slice(-2);
  const nums = cpf.padStart(11,'0').slice(-11);
  const cpfMask = `${nums.slice(0,3)}.${nums.slice(3,6)}.${nums.slice(6,9)}-${nums.slice(9)}`;

  // Calcula BaseDate no fuso BR
  const pDate = {};
  new Intl.DateTimeFormat('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    year: '2-digit', month: 'numeric', day: 'numeric',
  }).formatToParts(agora).forEach(({ type, value }) => { pDate[type] = value; });
  const baseDate = `${pDate.month}/${pDate.day}/${pDate.year}`;

  const variacoes = [
    // attendances/add com token diarista (já testado, 401)
    {
      nome: 'attendances/add — token diarista',
      url:  'https://api1.tradingworks.net/v1/attendances/add',
      token: tokenDiarista,
      payload: [{ CPF: cpf, DataMarcacao, HoraMarcacao, NumeroREP: 'CONTROLID', NSR: '0' }],
    },
    // addattendance sem campo Out
    {
      nome: 'addattendance — sem Out',
      url:  'https://api1.tradingworks.net/v1/timecardcostcenter/addattendance',
      token: tokenDiarista,
      payload: [{ PersonalDocument: cpfMask, Name: 'João Silva', BaseDate: baseDate, In: HoraMarcacao }],
    },
    // addattendance com Out = In (mesmo horário)
    {
      nome: 'addattendance — Out igual ao In',
      url:  'https://api1.tradingworks.net/v1/timecardcostcenter/addattendance',
      token: tokenDiarista,
      payload: [{ PersonalDocument: cpfMask, Name: 'João Silva', BaseDate: baseDate, In: HoraMarcacao, Out: HoraMarcacao }],
    },
    // addattendance com Out vazio como null
    {
      nome: 'addattendance — Out null',
      url:  'https://api1.tradingworks.net/v1/timecardcostcenter/addattendance',
      token: tokenDiarista,
      payload: [{ PersonalDocument: cpfMask, Name: 'João Silva', BaseDate: baseDate, In: HoraMarcacao, Out: null }],
    },
  ];

  const resultados = [];
  for (const v of variacoes) {
    const r = await fetch(v.url, {
      method: 'POST',
      headers: { 'AUTH-TOKEN': v.token, 'Content-Type': 'application/json' },
      body: JSON.stringify(v.payload),
    });
    const texto = await r.text();
    let resp;
    try { resp = JSON.parse(texto); } catch { resp = texto || '(vazio)'; }
    resultados.push({ variacao: v.nome, status: r.status, resposta: resp });
  }

  return res.status(200).json({ resultados });
}
