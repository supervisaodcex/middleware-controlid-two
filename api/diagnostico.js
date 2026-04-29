// api/diagnostico.js — mostra a estrutura bruta do iDSecure
const IDSECURE_LOGIN_URL = 'https://sso-backend.controlid.com.br:5000/api/auth/login';
const IDSECURE_LOGS_URL  = 'https://report.idsecure.com.br:5000/api/v1/accesslog/logs';

export default async function handler(req, res) {
  // 1. Login
  const loginRes = await fetch(IDSECURE_LOGIN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email:    process.env.IDSECURE_EMAIL,
      password: process.env.IDSECURE_PASSWORD,
      systemId: Number(process.env.IDSECURE_SYSTEM_ID || 2),
    }),
  });
  const loginData = await loginRes.json();
  const token = loginData?.Data?.[0]?.token;

  // 2. Busca logs das últimas 2 HORAS para garantir que há dados
  const agora   = Math.floor(Date.now() / 1000);
  const dtStart = agora - (120 * 60); // 2 horas atrás

  const url = `${IDSECURE_LOGS_URL}?pageSize=5&pageNumber=1&sortOrder=desc` +
              `&sortField=Time&dtStart=${dtStart}&dtEnd=${agora}&getPhotos=false`;

  const logsRes  = await fetch(url, {
    headers: { 'Authorization': `Bearer ${token}` },
  });
  const logsData = await logsRes.json();

  return res.status(200).json({
    login_ok:       !!token,
    logs_status:    logsRes.status,
    chaves_raiz:    Object.keys(logsData),
    total_registros: logsData?.total || logsData?.Total || logsData?.count || '?',
    primeiros_2:    (logsData?.logs || logsData?.data || logsData?.items ||
                     logsData?.Data || logsData?.Records || []).slice(0, 2),
    resposta_bruta: JSON.stringify(logsData).slice(0, 1000),
  });
}
