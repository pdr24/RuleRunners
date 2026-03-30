// ── DEMO PRE-BUILT RULES ─────────────────────
const DEMO_RULES = [
    { cond: 'gap_ahead',     action: 'jump'       },
    { cond: 'hazard_nearby', action: 'jump'       },
    { cond: 'coin_nearby',   action: 'dash'       },
    { cond: 'grounded',      action: 'move_right' },
];

// ── DEMO SPEED CONTROL ───────────────────────
let demoFrameCounter = 0;
const DEMO_SLOW_FACTOR = 2; // 1 = normal, 2 = slower, 3 = slow

// Render chips
function renderDemoChips(activeIdx) {
    const wrap = document.getElementById('demo-chips');
    wrap.innerHTML = DEMO_RULES.map((r, i) =>
    `<span class="demo-rule-chip ${i === activeIdx ? 'firing' : ''}">
        IF ${COND_LABELS[r.cond]} THEN ${ACT_LABELS[r.action]}
    </span>`
    ).join('');
}
renderDemoChips(-1);

// ── DEMO SIMULATION LOOP ─────────────────────
let demoAgent = null;
let demoLevel = null;
let demoCam   = 0;
let demoAnimId = null;

function startDemoLoop() {
    if (demoAnimId) cancelAnimationFrame(demoAnimId);
    demoLevel = createLevel();
    demoAgent = createAgent(20);
    demoCam   = 0;
    demoFrameCounter = 0;

    const canvas = document.getElementById('demo-canvas');
    canvas.width  = canvas.offsetWidth  || 800;
    canvas.height = canvas.offsetHeight || 220;

    demoTick();
}

function demoTick() {
    demoFrameCounter++;

    if (demoFrameCounter >= DEMO_SLOW_FACTOR) {
    demoFrameCounter = 0;

    updateSensors(demoAgent, demoLevel);
    const action = evaluateRules(demoAgent, DEMO_RULES);
    applyAction(demoAgent, action);
    physicsStep(demoAgent, demoLevel);
    updateEnemies(demoLevel);
    demoCam = Math.max(0, demoAgent.x - 150);
    }

    const canvas = document.getElementById('demo-canvas');

    // Only update internal buffer size when the element width actually changed;
    // never reassign canvas.width/height inside the draw loop — it clears the canvas
    const cssW = canvas.offsetWidth || 800;
    if (canvas.width !== cssW) canvas.width = cssW;

    drawLevel(
    canvas.getContext('2d'),
    canvas.width,
    canvas.height,
    demoLevel,
    demoAgent,
    demoCam,
    'green',
    true
    );

    const idx = demoAgent.activeRuleIdx;
    const el  = document.getElementById('demo-rule-text');
    if (idx >= 0 && DEMO_RULES[idx]) {
    const r = DEMO_RULES[idx];
    el.innerHTML = `<span style="color:var(--accent-purple)">IF</span> <span style="color:var(--accent-yellow)">${COND_LABELS[r.cond]}</span> <span style="color:var(--accent-purple)">THEN</span> <span style="color:var(--accent-green)">${ACT_LABELS[r.action]}</span>`;
    } else {
    el.innerHTML = `<span style="color:var(--text-dim)">No rule firing…</span>`;
    }
    renderDemoChips(idx);

    if (demoAgent.resetCount > 3 || demoAgent.finished) {
    demoLevel = createLevel();
    demoAgent = createAgent(20);
    demoCam   = 0;
    demoFrameCounter = 0;
    }

    demoAnimId = requestAnimationFrame(demoTick);
}

window.addEventListener('load', startDemoLoop);
window.addEventListener('resize', () => {
    const canvas = document.getElementById('demo-canvas');
    canvas.width  = canvas.offsetWidth  || 800;
    canvas.height = canvas.offsetHeight || 220;
});
