import ImageManipulator from 'react-native-image-manipulator';

const CROP_RATIO = 0.4;

function getCropRect(width, height, direction) {
  const cropWidth = Math.floor(width * CROP_RATIO);
  switch (direction) {
    case 'left':
      return {originX: 0, originY: 0, width: cropWidth, height};
    case 'right':
      return {originX: width - cropWidth, originY: 0, width: cropWidth, height};
    case 'center':
    default: {
      const originX = Math.floor((width - cropWidth) / 2);
      return {originX, originY: 0, width: cropWidth, height};
    }
  }
}

export async function cropImageByDirection(imageUri, direction, imageWidth, imageHeight) {
  try {
    const cropRect = getCropRect(imageWidth, imageHeight, direction);
    const result = await ImageManipulator.manipulate(
      imageUri,
      [{crop: cropRect}],
      {compress: 0.8, format: 'jpeg', base64: true},
    );

    const full = await ImageManipulator.manipulate(
      imageUri,
      [],
      {compress: 0.8, format: 'jpeg', base64: true},
    );

    return {
      cropped: result.base64,
      full: full.base64,
    };
  } catch (error) {
    console.error('cropImageByDirection error:', error);
    return {cropped: null, full: null};
  }
}
