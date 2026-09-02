import { exec, toast as ksuToast, fullScreen } from './js/kernelsu.js';
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

function applyTranslations() {
  document.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.dataset.i18n;
    if (translations[currentLang]?.[key]) {
      el.textContent = translations[currentLang][key];
    }
  });
  document.documentElement.lang = currentLang;
  const isRTL = RTL_LANGS.includes(currentLang);
  document.documentElement.dir = isRTL ? 'rtl' : 'ltr';
  updateLangPickerUI();
}

function updateLangPickerUI() {
  document.querySelectorAll('.lang-option').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.lang === currentLang);
  });
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
  version: '—'
};

const $ = id => document.getElementById(id);

function showToast(message) {
  const el = $('toast');
  el.textContent = message;
  el.classList.add('show');
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => el.classList.remove('show'), 2200);
  try { ksuToast(message); } catch (_) {}
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

async function loadVersion() {
  const prop = await readFile('/data/adb/modules/rezygisk/module.prop');
  const match = prop.match(/^version=(.*)$/m);
  state.version = match ? match[1].trim() : '—';
}

async function loadRuntime() {
  const raw = await readFile('/data/adb/rezygisk/state.json');
  state.rawState = raw || '';
  if (!raw) { state.runtime = null; return; }
  try { state.runtime = JSON.parse(raw); }
  catch (_) { state.runtime = null; }
}

function overall(runtime) {
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
}

function renderMetrics(runtime) {
  const keys = architectureKeys(runtime);
  const injected = keys.filter(k => isInjected(runtime, k)).length;
  const modules = moduleInventory(runtime).length;
  $('metric-monitor').textContent = runtime ? (Number(runtime?.monitor?.state) === 0 ? t('active') : t('stopped')) : '—';
  $('metric-monitor-note').textContent = runtime?.monitor?.reason || t('monitorState');
  $('metric-arch').textContent = injected + '/' + (keys.length || 0);
  $('metric-arch-note').textContent = keys.length ? (keys.filter(k => isInjected(runtime, k)).map(archName).join(' + ') || t('noInjectedPaths')) : t('noArchData');
  $('metric-modules').textContent = modules;
  $('metric-root').textContent = runtime?.root || '—';
}

function renderArchitectures(runtime) {
  const keys = architectureKeys(runtime);
  $('runtime-count').textContent = keys.filter(k => isInjected(runtime, k)).length + '/' + keys.length + ' ' + (t('injected') || 'injected');
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
      '<div class="arch-stats"><div class="arch-stat"><div class="arch-stat-value">' + (daemon ? 'OK' : (t('no') || 'No')) + '</div><div class="arch-stat-label">' + t('daemon') + '</div></div><div class="arch-stat"><div class="arch-stat-value">' + (injected ? 'OK' : (t('no') || 'No')) + '</div><div class="arch-stat-label">' + t('zygote') + '</div></div><div class="arch-stat"><div class="arch-stat-value">' + mods.length + '</div><div class="arch-stat-label">' + t('modules') + '</div></div></div>' +
      '<div class="progress"><i style="width:' + (injected && daemon ? 100 : injected || daemon ? 55 : 0) + '%; background:' + (injected && daemon ? 'var(--green)' : 'var(--amber)') + '"></i></div>' +
      '<div class="arch-foot"><span>' + (runtime?.rezygiskd?.[key]?.reason ? escapeHtml(runtime.rezygiskd[key].reason) : t('noActiveError')) + '</span><span>' + (mods.length ? t('modulesAvailable') : t('noModules')) + '</span></div>' +
    '</article>';
  }).join('');
}

function renderModules(runtime) {
  const modules = moduleInventory(runtime);
  $('module-total').textContent = modules.length;
  $('module-table').innerHTML = '<div class="table-row table-head"><div>' + t('module') + '</div><div>' + t('bit64Short') + '</div><div>' + t('bit32Short') + '</div><div>' + t('status') + '</div></div>' + (modules.length ? modules.map(m => '<div class="table-row"><div class="table-module"><div class="module-symbol"><span class="material-symbols-rounded">extension</span></div><div><strong>' + escapeHtml(m.name) + '</strong><small>' + t('reportedByDaemon') + '</small></div></div><div>' + (m.a64 ? '<span class="pill ok"><span class="material-symbols-rounded" style="font-size:13px">check</span>OK</span>' : '<span class="pill">No</span>') + '</div><div>' + (m.a32 ? '<span class="pill ok"><span class="material-symbols-rounded" style="font-size:13px">check</span>OK</span>' : '<span class="pill">No</span>') + '</div><div><span class="pill ok">' + t('injected') + '</span></div></div>').join('') : '<div class="empty" style="padding:20px">' + t('noModulesReported') + '</div>');
}

function render() {
  const status = overall(state.runtime);
  setHero(status);
  renderMetrics(state.runtime);
  renderArchitectures(state.runtime);
  renderModules(state.runtime);
  $('brand-version').textContent = state.version === '—' ? t('standaloneZygisk') : 'v' + state.version;
  $('sidebar-status').textContent = status.label;
}

async function refresh() {
  await loadRuntime();
  await loadVersion();
  render();
}

async function copyText(text) {
  try { await navigator.clipboard.writeText(text); showToast(t('copied')); return; } catch (_) {}
  try { const area = document.createElement('textarea'); area.value = text; document.body.appendChild(area); area.select(); document.execCommand('copy'); area.remove(); showToast(t('copied')); } catch (_) { showToast(t('clipboardUnavailable')); }
}

function diagnosticReport() {
  const modules = moduleInventory(state.runtime);
  const keys = architectureKeys(state.runtime);
  return [
    'ReZygisk ' + state.version,
    t('root') + ': ' + (state.runtime?.root || 'unknown'),
    t('monitor') + ': ' + (Number(state.runtime?.monitor?.state) === 0 ? t('active').toLowerCase() : t('stopped').toLowerCase()),
    t('architectures') + ': ' + (keys.map(k => archName(k) + '=' + (isInjected(state.runtime, k) ? t('injected').toLowerCase() : 'not injected')).join(', ') || 'none'),
    t('daemon') + ': ' + (keys.map(k => archName(k) + '=' + (Number(state.runtime?.rezygiskd?.[k]?.state) === 1 ? 'running' : t('stopped').toLowerCase())).join(', ') || 'none'),
    t('modules') + ': ' + (modules.map(m => m.name).join(', ') || 'none')
  ].join('\n');
}

$('refresh-btn').addEventListener('click', () => refresh());
$('hero-refresh').addEventListener('click', () => refresh());
$('copy-report-btn').addEventListener('click', () => copyText(diagnosticReport()));

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
$('support-btn').addEventListener('click', () => { try { ksu.exec('am start -a android.intent.action.VIEW -d "https://meowdump.github.io"'); } catch (_) { window.open('https://meowdump.github.io', '_blank'); } });
langPicker.querySelector('.lang-picker-backdrop').addEventListener('click', () => langPicker.classList.remove('show'));
langPicker.querySelector('.lang-picker-close').addEventListener('click', () => langPicker.classList.remove('show'));
document.querySelectorAll('.lang-option').forEach(btn => {
  btn.addEventListener('click', () => {
    setLanguage(btn.dataset.lang);
    langPicker.classList.remove('show');
  });
});

document.addEventListener('keydown', e => { if (e.key.toLowerCase() === 'r' && !['INPUT', 'TEXTAREA'].includes(document.activeElement.tagName)) refresh(); });

applyTranslations();
fullScreen(true);
refresh();
setInterval(() => refresh(), 5000);
