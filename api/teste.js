// api/teste.js
export default async function handler(req, res) {
  const cpf = req.query.cpf || '53944108876';
  const token = process.env.TWO_AUTH_TOKEN || '';

  // Diagnóstico do token
  const tokenInfo = {
    tamanho:        token.length,
    primeiros_4:    token.slice(0, 4),
    ultimos_4:      token.slice(-4),
    tem_espaco:     token.includes(' '),
    tem_newline:    token.includes('\n'),
  };

  // Testa o GET (listar apontamentos) para verificar o token
  const respostaGet = await fetch('https://api1.tradingworks.net/v1/attendances?Language=pt-br', {
    headers: { 'AUTH-TOKEN': token.trim() },
  });
  const textoGet = await respostaGet.text();

  // Testa o POST (adicionar apontamento)
  const agora = new Date();
  const payload = [{
    CPF: cpf.replace(/\D/g, ''),
    DataMarcacao: agora.toISOString().split('T')[0],
    HoraMarcacao: agora.toTimeString().slice(0, 5),
    NumeroREP: 'TESTE',
    NSR: '0',
  }];

  const respostaPost = await fetch('https://api1.tradingworks.net/v1/attendances/add', {
    method: 'POST',
    headers: {
      'AUTH-TOKEN':   token.trim(),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });
  const textoPost = await respostaPost.text();

  return res.status(200).json({
    token_info:      tokenInfo,
    get_status:      respostaGet.status,
    get_resposta:    textoGet.slice(0, 300) || '(vazio)',
    post_status:     respostaPost.status,
    post_resposta:   textoPost || '(vazio)',
  });
}
