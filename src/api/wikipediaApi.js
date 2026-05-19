const ZH_BASE = 'https://zh.wikipedia.org/api/rest_v1/page/summary';
const EN_BASE = 'https://en.wikipedia.org/api/rest_v1/page/summary';
const EN_API = 'https://en.wikipedia.org/w/api.php';

export async function searchWikipedia(keyword, language = 'zh') {
  if (!keyword) return null;

  const encoded = encodeURIComponent(keyword);

  // Try Chinese first, fallback to English
  const urls =
    language === 'zh'
      ? [`${ZH_BASE}/${encoded}`, `${EN_BASE}/${encoded}`]
      : [`${EN_BASE}/${encoded}`];

  for (const url of urls) {
    try {
      const response = await fetch(url, {
        headers: {'Accept': 'application/json'},
      });
      if (!response.ok) continue;
      const data = await response.json();
      if (data.type === 'https://mediawiki.org/wiki/HyperSwitch/errors/not_found') {
        continue;
      }
      return {
        title: data.title || keyword,
        extract: data.extract || '',
        thumbnail: data.thumbnail?.source || null,
      };
    } catch {
      continue;
    }
  }

  return null;
}

export async function searchWikipediaByCoords(lat, lng) {
  if (lat == null || lng == null) return [];

  try {
    const params = new URLSearchParams({
      action: 'query',
      list: 'geosearch',
      gscoord: `${lat}|${lng}`,
      gsradius: '500',
      gslimit: '5',
      format: 'json',
      origin: '*',
    });

    const response = await fetch(`${EN_API}?${params}`, {
      headers: {'Accept': 'application/json'},
    });
    if (!response.ok) return [];

    const data = await response.json();
    return data?.query?.geosearch || [];
  } catch (error) {
    console.error('searchWikipediaByCoords error:', error);
    return [];
  }
}
