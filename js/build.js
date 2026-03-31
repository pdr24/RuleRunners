/* ═══════════════════════════════════════════════
   build.js — Phase 2: Build Your Agent logic
   ═══════════════════════════════════════════════ */

// ── STATE ────────────────────────────────────────
let buildRules   = [];
let buildAgent   = null;
let buildLevel   = null;
let buildCamX    = 0;
let buildRunning = false;
let buildAnimId  = null;
let buildLastTime = 0;
let buildStepAcc  = 0;

// ── DATA COLLECTION: per-run firing counts ───────
let _buildRuleFiringCounts = {};

// ── INIT ─────────────────────────────────────────
window.addEventListener('load', () => {
  initBuild();
  window.addEventListener('resize', resizeBuildCanvas);

  // ── DATA COLLECTION: start page timer, click counter, level bucket
  dcBuild_start();
});

function initBuild() {
  buildLevel = createLevel();
  buildAgent = createAgent(20);
  buildCamX  = 0;
  buildRunning = false;
  if (buildAnimId) cancelAnimationFrame(buildAnimId);
  resizeBuildCanvas();
  renderBuildRules();
  drawBuildFrame();
  document.getElementById('build-status').textContent = 'PAUSED';
  document.getElementById('build-run-btn').textContent = '▶ RUN';
  document.getElementById('build-coins').textContent = '0';
  document.getElementById('build-dist').textContent  = '0m';
  document.getElementById('build-active-rule-stat').textContent = '—';
  document.getElementById('build-firing-text').textContent = 'none';
}

// ── CANVAS SIZING ────────────────────────────────
function resizeBuildCanvas() {
  const canvas  = document.getElementById('build-canvas');
  const wrapper = canvas.parentElement;
  canvas.width  = wrapper.clientWidth  || 600;
  canvas.height = wrapper.clientHeight || 340;
  drawBuildFrame();
}

// ── RULE MANAGEMENT ──────────────────────────────
function buildAddRule() {
  const cond   = document.getElementById('build-cond-select').value;
  const action = document.getElementById('build-action-select').value;
  if (!cond || !action) { showToast('⚠ Select both a condition and an action!'); return; }
  buildRules.push({ cond, action });
  document.getElementById('build-cond-select').value   = '';
  document.getElementById('build-action-select').value = '';
  renderBuildRules();
  showToast('✓ Rule added!');

  // ── DATA COLLECTION: a new rule was created
  dcBuild_recordRuleCreated();
}

function buildDeleteRule(i) {
  buildRules.splice(i, 1);
  renderBuildRules();
}

// Drag context accessor for shared engine dragDrop helper
function _getBuildArr() { return buildRules; }
function _onBuildRender() {
  renderBuildRules();

  // ── DATA COLLECTION: rules were reordered via drag-and-drop
  dcBuild_recordRuleReorder();
}

function renderBuildRules() {
  const list  = document.getElementById('build-rule-list');
  const count = document.getElementById('build-rule-count');
  count.textContent = buildRules.length + (buildRules.length === 1 ? ' rule' : ' rules');

  if (buildRules.length === 0) {
    list.innerHTML = `<div class="empty-rules" id="build-empty-msg">No rules yet.<br>Add a rule below to get started.</div>`;
    return;
  }

  list.innerHTML = buildRules.map((r, i) => `
    <div class="rule-card" id="brule-${i}" draggable="true"
         ondragstart="dragStart(event,${i},'build')"
         ondragover="event.preventDefault()"
         ondrop="_onBuildDrop(event,${i})">
      <span class="drag-handle">⠿</span>
      <span class="rule-number">${i + 1}</span>
      <span class="rule-text">${ruleHTML(r.cond, r.action)}</span>
      <button class="rule-delete" onclick="buildDeleteRule(${i})" title="Delete rule">✕</button>
    </div>
  `).join('');
}

function _onBuildDrop(e, targetIdx) {
  dragDrop(e, targetIdx, 'build', _getBuildArr, _onBuildRender);
}

// ── SIMULATION CONTROLS ──────────────────────────
function buildRun() {
  if (buildRules.length === 0) { showToast('⚠ Add at least one rule first!'); return; }
  buildRunning = !buildRunning;
  document.getElementById('build-run-btn').textContent = buildRunning ? '⏸ PAUSE' : '▶ RUN';
  document.getElementById('build-status').textContent  = buildRunning ? 'RUNNING'  : 'PAUSED';
  if (buildRunning) {
    // ── DATA COLLECTION: run button clicked — stop editing timer, start anim timer
    dcBuild_recordRunButtonClicked();

    // Reset per-run firing counts
    _buildRuleFiringCounts = {};

    buildLastTime = performance.now();
    buildStepAcc  = 0;
    buildLoop(buildLastTime);
  } else {
    if (buildAnimId) cancelAnimationFrame(buildAnimId);
  }
}

function buildStep() {
  if (buildRules.length === 0) { showToast('⚠ Add at least one rule first!'); return; }
  _simStep();
  drawBuildFrame();
}

function buildReset() {
  // ── DATA COLLECTION: record run data before resetting, if a run was active
  if (buildRunning || buildAgent) {
    dcBuild_recordRun({
      finalRules      : buildRules.map(r => ({ cond: r.cond, action: r.action })),
      coinsCollected  : buildAgent ? buildAgent.coins : 0,
      distanceTraveled: buildAgent ? Math.round(buildAgent.distMax / 10) : 0,
      ruleFiringCounts: { ..._buildRuleFiringCounts },
    });
  }

  buildRunning = false;
  if (buildAnimId) cancelAnimationFrame(buildAnimId);

  // ── DATA COLLECTION: reset button clicked
  dcBuild_recordResetClicked();

  // ── DATA COLLECTION: restart rule editing timer for next run
  dcBuild_startRuleEditing();

  initBuild();
  _buildRuleFiringCounts = {};
}

function buildLoop(now) {
  if (!buildRunning) return;
  const dt = now - buildLastTime;
  buildLastTime = now;
  buildStepAcc += dt;
  while (buildStepAcc >= 16) {
    _simStep();
    buildStepAcc -= 16;
  }
  drawBuildFrame();
  buildAnimId = requestAnimationFrame(buildLoop);
}

function _simStep() {
  const ag    = buildAgent;
  const level = buildLevel;
  updateSensors(ag, level);
  const action = evaluateRules(ag, buildRules);
  applyAction(ag, action);
  physicsStep(ag, level);
  updateEnemies(level);

  buildCamX = Math.max(0, ag.x - 250);

  // HUD update
  document.getElementById('build-coins').textContent = ag.coins;
  document.getElementById('build-dist').textContent  = Math.round(ag.distMax / 10) + 'm';

  const idx = ag.activeRuleIdx;
  if (idx >= 0 && buildRules[idx]) {
    const r = buildRules[idx];
    document.getElementById('build-firing-text').innerHTML =
      `Rule ${idx + 1}: IF ${COND_LABELS[r.cond]} THEN ${ACT_LABELS[r.action]}`;
    document.getElementById('build-active-rule-stat').textContent = `Rule ${idx + 1}`;
    document.querySelectorAll('.rule-card').forEach((el, i) => {
      el.classList.toggle('active-rule', i === idx);
    });

    // ── DATA COLLECTION: increment this rule's firing count
    _buildRuleFiringCounts[idx] = (_buildRuleFiringCounts[idx] || 0) + 1;

  } else {
    document.getElementById('build-firing-text').textContent = 'none';
    document.getElementById('build-active-rule-stat').textContent = '—';
    document.querySelectorAll('.rule-card').forEach(el => el.classList.remove('active-rule'));
  }

  // ── DATA COLLECTION: auto-save run when agent finishes or resets too many times
  if (ag.finished || ag.resetCount > 10) {
    dcBuild_recordRun({
      finalRules      : buildRules.map(r => ({ cond: r.cond, action: r.action })),
      coinsCollected  : ag.coins,
      distanceTraveled: Math.round(ag.distMax / 10),
      ruleFiringCounts: { ..._buildRuleFiringCounts },
    });
    _buildRuleFiringCounts = {};
  }
}

function drawBuildFrame() {
  const canvas = document.getElementById('build-canvas');
  const ctx    = canvas.getContext('2d');
  drawLevel(ctx, canvas.width, canvas.height, buildLevel, buildAgent, buildCamX, null, true);
}

// ── PROCEED TO COMPETE ───────────────────────────
function proceedToCompete() {
  // ── DATA COLLECTION: save final run state before leaving if agent is active
  if (buildAgent) {
    dcBuild_recordRun({
      finalRules      : buildRules.map(r => ({ cond: r.cond, action: r.action })),
      coinsCollected  : buildAgent.coins,
      distanceTraveled: Math.round(buildAgent.distMax / 10),
      ruleFiringCounts: { ..._buildRuleFiringCounts },
    });
  }
  window.location.href = 'compete.html';
}