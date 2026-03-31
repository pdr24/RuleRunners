/* ═══════════════════════════════════════════════
   compete.js — Phase 3: Head-to-Head Competition
   ═══════════════════════════════════════════════ */

// ── STATE ────────────────────────────────────────
let competeRulesA = [];
let competeRulesB = [];

let competeAgentA = null, competeAgentB = null;
let competeLevelA = null, competeLevelB = null;
let competeCamA   = 0,   competeCamB   = 0;
let competeRunning = false;
let competeAnimId  = null;
let competeLastTime = 0;
let competeTimerVal = 20;
let competeTimerInterval = null;
let competeScoreA = 0, competeScoreB = 0;

// ── DATA COLLECTION: per-game rule tracking ──────
let _competeAllRulesCreatedA = [];
let _competeAllRulesCreatedB = [];
let _competeFiringCountsA    = {};
let _competeFiringCountsB    = {};

// ── INIT ─────────────────────────────────────────
window.addEventListener('load', () => {
  competeRulesA = [];
  competeRulesB = [];
  initCompete();
  window.addEventListener('resize', () => {
    resizeCompeteCanvases();
    drawCompeteFrame();
  });

  // ── DATA COLLECTION: start page timer, click counter, compete bucket
  dcCompete_start();
});

function initCompete() {
  competeLevelA = createLevel();
  competeLevelB = createLevel();
  competeAgentA = createAgent(20);
  competeAgentB = createAgent(20);
  competeCamA = 0; competeCamB = 0;
  competeTimerVal = 20;
  competeScoreA = 0; competeScoreB = 0;
  competeRunning = false;
  if (competeAnimId) cancelAnimationFrame(competeAnimId);
  clearInterval(competeTimerInterval);

  document.getElementById('compete-timer').textContent = '20';
  document.getElementById('compete-timer').classList.remove('urgent');
  document.getElementById('score-a').textContent = '0';
  document.getElementById('score-b').textContent = '0';
  document.getElementById('compete-start-btn').textContent = '▶ START COMPETITION';

  renderCompeteRules();
  competeSetEditorLocked(false);
  setTimeout(() => { resizeCompeteCanvases(); drawCompeteFrame(); }, 60);
}

// ── LOCK / UNLOCK RULE EDITORS ────────────────────
// Disables all rule editing controls for both players while competition runs.
function competeSetEditorLocked(locked) {
  ['a', 'b'].forEach(ag => {
    document.getElementById(ag + '-cond').disabled   = locked;
    document.getElementById(ag + '-action').disabled = locked;
  });

  // Add-rule buttons (identified by their onclick)
  document.querySelectorAll('[onclick="competeAddRule(\'a\')"], [onclick="competeAddRule(\'b\')"]')
    .forEach(btn => btn.disabled = locked);

  // Delete buttons and drag handles on existing rule cards
  document.querySelectorAll('.mini-rule-delete').forEach(btn => btn.disabled = locked);
  document.querySelectorAll('.mini-rule-card').forEach(card => {
    card.draggable = !locked;
    card.style.cursor = locked ? 'default' : 'grab';
  });

  // Visual dimming of the add-rule rows
  document.querySelectorAll('.mini-add-row').forEach(row => {
    row.style.opacity = locked ? '0.4' : '1';
  });
}

// ── CANVAS SIZING ────────────────────────────────
function resizeCompeteCanvases() {
  ['a', 'b'].forEach(ag => {
    const canvas = document.getElementById('compete-canvas-' + ag);
    const wrap   = canvas.parentElement;
    canvas.width  = wrap.clientWidth        || 400;
    canvas.height = (wrap.clientHeight - 28) || 200;
  });
}

// ── RULE MANAGEMENT ──────────────────────────────
function competeAddRule(ag) {
  if (competeRunning) return;  // guard: no edits while running
  const cond   = document.getElementById(ag + '-cond').value;
  const action = document.getElementById(ag + '-action').value;
  if (!cond || !action) { showToast('⚠ Select condition and action!'); return; }
  const arr = ag === 'a' ? competeRulesA : competeRulesB;
  arr.push({ cond, action });
  document.getElementById(ag + '-cond').value   = '';
  document.getElementById(ag + '-action').value = '';
  renderCompeteRules();
  showToast(`✓ Rule added to Agent ${ag === 'a' ? 'Player 1' : 'Player 2'}!`);

  // ── DATA COLLECTION: track rule creation and start editing timer
  if (ag === 'a') {
    _competeAllRulesCreatedA.push({ cond, action });
    dcCompete_recordRuleCreated(1);
    dcCompete_startRuleEditing(1);
  } else {
    _competeAllRulesCreatedB.push({ cond, action });
    dcCompete_recordRuleCreated(2);
    dcCompete_startRuleEditing(2);
  }
}

function competeDeleteRule(ag, i) {
  if (competeRunning) return;  // guard: no edits while running
  const arr = ag === 'a' ? competeRulesA : competeRulesB;
  arr.splice(i, 1);
  renderCompeteRules();
}

// Drag context accessors
function _getCompeteArr(ctx) {
  return ctx === 'a' ? competeRulesA : competeRulesB;
}
function _onCompeteRender(ctx) {
  renderCompeteRules();

  // ── DATA COLLECTION: rule reorder via drag-and-drop
  if (ctx === 'a') dcCompete_recordRuleReorder(1);
  else             dcCompete_recordRuleReorder(2);
}

function _onCompeteDrop(e, targetIdx, ag) {
  if (competeRunning) return;  // guard: no reorder while running
  dragDrop(e, targetIdx, ag, _getCompeteArr, _onCompeteRender);
}

function renderCompeteRules() {
  ['a', 'b'].forEach(ag => {
    const arr  = ag === 'a' ? competeRulesA : competeRulesB;
    const list = document.getElementById('compete-' + ag + '-list');
    if (arr.length === 0) {
      list.innerHTML = `<div style="padding:6px 4px;font-family:'Share Tech Mono',monospace;font-size:0.63rem;color:var(--text-dim);">No rules yet.</div>`;
      return;
    }
    list.innerHTML = arr.map((r, i) => `
      <div class="mini-rule-card" id="crule-${ag}-${i}"
           draggable="${!competeRunning}"
           ondragstart="dragStart(event,${i},'${ag}')"
           ondragover="event.preventDefault()"
           ondrop="_onCompeteDrop(event,${i},'${ag}')"
           style="cursor:${competeRunning ? 'default' : 'grab'}">
        <span class="mini-rule-num">${i + 1}</span>
        <span class="mini-rule-text">${miniRuleHTML(r.cond, r.action)}</span>
        <button class="mini-rule-delete" onclick="competeDeleteRule('${ag}',${i})" ${competeRunning ? 'disabled' : ''}>✕</button>
      </div>
    `).join('');
  });
}

// ── COMPETITION CONTROLS ─────────────────────────
function competeStart() {
  if (competeRunning) return;
  if (competeRulesA.length === 0 || competeRulesB.length === 0) {
    showToast('⚠ Add at least 1 rule to both agents!');
    return;
  }
  competeRunning = true;
  document.getElementById('compete-start-btn').textContent = '⏸ Running…';

  // Lock both editors for the duration of the competition
  competeSetEditorLocked(true);

  // ── DATA COLLECTION: stop editing timers, start animation timer
  dcCompete_startAnimation();

  // Reset per-game firing counts
  _competeFiringCountsA = {};
  _competeFiringCountsB = {};

  competeTimerInterval = setInterval(() => {
    competeTimerVal--;
    document.getElementById('compete-timer').textContent = competeTimerVal;
    if (competeTimerVal <= 15) document.getElementById('compete-timer').classList.add('urgent');
    if (competeTimerVal <= 0) endCompetition();
  }, 1000);

  competeLastTime = performance.now();
  competeLoop(competeLastTime);
}

function competeReset() {
  // clear rules 
  competeRulesA = [];
  competeRulesB = [];

  _competeAllRulesCreatedA = [];
  _competeAllRulesCreatedB = [];
  _competeFiringCountsA = {};
  _competeFiringCountsB = {};

  initCompete();
}

function closeResult() {
  document.getElementById('result-overlay').classList.remove('visible');
}

// ── GAME LOOP ────────────────────────────────────
function competeLoop(now) {
  if (!competeRunning) return;
  const dt = now - competeLastTime;
  competeLastTime = now;

  const steps = Math.max(1, Math.round(dt / 16));
  for (let s = 0; s < steps; s++) {
    if (!competeAgentA.finished) {
      updateSensors(competeAgentA, competeLevelA);
      const actionA = evaluateRules(competeAgentA, competeRulesA);
      applyAction(competeAgentA, actionA);
      physicsStep(competeAgentA, competeLevelA);

      // ── DATA COLLECTION: track rule firing counts for player 1
      const idxA = competeAgentA.activeRuleIdx;
      if (idxA >= 0) _competeFiringCountsA[idxA] = (_competeFiringCountsA[idxA] || 0) + 1;
    }
    if (!competeAgentB.finished) {
      updateSensors(competeAgentB, competeLevelB);
      const actionB = evaluateRules(competeAgentB, competeRulesB);
      applyAction(competeAgentB, actionB);
      physicsStep(competeAgentB, competeLevelB);

      // ── DATA COLLECTION: track rule firing counts for player 2
      const idxB = competeAgentB.activeRuleIdx;
      if (idxB >= 0) _competeFiringCountsB[idxB] = (_competeFiringCountsB[idxB] || 0) + 1;
    }
    updateEnemies(competeLevelA);
    updateEnemies(competeLevelB);
  }

  competeCamA = Math.max(0, competeAgentA.x - 200);
  competeCamB = Math.max(0, competeAgentB.x - 200);

  competeScoreA = calcScore(competeAgentA);
  competeScoreB = calcScore(competeAgentB);
  document.getElementById('score-a').textContent = competeScoreA;
  document.getElementById('score-b').textContent = competeScoreB;

  _highlightRules('a', competeAgentA.activeRuleIdx, competeRulesA.length);
  _highlightRules('b', competeAgentB.activeRuleIdx, competeRulesB.length);

  drawCompeteFrame();

  if (competeAgentA.finished && competeAgentB.finished) {
    endCompetition();
    return;
  }
  competeAnimId = requestAnimationFrame(competeLoop);
}

function _highlightRules(ag, idx, total) {
  for (let i = 0; i < total; i++) {
    const el = document.getElementById(`crule-${ag}-${i}`);
    if (el) el.classList.toggle(`active-rule-${ag}`, i === idx);
  }
}

function drawCompeteFrame() {
  const canA = document.getElementById('compete-canvas-a');
  const canB = document.getElementById('compete-canvas-b');
  if (canA.width > 0 && competeAgentA) drawLevel(canA.getContext('2d'), canA.width, canA.height, competeLevelA, competeAgentA, competeCamA, 'cyan');
  if (canB.width > 0 && competeAgentB) drawLevel(canB.getContext('2d'), canB.width, canB.height, competeLevelB, competeAgentB, competeCamB, 'orange');
}

// ── END & RESULTS ────────────────────────────────
function endCompetition() {
  competeRunning = false;
  cancelAnimationFrame(competeAnimId);
  clearInterval(competeTimerInterval);

  const sa = calcScore(competeAgentA);
  const sb = calcScore(competeAgentB);

  // ── DATA COLLECTION: record the full competition result
  dcCompete_recordResult({
    p1FinalRules       : competeRulesA.map(r => ({ cond: r.cond, action: r.action })),
    p1AllRulesCreated  : _competeAllRulesCreatedA.map(r => ({ cond: r.cond, action: r.action })),
    p1Score            : sa,
    p1CoinsCollected   : competeAgentA ? competeAgentA.coins    : 0,
    p1DistanceMax      : competeAgentA ? Math.round(competeAgentA.distMax / 10) : 0,
    p1RuleFiringCounts : { ..._competeFiringCountsA },
    p2FinalRules       : competeRulesB.map(r => ({ cond: r.cond, action: r.action })),
    p2AllRulesCreated  : _competeAllRulesCreatedB.map(r => ({ cond: r.cond, action: r.action })),
    p2Score            : sb,
    p2CoinsCollected   : competeAgentB ? competeAgentB.coins    : 0,
    p2DistanceMax      : competeAgentB ? Math.round(competeAgentB.distMax / 10) : 0,
    p2RuleFiringCounts : { ..._competeFiringCountsB },
  });

  document.getElementById('result-score-a').textContent = sa;
  document.getElementById('result-score-b').textContent = sb;

  let winnerName, winnerClass, subtitle, reflection;

  if (sa > sb) {
    winnerName = 'Player 1 WINS'; winnerClass = 'win-a';
    subtitle   = `Player 1 scored ${sa - sb} more points!`;
    reflection = `Player 1's rules were more effective! Discuss: which rule contributed most? Was there a rule that didn't help? Try swapping or reordering rules and see if the outcome changes.`;
  } else if (sb > sa) {
    winnerName = 'Player 2 WINS'; winnerClass = 'win-b';
    subtitle   = `Player 2 scored ${sb - sa} more points!`;
    reflection = `Player 2's rules were more effective! Discuss: which rule contributed most? Was there a rule that didn't help? Try swapping or reordering rules and see if the outcome changes.`;
  } else {
    winnerName = "IT'S A TIE!"; winnerClass = 'win-tie';
    subtitle   = 'Both agents scored equally!';
    reflection = `A perfect tie! What did both rule sets have in common? Try adding one new rule to each agent and see who pulls ahead.`;
  }

  document.getElementById('result-winner-name').textContent = winnerName;
  document.getElementById('result-winner-name').className   = 'result-name ' + winnerClass;
  document.getElementById('result-subtitle').textContent    = subtitle;
  document.getElementById('result-reflection-text').textContent = reflection;
  document.getElementById('result-overlay').classList.add('visible');
}