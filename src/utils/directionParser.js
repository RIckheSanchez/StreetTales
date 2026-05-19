const LEFT_WORDS = ['左边', '左侧', '左面', '左手边', '左手', '左'];
const RIGHT_WORDS = ['右边', '右侧', '右面', '右手边', '右手', '右'];

export function parseDirection(text) {
  if (!text) return 'center';

  for (const word of LEFT_WORDS) {
    if (text.includes(word)) return 'left';
  }
  for (const word of RIGHT_WORDS) {
    if (text.includes(word)) return 'right';
  }
  return 'center';
}
