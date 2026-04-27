// api/teste.js
// Teste via GET no navegador:
// https://seu-app.vercel.app/api/teste?cpf=53944108876

const TWO_AUTH_TOKEN = process.env.TWO_AUTH_TOKEN;
const TWO_API_URL = 'https://api1.tradingworks.net/v1/attendances/add';

export default async function handler(req, res) {
  const cpf = req.query.cpf;

  if (!cpf) {
    return res.status(400).json({
      error: 'Informe o CPF na URL',
      exemplo: '/api/teste?cpf=53944108876'
    });
  }

  const agora      = new Date();
  const DataMarcacao = agora.toISOString().split('T')[0];
  const HoraMarcacao = agora.toTimeString().slice(0, 5);

  const payloadTWO = [{
    NumeroREP: 'TESTE',
    NSR: '0',
    CPF: cpf.replace(/\D/g, ''),
    DataMarcacao,
    HoraMarcacao,
  }];

  try {
    const response = await fetch(TWO_API_URL, {
      method: 'POST',
      headers: {
        'AUTH-TOKEN': TWO_AUTH_TOKEN,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payloadTWO),
    });

    const resultado = await response.json();

    return res.status(200).json({
      status: 'Requisição enviada ao TWO',
      payload_enviado: payloadTWO,
      resposta_two: resultado,
    });

  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
