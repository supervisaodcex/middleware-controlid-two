export default async function handler(req, res) {
  try {
    // 1. Login
    const loginRes = await fetch('https://sso-backend.controlid.com.br:5000/api/auth/login', {
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

    // 2. Busca logs — últimas 2 horas, só 3 registros
    const agora   = Math.floor(Date.now() / 1000);
    const dtStart = agora - (120 * 60);
    const url = `https://report.idsecure.com.br:5000/api/v1/accesslog/logs?pageSize=3&pageNumber=1&sortOrder=desc&sortField=Time&dtStart=${dtStart}&dtEnd=${agora}&getPhotos=false`;

    const logsRes  = await fetch(url, { headers: { 'Authorization': `Bearer ${token}` } });
    const logsText = await logsRes.text();

    // Retorna tudo bruto para inspeção
    return res.status(200).json({
      login_ok:    !!token,
      logs_status: logsRes.status,
      logs_bruto:  logsText.slice(0, 2000),
    });

  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
