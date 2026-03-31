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

// ── INIT ─────────────────────────────────────────
window.addEventListener('load', () => {
  // Both agents start with empty rule sets on this page
  competeRulesA = [];
  competeRulesB = [];
  initCompete();
  window.addEventListener('resize', () => {
    resizeCompeteCanvases();
    drawCompeteFrame();
  });
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
  setTimeout(() => { resizeCompeteCanvases(); drawCompeteFrame(); }, 60);
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
  const cond   = document.getElementById(ag + '-cond').value;
  const action = document.getElementById(ag + '-action').value;
  if (!cond || !action) { showToast('⚠ Select condition and action!'); return; }
  const arr = ag === 'a' ? competeRulesA : competeRulesB;
  arr.push({ cond, action });
  document.getElementById(ag + '-cond').value   = '';
  document.getElementById(ag + '-action').value = '';
  renderCompeteRules();
  showToast(`✓ Rule added to Agent ${ag === 'a' ? 'Player 1' : 'Player 2'}!`);
}

function competeDeleteRule(ag, i) {
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
}

function _onCompeteDrop(e, targetIdx, ag) {
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
      <div class="mini-rule-card" id="crule-${ag}-${i}" draggable="true"
           ondragstart="dragStart(event,${i},'${ag}')"
           ondragover="event.preventDefault()"
           ondrop="_onCompeteDrop(event,${i},'${ag}')">
        <span class="mini-rule-num">${i + 1}</span>
        <span class="mini-rule-text">${miniRuleHTML(r.cond, r.action)}</span>
        <button class="mini-rule-delete" onclick="competeDeleteRule('${ag}',${i})">✕</button>
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
      applyAction(competeAgentA, evaluateRules(competeAgentA, competeRulesA));
      physicsStep(competeAgentA, competeLevelA);
    }
    if (!competeAgentB.finished) {
      updateSensors(competeAgentB, competeLevelB);
      applyAction(competeAgentB, evaluateRules(competeAgentB, competeRulesB));
      physicsStep(competeAgentB, competeLevelB);
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

  // Highlight firing rules
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