export default async function handler(req, res) {
  const token = (process.env.TWO_AUTH_TOKEN || '').trim();

  // Testa 3 variações de autenticação para descobrir qual o TWO aceita
  const testes = [
    {
      nome: 'AUTH-TOKEN no header',
      headers: { 'AUTH-TOKEN': token, 'Content-Type': 'application/json' },
    },
    {
      nome: 'Authorization Bearer',
      headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
    },
    {
      nome: 'Authorization sem Bearer',
      headers: { 'Authorization': token, 'Content-Type': 'application/json' },
    },
  ];

  const resultados = [];

  for (const teste of testes) {
    const r = await fetch('https://api1.tradingworks.net/v1/attendances?Language=pt-br', {
      headers: teste.headers,
    });

    const headersResposta = {};
    r.headers.forEach((v, k) => { headersResposta[k] = v; });
    const corpo = await r.text();

    resultados.push({
      nome:    teste.nome,
      status:  r.status,
      headers: headersResposta,
      corpo:   corpo.slice(0, 200) || '(vazio)',
    });
  }

  return res.status(200).json({ resultados });
}
