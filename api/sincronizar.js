// api/sincronizar.js
const TWO_AUTH_TOKEN     = process.env.TWO_AUTH_TOKEN;
const TWO_API_URL        = 'https://api1.tradingworks.net/v1/timecardcostcenter/addattendance';
const COST_CENTER        = process.env.COST_CENTER || 'BRE_BLITZ_DIA';
const IDSECURE_LOGIN_URL = 'https://sso-backend.controlid.com.br:5000/api/auth/login';
const IDSECURE_LOGS_URL  = 'https://report.idsecure.com.br:5000/api/v1/accesslog/logs';

function formatarCPF(valor) {
  const nums = String(valor).replace(/\D/g, '').padStart(11, '0').slice(-11);
  return `${nums.slice(0,3)}.${nums.slice(3,6)}.${nums.slice(6,9)}-${nums.slice(9)}`;
}

function extrairDataHora(timeStr) {
  // iDSecure já retorna horário local de Brasília: "2026-04-29T14:37:00"
  // Basta extrair diretamente sem converter fuso
  const [datePart, timePart] = timeStr.split('T');
  const [ano, mes, dia] = datePart.split('-');
  const hora = timePart.slice(0, 5); // "14:37"

  // Formato da data para o TWO: M/D/YY
  const baseDate = `${parseInt(mes)}/${parseInt(dia)}/${ano.slice(-2)}`;

  return { baseDate, hora };
}

async function loginIDSecure() {
  const r = await fetch(IDSECURE_LOGIN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email:    process.env.IDSECURE_EMAIL,
      password: process.env.IDSECURE_PASSWORD,
      systemId: Number(process.env.IDSECURE_SYSTEM_ID || 2),
    }),
  });
  const data = await r.json();
  const token = data?.Data?.[0]?.token;
  if (!token) throw new Error('Token não encontrado no login');
  return token;
}

async function buscarAcessos(bearerToken, minutosAtras = 10) {
  const agora   = Math.floor(Date.now() / 1000);
  const dtStart = agora - (minutosAtras * 60);

  const url = `${IDSECURE_LOGS_URL}?pageSize=100&pageNumber=1&sortOrder=asc` +
              `&sortField=Time&dtStart=${dtStart}&dtEnd=${agora}&getPhotos=false`;

  const r    = await fetch(url, { headers: { 'Authorization': `Bearer ${bearerToken}` } });
  const data = await r.json();
  return data?.data?.data || [];
}

async function enviarParaTWO(acessos) {
  const payload = acessos
    .filter(a => a.eventDescription === 'AccessGranted')
    .map(a => {
      const cpfBruto = a.personDocuments?.[0]?.value ||
                       a.documentDescValue?.match(/CPF=(\d+)/)?.[1] || '';
      const nome     = a.personName || '';
      const { baseDate, hora } = extrairDataHora(a.time);

      return {
        PersonalDocument: formatarCPF(cpfBruto),
        Name:             nome,
        BaseDate:         baseDate,
        In:               hora,
        Out:              hora,
        InPause:          '',
        OutPause:         '',
        CostCenterCode:   COST_CENTER,
        LocaleCode:       '',
      };
    })
    .filter(a => a.PersonalDocument !== '000.000.000-00');

  if (!payload.length) return { enviados: 0, erros: [], total_payload: 0 };

  console.log('📤 Enviando para TWO:', JSON.stringify(payload, null, 2));

  const r = await fetch(TWO_API_URL, {
    method: 'POST',
    headers: { 'AUTH-TOKEN': TWO_AUTH_TOKEN, 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  const texto = await r.text();
  let resultado;
  try { resultado = JSON.parse(texto); } catch { resultado = texto; }

  return {
    enviados:      resultado?.ProcessedRecords || 0,
    erros:         resultado?.Errors           || [],
    total_payload: payload.length,
    resposta_two:  resultado,
  };
}

export default async function handler(req, res) {
  console.log('🔄 Sincronização iniciada:', new Date().toISOString());
  const inicio = Date.now();

  try {
    const token   = await loginIDSecure();
    const acessos = await buscarAcessos(token, 10);
    console.log(`📋 ${acessos.length} acessos encontrados`);

    let resultado = { enviados: 0, erros: [], total_payload: 0 };
    if (acessos.length > 0) {
      resultado = await enviarParaTWO(acessos);
      console.log('✅ Resultado TWO:', JSON.stringify(resultado));
    }

    return res.status(200).json({
      ok:                  true,
      timestamp:           new Date().toISOString(),
      duracao_ms:          Date.now() - inicio,
      acessos_encontrados: acessos.length,
      ...resultado,
    });

  } catch (err) {
    console.error('❌ Erro:', err.message);
    return res.status(500).json({ error: err.message });
  }
}
