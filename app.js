// app.js – 화면 동작 (목록 그리기, 일정 추가)

let tasks = [];
let weatherByRegion = {};
let taskClient;
let tasksLoading = false;
let taskSaving = false;

function getTaskClient() {
  if (taskClient) return taskClient;
  if (typeof SUPABASE_URL === 'undefined' || !SUPABASE_URL ||
      typeof SUPABASE_PUBLIC_KEY === 'undefined' || !SUPABASE_PUBLIC_KEY) {
    throw new Error('config.js에 Supabase 주소와 공개용 키를 입력해 주세요.');
  }
  let publicKey = SUPABASE_PUBLIC_KEY.startsWith('sb_publishable_');
  if (!publicKey) {
    try {
      const payload = SUPABASE_PUBLIC_KEY.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
      publicKey = JSON.parse(atob(payload)).role === 'anon';
    } catch (error) {
      publicKey = false;
    }
  }
  if (!publicKey) throw new Error('config.js에는 publishable 또는 anon 공개용 키만 사용해 주세요.');
  if (!window.supabase) throw new Error('Supabase 스크립트를 불러오지 못했습니다. 인터넷 연결을 확인해 주세요.');
  taskClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_PUBLIC_KEY, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  return taskClient;
}

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

async function loadTasks() {
  const status = document.getElementById('taskStatus');
  const button = document.getElementById('addTaskButton');
  tasksLoading = true;
  button.disabled = true;
  status.textContent = '일정 목록을 불러오는 중입니다.';
  try {
    const client = getTaskClient();
    const { data, error } = await client.from('wx_tasks')
      .select('id,title,region,kind,owner').order('id', { ascending: true });
    if (error) throw new Error('일정을 불러오지 못했습니다. 연결 설정과 setup.sql 실행 여부를 확인하고 새로고침해 주세요.');
    tasks = data;
    status.textContent = '';
  } catch (error) {
    status.textContent = error.message;
  } finally {
    tasksLoading = false;
    button.disabled = taskSaving;
    renderTasks();
  }
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

async function addTask(e) {
  e.preventDefault();
  if (tasksLoading || taskSaving) return;
  const t = {
    title: document.getElementById('titleInput').value.trim(),
    region: document.getElementById('regionInput').value,
    kind: document.getElementById('kindInput').value,
    owner: document.getElementById('ownerInput').value.trim(),
  };
  if (!t.title || !t.owner) return;
  const form = e.target;
  const button = document.getElementById('addTaskButton');
  const message = document.getElementById('msgBox');
  taskSaving = true;
  button.disabled = true;
  message.textContent = '일정을 저장하는 중입니다.';
  try {
    const client = getTaskClient();
    const { data, error } = await client.from('wx_tasks').insert(t)
      .select('id,title,region,kind,owner').single();
    if (error) throw new Error('저장하지 못했습니다. 연결과 지역·구분 값을 확인한 뒤 다시 시도해 주세요.');
    tasks.push(data);
    form.reset();
    renderTasks();
    message.textContent = '일정을 저장했습니다.';
  } catch (error) {
    message.textContent = error.message;
  } finally {
    taskSaving = false;
    button.disabled = tasksLoading;
  }
}

function downloadJudgmentMarkdown() {
  const rows = Array.from(document.getElementById('taskList').rows,
    row => Array.from(row.cells, cell => cell.textContent));
  const date = document.getElementById('todayDate').dateTime;
  const markdown = buildJudgmentMarkdown(rows, date);
  const url = URL.createObjectURL(new Blob([markdown], { type: 'text/markdown;charset=utf-8' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = '현장일정_판단_' + date + '.md';
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
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
document.getElementById('downloadJudgment').addEventListener('click', downloadJudgmentMarkdown);
loadTasks();
renderTasks();
loadWeather();
