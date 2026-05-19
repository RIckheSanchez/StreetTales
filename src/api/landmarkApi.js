import Config from 'react-native-config';

const VISION_ENDPOINT = 'https://vision.googleapis.com/v1/images:annotate';

export async function detectLandmark(base64Image) {
  if (!Config.GOOGLE_VISION_KEY) return null;

  try {
    const body = {
      requests: [
        {
          image: {content: base64Image},
          features: [{type: 'LANDMARK_DETECTION', maxResults: 1}],
        },
      ],
    };

    const response = await fetch(
      `${VISION_ENDPOINT}?key=${Config.GOOGLE_VISION_KEY}`,
      {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify(body),
      },
    );

    if (!response.ok) return null;

    const data = await response.json();
    const landmarks = data?.responses?.[0]?.landmarkAnnotations;
    if (!landmarks || landmarks.length === 0) return null;

    const top = landmarks[0];
    const location = top.locations?.[0]?.latLng;

    return {
      name: top.description,
      confidence: top.score,
      lat: location?.latitude ?? null,
      lng: location?.longitude ?? null,
    };
  } catch (error) {
    console.error('detectLandmark error:', error);
    return null;
  }
}
