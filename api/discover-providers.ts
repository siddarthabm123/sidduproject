import { authenticatedDatabase, ServiceError, serviceStatus } from '../server-supabase.js';

type Provider = {
  id: string;
  name: string;
  address: string;
  rating: number | null;
  reviewCount: number | null;
  mapsUrl: string;
};

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed.' });
  }

  const apiKey = process.env.GOOGLE_PLACES_API_KEY;
  if (!apiKey) {
    return res.status(200).json({
      configured: false,
      providers: [],
      message: 'Google Places discovery is not connected yet.',
    });
  }

  const category = String(req.body?.category || 'heavy equipment').replace(/[^a-zA-Z0-9 &-]/g, '').slice(0, 80);
  const latitude = Number(req.body?.latitude);
  const longitude = Number(req.body?.longitude);
  if (req.body?.latitude==null||req.body?.longitude==null||String(req.body.latitude).trim()===''||String(req.body.longitude).trim()===''||!Number.isFinite(latitude) || !Number.isFinite(longitude) || latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
    return res.status(400).json({ error: 'A valid search location is required.' });
  }

  try {
    const db=await authenticatedDatabase(req);
    const quota=await db.rpc('claim_provider_request',{p_service:'places'});
    if(quota.error)throw new ServiceError('Provider discovery is temporarily unavailable.',503);
    if(quota.data!==true)throw new ServiceError('Too many requests. Please retry later.',429,60);
    const response = await fetch('https://places.googleapis.com/v1/places:searchText', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': apiKey,
        'X-Goog-FieldMask': 'places.id,places.displayName,places.formattedAddress,places.rating,places.userRatingCount,places.googleMapsUri',
      },
      body: JSON.stringify({
        textQuery: `${category} rental and service providers`,
        maxResultCount: 5,
        languageCode: 'en',
        locationBias: {
          circle: { center: { latitude, longitude }, radius: 15000 },
        },
      }),
      signal: AbortSignal.timeout(10000),
    });

    if (!response.ok) throw new ServiceError('Provider discovery is temporarily unavailable.',response.status===429?429:503,60);
    const result = await response.json();
    const providers: Provider[] = (Array.isArray(result.places) ? result.places : [])
      .map((place: any) => ({
        id: String(place.id || ''),
        name: String(place.displayName?.text || 'Equipment provider'),
        address: String(place.formattedAddress || 'Address unavailable'),
        rating: typeof place.rating === 'number' ? place.rating : null,
        reviewCount: typeof place.userRatingCount === 'number' ? place.userRatingCount : null,
        mapsUrl: String(place.googleMapsUri || ''),
      }))
      .filter((provider: Provider) => provider.id && provider.mapsUrl);

    res.setHeader('Cache-Control', 'private, max-age=300');
    return res.status(200).json({ configured: true, providers });
  } catch (error) {
    if(error instanceof ServiceError&&error.retryAfter)res.setHeader('Retry-After',String(error.retryAfter));
    return res.status(serviceStatus(error)).json({
      configured: false,
      providers: [],
      message: 'Provider discovery is temporarily unavailable.',
      error:error instanceof ServiceError?error.message:'Provider discovery is temporarily unavailable.',
    });
  }
}
