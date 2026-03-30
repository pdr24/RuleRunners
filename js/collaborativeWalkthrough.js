/* ═══════════════════════════════════════════════
   collaborativeWalkthrough.js — Cooperative Level

   Two players share one device. Roles alternate each
   scenario:
     Sensor Player  — observes the canvas, selects
                      which sensors are active
     Rule Player    — sees only the selected sensors,
                      picks which rule fires

   8 predefined scenarios. Players must complete at
   least 4 before "Proceed" appears. Scoring:
     +1 sensors fully correct
     +1 rule correct
   ═══════════════════════════════════════════════ */

// ── SHARED RULE SET ─────────────────────────────
const CW_RULES = [
  { cond: 'gap_ahead',     action: 'jump'       },
  { cond: 'hazard_nearby', action: 'jump'       },
  { cond: 'coin_nearby',   action: 'dash'       },
  { cond: 'near_wall',     action: 'change_dir' },
  { cond: 'grounded',      action: 'move_right' },
];

// ── SENSOR LIST ─────────────────────────────────
const CW_SENSORS = [
  { key: 'gap_ahead',     label: 'Gap ahead',     color: '#00f5ff' },
  { key: 'coin_nearby',   label: 'Coin nearby',   color: '#ffd60a' },
  { key: 'hazard_nearby', label: 'Hazard nearby', color: '#ff2d55' },
  { key: 'near_wall',     label: 'Near wall',     color: '#8b5cf6' },
  { key: 'grounded',      label: 'Grounded',      color: '#00ff88' },
];
const CW_NONE_KEY = '__none__';

// ── SNAPSHOT HELPER ─────────────────────────────
function cwSnap(x, y, dir, sensors, grounded) {
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

/* ── 8 SCENARIOS ───────────────────────────────
   Each has:
     context      — situation shown above the canvas
     camX         — camera offset
     agent        — frozen agent snapshot
     activeSensors — array of active sensor keys (truth)
     correctRule  — index into CW_RULES that fires
     explanation  — shown on reveal screen
   ─────────────────────────────────────────────── */
const CW_SCENARIOS = [

  // 1 — grounded + coin nearby → dash
  {
    context: 'The agent is on the opening platform. A coin glitters just ahead.',
    camX: 0,
    agent: cwSnap(60, 272, 1, { grounded: true, coin_nearby: true }, true),
    activeSensors: ['grounded', 'coin_nearby'],
    correctRule: 2,
    explanation: 'The agent is grounded and a coin is nearby. Rules are checked top-to-bottom — gap_ahead? No. hazard_nearby? No. coin_nearby? Yes! Rule 3 fires: DASH.',
  },

  // 2 — grounded only → move_right
  {
    context: 'Clear ground, nothing special detected. The agent moves forward.',
    camX: 0,
    agent: cwSnap(140, 272, 1, { grounded: true }, true),
    activeSensors: ['grounded'],
    correctRule: 4,
    explanation: 'Only grounded is active. No gap, no hazard, no coin, no wall. The fallback rule — Rule 5 — fires: MOVE RIGHT.',
  },

  // 3 — grounded + gap ahead → jump
  {
    context: 'The platform ends. A gap has been detected straight ahead!',
    camX: 0,
    agent: cwSnap(168, 272, 1, { grounded: true, gap_ahead: true }, true),
    activeSensors: ['grounded', 'gap_ahead'],
    correctRule: 0,
    explanation: 'Grounded and gap_ahead are both active. Rule 1 — gap_ahead → JUMP — is the highest-priority matching rule, so it fires first.',
  },

  // 4 — airborne, none active → (no rule fires — grounded is false)
  {
    context: 'The agent is mid-jump over the gap. Nothing is close enough to detect.',
    camX: 0,
    agent: cwSnap(205, 235, 1, {}, false),
    activeSensors: [],
    correctRule: -1,   // no rule fires
    explanation: 'The agent is airborne with no sensors active. None of the five rules have a matching condition — no rule fires this frame.',
  },

  // 5 — grounded + hazard nearby → jump
  {
    context: 'Landed on the next platform. A spike hazard is dangerously close!',
    camX: 0,
    agent: cwSnap(268, 272, 1, { grounded: true, hazard_nearby: true }, true),
    activeSensors: ['grounded', 'hazard_nearby'],
    correctRule: 1,
    explanation: 'Grounded and hazard_nearby are active. gap_ahead is not, so Rule 1 is skipped. Rule 2 — hazard_nearby → JUMP — fires.',
  },

  // 6 — grounded + coin + hazard → hazard wins (rule priority)
  {
    context: 'A coin AND a patrolling enemy are both within sensor range. Which rule wins?',
    camX: 200,
    agent: cwSnap(535, 272, 1, { grounded: true, coin_nearby: true, hazard_nearby: true }, true),
    activeSensors: ['grounded', 'coin_nearby', 'hazard_nearby'],
    correctRule: 1,
    explanation: 'Both coin_nearby and hazard_nearby are active. Rules are checked top-to-bottom: hazard_nearby (Rule 2) comes before coin_nearby (Rule 3), so Rule 2 fires: JUMP.',
  },

  // 7 — grounded + near wall → change_dir
  {
    context: 'The agent has run into the right edge of a platform — a wall blocks the path.',
    camX: 200,
    agent: cwSnap(636, 272, 1, { grounded: true, near_wall: true }, true),
    activeSensors: ['grounded', 'near_wall'],
    correctRule: 3,
    explanation: 'Grounded and near_wall are active. No gap, hazard, or coin. Rule 4 — near_wall → CHANGE DIRECTION — fires.',
  },

  // 8 — grounded + gap + coin nearby → gap wins
  {
    context: 'The platform edge is close and a coin floats just beyond. What fires?',
    camX: 100,
    agent: cwSnap(450, 252, 1, { grounded: true, gap_ahead: true, coin_nearby: true }, true),
    activeSensors: ['grounded', 'gap_ahead', 'coin_nearby'],
    correctRule: 0,
    explanation: 'Three sensors active: grounded, gap_ahead, coin_nearby. Rule 1 — gap_ahead → JUMP — is the highest-priority match and fires first.',
  },
];

// ── STATE ────────────────────────────────────────
let cwScenarioIdx   = 0;
let cwCompleted     = 0;
let cwTotalScore    = 0;
let cwSensorCorrect = false;
let cwRuleCorrect   = false;
let cwSensorPlayerIdx = 0;   // 0 = Player 1 is sensor first

let cwSelectedSensors = new Set();
let cwSelectedRule    = null;

let cwPhase = 'intro';

let cwLevel  = null;

// ── INIT ─────────────────────────────────────────
window.addEventListener('load', () => {
  cwLevel = createLevel();
  cwResizeCanvas();
  cwShowPhase('intro');  // start with intro overlay
  window.addEventListener('resize', cwResizeCanvas);
});

function cwResizeCanvas() {
  ['cw-canvas-sensor', 'cw-canvas-reveal'].forEach(id => {
    const canvas = document.getElementById(id);
    if (!canvas) return;
    const wrap = canvas.parentElement;
    canvas.width  = wrap.clientWidth  || 700;
    canvas.height = wrap.clientHeight || 300;
  });
}

// ── PHASE CONTROLLER ─────────────────────────────
function cwShowPhase(phase) {
  cwPhase = phase;

  // Hide all sections
  ['cw-overlay', 'cw-sensor-screen', 'cw-rule-screen', 'cw-reveal-screen']
    .forEach(id => document.getElementById(id).style.display = 'none');

  const scenario   = CW_SCENARIOS[cwScenarioIdx];
  const sensorName = cwSensorPlayerIdx === 0 ? 'Player 1' : 'Player 2';
  const ruleName   = cwSensorPlayerIdx === 0 ? 'Player 2' : 'Player 1';

  // ── INTRO overlay ───────────────────────────────
  if (phase === 'intro') {
    cwSetOverlay('blue', 'COLLABORATIVE WALKTHROUGH', '');
    document.getElementById('cw-overlay-bottom').innerHTML =
      `One player identifies which sensors are active.<br>
       The other picks the rule — without seeing the environment.<br><br>
       Roles swap after every scenario.<br>
       Complete at least 4 scenarios to proceed.`;
    document.getElementById('cw-overlay-tap').textContent = 'tap anywhere to begin';
    const overlayIntro = document.getElementById('cw-overlay');
    overlayIntro.onclick = null;
    overlayIntro.style.display = 'flex';
    overlayIntro.onclick = () => cwShowPhase('overlay-sensor');

  // ── Sensor player overlay ───────────────────────
  } else if (phase === 'overlay-sensor') {
    cwSetOverlay(
      cwSensorPlayerIdx === 1 ? 'orange' : 'blue',
      `${ruleName.toUpperCase()} — CLOSE YOUR EYES`,
      `${sensorName.toUpperCase()} — TAP ANYWHERE TO BEGIN`
    );
    const overlaySensor = document.getElementById('cw-overlay');
    overlaySensor.onclick = null;
    overlaySensor.style.display = 'flex';
    overlaySensor.onclick = () => cwShowPhase('sensor');

  } else if (phase === 'sensor') {
    document.getElementById('cw-sensor-screen').style.display = 'flex';
    document.getElementById('cw-sensor-player-label').textContent =
      `${sensorName} — Sensor Detection`;
    document.getElementById('cw-sensor-context').textContent = scenario.context;
    document.getElementById('cw-scenario-num-sensor').textContent =
      `Scenario ${cwScenarioIdx + 1} of ${CW_SCENARIOS.length}`;
    cwSelectedSensors = new Set();
    cwRenderSensorChoices();
    document.getElementById('cw-sensor-feedback').textContent = '';
    setTimeout(() => { cwResizeCanvas(); cwDrawSensorCanvas(); }, 30);

  } else if (phase === 'overlay-rule') {
    cwSetOverlay(
      cwSensorPlayerIdx === 0 ? 'orange' : 'blue',
      `${sensorName.toUpperCase()} — CLOSE YOUR EYES`,
      `${ruleName.toUpperCase()} — TAP ANYWHERE TO BEGIN`
    );
    const overlayRule = document.getElementById('cw-overlay');
    overlayRule.onclick = null;
    overlayRule.style.display = 'flex';
    overlayRule.onclick = () => cwShowPhase('rule');

  } else if (phase === 'rule') {
    document.getElementById('cw-rule-screen').style.display = 'flex';
    document.getElementById('cw-rule-player-label').textContent =
      `${ruleName} — Rule Selection`;
    document.getElementById('cw-scenario-num-rule').textContent =
      `Scenario ${cwScenarioIdx + 1} of ${CW_SCENARIOS.length}`;

    cwSelectedRule = null;
    cwRenderActiveSensorList();
    cwRenderRuleChoices();
    document.getElementById('cw-rule-feedback').textContent = '';

  } else if (phase === 'overlay-reveal') {
    cwSetOverlay('green', 'BOTH PLAYERS — LOOK NOW', 'TAP ANYWHERE TO REVEAL THE ANSWER');
    const overlayReveal = document.getElementById('cw-overlay');
    overlayReveal.onclick = null;
    overlayReveal.style.display = 'flex';
    overlayReveal.onclick = () => cwShowPhase('reveal');

  } else if (phase === 'reveal') {
    document.getElementById('cw-reveal-screen').style.display = 'flex';
    document.getElementById('cw-scenario-num-reveal').textContent =
      `Scenario ${cwScenarioIdx + 1} of ${CW_SCENARIOS.length}`;
    cwBuildReveal();
    setTimeout(() => { cwResizeCanvas(); cwDrawRevealCanvas(); }, 30);
  }
}

// ── OVERLAY HELPER ───────────────────────────────
function cwSetOverlay(color, topText, bottomText) {
  const overlay = document.getElementById('cw-overlay');
  const colors  = { blue: '#0a1628', orange: '#1a0d06', green: '#061a0e' };
  const accents = { blue: '#00f5ff', orange: '#ff6b35', green: '#00ff88' };
  overlay.style.background = colors[color] || colors.blue;
  document.getElementById('cw-overlay-top').textContent    = topText;
  document.getElementById('cw-overlay-bottom').innerHTML   = bottomText;
  document.getElementById('cw-overlay-top').style.color    = accents[color];
  document.getElementById('cw-overlay-bottom').style.color = '#e8f0ff';
}

// ── CANVAS DRAWING ───────────────────────────────
function cwDrawSensorCanvas() {
  const canvas = document.getElementById('cw-canvas-sensor');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const sc  = CW_SCENARIOS[cwScenarioIdx];
  drawLevel(ctx, canvas.width, canvas.height, cwLevel, sc.agent, sc.camX, 'green');
  cwDrawRing(ctx, sc.agent, sc.camX);
}

function cwDrawRevealCanvas() {
  const canvas = document.getElementById('cw-canvas-reveal');
  if (!canvas) return;
  canvas.width  = canvas.parentElement.clientWidth  || 400;
  canvas.height = canvas.parentElement.clientHeight || 300;
  const ctx = canvas.getContext('2d');
  const sc  = CW_SCENARIOS[cwScenarioIdx];
  drawLevel(ctx, canvas.width, canvas.height, cwLevel, sc.agent, sc.camX, 'green');
  cwDrawRing(ctx, sc.agent, sc.camX);
}

function cwDrawRing(ctx, agent, camX) {
  const ox = -camX;
  const cx = agent.x + ox + agent.w / 2;
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

// ── SENSOR PHASE ─────────────────────────────────
function cwRenderSensorChoices() {
  const list = document.getElementById('cw-sensor-list');
  const opts = [...CW_SENSORS, { key: CW_NONE_KEY, label: 'None of the above', color: '#3a5070' }];
  list.innerHTML = opts.map(s => {
    const sel = cwSelectedSensors.has(s.key);
    return `
      <div class="cw-choice ${sel ? 'cw-choice-selected' : ''}"
           onclick="cwToggleSensor('${s.key}')"
           style="${sel ? `border-color:${s.color};background:${s.color}15` : ''}">
        <span class="cw-choice-dot" style="background:${s.key !== CW_NONE_KEY ? s.color : 'var(--text-dim)'}"></span>
        <span class="cw-choice-label">${s.label}</span>
        ${sel ? '<span class="cw-tick">✓</span>' : ''}
      </div>`;
  }).join('');
}

function cwToggleSensor(key) {
  if (key === CW_NONE_KEY) {
    cwSelectedSensors.has(CW_NONE_KEY)
      ? cwSelectedSensors.delete(CW_NONE_KEY)
      : (cwSelectedSensors.clear(), cwSelectedSensors.add(CW_NONE_KEY));
  } else {
    cwSelectedSensors.delete(CW_NONE_KEY);
    cwSelectedSensors.has(key) ? cwSelectedSensors.delete(key) : cwSelectedSensors.add(key);
  }
  cwRenderSensorChoices();
}

function cwSubmitSensors() {
  if (cwSelectedSensors.size === 0) {
    document.getElementById('cw-sensor-feedback').textContent =
      '⚠ Select at least one option (or "None of the above").';
    return;
  }

  const sc      = CW_SCENARIOS[cwScenarioIdx];
  const correct = new Set(sc.activeSensors.length === 0 ? [CW_NONE_KEY] : sc.activeSensors);
  cwSensorCorrect = cwSetsEqual(cwSelectedSensors, correct);

  cwShowPhase('overlay-rule');
}

// ── RULE PHASE ───────────────────────────────────
function cwRenderActiveSensorList() {
  const container = document.getElementById('cw-active-sensors-display');
  const opts = [...CW_SENSORS, { key: CW_NONE_KEY, label: 'None of the above', color: '#3a5070' }];
  container.innerHTML = opts.map(s => {
    const active = cwSelectedSensors.has(s.key);
    return `
      <div class="cw-sensor-badge ${active ? 'cw-badge-active' : 'cw-badge-inactive'}"
           style="${active ? `border-color:${s.color};color:${s.color}` : ''}">
        ${active ? '●' : '○'} ${s.label}
      </div>`;
  }).join('');
}

function cwRenderRuleChoices(highlightCorrect = false, highlightWrong = -1) {
  const sc   = CW_SCENARIOS[cwScenarioIdx];
  const list = document.getElementById('cw-rule-list');
  list.innerHTML = CW_RULES.map((r, i) => {
    let cls = 'cw-choice';
    if (highlightCorrect && i === sc.correctRule) cls += ' cw-choice-correct';
    else if (highlightWrong === i)                cls += ' cw-choice-wrong';
    else if (cwSelectedRule === i)                cls += ' cw-choice-selected';
    return `
      <div class="${cls}" onclick="cwSelectRule(${i})">
        <span class="cw-rule-num">${i + 1}</span>
        <span class="cw-rule-text">${ruleHTML(r.cond, r.action)}</span>
      </div>`;
  }).join('');

  if (sc.correctRule === -1) {
    const noRuleEl = document.getElementById('cw-no-rule-option');
    if (noRuleEl) {
      noRuleEl.className = 'cw-choice' +
        (highlightCorrect ? ' cw-choice-correct' : cwSelectedRule === -2 ? ' cw-choice-selected' : '');
    }
  }
}

function cwSelectRule(i) {
  if (document.getElementById('cw-rule-submit-btn').disabled) return;
  cwSelectedRule = i;
  cwRenderRuleChoices();
}

function cwSelectNoRule() {
  if (document.getElementById('cw-rule-submit-btn').disabled) return;
  cwSelectedRule = -2;
  cwRenderRuleChoices();
}

function cwSubmitRule() {
  const sc = CW_SCENARIOS[cwScenarioIdx];
  if (cwSelectedRule === null) {
    document.getElementById('cw-rule-feedback').textContent = '⚠ Select a rule first.';
    return;
  }

  const playerChoice = cwSelectedRule === -2 ? -1 : cwSelectedRule;
  cwRuleCorrect = playerChoice === sc.correctRule;

  cwShowPhase('overlay-reveal');
}

// ── REVEAL PHASE ─────────────────────────────────
function cwBuildReveal() {
  const sc = CW_SCENARIOS[cwScenarioIdx];

  document.getElementById('cw-explanation').textContent = sc.explanation;

  const roundScore = (cwSensorCorrect ? 1 : 0) + (cwRuleCorrect ? 1 : 0);
  cwTotalScore += roundScore;

  const sensorEl = document.getElementById('cw-sensor-result');
  sensorEl.textContent = cwSensorCorrect ? '✓ Sensors correct' : '✗ Sensors incorrect';
  sensorEl.style.color = cwSensorCorrect ? 'var(--accent-green)' : 'var(--accent-red)';

  const ruleEl = document.getElementById('cw-rule-result');
  ruleEl.textContent = cwRuleCorrect ? '✓ Rule correct' : '✗ Rule incorrect';
  ruleEl.style.color = cwRuleCorrect ? 'var(--accent-green)' : 'var(--accent-red)';

  document.getElementById('cw-round-score').textContent = `Round: ${roundScore} / 2`;
  document.getElementById('cw-total-score').textContent = `Total score: ${cwTotalScore}`;

  cwBuildSensorReveal();
  cwBuildRuleReveal();

  cwCompleted++;
  document.getElementById('cw-next-btn').style.display = '';
  const proceedBtn = document.getElementById('cw-proceed-btn');
  if (cwCompleted >= 4) proceedBtn.style.display = '';
  else proceedBtn.style.display = 'none';

  if (cwScenarioIdx >= CW_SCENARIOS.length - 1) {
    document.getElementById('cw-next-btn').style.display = 'none';
  }
}

function cwBuildSensorReveal() {
  const sc      = CW_SCENARIOS[cwScenarioIdx];
  const correct = new Set(sc.activeSensors.length === 0 ? [CW_NONE_KEY] : sc.activeSensors);
  const opts    = [...CW_SENSORS, { key: CW_NONE_KEY, label: 'None of the above', color: '#3a5070' }];
  const container = document.getElementById('cw-reveal-sensors');

  container.innerHTML = opts.map(s => {
    const wasSelected = cwSelectedSensors.has(s.key);
    const isCorrect   = correct.has(s.key);
    let cls = 'cw-reveal-item', icon = '○';
    if (isCorrect && wasSelected)       { cls += ' cw-reveal-correct'; icon = '✓'; }
    else if (isCorrect && !wasSelected) { cls += ' cw-reveal-missed';  icon = '!'; }
    else if (!isCorrect && wasSelected) { cls += ' cw-reveal-wrong';   icon = '✗'; }
    return `<div class="${cls}"><span class="cw-reveal-icon">${icon}</span>${s.label}</div>`;
  }).join('');
}

function cwBuildRuleReveal() {
  const sc   = CW_SCENARIOS[cwScenarioIdx];
  const list = document.getElementById('cw-reveal-rules');
  const playerChoice = cwSelectedRule === -2 ? -1 : cwSelectedRule;

  let html = CW_RULES.map((r, i) => {
    let cls = 'cw-reveal-item';
    if (i === sc.correctRule)                              cls += ' cw-reveal-correct';
    if (i === playerChoice && i !== sc.correctRule)        cls += ' cw-reveal-wrong';
    return `<div class="${cls}">
      ${i === sc.correctRule ? '<span class="cw-reveal-icon">✓</span>' :
        i === playerChoice   ? '<span class="cw-reveal-icon">✗</span>' :
                               '<span class="cw-reveal-icon">○</span>'}
      ${ruleHTML(r.cond, r.action)}
    </div>`;
  }).join('');

  if (sc.correctRule === -1) {
    html += `<div class="cw-reveal-item cw-reveal-correct">
      <span class="cw-reveal-icon">✓</span>No rule fires
    </div>`;
  } else if (playerChoice === -1) {
    html += `<div class="cw-reveal-item cw-reveal-wrong">
      <span class="cw-reveal-icon">✗</span>No rule fires (your selection)
    </div>`;
  }

  list.innerHTML = html;
}

// ── NAVIGATION ───────────────────────────────────
function cwNextScenario() {
  cwScenarioIdx++;
  cwLevel = createLevel();
  cwSensorPlayerIdx = cwSensorPlayerIdx === 0 ? 1 : 0;
  cwShowPhase('overlay-sensor');
}

// ── UTILITY ──────────────────────────────────────
function cwSetsEqual(a, b) {
  if (a.size !== b.size) return false;
  for (const v of a) if (!b.has(v)) return false;
  return true;
}