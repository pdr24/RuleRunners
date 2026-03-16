/* ═══════════════════════════════════════════════
   sensorDetection.js — Phase 1.2: What Do The Sensors Detect?

   Students look at a frozen snapshot of the agent on the
   level and select ALL conditions that are currently active.
   They choose from all 5 conditions + "none", then click
   Check Answer.

   Scoring (shown on results screen):
     • Step accuracy   — % of steps where every selection
                         was fully correct on the first try
     • Condition accuracy — % of individual condition
                            answers correct across all steps
                            (true positives + true negatives)
   ═══════════════════════════════════════════════ */

// ── ALL CONDITIONS (displayed as choices every step) ──
const ALL_CONDITIONS = [
  { key: 'gap_ahead',     label: 'Gap ahead',     color: '#00f5ff' },
  { key: 'coin_nearby',   label: 'Coin nearby',   color: '#ffd60a' },
  { key: 'hazard_nearby', label: 'Hazard nearby', color: '#ff2d55' },
  { key: 'near_wall',     label: 'Near wall',     color: '#8b5cf6' },
  { key: 'grounded',      label: 'Grounded',      color: '#00ff88' },
];
const NONE_KEY = '__none__';

// ── HELPER: build agent snapshot (reused from guided pattern) ──
function sdSnap(x, y, dir, sensors, grounded) {
  return {
    x, y, w: 22, h: 28,
    vx: 0, vy: 0,
    dir,
    grounded,
    coins: 0, distMax: x, alive: true, finished: false,
    resetCount: 0, activeRuleIdx: -1,
    sensors: Object.assign(
      { gap_ahead: false, coin_nearby: false, hazard_nearby: false,
        grounded: false, near_wall: false },
      sensors
    ),
  };
}

/* ── THE 11 STEPS ──────────────────────────────────────
   correctConditions: array of active condition keys,
                      or ['__none__'] when nothing is active.
   hint: shown after the first wrong attempt.
   context: situation description above the canvas.
   ─────────────────────────────────────────────────────── */
const SD_STEPS = [

  // Step 1 — grounded only, flat open platform
  {
    context: 'The agent is standing still on the opening platform. Nothing unusual nearby.',
    camX: 0,
    agent: sdSnap(80, 272, 1, { grounded: true }, true),
    correctConditions: ['grounded'],
    hint: 'The agent is standing on solid ground. Which condition describes that state?',
  },

  // Step 2 — grounded + coin nearby
  {
    context: 'Still on the first platform. A yellow coin is glowing just ahead.',
    camX: 0,
    agent: sdSnap(60, 272, 1, { grounded: true, coin_nearby: true }, true),
    correctConditions: ['grounded', 'coin_nearby'],
    hint: 'The agent is on the ground AND something valuable is within its detection radius.',
  },

  // Step 3 — grounded + gap ahead
  {
    context: 'The platform edge is approaching. The floor disappears ahead of the agent.',
    camX: 0,
    agent: sdSnap(168, 272, 1, { grounded: true, gap_ahead: true }, true),
    correctConditions: ['grounded', 'gap_ahead'],
    hint: 'Look ahead of the agent — is there solid ground, or empty space? Also check whether the agent is standing on something.',
  },

  // Step 4 — airborne, no sensors active
  {
    context: 'The agent is mid-jump, sailing over the gap. No objects are close.',
    camX: 0,
    agent: sdSnap(210, 230, 1, {}, false),
    correctConditions: [NONE_KEY],
    hint: 'The agent is in the air with no coins, hazards, or walls nearby. None of the five conditions apply here.',
  },

  // Step 5 — grounded + hazard nearby
  {
    context: 'Landed on the next platform. A spike hazard is sitting very close.',
    camX: 0,
    agent: sdSnap(268, 272, 1, { grounded: true, hazard_nearby: true }, true),
    correctConditions: ['grounded', 'hazard_nearby'],
    hint: 'The agent is on the ground. Look at the red dashed ring — what does that colour represent?',
  },

  // Step 6 — airborne + coin nearby (coin on platform ahead)
  {
    context: 'The agent jumped again and is airborne. A coin on the next platform is within sensor range.',
    camX: 50,
    agent: sdSnap(340, 240, 1, { coin_nearby: true }, false),
    correctConditions: ['coin_nearby'],
    hint: 'The agent is not on the ground, but the yellow dashed ring is visible. Which condition does that ring represent?',
  },

  // Step 7 — grounded only, elevated platform, clear
  {
    context: 'The agent has landed on a higher platform. All clear — no objects in range.',
    camX: 100,
    agent: sdSnap(415, 252, 1, { grounded: true }, true),
    correctConditions: ['grounded'],
    hint: 'There are no coins, hazards, gaps, or walls near the agent right now. Just check the ground state.',
  },

  // Step 8 — grounded + gap ahead + coin nearby
  {
    context: 'The elevated platform ends soon, and a coin is floating just beyond the edge.',
    camX: 100,
    agent: sdSnap(450, 252, 1, { grounded: true, gap_ahead: true, coin_nearby: true }, true),
    correctConditions: ['grounded', 'gap_ahead', 'coin_nearby'],
    hint: 'Three things are happening at once here. Is the agent grounded? Is the floor ahead solid? Is there a coin in range?',
  },

  // Step 9 — grounded + hazard nearby + coin nearby
  {
    context: 'On a busy platform — a patrolling enemy AND a coin are both within sensor range.',
    camX: 200,
    agent: sdSnap(535, 272, 1,
      { grounded: true, coin_nearby: true, hazard_nearby: true }, true),
    correctConditions: ['grounded', 'coin_nearby', 'hazard_nearby'],
    hint: 'Both the yellow and red sensor rings are visible. Count all the active sensors — including the ground state.',
  },

  // Step 10 — grounded + near wall
  {
    context: 'The agent has walked into the right edge of the platform — a wall blocks the path.',
    camX: 200,
    agent: sdSnap(636, 272, 1, { grounded: true, near_wall: true }, true),
    correctConditions: ['grounded', 'near_wall'],
    hint: 'The purple ring is glowing around the agent. It is also standing on solid ground.',
  },

  // Step 11 — airborne + hazard nearby (enemy jumped over but still in range)
  {
    context: 'The agent is in the air after jumping over the enemy. The enemy is still within sensor range.',
    camX: 200,
    agent: sdSnap(600, 248, 1, { hazard_nearby: true }, false),
    correctConditions: ['hazard_nearby'],
    hint: 'The agent is airborne (not grounded), but the red dashed ring is still active because the enemy is close.',
  },
];

// ── STATE ──────────────────────────────────────────────
let sdStep         = 0;
let sdWrongCount   = 0;
let sdTotalSteps   = SD_STEPS.length;
let sdStepCorrect  = 0;   // steps fully correct on first try
let sdCondCorrect  = 0;   // individual condition answers correct (TP + TN)
let sdCondTotal    = 0;   // total individual condition evaluations
let sdSelected     = new Set();   // currently selected condition keys
let sdLocked       = false;       // true once correct answer is accepted
let sdAnimating    = false;

// Animation
let sdAnimLevel    = null;
let sdAnimAgent    = null;
let sdAnimId       = null;
let sdAnimProgress = 0;
const SD_ANIM_DUR  = 55;

// ── INIT ───────────────────────────────────────────────
window.addEventListener('load', () => {
  sdAnimLevel = createLevel();
  sdResizeCanvas();
  sdRenderStep();
  window.addEventListener('resize', () => { sdResizeCanvas(); sdDrawSnapshot(); });
});

function sdResizeCanvas() {
  const canvas = document.getElementById('sd-canvas');
  const wrap   = canvas.parentElement;
  canvas.width  = wrap.clientWidth  || 800;
  canvas.height = wrap.clientHeight || 300;
}

// ── RENDER STEP ────────────────────────────────────────
function sdRenderStep() {
  const step      = SD_STEPS[sdStep];
  sdWrongCount    = 0;
  sdSelected      = new Set();
  sdLocked        = false;

  // Progress
  document.getElementById('sd-step-counter').textContent =
    `Step ${sdStep + 1} of ${sdTotalSteps}`;
  document.getElementById('sd-progress-fill').style.width =
    ((sdStep / sdTotalSteps) * 100) + '%';

  // Context
  document.getElementById('sd-step-context').textContent = step.context;

  // Choices
  sdRenderChoices();

  // Reset feedback
  sdSetFeedback('', '');
  document.getElementById('sd-hint-box').style.display   = 'none';
  document.getElementById('sd-next-btn').style.display   = 'none';
  document.getElementById('sd-check-btn').style.display  = '';
  document.getElementById('sd-check-btn').disabled       = false;
  document.getElementById('sd-next-btn').disabled        = false;

  sdDrawSnapshot();
}

function sdDrawSnapshot() {
  const step   = SD_STEPS[sdStep];
  const canvas = document.getElementById('sd-canvas');
  drawLevel(canvas.getContext('2d'), canvas.width, canvas.height,
            sdAnimLevel, step.agent, step.camX, 'green');
}

// ── CHOICE RENDERING ──────────────────────────────────
function sdRenderChoices(revealCorrect = false, wrongKeys = null) {
  const step = SD_STEPS[sdStep];
  const list = document.getElementById('sd-choices');

  // Build full option list: 5 conditions + none
  const options = [...ALL_CONDITIONS, { key: NONE_KEY, label: 'None of the above', color: '#3a5070' }];

  list.innerHTML = options.map(opt => {
    const isSelected = sdSelected.has(opt.key);
    const isCorrect  = step.correctConditions.includes(opt.key);
    const isWrong    = wrongKeys && wrongKeys.has(opt.key);

    let cls = 'sd-choice-card';
    if (revealCorrect && isCorrect)  cls += ' sd-choice-correct';
    else if (isWrong)                cls += ' sd-choice-wrong';
    else if (isSelected)             cls += ' sd-choice-selected';

    // dot colour
    const dotStyle = opt.key !== NONE_KEY
      ? `background:${opt.color};`
      : `background: var(--text-dim);`;

    return `
      <div class="${cls}" id="sdchoice-${opt.key}" onclick="sdToggleChoice('${opt.key}')">
        <span class="sd-choice-dot" style="${dotStyle}"></span>
        <span class="sd-choice-text">${opt.label}</span>
        ${isSelected && !revealCorrect && !isWrong
          ? '<span class="sd-check-tick">✓</span>' : ''}
      </div>`;
  }).join('');
}

function sdToggleChoice(key) {
  if (sdLocked || sdAnimating) return;
  if (document.getElementById('sd-next-btn').style.display !== 'none') return;

  // "None" is mutually exclusive with everything else
  if (key === NONE_KEY) {
    if (sdSelected.has(NONE_KEY)) {
      sdSelected.delete(NONE_KEY);
    } else {
      sdSelected.clear();
      sdSelected.add(NONE_KEY);
    }
  } else {
    sdSelected.delete(NONE_KEY);   // deselect none if a real condition chosen
    if (sdSelected.has(key)) {
      sdSelected.delete(key);
    } else {
      sdSelected.add(key);
    }
  }
  sdRenderChoices();
}

// ── CHECK ANSWER ───────────────────────────────────────
function sdCheckAnswer() {
  if (sdAnimating || sdLocked) return;
  if (sdSelected.size === 0) {
    sdSetFeedback('warning', '⚠ Select at least one option (or "None of the above").');
    return;
  }

  const step    = SD_STEPS[sdStep];
  const correct = new Set(step.correctConditions);

  // Compare sets
  const isFullyCorrect = setsEqual(sdSelected, correct);

  if (isFullyCorrect) {
    // ── Correct ──────────────────────────────────────
    if (sdWrongCount === 0) {
      sdStepCorrect++;
      // Count individual condition accuracy for first-try correct
      // All 6 options evaluated: 5 conditions + none
      const allKeys = [...ALL_CONDITIONS.map(c => c.key), NONE_KEY];
      allKeys.forEach(k => {
        sdCondTotal++;
        // Correct if both agree (selected & in answer) or (not selected & not in answer)
        if (sdSelected.has(k) === correct.has(k)) sdCondCorrect++;
      });
    }

    sdLocked = true;
    sdRenderChoices(true, null);
    const labels = [...correct].map(k =>
      k === NONE_KEY ? 'None' : ALL_CONDITIONS.find(c => c.key === k)?.label
    ).join(', ');
    sdSetFeedback('correct', `✓ Correct! Active conditions: ${labels}.`);
    document.getElementById('sd-hint-box').style.display  = 'none';
    document.getElementById('sd-check-btn').style.display = 'none';
    document.getElementById('sd-next-btn').style.display  = '';
    if (sdStep >= sdTotalSteps - 1) {
      document.getElementById('sd-next-btn').textContent = 'See Results ▶';
    }

  } else {
    // ── Wrong ────────────────────────────────────────
    sdWrongCount++;

    // Mark which selected answers were wrong (selected but shouldn't be, or missing)
    const wrongKeys = new Set();
    sdSelected.forEach(k => { if (!correct.has(k)) wrongKeys.add(k); });

    sdRenderChoices(false, wrongKeys);

    if (sdWrongCount === 1) {
      sdSetFeedback('wrong', '✗ Not quite — some conditions are missing or incorrect. Here\'s a hint:');
      const hintBox = document.getElementById('sd-hint-box');
      hintBox.textContent = step.hint;
      hintBox.style.display = '';
      // Reset selection so they can try again
      sdSelected = new Set();
      setTimeout(() => sdRenderChoices(), 800);
    } else {
      // Second wrong — count individual accuracy for this step then reveal
      const allKeys = [...ALL_CONDITIONS.map(c => c.key), NONE_KEY];
      allKeys.forEach(k => {
        sdCondTotal++;
        if (sdSelected.has(k) === correct.has(k)) sdCondCorrect++;
      });

      sdLocked = true;
      sdRenderChoices(true, null);
      const labels = [...correct].map(k =>
        k === NONE_KEY ? 'None' : ALL_CONDITIONS.find(c => c.key === k)?.label
      ).join(', ');
      sdSetFeedback('wrong', `✗ The active conditions were: ${labels}.`);
      document.getElementById('sd-hint-box').style.display  = 'none';
      document.getElementById('sd-check-btn').style.display = 'none';
      document.getElementById('sd-next-btn').style.display  = '';
      if (sdStep >= sdTotalSteps - 1) {
        document.getElementById('sd-next-btn').textContent = 'See Results ▶';
      }
    }
  }
}

// ── ADVANCE ────────────────────────────────────────────
function sdNextStep() {
  if (sdAnimating) return;
  if (sdStep >= sdTotalSteps - 1) { sdShowResults(); return; }

  const fromAgent = SD_STEPS[sdStep].agent;
  const toStep    = SD_STEPS[sdStep + 1];
  sdStartAnimation(fromAgent, toStep.agent,
    SD_STEPS[sdStep].camX, toStep.camX, () => {
      sdStep++;
      sdRenderStep();
    });
}

// ── ANIMATION ──────────────────────────────────────────
function sdStartAnimation(fromAgent, toAgent, fromCam, toCam, onDone) {
  sdAnimating  = true;
  sdAnimProgress = 0;
  sdAnimAgent  = JSON.parse(JSON.stringify(fromAgent));

  document.getElementById('sd-next-btn').disabled  = true;
  document.getElementById('sd-check-btn').disabled = true;

  function tick() {
    sdAnimProgress++;
    const t  = sdAnimProgress / SD_ANIM_DUR;
    const et = sdEase(t);

    sdAnimAgent.x = fromAgent.x + (toAgent.x - fromAgent.x) * et;
    sdAnimAgent.y = fromAgent.y + (toAgent.y - fromAgent.y) * et;
    sdAnimAgent.y -= Math.sin(Math.PI * t) * 28;   // gentle arc

    const camX = fromCam + (toCam - fromCam) * et;
    const canvas = document.getElementById('sd-canvas');
    drawLevel(canvas.getContext('2d'), canvas.width, canvas.height,
              sdAnimLevel, sdAnimAgent, camX, 'green');

    if (sdAnimProgress < SD_ANIM_DUR) {
      sdAnimId = requestAnimationFrame(tick);
    } else {
      sdAnimating = false;
      document.getElementById('sd-next-btn').disabled  = false;
      document.getElementById('sd-check-btn').disabled = false;
      onDone();
    }
  }
  sdAnimId = requestAnimationFrame(tick);
}

function sdEase(t) {
  return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
}

// ── RESULTS ────────────────────────────────────────────
function sdShowResults() {
  document.getElementById('sd-main').style.display    = 'none';
  document.getElementById('sd-results').style.display = 'flex';
  document.getElementById('sd-progress-fill').style.width = '100%';

  const stepPct = Math.round((sdStepCorrect / sdTotalSteps) * 100);
  const condPct = sdCondTotal > 0
    ? Math.round((sdCondCorrect / sdCondTotal) * 100)
    : 0;

  document.getElementById('sd-acc-step').textContent = stepPct + '%';
  document.getElementById('sd-acc-cond').textContent = condPct + '%';
  document.getElementById('sd-res-step-detail').textContent =
    `${sdStepCorrect} / ${sdTotalSteps} steps fully correct on first try`;
  document.getElementById('sd-res-cond-detail').textContent =
    `${sdCondCorrect} / ${sdCondTotal} individual condition answers correct`;

  // Grade colour for step accuracy
  const stepGrade = stepPct === 100 ? 'grade-perfect' : stepPct >= 70 ? 'grade-good' : 'grade-ok';
  document.getElementById('sd-acc-step').className = 'acc-big ' + stepGrade;

  let msg;
  if (stepPct === 100) {
    msg = 'Perfect! You correctly identified every active sensor at every step. You have a solid grasp of how conditions map to what the agent detects.';
  } else if (stepPct >= 70) {
    msg = 'Great work! You caught most of the active sensors. Pay attention to steps where multiple conditions fired at once — it\'s easy to miss the grounded state when something more exciting is happening!';
  } else {
    msg = 'Good effort! Sensor detection takes practice. Try to look at the coloured halos around the agent for each one: cyan = gap, yellow = coin, red = hazard, purple = wall, and green means grounded.';
  }
  document.getElementById('sd-res-msg').textContent = msg;
}

function sdRestart() {
  sdStep        = 0;
  sdWrongCount  = 0;
  sdStepCorrect = 0;
  sdCondCorrect = 0;
  sdCondTotal   = 0;
  sdSelected    = new Set();
  sdLocked      = false;
  sdAnimating   = false;
  if (sdAnimId) cancelAnimationFrame(sdAnimId);
  sdAnimLevel   = createLevel();

  document.getElementById('sd-main').style.display    = '';
  document.getElementById('sd-results').style.display = 'none';
  sdRenderStep();
}

// ── UTILITIES ──────────────────────────────────────────
function setsEqual(a, b) {
  if (a.size !== b.size) return false;
  for (const v of a) if (!b.has(v)) return false;
  return true;
}

function sdSetFeedback(type, msg) {
  const el = document.getElementById('sd-feedback-msg');
  el.textContent = msg;
  el.className = 'feedback-msg ' + (type ? 'fb-' + type : '');
}