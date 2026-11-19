import { exec, fullScreen } from './js/kernelsu.js';
const translations = window.MeowTranslations || {};
const RTL_LANGS = ['ar'];
const FEATURE_STATE_PATH = '/data/adb/treat_wheel/state';
const FEATURE_STATUS_PATH = '/data/adb/treat_wheel/status';
const FEATURE_SETTING_KEYS = [
  'ignoring',
  'disable_prop_spoofing',
  'disable_gsi_hiding',
  'disable_zygote_mountinfo_leak_fixing',
  'disable_maps_hiding',
  'disable_revanced_mounts_umount',
  'disable_custom_font_loading',
  'disable_denylist_logic_inversion',
  'disable_module_loading_traces_hiding',
  'disable_frida_traces_hiding'
];
const FEATURE_DEFAULTS = {
  ignoring: false,
  disable_prop_spoofing: false,
  disable_gsi_hiding: false,
  disable_zygote_mountinfo_leak_fixing: false,
  disable_maps_hiding: false,
  disable_revanced_mounts_umount: true,
  disable_custom_font_loading: false,
  disable_denylist_logic_inversion: true,
  disable_module_loading_traces_hiding: false,
  disable_frida_traces_hiding: false
};
function storageGet(key, fallback) { try { return localStorage.getItem(key) || fallback; } catch (_) { return fallback; } }
function storageSet(key, value) { try { localStorage.setItem(key, value); } catch (_) {} }
let currentLang = storageGet('meowzygisk-lang', 'en');
let currentTheme = storageGet('meowzygisk-theme', 'light');
const THEME_MODES = ['light', 'dark'];
function applyTheme(mode = currentTheme) {
  currentTheme = THEME_MODES.includes(mode) ? mode : 'light';
  document.documentElement.dataset.theme = currentTheme;
  const dark = currentTheme === 'dark';
  const icon = document.getElementById('theme-icon');
  const button = document.getElementById('theme-toggle');
  const icons = { light: 'light_mode', dark: 'dark_mode' };
  if (icon) icon.textContent = icons[currentTheme];
  if (button) {
    button.title = t('changeTheme') + ': ' + t(currentTheme === 'light' ? 'themeLight' : 'themeDark');
    button.setAttribute('aria-label', button.title);
    button.dataset.themeMode = currentTheme;
  }
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', dark ? '#111318' : '#f7f7fb');
  document.documentElement.style.colorScheme = dark ? 'dark' : 'light';
  storageSet('meowzygisk-theme', currentTheme);
}
function cycleTheme() {
  const next = THEME_MODES[(THEME_MODES.indexOf(currentTheme) + 1) % THEME_MODES.length];
  storageSet('meowzygisk-theme', next);
  applyTheme(next);
  showToast(t('themeToast') + t(next === 'light' ? 'themeLight' : 'themeDark'));
}
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
  document.querySelectorAll('[data-i18n-title]').forEach(el => { const key = el.dataset.i18nTitle; if (translations[currentLang]?.[key]) el.title = translations[currentLang][key]; });
  document.querySelectorAll('[data-i18n-placeholder]').forEach(el => { const key = el.dataset.i18nPlaceholder; if (translations[currentLang]?.[key]) el.placeholder = translations[currentLang][key]; });
  document.querySelectorAll('[data-i18n-aria]').forEach(el => { const key = el.dataset.i18nAria; if (translations[currentLang]?.[key]) el.setAttribute('aria-label', translations[currentLang][key]); });
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
  storageSet('meowzygisk-lang', lang);
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
    abi: '—'
  },
  debugEnabled: false,
  debugBuild: false,
  featureSettings: { ...FEATURE_DEFAULTS },
  featureSettingsLoaded: false,
  featureSettingsBusy: false,
  featureSettingsError: '',
  morpheModules: [],
  morpheModulesLoaded: false,
  morpheModulesBusy: false,
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
  try { if (typeof exec !== 'function') throw new Error('KernelSU JavaScript bridge is unavailable'); return await exec(command); }
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
}
async function loadFeatureSettings() {
  const path = shellQuote(FEATURE_STATE_PATH);
  const script = [
    'set -e',
    '/system/bin/mkdir -p /data/adb/treat_wheel',
    `[ -f ${path} ] || : > ${path}`,
    `if ! /system/bin/grep -q '^disable_revanced_mounts_umount=' ${path}; then printf '%s\\n' 'disable_revanced_mounts_umount=true' >> ${path}; fi`,
    `if ! /system/bin/grep -q '^disable_denylist_logic_inversion=' ${path}; then printf '%s\\n' 'disable_denylist_logic_inversion=true' >> ${path}; fi`,
    `/system/bin/cat ${path}`
  ].join('; ');
  const result = await run('/system/bin/sh -c ' + shellQuote(script));
  if (result.errno !== 0) {
    state.featureSettingsError = (result.stderr || '').trim() || `errno ${result.errno}`;
    state.featureSettingsLoaded = false;
    showToast(t('actionFailed') + ': ' + state.featureSettingsError, 4500);
    return false;
  }
  const values = { ...FEATURE_DEFAULTS };
  String(result.stdout || '').split(/\r?\n/).forEach(line => {
    const separator = line.indexOf('=');
    if (separator < 1) return;
    const key = line.slice(0, separator).trim();
    if (Object.prototype.hasOwnProperty.call(values, key)) {
      values[key] = line.slice(separator + 1).trim() === 'true';
    }
  });
  state.featureSettings = values;
  state.featureSettingsError = '';
  state.featureSettingsLoaded = true;
  return true;
}
async function saveFeatureSettings() {
  const contents = FEATURE_SETTING_KEYS
    .filter(key => state.featureSettings[key])
    .map(key => `${key}=true`)
    .join('\n') + '\n';
  const script = [
    'set -e',
    '/system/bin/mkdir -p /data/adb/treat_wheel',
    `printf %s ${shellQuote(contents)} > ${shellQuote(FEATURE_STATE_PATH)}`,
    `/system/bin/rm -f ${shellQuote(FEATURE_STATUS_PATH)}`
  ].join('; ');
  const result = await run('/system/bin/sh -c ' + shellQuote(script));
  if (result.errno !== 0) {
    state.featureSettingsError = (result.stderr || '').trim() || `errno ${result.errno}`;
    showToast(t('actionFailed') + ': ' + state.featureSettingsError, 4500);
    return false;
  }
  state.featureSettingsError = '';
  return true;
}
function renderFeatureSettings() {
  document.querySelectorAll('[data-feature-setting]').forEach(row => {
    const key = row.dataset.featureSetting;
    const enabled = key === 'ignoring'
      ? Boolean(state.featureSettings[key])
      : !Boolean(state.featureSettings[key]);
    const ignoring = Boolean(state.featureSettings.ignoring);
    const isMagisk = String(state.runtime?.root || '').toLowerCase().includes('magisk');
    const restrictedDenylist = key === 'disable_denylist_logic_inversion' && !isMagisk;
    const disabled = !state.featureSettingsLoaded || state.featureSettingsBusy || (ignoring && key !== 'ignoring') || restrictedDenylist;
    row.disabled = disabled;
    row.setAttribute('aria-pressed', enabled ? 'true' : 'false');
    row.querySelector('.toggle')?.classList.toggle('on', enabled);
    if (key === 'disable_denylist_logic_inversion') {
      row.classList.toggle('is-enabled', enabled);
      row.classList.toggle('is-disabled', !enabled);
      const status = $('magisk-detection-status');
      const stateLabel = $('magisk-detection-state');
      if (status) status.textContent = isMagisk ? (enabled ? t('enabled') : t('disabled')) : t('magiskOnly');
      if (stateLabel) stateLabel.textContent = isMagisk ? (enabled ? 'ON' : 'OFF') : t('na');
    }
  });
}
async function toggleFeatureSetting(key) {
  if (!FEATURE_SETTING_KEYS.includes(key) || state.featureSettingsBusy) return;
  const row = document.querySelector(`[data-feature-setting="${key}"]`);
  if (row?.disabled) return;
  const previous = { ...state.featureSettings };
  state.featureSettings[key] = !state.featureSettings[key];
  state.featureSettingsBusy = true;
  renderFeatureSettings();
  const saved = await saveFeatureSettings();
  state.featureSettingsBusy = false;
  if (!saved) state.featureSettings = previous;
  renderFeatureSettings();
  if (saved) showToast(t('settingsSaved'));
}
async function loadMorpheModules() {
  state.morpheModulesBusy = true;
  renderMorpheModules();
  const script = String.raw`
    for dir in /data/adb/modules/*; do
      [ -d "$dir" ] || continue
      prop="$dir/module.prop"
      [ -f "$prop" ] || continue
      id=$(sed -n 's/^id=//p' "$prop" | head -n 1)
      name=$(sed -n 's/^name=//p' "$prop" | head -n 1)
      description=$(sed -n 's/^description=//p' "$prop" | head -n 1)
      [ -n "$id" ] || id=$(/system/bin/basename "$dir")
      [ -n "$name" ] || name=$id
      config="$dir/tw_config"
      module_type=''
      allow='false'
      if [ -f "$config" ]; then
        module_type=$(sed -n 's/^module_type=//p' "$config" | head -n 1)
        allow=$(sed -n 's/^allow_umount=//p' "$config" | head -n 1)
      fi
      case "$id $name $description $module_type" in
        *[Mm][Oo][Rr][Pp][Hh][Ee]*)
          [ "$allow" = 'true' ] && enabled=1 || enabled=0
          printf '%s\t%s\t%s\n' "$id" "$name" "$enabled"
          ;;
      esac
    done
  `;
  const result = await run('/system/bin/sh -c ' + shellQuote(script));
  state.morpheModulesBusy = false;
  if (result.errno !== 0) {
    state.morpheModulesLoaded = false;
    state.morpheModules = [];
    renderMorpheModules();
    showToast(t('readModulesFailed') + ': ' + (result.stderr || `errno ${result.errno}`), 4000);
    return false;
  }
  state.morpheModules = String(result.stdout || '').split(/\r?\n/).filter(Boolean).map(line => {
    const [id, name, enabled] = line.split('\t');
    return { id, name: name || id, enabled: enabled === '1' };
  }).filter(module => module.id && /^[A-Za-z0-9._-]+$/.test(module.id));
  state.morpheModulesLoaded = true;
  renderMorpheModules();
  return true;
}
function renderMorpheModules() {
  const container = $('morphe-module-list');
  if (!container) return;
  const refresh = $('morphe-refresh-btn');
  if (refresh) refresh.disabled = state.morpheModulesBusy;
  if (state.morpheModulesBusy) {
    container.innerHTML = '<div class="empty">' + escapeHtml(t('loadingMorphe')) + '</div>';
    return;
  }
  if (!state.morpheModulesLoaded) {
    container.innerHTML = '<div class="empty">' + escapeHtml(t('loadModulesFailed')) + '</div>';
    return;
  }
  if (!state.morpheModules.length) {
    container.innerHTML = '<div class="empty">' + escapeHtml(t('noMorpheModules')) + '</div>';
    return;
  }
  container.innerHTML = state.morpheModules.map(module =>
    '<button class="action-row morphe-module-row" type="button" data-morphe-module="' + escapeHtml(module.id) + '" aria-pressed="' + (module.enabled ? 'true' : 'false') + '" ' + (state.morpheModulesBusy ? 'disabled' : '') + '>' +
      '<span class="action-icon"><span class="material-symbols-rounded">extension</span></span>' +
      '<span class="action-copy"><strong>' + escapeHtml(module.name) + '</strong><small>' + escapeHtml(module.id) + '</small></span>' +
      '<span class="toggle ' + (module.enabled ? 'on' : '') + '"><span></span></span>' +
    '</button>'
  ).join('');
  container.querySelectorAll('[data-morphe-module]').forEach(row => {
    row.addEventListener('click', () => toggleMorpheModule(row.dataset.morpheModule));
  });
}
async function toggleMorpheModule(id) {
  if (state.morpheModulesBusy || !/^[A-Za-z0-9._-]+$/.test(String(id))) return;
  const module = state.morpheModules.find(item => item.id === id);
  if (!module) return;
  const nextEnabled = !module.enabled;
  state.morpheModulesBusy = true;
  renderMorpheModules();
  const moduleDir = '/data/adb/modules/' + id;
  const configPath = moduleDir + '/tw_config';
  const tempPath = configPath + '.meowzygisk.tmp';
  const script = [
    'set -e',
    '[ -d ' + shellQuote(moduleDir) + ' ]',
    '[ ! -f ' + shellQuote(moduleDir + '/disable') + ' ]',
    'if [ -f ' + shellQuote(configPath) + ' ]; then /system/bin/grep -vE "^(module_type|allow_umount)=" ' + shellQuote(configPath) + ' > ' + shellQuote(tempPath) + ' || true; else : > ' + shellQuote(tempPath) + '; fi',
    'printf "%s\\n" ' + shellQuote('module_type=morphe') + ' ' + shellQuote('allow_umount=' + (nextEnabled ? 'true' : 'false')) + ' >> ' + shellQuote(tempPath),
    '/system/bin/chmod 0644 ' + shellQuote(tempPath),
    '/system/bin/mv -f ' + shellQuote(tempPath) + ' ' + shellQuote(configPath)
  ].join('; ');
  const result = await run('/system/bin/sh -c ' + shellQuote(script));
  state.morpheModulesBusy = false;
  if (result.errno !== 0) {
    showToast(t('updateMorpheFailed') + ': ' + (result.stderr || `errno ${result.errno}`), 4000);
    renderMorpheModules();
    return;
  }
  module.enabled = nextEnabled;
  renderMorpheModules();
  showToast((nextEnabled ? t('morpheEnabled') : t('morpheDisabled')));
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
  icon.style.color = status.kind === 'ok' ? 'var(--c-success)' : status.kind === 'warn' ? 'var(--c-warning)' : 'var(--c-error)';
  icon.style.background = status.kind === 'ok' ? 'rgba(66,217,155,.1)' : status.kind === 'warn' ? 'rgba(245,184,75,.1)' : 'rgba(255,109,125,.1)';
  $('hero-label').textContent = status.label;
  $('hero-label').style.color = status.kind === 'ok' ? 'var(--c-success)' : status.kind === 'warn' ? 'var(--c-warning)' : 'var(--c-error)';
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
  const monitorActive = Boolean(runtime) && Number(runtime?.monitor?.state) === 0;
  $('metric-monitor').textContent = runtime ? (monitorActive ? t('active') : t('stopped')) : '—';
  const monitorPanel = document.querySelector('.monitor-panel');
  if (monitorPanel) monitorPanel.dataset.state = runtime ? (monitorActive ? 'active' : 'inactive') : 'unknown';
  $('metric-monitor').classList.toggle('is-inactive', Boolean(runtime) && !monitorActive);
  $('metric-root').textContent = runtime?.root || '—';
}
function renderArchitectures(runtime) {
  const keys = architectureKeys(runtime);
  if (!keys.length) {
    $('arch-grid').innerHTML = '<div class="runtime-empty">' + t('noArchPublished') + '</div>';
    return;
  }
  $('arch-grid').innerHTML = keys.map(key => {
    const daemon = Number(runtime?.rezygiskd?.[key]?.state) === 1;
    const injected = isInjected(runtime, key);
    const mods = modulesFor(runtime, key);
    const stateClass = injected && daemon ? 'ok' : daemon || injected ? 'warning' : 'error';
    const stateText = injected && daemon ? t('ready') : daemon ? t('daemonOnly') : injected ? t('injected') : t('notReadyShort');
    return '<div class="runtime-arch-row"><strong class="runtime-arch-name">' + archName(key) + '</strong><span class="runtime-arch-separator">|</span><span class="runtime-arch-count">' + localizeDigits(mods.length) + ' ' + t('modules') + '</span><span class="runtime-arch-separator">|</span><span class="runtime-status ' + stateClass + '">' + stateText + '</span></div>';
  }).join('');
}
function renderModules(runtime) {
  const modules = moduleInventory(runtime);
  const query = ($('module-search')?.value || '').trim().toLowerCase();
  const visible = modules.filter(module => module.name.toLowerCase().includes(query));
  $('module-table').innerHTML = visible.length ? visible.map(module => {
    const arches = [module.a64 ? '64-bit' : '', module.a32 ? '32-bit' : ''].filter(Boolean).join(' · ') || '—';
    return '<div class="module-list-row"><span class="module-list-icon material-symbols-rounded">extension</span><div class="module-list-copy"><strong title="' + escapeHtml(module.name) + '">' + escapeHtml(module.name) + '</strong></div><span class="module-list-arches">' + arches + '</span><span class="module-list-status"><i></i>' + t('injected') + '</span></div>';
  }).join('') : '<div class="module-empty">' + (modules.length ? t('noSearchMatches') : t('noModulesReported')) + '</div>';
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
  $('debug-toggle').classList.toggle('on', state.debugEnabled);
  $('debug-toggle-btn').setAttribute('aria-pressed', state.debugEnabled ? 'true' : 'false');
  renderFeatureSettings();
}
let staticInfoLoaded = false;
let refreshInProgress = false;
async function refresh(includeStatic = false) {
  if (refreshInProgress) return;
  refreshInProgress = true;
  try {
    if (!staticInfoLoaded || includeStatic) {
      await Promise.all([loadRuntime(), loadVersion(), loadDeviceInfo(), loadDebugState(), loadFeatureSettings()]);
      staticInfoLoaded = true;
    } else {
      await Promise.all([loadRuntime()]);
    }
    render();
  } catch (error) {
    state.runtimeError = String(error?.message || error || t('actionFailed'));
    try { render(); } catch (_) {}
    showToast(t('uiRefreshFailed') + ': ' + state.runtimeError, 5000);
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
  return [
    'Meow Zygisk Information',
    '========================',
    '',
    'Version:         ' + state.version,
    'Device:          ' + state.device.name,
    'Android:         ' + state.device.android,
    'SELinux:         ' + state.device.selinux,
    '',
    'Overall status:  ' + status.title,
    'Monitor:         ' + monitorState,
    'Architectures:   ' + architectureState,
    'ReZygisk daemon:',
    daemonState,
    'Root implementation: ' + (state.runtime?.root || 'Unknown'),
    'Loaded modules:     ' + (modules.map(m => m.name).join(', ') || 'None'),
    '',
    'Debug build: ' + (state.debugBuild ? 'Yes' : 'No'),
    'Debug logging: ' + (state.debugEnabled ? t('enabled') : t('disabled')),
    state.runtimeError ? 'Runtime error: ' + state.runtimeError : ''
  ].filter(Boolean).join('\n');
}
function archNameEnglish(key) {
  return key === '64' ? '64-bit' : '32-bit';
}
function reportBug() {
  const overlay = $('report-overlay');
  overlay.classList.add('show');
  overlay.setAttribute('aria-hidden', 'false');
}
function closeReportBug() {
  const overlay = $('report-overlay');
  overlay.classList.remove('show');
  overlay.setAttribute('aria-hidden', 'true');
}
$('theme-toggle').addEventListener('click', cycleTheme);
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
$('report-bug-btn').addEventListener('click', reportBug);
$('recovery-report').addEventListener('click', reportBug);
$('report-close').addEventListener('click', closeReportBug);
$('report-overlay').querySelector('.report-backdrop').addEventListener('click', closeReportBug);
const pauseWarning = $('pause-warning');
const closePauseWarning = () => {
  pauseWarning.hidden = true;
};
document.querySelectorAll('[data-feature-setting]').forEach(row => {
  row.addEventListener('click', () => {
    if (row.dataset.featureSetting === 'ignoring') {
      if (state.featureSettings.ignoring) {
        toggleFeatureSetting('ignoring');
      } else {
        pauseWarning.hidden = false;
      }
      return;
    }
    toggleFeatureSetting(row.dataset.featureSetting);
  });
});
$('pause-cancel').addEventListener('click', closePauseWarning);
$('pause-confirm').addEventListener('click', async () => {
  closePauseWarning();
  await toggleFeatureSetting('ignoring');
});
$('module-search').addEventListener('input', () => renderModules(state.runtime));
$('morphe-refresh-btn').addEventListener('click', loadMorpheModules);
const langPicker = $('lang-picker');
$('lang-btn').addEventListener('click', () => { langPicker.classList.add('show'); langPicker.setAttribute('aria-hidden', 'false'); });
function openExternalUrl(url) {
  const command = '/system/bin/am start -a android.intent.action.VIEW -d ' + shellQuote(url);
  run(command).then(result => {
    if (result.errno !== 0) showToast(t('unableOpenLink'));
  });
}
$('support-btn').addEventListener('click', () => openExternalUrl('https://meowdump.github.io'));
const githubUrl = 'https://github.com/MeowDump/MeowZygisk';
document.querySelectorAll('.brand-github').forEach(link => {
  link.addEventListener('click', event => {
    event.preventDefault();
    openExternalUrl(githubUrl);
  });
});
langPicker.querySelector('.lang-picker-backdrop').addEventListener('click', () => { langPicker.classList.remove('show'); langPicker.setAttribute('aria-hidden', 'true'); });
langPicker.querySelector('.lang-picker-close').addEventListener('click', () => { langPicker.classList.remove('show'); langPicker.setAttribute('aria-hidden', 'true'); });
document.querySelectorAll('.lang-option').forEach(btn => btn.addEventListener('click', () => { setLanguage(btn.dataset.lang); langPicker.classList.remove('show'); langPicker.setAttribute('aria-hidden', 'true'); }));
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') closeReportBug();
  if (e.key.toLowerCase() === 'r' && !['INPUT', 'TEXTAREA'].includes(document.activeElement.tagName)) refresh();
});
applyTheme(currentTheme);
applyTranslations();
try { if (typeof fullScreen === 'function') fullScreen(true); } catch (_) {}
refresh(true);
loadMorpheModules();
setInterval(() => refresh(false), 15000);
