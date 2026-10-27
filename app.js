// app.js – 화면 동작 (목록 그리기, 일정 추가)

let tasks = [];
let weatherByRegion = {};

async function loadWeather() {
  const status = document.getElementById('weatherStatus');
  const testWind = new URLSearchParams(window.location.search).get('test') === 'wind';
  const failed = [];
  status.textContent = '오늘 날씨를 불러오는 중입니다.';

  await Promise.all(Object.keys(REGIONS).map(async (region) => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);
    try {
      const response = await fetch(buildWeatherUrl(region), { signal: controller.signal });
      if (!response.ok) throw new Error('날씨 요청 실패');
      const weather = parseWeatherResponse(await response.json());
      if (testWind) weather.windMax = 12;
      weatherByRegion[region] = weather;
      renderTasks();
    } catch (error) {
      failed.push(region);
    } finally {
      clearTimeout(timeout);
    }
  }));

  status.textContent = failed.length
    ? '날씨를 불러오지 못한 지역: ' + failed.join(' · ') + '. 새로고침하여 다시 시도해 주세요.'
    : '세종 · 대전 · 태안 · 보령의 오늘 날씨 (한국 시간 기준)';
  if (testWind) status.textContent += ' · 강풍 시험 모드: 수신한 풍속을 12m/s로 표시';
}

function readAddedTasks() {
  try {
    const saved = JSON.parse(localStorage.getItem('wx_added') || '[]');
    return Array.isArray(saved) ? saved : [];
  } catch (error) {
    return [];
  }
}

async function loadTasks() {
  const status = document.getElementById('taskStatus');
  status.textContent = '일정 목록을 불러오는 중입니다.';
  let baseTasks = [];
  try {
    const response = await fetch('data/tasks.json');
    if (!response.ok) throw new Error('일정 파일 요청 실패');
    const data = await response.json();
    if (!Array.isArray(data) || !data.every(task => task &&
        ['title', 'region', 'kind', 'owner'].every(key => typeof task[key] === 'string'))) {
      throw new Error('올바르지 않은 일정 데이터');
    }
    baseTasks = data;
    status.textContent = '';
  } catch (error) {
    status.textContent = '일정 파일을 읽지 못했습니다. 배포 주소로 열어 주세요';
  }
  // JSON을 먼저 읽고, 화면에서 추가해 브라우저에 저장한 일정만 뒤에 합칩니다.
  tasks = baseTasks.concat(readAddedTasks());
  renderTasks();
}

function weatherText(w) {
  return w ? w.tempMax + '℃ · ' + w.windMax + 'm/s · ' + w.rainProb + '%' : '-';
}

function renderTasks() {
  const body = document.getElementById('taskList');
  body.innerHTML = '';
  for (const t of tasks) {
    const w = weatherByRegion[t.region];
    const r = judge(t.kind, w);
    const tr = document.createElement('tr');
    for (const v of [t.title, t.region, t.kind, t.owner, weatherText(w)]) {
      const td = document.createElement('td');
      td.textContent = v;
      tr.appendChild(td);
    }
    const td = document.createElement('td');
    td.textContent = r.text;
    td.className = r.level;
    tr.appendChild(td);
    body.appendChild(tr);
  }
}

function addTask(e) {
  e.preventDefault();
  const t = {
    title: document.getElementById('titleInput').value.trim(),
    region: document.getElementById('regionInput').value,
    kind: document.getElementById('kindInput').value,
    owner: document.getElementById('ownerInput').value.trim(),
  };
  if (!t.title || !t.owner) return;
  const saved = readAddedTasks();
  saved.push(t);
  localStorage.setItem('wx_added', JSON.stringify(saved));
  e.target.reset();
  tasks.push(t);
  renderTasks();
}

const today = new Date();
const todayText = [
  today.getFullYear(),
  String(today.getMonth() + 1).padStart(2, '0'),
  String(today.getDate()).padStart(2, '0'),
].join('-');
const todayDate = document.getElementById('todayDate');
todayDate.textContent = todayText;
todayDate.dateTime = todayText;

document.getElementById('taskForm').addEventListener('submit', addTask);
loadTasks();
renderTasks();
loadWeather();
