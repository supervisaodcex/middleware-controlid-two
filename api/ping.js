// api/ping.js — acesse no browser para confirmar que está no ar
export default function handler(req, res) {
  res.status(200).json({
    status: 'online',
    hora:   new Date().toISOString(),
  });
}
