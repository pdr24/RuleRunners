/* ═══════════════════════════════════════════════
   practiceCollaborativeWalkthrough.js

   Single-scenario practice run. Both players see
   the screen at all times — no overlays. All three
   panels (canvas, sensors, rules) are visible
   simultaneously. Players submit sensors and rule
   together in one action, then see the reveal.

   Scoring: +1 sensors correct, +1 rule correct.
   Proceed button always appears after one attempt.
   ═══════════════════════════════════════════════ */

// ── RULES ────────────────────────────────────────
const PCW_RULES = [
  { cond: 'gap_ahead',     action: 'jump'       },
  { cond: 'hazard_nearby', action: 'jump'       },
  { cond: 'coin_nearby',   action: 'dash'       },
  { cond: 'near_wall',     action: 'change_dir' },
  { cond: 'grounded',      action: 'move_right' },
];

// ── SENSORS ──────────────────────────────────────
const PCW_SENSORS = [
  { key: 'gap_ahead',     label: 'Gap ahead',     color: '#00f5ff' },
  { key: 'coin_nearby',   label: 'Coin nearby',   color: '#ffd60a' },
  { key: 'hazard_nearby', label: 'Hazard nearby', color: '#ff2d55' },
  { key: 'near_wall',     label: 'Near wall',     color: '#8b5cf6' },
  { key: 'grounded',      label: 'Grounded',      color: '#00ff88' },
];
const PCW_NONE_KEY = '__none__';

// ── SNAPSHOT HELPER ──────────────────────────────
function pcwSnap(x, y, dir, sensors, grounded) {
  return {
    x, y, w: 22, h: 28,
    vx: 0, vy: 0, dir, grounded,
    coins: 0, distMax: x, alive: true, finished: false,
    resetCount: 0, activeRuleIdx: -1,
    sensors: Object.assign(
      { gap_ahead: false, coin_nearby: false, hazard_nearby: false,
        grounded: false, near_wall: false },
      sensors
    ),
  };
}

/* ── THE ONE PRACTICE SCENARIO ──────────────────
   Four sensors active simultaneously — students
   must discuss all of them and understand rule
   priority (gap_ahead beats hazard and coin).
   ─────────────────────────────────────────────── */
const PCW_SCENARIO = {
  context: 'The agent is on a platform. A coin glints ahead — but so does a hazard spike! The platform edge is also approaching. Determine which are close enough to trigger the sensors!',
  camX: 0,
  agent: pcwSnap(80, 272, 1,
    { grounded: true, coin_nearby: true, hazard_nearby: false, gap_ahead: false },
    true),
  activeSensors: ['grounded', 'coin_nearby'],
  correctRule: 2,  // coin nearby -> dash
  explanation: 'Two sensors are active: grounded, coin_nearby. Rules fire top-to-bottom — coin_nearby (Rule 3) is checked first and matches, so Rule 3 fires: DASH.',

};

// ── STATE ────────────────────────────────────────
let pcwSelectedSensors = new Set();
let pcwSelectedRule    = null;
let pcwLevel           = null;
let pcwSubmitted       = false;

// ── INIT ─────────────────────────────────────────
window.addEventListener('load', () => {
  pcwLevel = createLevel();
  document.getElementById('pcw-context').textContent = PCW_SCENARIO.context;
  pcwRenderSensors();
  pcwRenderRules();
  pcwResizeCanvas();
  pcwDrawCanvas();
  window.addEventListener('resize', () => { pcwResizeCanvas(); pcwDrawCanvas(); });
});

function pcwResizeCanvas() {
  const canvas = document.getElementById('pcw-canvas');
  if (!canvas) return;
  canvas.width  = canvas.parentElement.clientWidth  || 600;
  canvas.height = canvas.parentElement.clientHeight || 300;
}

function pcwDrawCanvas() {
  const canvas = document.getElementById('pcw-canvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  drawLevel(ctx, canvas.width, canvas.height, pcwLevel, PCW_SCENARIO.agent, PCW_SCENARIO.camX, 'green');
  pcwDrawRing(ctx, canvas.width, canvas.height);
}

function pcwDrawRing(ctx) {
  const agent = PCW_SCENARIO.agent;
  const camX  = PCW_SCENARIO.camX;
  const cx = agent.x - camX + agent.w / 2;
  const cy = agent.y + agent.h / 2;
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, SENSOR_RANGE, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(255,255,255,0.04)';
  ctx.fill();
  ctx.beginPath();
  ctx.arc(cx, cy, SENSOR_RANGE, 0, Math.PI * 2);
  ctx.strokeStyle = 'rgba(255,255,255,0.55)';
  ctx.lineWidth = 2;
  ctx.setLineDash([6, 4]);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.restore();
}

// ── SENSOR PANEL ─────────────────────────────────
function pcwRenderSensors() {
  const list = document.getElementById('pcw-sensor-list');
  const opts = [...PCW_SENSORS, { key: PCW_NONE_KEY, label: 'None of the above', color: '#3a5070' }];
  list.innerHTML = opts.map(s => {
    const sel = pcwSelectedSensors.has(s.key);
    return `
      <div class="pcw-choice ${sel ? 'pcw-selected' : ''} ${pcwSubmitted ? 'pcw-locked' : ''}"
           onclick="pcwToggleSensor('${s.key}')"
           style="${sel ? `border-color:${s.color};background:${s.color}15;` : ''}">
        <span class="pcw-choice-dot" style="background:${s.key !== PCW_NONE_KEY ? s.color : 'var(--text-dim)'}"></span>
        <span class="pcw-choice-label">${s.label}</span>
        ${sel ? '<span class="pcw-tick">✓</span>' : ''}
      </div>`;
  }).join('');
}

function pcwToggleSensor(key) {
  if (pcwSubmitted) return;
  if (key === PCW_NONE_KEY) {
    pcwSelectedSensors.has(PCW_NONE_KEY)
      ? pcwSelectedSensors.delete(PCW_NONE_KEY)
      : (pcwSelectedSensors.clear(), pcwSelectedSensors.add(PCW_NONE_KEY));
  } else {
    pcwSelectedSensors.delete(PCW_NONE_KEY);
    pcwSelectedSensors.has(key) ? pcwSelectedSensors.delete(key) : pcwSelectedSensors.add(key);
  }
  pcwRenderSensors();
}

// ── RULE PANEL ───────────────────────────────────
function pcwRenderRules() {
  const list = document.getElementById('pcw-rule-list');
  list.innerHTML = PCW_RULES.map((r, i) => {
    const sel = pcwSelectedRule === i;
    return `
      <div class="pcw-choice ${sel ? 'pcw-selected' : ''} ${pcwSubmitted ? 'pcw-locked' : ''}"
           onclick="pcwSelectRule(${i})">
        <span class="pcw-rule-num">${i + 1}</span>
        <span class="pcw-choice-label">${ruleHTML(r.cond, r.action)}</span>
      </div>`;
  }).join('');
}

function pcwSelectRule(i) {
  if (pcwSubmitted) return;
  pcwSelectedRule = i;
  pcwRenderRules();
}

// ── SUBMIT ───────────────────────────────────────
function pcwSubmit() {
  // Validate
  let valid = true;
  if (pcwSelectedSensors.size === 0) {
    document.getElementById('pcw-sensor-feedback').textContent =
      '⚠ Select at least one sensor (or "None").';
    valid = false;
  } else {
    document.getElementById('pcw-sensor-feedback').textContent = '';
  }
  if (pcwSelectedRule === null) {
    document.getElementById('pcw-rule-feedback').textContent = '⚠ Select a rule.';
    valid = false;
  } else {
    document.getElementById('pcw-rule-feedback').textContent = '';
  }
  if (!valid) return;

  pcwSubmitted = true;

  // Grade
  const correctSensors = new Set(PCW_SCENARIO.activeSensors);
  const sensorCorrect  = pcwSetsEqual(pcwSelectedSensors, correctSensors);
  const ruleCorrect    = pcwSelectedRule === PCW_SCENARIO.correctRule;
  const score          = (sensorCorrect ? 1 : 0) + (ruleCorrect ? 1 : 0);

  // Show reveal screen
  document.getElementById('pcw-main-screen').style.display   = 'none';
  document.getElementById('pcw-reveal-screen').style.display = 'flex';

  document.getElementById('pcw-explanation').textContent = PCW_SCENARIO.explanation;
  document.getElementById('pcw-round-score').textContent  = `${score} / 2`;

  document.getElementById('pcw-sensor-result').textContent =
    sensorCorrect ? '✓ Correct' : '✗ Incorrect';
  document.getElementById('pcw-sensor-result').style.color =
    sensorCorrect ? 'var(--accent-green)' : 'var(--accent-red)';

  document.getElementById('pcw-rule-result').textContent =
    ruleCorrect ? '✓ Correct' : '✗ Incorrect';
  document.getElementById('pcw-rule-result').style.color =
    ruleCorrect ? 'var(--accent-green)' : 'var(--accent-red)';

  // Sensor reveal
  const allOpts = [...PCW_SENSORS, { key: PCW_NONE_KEY, label: 'None of the above' }];
  document.getElementById('pcw-reveal-sensors').innerHTML = allOpts.map(s => {
    const wasSel   = pcwSelectedSensors.has(s.key);
    const isRight  = correctSensors.has(s.key);
    let cls = 'pcw-reveal-item', icon = '○';
    if (isRight && wasSel)   { cls += ' pcw-reveal-correct'; icon = '✓'; }
    else if (isRight && !wasSel) { cls += ' pcw-reveal-missed';  icon = '!'; }
    else if (!isRight && wasSel) { cls += ' pcw-reveal-wrong';   icon = '✗'; }
    return `<div class="${cls}"><span class="pcw-reveal-icon">${icon}</span>${s.label}</div>`;
  }).join('');

  // Rule reveal
  document.getElementById('pcw-reveal-rules').innerHTML = PCW_RULES.map((r, i) => {
    let cls = 'pcw-reveal-item', icon = '○';
    if (i === PCW_SCENARIO.correctRule)                           { cls += ' pcw-reveal-correct'; icon = '✓'; }
    if (i === pcwSelectedRule && i !== PCW_SCENARIO.correctRule)  { cls += ' pcw-reveal-wrong';   icon = '✗'; }
    return `<div class="${cls}"><span class="pcw-reveal-icon">${icon}</span>${ruleHTML(r.cond, r.action)}</div>`;
  }).join('');

  // Draw reveal canvas
  setTimeout(() => {
    const canvas = document.getElementById('pcw-canvas-reveal');
    if (!canvas) return;
    canvas.width  = canvas.parentElement.clientWidth  || 400;
    canvas.height = canvas.parentElement.clientHeight || 200;
    const ctx = canvas.getContext('2d');
    drawLevel(ctx, canvas.width, canvas.height, pcwLevel, PCW_SCENARIO.agent, PCW_SCENARIO.camX, 'green');
    pcwDrawRevealRing(ctx);
  }, 30);
}

function pcwDrawRevealRing(ctx) {
  const agent = PCW_SCENARIO.agent;
  const camX  = PCW_SCENARIO.camX;
  const cx = agent.x - camX + agent.w / 2;
  const cy = agent.y + agent.h / 2;
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, SENSOR_RANGE, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(255,255,255,0.04)';
  ctx.fill();
  ctx.beginPath();
  ctx.arc(cx, cy, SENSOR_RANGE, 0, Math.PI * 2);
  ctx.strokeStyle = 'rgba(255,255,255,0.55)';
  ctx.lineWidth = 2;
  ctx.setLineDash([6, 4]);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.restore();
}

// ── RESTART ──────────────────────────────────────
function pcwRestart() {
  pcwSelectedSensors = new Set();
  pcwSelectedRule    = null;
  pcwSubmitted       = false;
  pcwLevel           = createLevel();

  document.getElementById('pcw-main-screen').style.display   = 'flex';
  document.getElementById('pcw-reveal-screen').style.display = 'none';
  document.getElementById('pcw-sensor-feedback').textContent = '';
  document.getElementById('pcw-rule-feedback').textContent   = '';

  pcwRenderSensors();
  pcwRenderRules();
  pcwResizeCanvas();
  pcwDrawCanvas();
}

// ── UTILITY ──────────────────────────────────────
function pcwSetsEqual(a, b) {
  if (a.size !== b.size) return false;
  for (const v of a) if (!b.has(v)) return false;
  return true;
}