/* ═══════════════════════════════════════════════
   guided.js — Phase 1.5: Guided Walkthrough
   ═══════════════════════════════════════════════

   The predefined agent uses these 5 rules (in order):
     Rule 1: IF gap_ahead     THEN jump
     Rule 2: IF hazard_nearby THEN jump
     Rule 3: IF coin_nearby   THEN dash
     Rule 4: IF near_wall     THEN change_dir
     Rule 5: IF grounded      THEN move_right

   Each STEP records:
     - agentSnapshot : exact agent state to draw (position, dir, sensors, grounded)
     - camX          : camera offset for that snapshot
     - correctRule   : index (0-based) into GUIDED_RULES that fires
     - hint          : shown after first wrong guess
     - context       : short narrative label shown above the canvas
   ═══════════════════════════════════════════════ */

// ── THE PREDEFINED RULE SET ──────────────────────
const GUIDED_RULES = [
  { cond: 'gap_ahead',     action: 'jump'       },
  { cond: 'hazard_nearby', action: 'jump'       },
  { cond: 'coin_nearby',   action: 'dash'       },
  { cond: 'near_wall',     action: 'change_dir' },
  { cond: 'grounded',      action: 'move_right' },
];

// ── HELPER: build a minimal agent snapshot ───────
function snap(x, y, dir, sensors, grounded) {
  return {
    x, y, w: 22, h: 28,
    vx: 0, vy: 0,
    dir,
    grounded,
    coins: 0, distMax: x, alive: true, finished: false,
    resetCount: 0, activeRuleIdx: -1,
    sensors: Object.assign(
      { gap_ahead: false, coin_nearby: false, hazard_nearby: false, grounded: false, near_wall: false },
      sensors
    ),
  };
}

// ── THE 11 STEPS ─────────────────────────────────
// Level geometry reference (from engine.js createLevel):
//   Platform 0 : x:0    y:300 w:200   — starting platform
//   Platform 1 : x:230  y:300 w:120   — gap at x:200–230
//   Platform 2 : x:380  y:280 w:100   — gap at x:350–380
//   Platform 3 : x:510  y:300 w:150   — gap at x:480–510
//   Hazard spikes at x:310, x:660
//   Enemy patrols x:510–640, x:800–980
//   Coin at x:120, x:260, x:400, x:530 …

const GUIDED_STEPS = [
  // ── Step 1 ── open ground, coin nearby
  {
    context: 'The agent starts on the opening platform. A coin glitters just ahead.',
    camX: 0,
    agent: snap(60, 272, 1,
      { grounded: true, coin_nearby: true },
      true),
    correctRule: 2,   // coin_nearby → dash
    hint: 'Look at what the sensors are detecting. Is anything shiny nearby?',
  },

  // ── Step 2 ── open ground, no special sensor
  {
    context: 'Coin collected. The agent is moving right on clear ground.',
    camX: 0,
    agent: snap(145, 272, 1,
      { grounded: true },
      true),
    correctRule: 4,   // grounded → move_right
    hint: 'No gaps, no hazards, no coins — check the lowest-priority rule that always applies on flat ground.',
  },

  // ── Step 3 ── gap ahead!
  {
    context: 'The platform is about to end. There\'s a gap ahead!',
    camX: 0,
    agent: snap(168, 272, 1,
      { grounded: true, gap_ahead: true },
      true),
    correctRule: 0,   // gap_ahead → jump
    hint: 'The sensor ring in front of the agent is glowing. What does the cyan halo mean?',
  },

  // ── Step 4 ── mid-air after jump, coin nearby on next platform
  {
    context: 'The agent jumped and is now airborne, coin visible on the next platform.',
    camX: 0,
    agent: snap(210, 245, 1,
      { coin_nearby: true },
      false),
    correctRule: 2,   // coin_nearby → dash (grounded=false so jump won't fire, gap_ahead=false)
    hint: 'The agent is in the air — is there a coin within range? Which rule reacts to coins?',
  },

  // ── Step 5 ── landed on platform 1, hazard spike ahead
  {
    context: 'Landed safely. But there\'s a hazard spike right ahead on the gap edge!',
    camX: 0,
    agent: snap(268, 272, 1,
      { grounded: true, hazard_nearby: true },
      true),
    correctRule: 1,   // hazard_nearby → jump
    hint: 'The red dashed ring is active. What does a red sensor ring mean, and which rule responds to it?',
  },

  // ── Step 6 ── clear ground on platform 2 (elevated)
  {
    context: 'Cleared the spike. The agent is on a higher platform moving right.',
    camX: 100,
    agent: snap(410, 252, 1,
      { grounded: true },
      true),
    correctRule: 4,   // grounded → move_right
    hint: 'All sensors are quiet. What is the fallback rule when nothing special is detected?',
  },

  // ── Step 7 ── gap ahead again at platform 2 edge
  {
    context: 'The elevated platform ends soon. Another gap is detected ahead.',
    camX: 100,
    agent: snap(455, 252, 1,
      { grounded: true, gap_ahead: true },
      true),
    correctRule: 0,   // gap_ahead → jump
    hint: 'The cyan halo is back. Remember — gaps come first in the rule list!',
  },

  // ── Step 8 ── on platform 3, enemy patrol coin nearby
  {
    context: 'On a new platform. A coin is nearby but so is a patrolling enemy!',
    camX: 200,
    agent: snap(535, 272, 1,
      { grounded: true, coin_nearby: true, hazard_nearby: true },
      true),
    correctRule: 1,   // hazard_nearby → jump  (fires before coin_nearby, rule 2 > rule 3)
    hint: 'Both a coin AND a hazard are detected. Rules are checked top to bottom — which one comes first?',
  },
  /*
  // ── Step 9 ── landed past enemy, coin now in range, no hazard
  {
    context: 'Jumped clear of the enemy. The coin is still in range, hazard left behind.',
    camX: 200,
    agent: snap(590, 252, 1,
      { grounded: true, coin_nearby: true },
      true),
    correctRule: 2,   // coin_nearby → dash
    hint: 'The hazard is gone now. Only the yellow coin sensor is active — which rule uses that?',
  },

  // ── Step 10 ── hit the right edge of platform 3, near wall
  {
    context: 'The agent has reached a wall at the right edge of the platform.',
    camX: 200,
    agent: snap(636, 272, 1,
      { grounded: true, near_wall: true },
      true),
    correctRule: 3,   // near_wall → change_dir
    hint: 'The purple ring is glowing. The agent can\'t go forward — which rule handles walls?',
  },

  // ── Step 11 ── now facing left after direction change, open ground
  {
    context: 'Direction reversed! The agent now faces left on open ground.',
    camX: 200,
    agent: snap(620, 272, -1,
      { grounded: true },
      true),
    correctRule: 4,   // grounded → move_right  (move_right fires regardless of dir — it sets dir=1)
    hint: 'After changing direction the agent is on flat ground with no sensors firing. What\'s the default movement rule?',
  }, */
];

// ── STATE ────────────────────────────────────────
let currentStep  = 0;
let wrongCount   = 0;   // wrong attempts on the current step
let totalSteps   = GUIDED_STEPS.length;
let correctCount = 0;   // steps answered correctly on first try
let selectedRule = null;
let isAnimating  = false;

// Animation state (agent sliding to next position)
let animAgent    = null;
let animTarget   = null;
let animLevel    = null;
let animCamStart = 0;
let animCamEnd   = 0;
let animProgress = 0;  // 0→1
let animId       = null;
const ANIM_DURATION = 55; // frames at 60fps ≈ 0.9s

// ── INIT ─────────────────────────────────────────
window.addEventListener('load', () => {
  animLevel = createLevel();
  resizeCanvas();
  renderStep();
  window.addEventListener('resize', () => { resizeCanvas(); drawSnapshot(); });
});

function resizeCanvas() {
  const canvas = document.getElementById('guided-canvas');
  const wrap   = canvas.parentElement;
  canvas.width  = wrap.clientWidth  || 800;
  canvas.height = wrap.clientHeight || 300;
}

// ── RENDER CURRENT STEP ──────────────────────────
function renderStep() {
  const step = GUIDED_STEPS[currentStep];
  wrongCount   = 0;
  selectedRule = null;

  // Progress bar
  document.getElementById('step-counter').textContent =
    `Step ${currentStep + 1} of ${totalSteps}`;
  const pct = ((currentStep) / totalSteps) * 100;
  document.getElementById('progress-fill').style.width = pct + '%';

  // Context label
  document.getElementById('step-context').textContent = step.context;

  // Sensor badges
  renderSensorBadges(step.agent.sensors);

  // Rule choices
  renderRuleChoices();

  // Reset feedback
  setFeedback('', '');
  document.getElementById('hint-box').style.display = 'none';
  document.getElementById('next-btn').style.display = 'none';
  document.getElementById('check-btn').style.display = '';

  // Draw canvas
  drawSnapshot();
}

function drawSnapshot() {
  const step   = GUIDED_STEPS[currentStep];
  const canvas = document.getElementById('guided-canvas');
  const ctx    = canvas.getContext('2d');
  drawLevel(ctx, canvas.width, canvas.height, animLevel, step.agent, step.camX, 'green');
}

// ── SENSOR BADGES ────────────────────────────────
function renderSensorBadges(sensors) {
  const container = document.getElementById('sensor-badges');
  const defs = [
    { key: 'gap_ahead',     label: 'Gap ahead',     color: '#00f5ff' },
    { key: 'coin_nearby',   label: 'Coin nearby',   color: '#ffd60a' },
    { key: 'hazard_nearby', label: 'Hazard nearby', color: '#ff2d55' },
    { key: 'near_wall',     label: 'Near wall',     color: '#8b5cf6' },
    { key: 'grounded',      label: 'Grounded',      color: '#00ff88' },
  ];
  container.innerHTML = defs.map(d => {
    const active = sensors[d.key];
    return `<span class="sensor-badge ${active ? 'badge-on' : 'badge-off'}" style="${active ? `border-color:${d.color};color:${d.color};background:${d.color}18` : ''}">
      ${active ? '●' : '○'} ${d.label}
    </span>`;
  }).join('');
}

// ── RULE CHOICES ─────────────────────────────────
function renderRuleChoices(highlightCorrect = false, highlightWrong = -1) {
  const list = document.getElementById('rule-choices');
  list.innerHTML = GUIDED_RULES.map((r, i) => {
    let cls = 'choice-card';
    if (selectedRule === i && !highlightCorrect && highlightWrong !== i) cls += ' choice-selected';
    if (highlightCorrect && i === GUIDED_STEPS[currentStep].correctRule) cls += ' choice-correct';
    if (highlightWrong === i) cls += ' choice-wrong';
    return `
      <div class="${cls}" id="choice-${i}" onclick="selectRule(${i})">
        <span class="choice-num">${i + 1}</span>
        <span class="choice-text">${ruleHTML(r.cond, r.action)}</span>
      </div>`;
  }).join('');
}

function selectRule(i) {
  if (isAnimating) return;
  // Don't allow re-selection after correct answer
  if (document.getElementById('next-btn').style.display !== 'none') return;
  selectedRule = i;
  renderRuleChoices();
}

// ── CHECK ANSWER ─────────────────────────────────
function checkAnswer() {
  if (isAnimating) return;
  if (selectedRule === null) {
    setFeedback('warning', '⚠ Select a rule first!');
    return;
  }

  const step    = GUIDED_STEPS[currentStep];
  const correct = step.correctRule;

  if (selectedRule === correct) {
    // Correct!
    if (wrongCount === 0) correctCount++;
    renderRuleChoices(true, -1);
    setFeedback('correct', `✓ Correct! Rule ${correct + 1} fires — IF ${COND_LABELS[GUIDED_RULES[correct].cond]} THEN ${ACT_LABELS[GUIDED_RULES[correct].action]}.`);
    document.getElementById('hint-box').style.display = 'none';
    document.getElementById('check-btn').style.display = 'none';
    if (currentStep < totalSteps - 1) {
      document.getElementById('next-btn').style.display = '';
    } else {
      document.getElementById('next-btn').style.display = '';
      document.getElementById('next-btn').textContent = 'See Results ▶';
    }
  } else {
    // Wrong
    wrongCount++;
    renderRuleChoices(false, selectedRule);
    selectedRule = null;

    if (wrongCount === 1) {
      // Show hint
      setFeedback('wrong', '✗ Not quite. Here\'s a hint:');
      const hintBox = document.getElementById('hint-box');
      hintBox.textContent = step.hint;
      hintBox.style.display = '';
    } else {
      // Second wrong — reveal and move on
      setFeedback('wrong', `✗ The correct answer was Rule ${correct + 1}: IF ${COND_LABELS[GUIDED_RULES[correct].cond]} THEN ${ACT_LABELS[GUIDED_RULES[correct].action]}.`);
      renderRuleChoices(true, -1);
      document.getElementById('hint-box').style.display = 'none';
      document.getElementById('check-btn').style.display = 'none';
      if (currentStep < totalSteps - 1) {
        document.getElementById('next-btn').style.display = '';
      } else {
        document.getElementById('next-btn').style.display = '';
        document.getElementById('next-btn').textContent = 'See Results ▶';
      }
    }
  }
}

// ── ADVANCE TO NEXT STEP ─────────────────────────
function nextStep() {
  if (isAnimating) return;

  if (currentStep >= totalSteps - 1) {
    showResults();
    return;
  }

  // Animate agent from current position to next step's position
  const fromAgent = GUIDED_STEPS[currentStep].agent;
  const toStep    = GUIDED_STEPS[currentStep + 1];
  startAnimation(fromAgent, toStep.agent, GUIDED_STEPS[currentStep].camX, toStep.camX, () => {
    currentStep++;
    renderStep();
  });
}

// ── ANIMATION ────────────────────────────────────
function startAnimation(fromAgent, toAgent, fromCam, toCam, onDone) {
  isAnimating  = true;
  animProgress = 0;
  animCamStart = fromCam;
  animCamEnd   = toCam;

  // Deep-copy from agent as mutable interpolation object
  animAgent = JSON.parse(JSON.stringify(fromAgent));

  document.getElementById('next-btn').disabled    = true;
  document.getElementById('check-btn').disabled   = true;

  function tick() {
    animProgress++;
    const t  = animProgress / ANIM_DURATION;
    const et = easeInOut(t);

    animAgent.x = fromAgent.x + (toAgent.x - fromAgent.x) * et;
    animAgent.y = fromAgent.y + (toAgent.y - fromAgent.y) * et;
    // Arc upward in the middle of movement (gives a "jump" feel)
    const arc = Math.sin(Math.PI * t) * 30;
    animAgent.y -= arc;

    const camX = animCamStart + (animCamEnd - animCamStart) * et;

    const canvas = document.getElementById('guided-canvas');
    const ctx    = canvas.getContext('2d');
    drawLevel(ctx, canvas.width, canvas.height, animLevel, animAgent, camX, 'green');

    if (animProgress < ANIM_DURATION) {
      animId = requestAnimationFrame(tick);
    } else {
      isAnimating = false;
      document.getElementById('next-btn').disabled  = false;
      document.getElementById('check-btn').disabled = false;
      onDone();
    }
  }
  animId = requestAnimationFrame(tick);
}

function easeInOut(t) {
  return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
}

// ── RESULTS SCREEN ───────────────────────────────
function showResults() {
  document.getElementById('guided-main').style.display    = 'none';
  document.getElementById('guided-results').style.display = 'flex';

  const pct = Math.round((correctCount / totalSteps) * 100);
  document.getElementById('result-accuracy').textContent = pct + '%';
  document.getElementById('result-correct').textContent  = correctCount;
  document.getElementById('result-total').textContent    = totalSteps;

  let msg, cls;
  if (pct === 100) {
    msg = 'Perfect score! You predicted every rule correctly on the first try. You\'ve mastered the logic of rule-based AI!';
    cls = 'grade-perfect';
  } else if (pct >= 70) {
    msg = 'Great work! You understood most of the rules. Review the steps where the hint appeared — think about rule ordering.';
    cls = 'grade-good';
  } else {
    msg = 'Good effort! Rule ordering is tricky. Head back and review the sensor colours — each one maps directly to a condition.';
    cls = 'grade-ok';
  }
  document.getElementById('result-msg').textContent = msg;
  document.getElementById('result-accuracy').className = 'big-accuracy ' + cls;

  // Fill progress bar to 100%
  document.getElementById('progress-fill').style.width = '100%';
}

function restartGuided() {
  currentStep  = 0;
  wrongCount   = 0;
  correctCount = 0;
  selectedRule = null;
  isAnimating  = false;
  if (animId) cancelAnimationFrame(animId);

  // Re-clone the level so coins etc. are fresh
  animLevel = createLevel();

  document.getElementById('guided-main').style.display    = '';
  document.getElementById('guided-results').style.display = 'none';
  renderStep();
}

// ── FEEDBACK HELPER ──────────────────────────────
function setFeedback(type, msg) {
  const el = document.getElementById('feedback-msg');
  el.textContent = msg;
  el.className = 'feedback-msg ' + (type ? 'fb-' + type : '');
}