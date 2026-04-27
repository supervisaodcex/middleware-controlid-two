export default async function handler(req, res) {
  const tokenEnv  = process.env.TWO_AUTH_TOKEN || '';
  const cpf       = req.query.cpf || '53944108876';

  // Teste 1 — usando variável de ambiente
  const r1 = await fetch('https://api1.tradingworks.net/v1/attendances?Language=pt-br', {
    headers: { 'AUTH-TOKEN': tokenEnv.trim() },
  });
  const t1 = await r1.text();

  // Teste 2 — POST com variável de ambiente
  const agora = new Date();
  const r2 = await fetch('https://api1.tradingworks.net/v1/attendances/add', {
    method: 'POST',
    headers: { 'AUTH-TOKEN': tokenEnv.trim(), 'Content-Type': 'application/json' },
    body: JSON.stringify([{
      CPF: cpf.replace(/\D/g, ''),
      DataMarcacao: agora.toISOString().split('T')[0],
      HoraMarcacao: agora.toTimeString().slice(0, 5),
      NumeroREP: 'TESTE',
      NSR: '0',
    }]),
  });
  const t2 = await r2.text();

  return res.status(200).json({
    token_env: {
      valor:       tokenEnv,   // mostra o token completo para confirmar
      tamanho:     tokenEnv.length,
    },
    get_status:   r1.status,
    get_corpo:    t1 || '(vazio)',
    post_status:  r2.status,
    post_corpo:   t2 || '(vazio)',
  });
}
