type Candidate = {
  id: string;
  title: string;
  category: string;
  distanceKm: number;
  rating: number;
  availability: string;
  verified: boolean;
};

type Recommendation = {
  id: string;
  reason: string;
};

function localRanking(candidates: Candidate[]): Recommendation[] {
  return [...candidates]
    .sort((left, right) => {
      const leftScore = left.rating * 10 + (left.verified ? 3 : 0) - left.distanceKm;
      const rightScore = right.rating * 10 + (right.verified ? 3 : 0) - right.distanceKm;
      return rightScore - leftScore;
    })
    .slice(0, 3)
    .map(candidate => ({
      id: candidate.id,
      reason: `${candidate.distanceKm.toFixed(1)} km away, ${candidate.rating.toFixed(1)} rating${candidate.verified ? ', verified' : ''}.`,
    }));
}

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed.' });
  }

  const candidates: Candidate[] = Array.isArray(req.body?.candidates)
    ? req.body.candidates.slice(0, 12).filter((candidate: unknown): candidate is Candidate => {
        if (!candidate || typeof candidate !== 'object') return false;
        const item = candidate as Candidate;
        return typeof item.id === 'string' && item.id.length <= 80
          && typeof item.title === 'string' && item.title.length <= 120
          && typeof item.category === 'string' && item.category.length <= 80
          && Number.isFinite(item.distanceKm) && item.distanceKm >= 0 && item.distanceKm <= 500
          && Number.isFinite(item.rating) && item.rating >= 0 && item.rating <= 5
          && typeof item.availability === 'string' && item.availability.length <= 80
          && typeof item.verified === 'boolean';
      })
    : [];
  const fallback = localRanking(candidates);
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey || !candidates.length) {
    return res.status(200).json({
      configured: false,
      recommendations: fallback,
      message: 'Nearby vehicles are ranked by distance, rating, and verification.',
    });
  }

  const allowedIds = new Set(candidates.map(candidate => candidate.id));
  const prompt = [
    'You rank equipment candidates for a customer booking.',
    'Return JSON only: {"recommendations":[{"id":"candidate id","reason":"short reason under 18 words"}]}.',
    'Choose up to three candidates. Prefer ready, verified, nearby, highly rated equipment.',
    `Candidates: ${JSON.stringify(candidates)}`,
  ].join('\n');

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${process.env.GEMINI_MODEL || 'gemini-2.5-flash'}:generateContent`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': apiKey,
        },
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [{ text: prompt }] }],
          generationConfig: { responseMimeType: 'application/json', temperature: 0.2 },
        }),
      },
    );

    if (!response.ok) throw new Error(`Gemini request failed with ${response.status}`);
    const payload = await response.json();
    const text = payload?.candidates?.[0]?.content?.parts?.[0]?.text;
    const parsed = JSON.parse(String(text || '{}'));
    const recommendations = Array.isArray(parsed.recommendations)
      ? parsed.recommendations
          .filter((item: unknown): item is Recommendation => Boolean(item && typeof item === 'object' && allowedIds.has((item as Recommendation).id) && typeof (item as Recommendation).reason === 'string'))
          .slice(0, 3)
      : [];

    return res.status(200).json({
      configured: true,
      recommendations: recommendations.length ? recommendations : fallback,
      message: recommendations.length ? 'Gemini ranked these nearby choices for this booking.' : 'Nearby vehicles are ranked by distance, rating, and verification.',
    });
  } catch {
    return res.status(200).json({
      configured: false,
      recommendations: fallback,
      message: 'Gemini is temporarily unavailable, so nearby vehicles are ranked by distance, rating, and verification.',
    });
  }
}
