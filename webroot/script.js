import { exec, spawn, fullScreen } from './js/kernelsu.js';
import en from './translations/en.js';
import ar from './translations/ar.js';
import zh from './translations/zh.js';
import ru from './translations/ru.js';

const translations = { en, ar, zh, ru };
const RTL_LANGS = ['ar'];
let currentLang = localStorage.getItem('meowzygisk-lang') || 'en';

function t(key) {
  return translations[currentLang]?.[key] ?? translations.en[key] ?? key;
}

const DIGIT_MAPS = { ar: ['٠','١','٢','٣','٤','٥','٦','٧','٨','٩'], zh: ['０','１','２','３','４','５','６','７','８','９'], ru: ['0','1','2','3','4','5','6','7','8','9'], en: ['0','1','2','3','4','5','6','7','8','9'] };
function localizeDigits(value) { const map = DIGIT_MAPS[currentLang] || DIGIT_MAPS.en; return String(value).replace(/[0-9]/g, digit => map[Number(digit)]); }
function roman(value) { const numerals = [[1000,'M'],[900,'CM'],[500,'D'],[400,'CD'],[100,'C'],[90,'XC'],[50,'L'],[40,'XL'],[10,'X'],[9,'IX'],[5,'V'],[4,'IV'],[1,'I']]; let n = Number(value); let result = ''; for (const [amount, symbol] of numerals) { while (n >= amount) { result += symbol; n -= amount; } } return result || '0'; }

function applyTranslations() {
  document.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.dataset.i18n;
    if (translations[currentLang]?.[key]) el.textContent = translations[currentLang][key];
  });
  document.documentElement.lang = currentLang;
  document.documentElement.dir = RTL_LANGS.includes(currentLang) ? 'rtl' : 'ltr';
  updateLangPickerUI();
}

function updateLangPickerUI() {
  document.querySelectorAll('.lang-option').forEach(btn => btn.classList.toggle('active', btn.dataset.lang === currentLang));
}

function setLanguage(lang) {
  if (!translations[lang]) return;
  currentLang = lang;
  localStorage.setItem('meowzygisk-lang', lang);
  applyTranslations();
  render();
}

const state = {
  runtime: null,
  rawState: null,
  runtimeError: '',
  version: '—',
  device: {
    name: '—',
    android: '—',
    selinux: '—',
    abi: '—',
    treatWheel: false
  },
  debugEnabled: false,
  debugBuild: false,
  lastUpdated: 0
};

const $ = id => document.getElementById(id);

function showToast(message, duration = 2600) {
  const text = String(message || '').trim() || t('actionFailed');
  const el = $('toast');
  el.textContent = text;
  el.classList.add('show');
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => el.classList.remove('show'), duration);
}

async function run(command) {
  try { return await exec(command); }
  catch (error) { return { errno: -1, stdout: '', stderr: String(error) }; }
}

async function readFile(path) {
  const r = await run('/system/bin/cat ' + shellQuote(path));
  return r.errno === 0 ? r.stdout.trim() : '';
}

function shellQuote(value) {
  return "'" + String(value).replace(/'/g, "'\\''") + "'";
}

function escapeHtml(value) {
  return String(value ?? '—').replace(/[&<>'"]/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;' }[c]));
}

function archName(key) {
  return key === '64' ? t('bit64') : t('bit32');
}

function isInjected(runtime, key) {
  return Number(runtime?.zygote?.[key]) === 1;
}

function architectureKeys(runtime) {
  const keys = [];
  if (runtime?.rezygiskd?.['64'] || runtime?.zygote?.['64'] !== undefined) keys.push('64');
  if (runtime?.rezygiskd?.['32'] || runtime?.zygote?.['32'] !== undefined) keys.push('32');
  return keys;
}

function modulesFor(runtime, key) {
  return Array.isArray(runtime?.rezygiskd?.[key]?.modules) ? runtime.rezygiskd[key].modules : [];
}

function moduleInventory(runtime) {
  const map = new Map();
  for (const key of ['64', '32']) {
    for (const name of modulesFor(runtime, key)) {
      if (!map.has(name)) map.set(name, { name, a64: false, a32: false });
      map.get(name)[key === '64' ? 'a64' : 'a32'] = true;
    }
  }
  return [...map.values()].sort((a, b) => a.name.localeCompare(b.name));
}

function classifyAbis(value) {
  const abis = String(value || '').split(',').map(v => v.trim()).filter(Boolean);
  const has64 = abis.some(v => ['arm64-v8a', 'x86_64', 'riscv64'].includes(v));
  const has32 = abis.some(v => ['armeabi-v7a', 'armeabi', 'x86', 'riscv32'].includes(v));
  if (has64 && has32) return t('arch64And32');
  if (has64) return t('arch64Only');
  if (has32) return t('arch32Only');
  return abis.join(' + ') || '—';
}

async function loadDeviceInfo() {
  const [manufacturer, model, android, selinux] = await Promise.all([
    run('/system/bin/getprop ro.product.manufacturer').then(r => r.stdout?.trim() || ''),
    run('/system/bin/getprop ro.product.model').then(r => r.stdout?.trim() || ''),
    run('/system/bin/getprop ro.build.version.release').then(r => r.stdout?.trim() || ''),
    run('/system/bin/getenforce').then(r => r.stdout?.trim() || ''),
  ]);
  state.device.name = [manufacturer, model].filter(Boolean).join(' ') || '—';
  state.device.android = android ? 'Android ' + android : '—';
  state.device.selinux = selinux || '—';
  const treat = await run('[ -f /data/adb/modules/treat_wheel/service.sh ]');
  state.device.treatWheel = treat.errno === 0;
}

async function loadDebugState() {
  const [log, debugging] = await Promise.all([
    run('[ -e /data/adb/rezygisk/log ]'),
    run('[ -e /data/adb/rezygisk/debugging ]')
  ]);
  state.debugEnabled = log.errno === 0;
  state.debugBuild = debugging.errno === 0;
}

async function loadVersion() {
  const prop = await readFile('/data/adb/modules/rezygisk/module.prop');
  const match = prop.match(/^version=(.*)$/m);
  state.version = match ? match[1].trim() : '—';
}

async function loadRuntime() {
  const raw = await readFile('/data/adb/rezygisk/state.json');
  state.rawState = raw || '';
  state.runtimeError = '';
  if (!raw) {
    state.runtime = null;
    return;
  }
  try {
    state.runtime = JSON.parse(raw);
  } catch (error) {
    state.runtime = null;
    state.runtimeError = t('jsonReadError');
  }
}

function overall(runtime) {
  if (state.runtimeError) return { kind: 'bad', label: t('unavailable'), title: t('runtimeUnavailable'), desc: t('jsonReadError') };
  if (!runtime) return { kind: 'bad', label: t('unavailable'), title: t('runtimeUnavailable'), desc: t('noStateFile') };
  const keys = architectureKeys(runtime);
  const injected = keys.filter(k => isInjected(runtime, k));
  const running = keys.filter(k => Number(runtime?.rezygiskd?.[k]?.state) === 1);
  if (!keys.length) return { kind: 'warn', label: t('waiting'), title: t('noArchReported'), desc: t('monitorNotPublished') };
  if (injected.length === keys.length && running.length === keys.length) return { kind: 'ok', label: t('operational'), title: t('everythingWorking'), desc: t('zygoteRunning') };
  if (injected.length) return { kind: 'warn', label: t('partial'), title: t('partiallyInitialized'), desc: t('partialDesc') };
  return { kind: 'bad', label: t('notReady'), title: t('zygoteNotActive'), desc: t('noZygotePath') };
}

function setHero(status) {
  const card = $('hero-card');
  const icon = $('hero-icon');
  card.style.borderColor = status.kind === 'ok' ? 'rgba(66,217,155,.18)' : status.kind === 'warn' ? 'rgba(245,184,75,.18)' : 'rgba(255,109,125,.18)';
  icon.textContent = status.kind === 'ok' ? 'verified' : status.kind === 'warn' ? 'warning' : 'error';
  icon.style.color = status.kind === 'ok' ? 'var(--green)' : status.kind === 'warn' ? 'var(--amber)' : 'var(--red)';
  icon.style.background = status.kind === 'ok' ? 'rgba(66,217,155,.1)' : status.kind === 'warn' ? 'rgba(245,184,75,.1)' : 'rgba(255,109,125,.1)';
  $('hero-label').textContent = status.label;
  $('hero-label').style.color = status.kind === 'ok' ? 'var(--green)' : status.kind === 'warn' ? 'var(--amber)' : 'var(--red)';
  $('hero-title').textContent = status.title;
  $('hero-description').textContent = status.desc;
  const warning = $('debug-warning');
  warning.hidden = !state.debugBuild;
  warning.textContent = state.debugBuild ? t('debugBuildWarning') : '';
  card.classList.toggle('has-debug-warning', state.debugBuild);
}

function renderMetrics(runtime) {
  const keys = architectureKeys(runtime);
  const injected = keys.filter(k => isInjected(runtime, k)).length;
  const modules = moduleInventory(runtime).length;
  $('metric-monitor').textContent = runtime ? (Number(runtime?.monitor?.state) === 0 ? t('active') : t('stopped')) : '—';
  $('metric-arch').textContent = keys.length ? keys.map(archName).join(' + ') : '—';
  $('metric-modules').textContent = currentLang === 'en' ? roman(modules) : localizeDigits(modules);
  $('metric-root').textContent = runtime?.root || '—';
  $('runtime-count').textContent = keys.length ? localizeDigits(injected + '/' + keys.length) + ' ' + t('injected') : '—';
}

function renderArchitectures(runtime) {
  const keys = architectureKeys(runtime);
  if (!keys.length) {
    $('arch-grid').innerHTML = '<div class="arch-card empty">' + t('noArchPublished') + '</div>';
    return;
  }
  $('arch-grid').innerHTML = keys.map(key => {
    const daemon = Number(runtime?.rezygiskd?.[key]?.state) === 1;
    const injected = isInjected(runtime, key);
    const mods = modulesFor(runtime, key);
    const stateClass = injected && daemon ? '' : daemon || injected ? 'warning' : 'error';
    const stateText = injected && daemon ? t('ready') : daemon ? t('daemonOnly') : injected ? t('injected') : t('notReadyShort');
    return '<article class="arch-card">' +
      '<div class="arch-head"><div class="arch-icon"><span class="material-symbols-rounded">memory</span></div><div><div class="arch-title">' + archName(key) + '</div><div class="arch-sub">' + (key === '64' ? 'arm64-v8a / x86_64' : 'armeabi-v7a / x86') + '</div></div><div class="arch-state ' + stateClass + '">' + stateText + '</div></div>' +
      '<div class="arch-stats"><div class="arch-stat"><div class="arch-stat-value">' + (daemon ? 'OK' : t('no')) + '</div><div class="arch-stat-label">' + t('daemon') + '</div></div><div class="arch-stat"><div class="arch-stat-value">' + (injected ? 'OK' : t('no')) + '</div><div class="arch-stat-label">' + t('zygote') + '</div></div><div class="arch-stat"><div class="arch-stat-value">' + mods.length + '</div><div class="arch-stat-label">' + t('modules') + '</div></div></div>' +
      '<div class="progress"><i style="width:' + (injected && daemon ? 100 : injected || daemon ? 55 : 0) + '%; background:' + (injected && daemon ? 'var(--green)' : 'var(--amber)') + '"></i></div>' +
      '<div class="arch-foot"><span>' + (runtime?.rezygiskd?.[key]?.reason ? escapeHtml(runtime.rezygiskd[key].reason) : t('noActiveError')) + '</span><span>' + (mods.length ? t('modulesAvailable') : t('noModules')) + '</span></div>' +
    '</article>';
  }).join('');
}

function renderModules(runtime) {
  const modules = moduleInventory(runtime);
  $('module-total').textContent = localizeDigits(modules.length);
  $('module-table').innerHTML = '<div class="table-row table-head"><div>' + t('module') + '</div><div>' + t('bit64Short') + '</div><div>' + t('bit32Short') + '</div><div>' + t('status') + '</div></div>' + (modules.length ? modules.map(m => '<div class="table-row"><div class="table-module"><div class="module-symbol"><span class="material-symbols-rounded">extension</span></div><div><strong>' + escapeHtml(m.name) + '</strong><small>' + t('reportedByDaemon') + '</small></div></div><div>' + (m.a64 ? '<span class="pill ok"><span class="material-symbols-rounded" style="font-size:13px">check</span>OK</span>' : '<span class="pill">No</span>') + '</div><div>' + (m.a32 ? '<span class="pill ok"><span class="material-symbols-rounded" style="font-size:13px">check</span>OK</span>' : '<span class="pill">No</span>') + '</div><div><span class="pill ok">' + t('injected') + '</span></div></div>').join('') : '<div class="empty" style="padding:20px">' + t('noModulesReported') + '</div>');
}

function renderRecovery() {
  const card = $('recovery-card');
  const problem = Boolean(state.runtimeError || !state.runtime);
  card.hidden = !problem;
  if (problem) $('recovery-message').textContent = state.runtimeError ? t('jsonReadError') : t('noStateFile');
}


function render() {
  const status = overall(state.runtime);
  setHero(status);
  renderMetrics(state.runtime);
  renderArchitectures(state.runtime);
  renderModules(state.runtime);
  renderRecovery();
  $('brand-version').textContent = state.version === '—' ? t('standaloneZygisk') : 'v' + state.version;
  $('sidebar-status').textContent = status.label;
  $('device-name').textContent = state.device.name;
  $('android-version').textContent = state.device.android;
  $('selinux-status').textContent = state.device.selinux;
  $('treat-wheel').textContent = state.device.treatWheel ? t('installed') : t('unavailable');
  $('debug-toggle').classList.toggle('on', state.debugEnabled);
  $('debug-toggle-btn').setAttribute('aria-pressed', state.debugEnabled ? 'true' : 'false');
}

let staticInfoLoaded = false;
let refreshInProgress = false;

async function refresh(includeStatic = false) {
  if (refreshInProgress) return;
  refreshInProgress = true;
  try {
    if (!staticInfoLoaded || includeStatic) {
      await Promise.all([loadRuntime(), loadVersion(), loadDeviceInfo(), loadDebugState()]);
      staticInfoLoaded = true;
    } else {
      await loadRuntime();
    }
    render();
  } finally {
    refreshInProgress = false;
  }
}

async function copyText(text) {
  try { await navigator.clipboard.writeText(text); showToast(t('copied')); return; } catch (_) {}
  try { const area = document.createElement('textarea'); area.value = text; document.body.appendChild(area); area.select(); document.execCommand('copy'); area.remove(); showToast(t('copied')); } catch (_) { showToast(t('clipboardUnavailable')); }
}

function diagnosticReport() {
  const modules = moduleInventory(state.runtime);
  const keys = architectureKeys(state.runtime);
  const monitorState = state.runtime ? (Number(state.runtime?.monitor?.state) === 0 ? 'Active' : 'Stopped') : 'Unavailable';
  const architectureState = keys.length ? keys.map(k => archNameEnglish(k) + ': ' + (isInjected(state.runtime, k) ? 'Injected' : 'Not injected')).join(', ') : 'Unavailable';
  const daemonState = keys.length ? keys.map(k => archNameEnglish(k) + ': ' + (Number(state.runtime?.rezygiskd?.[k]?.state) === 1 ? 'Running' : 'Stopped')).join(', ') : 'Unavailable';
  const status = overall(state.runtime);
  const runtimePaths = keys.length ? keys.map(k => {
    const mods = modulesFor(state.runtime, k);
    return archNameEnglish(k) + ': ' + (Number(state.runtime?.rezygiskd?.[k]?.state) === 1 ? 'Daemon running' : 'Daemon stopped') + ', ' + (isInjected(state.runtime, k) ? 'Injected' : 'Not injected') + ', ' + mods.length + ' module' + (mods.length === 1 ? '' : 's');
  }).join('\n') : 'Unavailable';
  return [
    'Meow Zygisk Information',
    '========================',
    '',
    'Version:         ' + state.version,
    'Device:          ' + state.device.name,
    'Android:         ' + state.device.android,
    'SELinux:         ' + state.device.selinux,
    'Treat Wheel:     ' + (state.device.treatWheel ? 'Installed' : 'Unavailable'),
    '',
    'Overall status:  ' + status.title,
    'Monitor:         ' + monitorState,
    'Monitor detail:  ' + (state.runtime?.monitor?.reason || 'Unavailable'),
    'Architectures:   ' + architectureState,
    'ReZygisk daemon:',
    daemonState,
    'Root implementation: ' + (state.runtime?.root || 'Unknown'),
    'Loaded modules:     ' + (modules.map(m => m.name).join(', ') || 'None'),
    'Runtime paths:',
    runtimePaths,
    '',
    'Debug build: ' + (state.debugBuild ? 'Yes' : 'No'),
    'Debug logging: ' + (state.debugEnabled ? 'Enabled' : 'Disabled'),
    state.runtimeError ? 'Runtime error: ' + state.runtimeError : ''
  ].filter(Boolean).join('\n');
}

function archNameEnglish(key) {
  return key === '64' ? '64-bit' : '32-bit';
}

function reportBug() {
  run('/system/bin/nohup /system/bin/am start -a android.intent.action.VIEW -d "https://t.me/TempMeow" >/dev/null 2>&1 </dev/null &');
}

function generateLogs() {
  showToast(t('generatingLogs'), 2200);
  let output = '';
  let errorOutput = '';
  let finished = false;
  try {
    const child = spawn('/system/bin/sh', ['-c', '/data/adb/modules/rezygisk/action.sh']);
    child.stdout.on('data', data => { output += String(data ?? ''); });
    child.stderr.on('data', data => { errorOutput += String(data ?? ''); });
    child.on('error', error => {
      finished = true;
      state.runtimeError = String(error);
      renderRecovery();
      showToast(t('actionFailed') + ': ' + String(error), 4000);
    });
    child.on('exit', code => {
      finished = true;
      const message = (output || errorOutput).trim();
      if (message) showToast(message, 5000);
      else if (Number(code) === 0) showToast(t('actionCompleted'));
      else {
        showToast(t('actionFailed') + ' (' + code + ')', 4000);
        state.runtimeError = t('actionFailed');
        renderRecovery();
      }
    });
  } catch (error) {
    finished = true;
    state.runtimeError = String(error);
    renderRecovery();
    showToast(t('actionFailed') + ': ' + String(error), 4000);
  }
  setTimeout(() => {
    if (!finished) showToast(t('logsRunning'), 3000);
  }, 900);
}

$('refresh-btn').addEventListener('click', () => refresh(true));
$('hero-refresh').addEventListener('click', () => refresh(true));
$('copy-report-btn').addEventListener('click', () => copyText(diagnosticReport()));
$('copy-information-btn').addEventListener('click', () => copyText(diagnosticReport()));
$('debug-toggle-btn').addEventListener('click', async () => {
  const command = state.debugEnabled ? '/system/bin/rm -f /data/adb/rezygisk/log' : '/system/bin/touch /data/adb/rezygisk/log';
  const result = await run(command);
  if (result.errno !== 0) {
    showToast(result.stderr?.trim() || t('actionFailed'));
    state.runtimeError = t('actionFailed');
    renderRecovery();
    return;
  }
  await loadDebugState();
  render();
  showToast(state.debugEnabled ? t('debugEnabled') : t('debugDisabled'));
});
$('run-action-btn').addEventListener('click', generateLogs);
$('report-bug-btn').addEventListener('click', reportBug);
$('recovery-generate').addEventListener('click', generateLogs);
$('recovery-report').addEventListener('click', reportBug);

const savedTheme = localStorage.getItem('rezygisk-theme') || 'dark';
document.documentElement.setAttribute('data-theme', savedTheme);
$('theme-btn').addEventListener('click', () => {
  const current = document.documentElement.getAttribute('data-theme') || 'dark';
  const next = current === 'dark' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', next);
  localStorage.setItem('rezygisk-theme', next);
  $('theme-btn').querySelector('span').textContent = next === 'dark' ? 'dark_mode' : 'light_mode';
});

const langPicker = $('lang-picker');
$('lang-btn').addEventListener('click', () => langPicker.classList.add('show'));
$('support-btn').addEventListener('click', async () => { try { await run('/system/bin/am start -a android.intent.action.VIEW -d "https://meowdump.github.io"'); } catch (_) { window.open('https://meowdump.github.io', '_blank'); } });
langPicker.querySelector('.lang-picker-backdrop').addEventListener('click', () => langPicker.classList.remove('show'));
langPicker.querySelector('.lang-picker-close').addEventListener('click', () => langPicker.classList.remove('show'));
document.querySelectorAll('.lang-option').forEach(btn => btn.addEventListener('click', () => { setLanguage(btn.dataset.lang); langPicker.classList.remove('show'); }));
document.addEventListener('keydown', e => { if (e.key.toLowerCase() === 'r' && !['INPUT', 'TEXTAREA'].includes(document.activeElement.tagName)) refresh(); });

applyTranslations();
fullScreen(true);
refresh();
setInterval(() => refresh(false), 10000);
