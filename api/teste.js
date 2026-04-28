export default async function handler(req, res) {
  const token  = (process.env.TWO_AUTH_TOKEN || '').trim();
  const cpfRaw = req.query.cpf  || '53944108876';
  const nome   = req.query.nome || 'João Silva';

  const nums    = cpfRaw.replace(/\D/g, '').padStart(11, '0').slice(-11);
  const cpfMask = `${nums.slice(0,3)}.${nums.slice(3,6)}.${nums.slice(6,9)}-${nums.slice(9)}`;

  const agora   = new Date();
  // Formato M/D/YY igual ao Excel do TWO (ex: 4/28/26)
  const mes     = agora.getMonth() + 1;
  const dia     = agora.getDate();
  const ano     = String(agora.getFullYear()).slice(-2);
  const baseDate = `${mes}/${dia}/${ano}`;

  const horaHHMM   = agora.toTimeString().slice(0, 5);
  const horaHHMMSS = agora.toTimeString().slice(0, 8);

  const base = { PersonalDocument: cpfMask, Name: nome, BaseDate: baseDate };

  const variacoes = [
    { nome: 'StartTime HH:MM',            payload: [{ ...base, StartTime:          horaHHMM }] },
    { nome: 'StartTime HH:MM:SS',         payload: [{ ...base, StartTime:          horaHHMMSS }] },
    { nome: 'EntryTime HH:MM',            payload: [{ ...base, EntryTime:          horaHHMM }] },
    { nome: 'horario_de_entrada HH:MM',   payload: [{ ...base, horario_de_entrada: horaHHMM }] },
    { nome: 'hora_entrada HH:MM',         payload: [{ ...base, hora_entrada:       horaHHMM }] },
    { nome: 'Entrada HH:MM',              payload: [{ ...base, Entrada:            horaHHMM }] },
    { nome: 'CheckIn HH:MM',              payload: [{ ...base, CheckIn:            horaHHMM }] },
    { nome: 'HoraMarcacao HH:MM',         payload: [{ ...base, HoraMarcacao:       horaHHMM }] },
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
    resultados.push({ variacao: v.nome, baseDate, resposta: resp });
  }

  return res.status(200).json({ resultados });
}
