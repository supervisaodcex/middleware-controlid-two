// api/sincronizar.js
// Busca acessos no iDSecure e envia para o TWO
// Pode ser chamado por cron externo (cron-job.org) a cada 5 minutos:
// GET https://seu-app.vercel.app/api/sincronizar

const TWO_AUTH_TOKEN  = process.env.TWO_AUTH_TOKEN;
const TWO_API_URL     = 'https://api1.tradingworks.net/v1/timecardcostcenter/addattendance';
const COST_CENTER     = process.env.COST_CENTER || 'BRE_BLITZ_DIA';

const IDSECURE_LOGIN_URL = 'https://sso-backend.controlid.com.br:5000/api/auth/login';
const IDSECURE_LOGS_URL  = 'https://report.idsecure.com.br:5000/api/v1/accesslog/logs';

// ─── Helpers ──────────────────────────────────────────────────────────────────

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

// ─── 1. Login no iDSecure ─────────────────────────────────────────────────────

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

  // O token pode estar em data.token, data.accessToken ou data.data.token
  const token = data.token || data.accessToken || data.data?.token || null;
  if (!token) throw new Error('Token não encontrado na resposta do login: ' + JSON.stringify(data));
  return token;
}

// ─── 2. Buscar logs dos últimos N minutos ──────────────────────────────────────

async function buscarAcessos(bearerToken, minutosAtras = 10) {
  const agora     = Math.floor(Date.now() / 1000);
  const dtStart   = agora - (minutosAtras * 60);
  const dtEnd     = agora;

  const url = `${IDSECURE_LOGS_URL}?pageSize=100&pageNumber=1&sortOrder=asc&sortField=Time` +
              `&dtStart=${dtStart}&dtEnd=${dtEnd}&getPhotos=false`;

  const r = await fetch(url, {
    headers: { 'Authorization': `Bearer ${bearerToken}` },
  });

  if (!r.ok) throw new Error(`Erro ao buscar logs iDSecure: HTTP ${r.status}`);
  const data = await r.json();

  // Retorna o array de logs (ajuste o campo conforme resposta real)
  return data.logs || data.data || data.items || data || [];
}

// ─── 3. Enviar para o TWO ─────────────────────────────────────────────────────

async function enviarParaTWO(acessos) {
  if (!acessos.length) return { enviados: 0, erros: [] };

  const payload = acessos.map(a => {
    // Campos possíveis do iDSecure — ajuste se necessário após ver o payload real
    const cpfBruto  = a.cpf || a.document || a.personalDocument || a.person?.cpf || '';
    const nome      = a.name || a.personName || a.person?.name || '';
    const timestamp = a.time || a.dateTime || a.eventDateTime || a.createdAt || new Date().toISOString();
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
  }).filter(a => a.PersonalDocument !== '000.000.000-00'); // ignora sem CPF

  if (!payload.length) return { enviados: 0, erros: [] };

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
    erros:         resultado?.Errors || [],
    total_payload: payload.length,
    resposta_two:  resultado,
  };
}

// ─── Handler principal ────────────────────────────────────────────────────────

export default async function handler(req, res) {
  const inicio = Date.now();
  console.log('🔄 Sincronização iniciada:', new Date().toISOString());

  try {
    // 1. Login
    console.log('🔑 Fazendo login no iDSecure...');
    const token = await loginIDSecure();
    console.log('✅ Login OK');

    // 2. Buscar acessos dos últimos 10 minutos
    console.log('📋 Buscando acessos...');
    const acessos = await buscarAcessos(token, 10);
    console.log(`📋 ${acessos.length} acessos encontrados`);

    if (acessos.length > 0) {
      console.log('📄 Exemplo de acesso recebido:', JSON.stringify(acessos[0], null, 2));
    }

    // 3. Enviar para TWO
    let resultado = { enviados: 0, erros: [] };
    if (acessos.length > 0) {
      console.log('📤 Enviando para TWO...');
      resultado = await enviarParaTWO(acessos);
      console.log('✅ TWO respondeu:', JSON.stringify(resultado, null, 2));
    }

    const duracao = Date.now() - inicio;
    return res.status(200).json({
      ok:          true,
      timestamp:   new Date().toISOString(),
      duracao_ms:  duracao,
      acessos_encontrados: acessos.length,
      ...resultado,
    });

  } catch (err) {
    console.error('❌ Erro na sincronização:', err.message);
    return res.status(500).json({ error: err.message });
  }
}
