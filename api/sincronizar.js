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

function formatarDataHoraBR(timestamp) {
  const d = new Date(timestamp);
  const p = {};
  new Intl.DateTimeFormat('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    year: '2-digit', month: 'numeric', day: 'numeric',
    hour: '2-digit', minute: '2-digit', hour12: false,
  }).formatToParts(d).forEach(({ type, value }) => { p[type] = value; });
  return {
    baseDate: `${p.month}/${p.day}/${p.year}`,
    hora:     `${p.hour}:${p.minute}`,
  };
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

  if (!r.ok) throw new Error(`Login iDSecure falhou: HTTP ${r.status}`);
  const data = await r.json();

  // Estrutura real: { Data: [{ token: "..." }] }
  const token =
    data?.Data?.[0]?.token ||
    data?.data?.[0]?.token ||
    data?.token            ||
    data?.accessToken      ||
    null;

  if (!token) throw new Error('Token não encontrado: ' + JSON.stringify(data).slice(0, 200));
  return token;
}

async function buscarAcessos(bearerToken, minutosAtras = 10) {
  const agora   = Math.floor(Date.now() / 1000);
  const dtStart = agora - (minutosAtras * 60);

  const url = `${IDSECURE_LOGS_URL}?pageSize=100&pageNumber=1&sortOrder=asc` +
              `&sortField=Time&dtStart=${dtStart}&dtEnd=${agora}&getPhotos=false`;

  const r = await fetch(url, {
    headers: { 'Authorization': `Bearer ${bearerToken}` },
  });

  if (!r.ok) throw new Error(`Erro ao buscar logs: HTTP ${r.status}`);
  const data = await r.json();

  // Log da estrutura real para diagnóstico
  console.log('📄 Estrutura da resposta logs:', JSON.stringify(data).slice(0, 500));

  return data?.logs || data?.data || data?.items || data?.Data || (Array.isArray(data) ? data : []);
}

async function enviarParaTWO(acessos) {
  const payload = acessos.map(a => {
    const cpfBruto  = a.cpf || a.document || a.personalDocument ||
                      a.PersonalDocument || a.person?.cpf || '';
    const nome      = a.name || a.personName || a.Name ||
                      a.person?.name || '';
    const timestamp = a.time || a.dateTime || a.eventDateTime ||
                      a.Time || a.DateTime || a.createdAt || new Date().toISOString();
    const { baseDate, hora } = formatarDataHoraBR(timestamp);

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
  }).filter(a => a.PersonalDocument !== '000.000.000-00');

  if (!payload.length) return { enviados: 0, erros: [], total_payload: 0 };

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
    console.log('🔑 Login iDSecure...');
    const token = await loginIDSecure();
    console.log('✅ Login OK');

    console.log('📋 Buscando acessos últimos 10min...');
    const acessos = await buscarAcessos(token, 10);
    console.log(`📋 ${acessos.length} acessos encontrados`);

    if (acessos.length > 0) {
      console.log('📄 Exemplo:', JSON.stringify(acessos[0], null, 2));
    }

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
