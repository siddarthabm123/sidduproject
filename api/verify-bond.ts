import { verifyBondToken } from '../bond-signature.js';

export default function handler(req: any, res: any) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method not allowed.' });
  }
  const token = Array.isArray(req.query?.token) ? req.query.token[0] : req.query?.token;
  const bond = verifyBondToken(String(token || ''));
  if (!bond) {
    return res.status(400).json({ verified: false, error: 'The bond signature is missing or invalid.' });
  }
  return res.status(200).json({ verified: true, bond });
}
