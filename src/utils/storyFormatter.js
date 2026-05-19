const DIGIT_MAP = {
  0: '零', 1: '一', 2: '二', 3: '三', 4: '四',
  5: '五', 6: '六', 7: '七', 8: '八', 9: '九',
};

function digitsToChineseYear(str) {
  // Convert 4-digit years like 1923 → 一九二三
  return str.replace(/\d{4}/g, match =>
    match.split('').map(d => DIGIT_MAP[parseInt(d, 10)]).join(''),
  );
}

function stripMarkdown(text) {
  return text
    .replace(/#{1,6}\s+/g, '')
    .replace(/\*{1,3}([^*]+)\*{1,3}/g, '$1')
    .replace(/_{1,3}([^_]+)_{1,3}/g, '$1')
    .replace(/`[^`]*`/g, '')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/^\s*[-*+]\s+/gm, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function ensureNaturalPauses(text) {
  // Add comma after long clauses without punctuation for better TTS rhythm
  return text.replace(/([^，。！？、\n]{15,20})(?=[^，。！？、\n])/g, '$1，');
}

export function formatForTTS(storyText) {
  if (!storyText) return '';
  let result = stripMarkdown(storyText);
  result = digitsToChineseYear(result);
  result = ensureNaturalPauses(result);
  return result;
}
