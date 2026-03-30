/* ═══════════════════════════════════════════════
   practiceCollaborativeWalkthrough.js

   Single-scenario practice run. Both players see
   the screen at all times — no overlays. All three
   panels (canvas, sensors, rules) are visible
   simultaneously.

   On submit, the layout does NOT change. Only:
     - Sensor and rule cards recolour in place
     - Instruction bar swaps to show score
     - Context bar swaps to show explanation
     - Submit button swaps to Try Again + Proceed

   Scoring: +1 sensors correct, +1 rule correct.
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

// ── THE ONE PRACTICE SCENARIO ────────────────────
const PCW_SCENARIO = {
  context: 'The agent is on a platform. A coin glints ahead — but so does a hazard spike! The platform edge is also approaching. Determine which are close enough to trigger the sensors!',
  camX: 0,
  agent: pcwSnap(80, 272, 1,
    { grounded: true, coin_nearby: true, hazard_nearby: false, gap_ahead: false },
    true),
  activeSensors: ['grounded', 'coin_nearby'],
  correctRule: 2,  // coin_nearby → dash
  explanation: 'Two sensors are active: grounded and coin_nearby. Rules fire top-to-bottom — gap_ahead? No. hazard_nearby? No. coin_nearby? Yes! Rule 3 fires: DASH.',
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
  pcwDrawRing(ctx);
}

function pcwDrawRing(ctx) {
  const agent = PCW_SCENARIO.agent;
  const cx = agent.x - PCW_SCENARIO.camX + agent.w / 2;
  const cy = agent.y + agent.h / 2;
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, SENSOR_RANGE, -Math.PI / 2, Math.PI / 2);
  ctx.fillStyle = 'rgba(255,255,255,0.04)';
  ctx.fill();
  ctx.beginPath();
  ctx.arc(cx, cy, SENSOR_RANGE, -Math.PI / 2, Math.PI / 2);
  ctx.strokeStyle = 'rgba(255,255,255,0.55)';
  ctx.lineWidth = 2;
  ctx.setLineDash([6, 4]);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.restore();
}

// ── SENSOR PANEL ─────────────────────────────────
function pcwRenderSensors(revealMode = false) {
  const list       = document.getElementById('pcw-sensor-list');
  const correctSet = new Set(PCW_SCENARIO.activeSensors);
  const opts       = [...PCW_SENSORS, { key: PCW_NONE_KEY, label: 'None of the above', color: '#3a5070' }];

  list.innerHTML = opts.map(s => {
    const sel     = pcwSelectedSensors.has(s.key);
    const isRight = correctSet.has(s.key);

    let extraClass = '';
    let style      = '';

    if (revealMode) {
      if (isRight && sel)  extraClass = 'pcw-correct';
      else if (isRight)    extraClass = 'pcw-missed';
      else if (sel)        extraClass = 'pcw-wrong';
    } else {
      if (sel) {
        extraClass = 'pcw-selected';
        style = `border-color:${s.color};background:${s.color}15;`;
      }
    }

    const icon = revealMode
      ? (isRight && sel ? '✓' : isRight && !sel ? '!' : sel ? '✗' : '○')
      : (sel ? '✓' : '');

    return `
      <div class="pcw-choice ${extraClass} ${pcwSubmitted ? 'pcw-locked' : ''}"
           onclick="pcwToggleSensor('${s.key}')"
           style="${style}">
        <span class="pcw-choice-dot" style="background:${s.key !== PCW_NONE_KEY ? s.color : 'var(--text-dim)'}"></span>
        <span class="pcw-choice-label">${s.label}</span>
        ${icon ? `<span class="pcw-tick">${icon}</span>` : ''}
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
function pcwRenderRules(revealMode = false) {
  const list = document.getElementById('pcw-rule-list');
  list.innerHTML = PCW_RULES.map((r, i) => {
    const sel = pcwSelectedRule === i;
    let extraClass = '';

    if (revealMode) {
      if (i === PCW_SCENARIO.correctRule)                        extraClass = 'pcw-correct';
      else if (sel && i !== PCW_SCENARIO.correctRule)            extraClass = 'pcw-wrong';
    } else {
      if (sel) extraClass = 'pcw-selected';
    }

    const icon = revealMode
      ? (i === PCW_SCENARIO.correctRule ? '✓' : sel ? '✗' : '')
      : '';

    return `
      <div class="pcw-choice ${extraClass} ${pcwSubmitted ? 'pcw-locked' : ''}"
           onclick="pcwSelectRule(${i})">
        <span class="pcw-rule-num">${i + 1}</span>
        <span class="pcw-choice-label">${ruleHTML(r.cond, r.action)}</span>
        ${icon ? `<span class="pcw-tick">${icon}</span>` : ''}
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
    document.getElementById('pcw-sensor-feedback').textContent = '⚠ Select at least one sensor (or "None").';
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

  // Recolour cards in place
  pcwRenderSensors(true);
  pcwRenderRules(true);

  // Swap instruction bar → score summary
  document.getElementById('pcw-instruction-bar').innerHTML = `
    <span id="pcw-sensor-result"></span> &nbsp;|&nbsp;
    <span id="pcw-rule-result"></span> &nbsp;|&nbsp;
    Score: <strong style="color:var(--accent-cyan);" id="pcw-score-val"></strong>`;
  document.getElementById('pcw-sensor-result').textContent = sensorCorrect ? '✓ Sensors correct' : '✗ Sensors incorrect';
  document.getElementById('pcw-sensor-result').style.color = sensorCorrect ? 'var(--accent-green)' : 'var(--accent-red)';
  document.getElementById('pcw-rule-result').textContent   = ruleCorrect   ? '✓ Rule correct'    : '✗ Rule incorrect';
  document.getElementById('pcw-rule-result').style.color   = ruleCorrect   ? 'var(--accent-green)' : 'var(--accent-red)';
  document.getElementById('pcw-score-val').textContent     = `${score} / 2`;

  // Swap context bar → explanation
  const ctxBar = document.getElementById('pcw-context-bar');
  ctxBar.innerHTML = `<strong>EXPLANATION ▸</strong> <span>${PCW_SCENARIO.explanation}</span>`;
  ctxBar.style.background  = 'rgba(139,92,246,0.08)';
  ctxBar.style.borderColor = 'rgba(139,92,246,0.25)';

  // Swap submit → nav buttons
  document.getElementById('pcw-submit-btn').style.display = 'none';
  document.getElementById('pcw-nav-btns').style.display   = 'flex';
}

// ── RESTART ──────────────────────────────────────
function pcwRestart() {
  pcwSelectedSensors = new Set();
  pcwSelectedRule    = null;
  pcwSubmitted       = false;
  pcwLevel           = createLevel();

  document.getElementById('pcw-sensor-feedback').textContent = '';
  document.getElementById('pcw-rule-feedback').textContent   = '';

  // Restore instruction bar
  document.getElementById('pcw-instruction-bar').innerHTML =
    `👥 <span>Both players — look at the environment, agree on which sensors are active, then agree on which rule fires. Submit when ready.</span>`;

  // Restore context bar
  const ctxBar = document.getElementById('pcw-context-bar');
  ctxBar.innerHTML         = `<strong>SITUATION ▸</strong> <span id="pcw-context">${PCW_SCENARIO.context}</span>`;
  ctxBar.style.background  = 'rgba(0,128,255,0.07)';
  ctxBar.style.borderColor = 'var(--border)';

  // Swap nav → submit
  document.getElementById('pcw-submit-btn').style.display = '';
  document.getElementById('pcw-nav-btns').style.display   = 'none';

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