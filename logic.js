// logic.js – 날씨 API 주소·응답 해석과 판단 규칙 (화면을 다루는 코드 금지)

const REGIONS = {
  '세종': { latitude: 36.4800, longitude: 127.2890 },
  '대전': { latitude: 36.3504, longitude: 127.3845 },
  '태안': { latitude: 36.7456, longitude: 126.2980 },
  '보령': { latitude: 36.3335, longitude: 126.6120 },
};

function buildWeatherUrl(region) {
  const coordinates = REGIONS[region];
  if (!coordinates) throw new Error('알 수 없는 지역');
  const params = new URLSearchParams({
    latitude: coordinates.latitude,
    longitude: coordinates.longitude,
    daily: 'temperature_2m_max,wind_speed_10m_max,precipitation_probability_max',
    temperature_unit: 'celsius',
    wind_speed_unit: 'ms',
    timezone: 'Asia/Seoul',
    forecast_days: '1',
  });
  return 'https://api.open-meteo.com/v1/forecast?' + params;
}

function parseWeatherResponse(data) {
  const daily = data && data.daily;
  const weather = {
    tempMax: daily?.temperature_2m_max?.[0],
    windMax: daily?.wind_speed_10m_max?.[0],
    rainProb: daily?.precipitation_probability_max?.[0],
  };
  if (!Object.values(weather).every(Number.isFinite) ||
      weather.windMax < 0 || weather.rainProb < 0 || weather.rainProb > 100) {
    throw new Error('날씨 응답에 유효한 값이 없습니다.');
  }
  return weather;
}

// 교육용 가상 기준 (실제 작업 중지 · 행사 취소 기준은 각 기관 규정을 따름)
const RULES = { wind: 10, rain: 60, heat: 33 };

// 일정 구분과 날씨로 판단 (w가 없으면 '날씨 확인 전')
function judge(kind, w) {
  if (kind === '실내') return { level: 'ok', text: '영향 없음' };
  if (!w) return { level: 'none', text: '날씨 확인 전' };
  if (kind === '고소' && w.windMax >= RULES.wind) return { level: 'stop', text: '중지 검토 (강풍)' };
  if (w.tempMax >= RULES.heat) return { level: 'warn', text: '폭염 휴식' };
  if (w.rainProb >= RULES.rain) return { level: 'warn', text: '우천 주의' };
  return { level: 'ok', text: '진행' };
}

// 화면의 표에서 전달받은 문자열로 마크다운을 만듭니다. DOM은 다루지 않습니다.
function buildJudgmentMarkdown(rows, date) {
  const escapeCell = value => String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/[\\|`*_\[\]]/g, '\\$&')
    .replace(/\r\n|\r|\n/g, '<br>');
  const lines = [
    '# 현장 일정 판단 ' + date,
    '',
    '| 일정 | 지역 | 구분 | 담당 | 날씨 | 판단 |',
    '| --- | --- | --- | --- | --- | --- |',
    ...rows.map(row => '| ' + row.map(escapeCell).join(' | ') + ' |'),
    '',
    '판단 기준: 고소 작업 최대 풍속 ' + RULES.wind + 'm/s 이상 → 중지 검토 · 최대 강수확률 ' +
      RULES.rain + '% 이상 → 우천 주의 · 최고 기온 ' + RULES.heat +
      '℃ 이상 → 폭염 휴식 (실내는 영향 없음, 우선순위: 강풍 → 폭염 → 우천).',
    '',
  ];
  return lines.join('\n');
}

if (typeof module !== 'undefined') {
  module.exports = { REGIONS, buildWeatherUrl, parseWeatherResponse, RULES, judge, buildJudgmentMarkdown };
}
