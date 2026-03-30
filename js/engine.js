/* ═══════════════════════════════════════════════
   engine.js — Physics, Level, Sensors, Renderer
   Shared by buildAgent.html and compete.html
   ═══════════════════════════════════════════════ */

// ── PHYSICS CONSTANTS ──────────────────────────
const SENSOR_RANGE   = 50;   // universal detection radius for all sensors
const SENSOR_GAP_DIST  = SENSOR_RANGE;
const SENSOR_COIN_DIST = SENSOR_RANGE;
const SENSOR_HAZ_DIST  = SENSOR_RANGE;
const SENSOR_WALL_DIST = 16;

const GRAVITY = 0.43;
const JUMP_V = -8.8;
const MOVE_SPEED = 1.5;
const DASH_SPEED = 3;

const JUMP_FORWARD_SPEED = 2.6;
const GROUND_FRICTION = 0.82;
const AIR_FRICTION = 0.98;
const MAX_FALL = 10;

// ── LABEL MAPS (used by all pages) ─────────────
const COND_LABELS = {
  gap_ahead:     'gap ahead',
  coin_nearby:   'coin nearby',
  hazard_nearby: 'hazard nearby',
  grounded:      'grounded',
  near_wall:     'near wall',
};
const ACT_LABELS = {
  jump:       'jump',
  move_left:  'move left',
  move_right: 'move right',
  dash:       'dash',
  change_dir: 'change dir',
};

// ── RULE HTML HELPERS ───────────────────────────
function ruleHTML(cond, action) {
  return `<span class="kw-if">IF</span> <span class="kw-cond">${COND_LABELS[cond]||cond}</span> <span class="kw-then">THEN</span> <span class="kw-act">${ACT_LABELS[action]||action}</span>`;
}
function miniRuleHTML(cond, action) {
  return `<span style="color:var(--accent-purple)">IF</span> <span style="color:var(--accent-yellow)">${COND_LABELS[cond]||cond}</span> <span style="color:var(--accent-purple)">THEN</span> <span style="color:var(--accent-green)">${ACT_LABELS[action]||action}</span>`;
}

// ── TOAST ───────────────────────────────────────
function showToast(msg) {
  const t = document.getElementById('toast');
  if (!t) return;
  t.textContent = msg;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 2200);
}

// ── DRAG & DROP (shared reorder logic) ─────────
let _dragSrcIdx = null;
let _dragContext = null;

function dragStart(e, idx, ctx) {
  _dragSrcIdx = idx;
  _dragContext = ctx;
  e.currentTarget.classList.add('dragging');
}
function dragDrop(e, targetIdx, ctx, getArr, onRender) {
  if (_dragSrcIdx === null || _dragContext !== ctx) return;
  const arr = getArr(ctx);
  const moved = arr.splice(_dragSrcIdx, 1)[0];
  arr.splice(targetIdx, 0, moved);
  _dragSrcIdx = null;
  onRender(ctx);
}

// ── LEVEL FACTORY ───────────────────────────────
function createLevel() {
  return {
    platforms: [
      { x: 0,    y: 300, w: 200, h: 20 },
      { x: 230,  y: 300, w: 120, h: 20 },
      { x: 380,  y: 280, w: 100, h: 20 },
      { x: 510,  y: 300, w: 150, h: 20 },
      { x: 690,  y: 260, w: 80,  h: 20 },
      { x: 800,  y: 300, w: 200, h: 20 },
      { x: 1030, y: 300, w: 100, h: 20 },
      { x: 1160, y: 270, w: 120, h: 20 },
      { x: 1310, y: 300, w: 180, h: 20 },
      { x: 1520, y: 280, w: 100, h: 20 },
      { x: 1650, y: 300, w: 250, h: 20 },
    ],
    coins: [
      { x: 120,  y: 270 }, { x: 260,  y: 270 }, { x: 400,  y: 250 },
      { x: 530,  y: 270 }, { x: 700,  y: 230 }, { x: 840,  y: 270 },
      { x: 1060, y: 270 }, { x: 1200, y: 240 }, { x: 1350, y: 270 },
      { x: 1540, y: 250 }, { x: 1700, y: 270 },
    ],
    hazards: [
      { x: 310,  y: 300, w: 20, h: 20 },
      { x: 660,  y: 260, w: 16, h: 16 },
      { x: 990,  y: 300, w: 20, h: 20 },
      { x: 1130, y: 270, w: 16, h: 16 },
      { x: 1480, y: 280, w: 20, h: 20 },
    ],
    enemies: [
      { x: 560,  y: 285, w: 20, h: 20, vx: 1,  minX: 510,  maxX: 640 },
      { x: 820,  y: 285, w: 20, h: 20, vx: -1, minX: 800,  maxX: 980 },
      { x: 1320, y: 285, w: 20, h: 20, vx: 1,  minX: 1310, maxX: 1470 },
    ],
    finishX: 1800,
    worldWidth: 1950,
  };
}

// ── AGENT FACTORY ───────────────────────────────
function createAgent(startX) {
  return {
    x: startX, y: 250,
    vx: 0, vy: 0,
    w: 22, h: 28,
    grounded: false,
    dir: 1,
    coins: 0,
    distMax: 0,
    alive: true,
    finished: false,
    resetCount: 0,
    activeRuleIdx: -1,
    sensors: {
      gap_ahead: false, coin_nearby: false,
      hazard_nearby: false, grounded: false, near_wall: false,
    },
  };
}

// ── SENSOR UPDATE ────────────────────────────────
function getFloorY(x, level) {
  let best = null;
  for (const p of level.platforms) {
    if (x >= p.x && x <= p.x + p.w) {
      if (best === null || p.y < best) best = p.y;
    }
  }
  return best;
}

function updateSensors(agent, level) {
  const s = agent.sensors;
  const ag = agent;
  const footX = ag.x + ag.w / 2;
  const footY = ag.y + ag.h;
  const lookAhead = footX + ag.dir * SENSOR_GAP_DIST;

  // Gap ahead
  const floorUnder = getFloorY(lookAhead, level);
  s.gap_ahead = floorUnder === null || floorUnder > 500;

  // Grounded
  s.grounded = ag.grounded;

  // Coin nearby
  s.coin_nearby = false;
  for (const c of level.coins) {
    if (!c.collected) {
      const dist = Math.hypot(c.x - (ag.x + ag.w/2), c.y - (ag.y + ag.h/2));
      if (dist < SENSOR_COIN_DIST) { s.coin_nearby = true; break; }
    }
  }

  // Hazard nearby
  const cx = ag.x + ag.w/2, cy = ag.y + ag.h/2;
  s.hazard_nearby = false;
  for (const h of level.hazards) {
    if (Math.hypot(h.x + h.w/2 - cx, h.y + h.h/2 - cy) < SENSOR_HAZ_DIST) { s.hazard_nearby = true; break; }
  }
  if (!s.hazard_nearby) {
    for (const e of level.enemies) {
      if (Math.hypot(e.x + e.w/2 - cx, e.y + e.h/2 - cy) < SENSOR_HAZ_DIST) { s.hazard_nearby = true; break; }
    }
  }

  // Near wall
  s.near_wall = false;
  const lookWall = cx + ag.dir * SENSOR_WALL_DIST;
  for (const p of level.platforms) {
    if (ag.y + ag.h > p.y && ag.y < p.y + p.h) {
      if (ag.dir > 0  && Math.abs(lookWall - p.x) < 10)           { s.near_wall = true; break; }
      if (ag.dir < 0  && Math.abs(lookWall - (p.x + p.w)) < 10)   { s.near_wall = true; break; }
    }
  }
}

// ── RULE EVALUATOR ───────────────────────────────
function evaluateRules(agent, rules) {
  const s = agent.sensors;
  for (let i = 0; i < rules.length; i++) {
    const r = rules[i];
    let condMet = false;
    if (r.cond === 'gap_ahead'     && s.gap_ahead)     condMet = true;
    if (r.cond === 'coin_nearby'   && s.coin_nearby)   condMet = true;
    if (r.cond === 'hazard_nearby' && s.hazard_nearby) condMet = true;
    if (r.cond === 'grounded'      && s.grounded)      condMet = true;
    if (r.cond === 'near_wall'     && s.near_wall)     condMet = true;
    if (condMet) { agent.activeRuleIdx = i; return r.action; }
  }
  agent.activeRuleIdx = -1;
  return null;
}

// ── ACTION APPLICATOR ────────────────────────────
function applyActionOLD(agent, action) {
  if (!action) return;
  switch (action) {
    case 'jump':       if (agent.grounded) { agent.vy = JUMP_V; agent.vx = agent.dir * MOVE_SPEED * 3; agent.grounded = false; } break;
    case 'move_left':  agent.vx = -MOVE_SPEED; agent.dir = -1; break;
    case 'move_right': agent.vx =  MOVE_SPEED; agent.dir =  1; break;
    case 'dash':       agent.vx = agent.dir * DASH_SPEED; break;
    case 'change_dir': agent.dir *= -1; agent.vx = agent.dir * MOVE_SPEED; break;
  }
}

function applyAction(agent, action) {
  if (!action) return;

  switch (action) {
    case 'jump':
      if (agent.grounded) {
        agent.vy = JUMP_V;
        agent.vx = agent.dir * JUMP_FORWARD_SPEED;
        agent.grounded = false;
      }
      break;

    case 'move_left':
      agent.vx = -MOVE_SPEED;
      agent.dir = -1;
      break;

    case 'move_right':
      agent.vx = MOVE_SPEED;
      agent.dir = 1;
      break;

    case 'dash':
      agent.vx = agent.dir * DASH_SPEED;
      break;

    case 'change_dir':
      agent.dir *= -1;
      agent.vx = agent.dir * MOVE_SPEED;
      break;
  }
}

// ── PHYSICS STEP ─────────────────────────────────
function physicsStep(agent, level) {

  agent.vx *= agent.grounded ? GROUND_FRICTION : AIR_FRICTION;

  agent.vy += GRAVITY;
  if (agent.vy > MAX_FALL) agent.vy = MAX_FALL;

  agent.x += agent.vx;
  agent.y += agent.vy;

  agent.grounded = false;
  for (const p of level.platforms) {
    if (agent.x + agent.w > p.x && agent.x < p.x + p.w) {
      if (agent.vy >= 0 && agent.y + agent.h > p.y && agent.y + agent.h < p.y + p.h + 12) {
        agent.y = p.y - agent.h;
        agent.vy = 0;
        agent.grounded = true;
      }
    }
    if (agent.y + agent.h > p.y + 2 && agent.y < p.y + p.h) {
      if (agent.x + agent.w > p.x && agent.x < p.x) {
        agent.x = p.x - agent.w; agent.vx = 0;
      } else if (agent.x < p.x + p.w && agent.x + agent.w > p.x + p.w) {
        agent.x = p.x + p.w; agent.vx = 0;
      }
    }
  }

  if (agent.x < 0) { agent.x = 0; agent.vx = 0; }

  // Collect coins
  for (const c of level.coins) {
    if (!c.collected) {
      if (Math.hypot(c.x - (agent.x + agent.w/2), c.y - (agent.y + agent.h/2)) < 18) {
        c.collected = true;
        agent.coins++;
      }
    }
  }

  // Hazard / fall check
  let hit = false;
  const ax1 = agent.x, ay1 = agent.y, ax2 = agent.x+agent.w, ay2 = agent.y+agent.h;
  for (const h of level.hazards) {
    if (ax2 > h.x && ax1 < h.x+h.w && ay2 > h.y && ay1 < h.y+h.h) { hit = true; break; }
  }
  if (!hit) {
    for (const e of level.enemies) {
      if (ax2 > e.x && ax1 < e.x+e.w && ay2 > e.y && ay1 < e.y+e.h) { hit = true; break; }
    }
  }
  if (agent.y > 500) hit = true;

  if (hit) {
    agent.x = 20; agent.y = 250; agent.vx = 0; agent.vy = 0;
    agent.dir = 1; agent.resetCount++;
  }

  if (agent.x > agent.distMax) agent.distMax = agent.x;
  if (agent.x + agent.w >= level.finishX) agent.finished = true;
}

// ── ENEMY UPDATE ─────────────────────────────────
function updateEnemies(level) {
  for (const e of level.enemies) {
    e.x += e.vx;
    if (e.x <= e.minX || e.x + e.w >= e.maxX) e.vx *= -1;
  }
}

// ── SCORE CALCULATOR ─────────────────────────────
function calcScore(agent) {
  return agent.coins * 50 + Math.round(agent.distMax / 10) + (agent.finished ? 300 : 0);
}

// ── LEVEL RENDERER ───────────────────────────────
function drawLevel(ctx, W, H, level, agent, camX, agentColor, showSensorOverlays=false) {
  const ox = -camX; // world-to-screen x offset

  // Background
  ctx.fillStyle = '#060c18';
  ctx.fillRect(0, 0, W, H);

  // Grid
  ctx.strokeStyle = 'rgba(0,128,255,0.04)';
  ctx.lineWidth = 1;
  const gs = 40;
  for (let gx = ox % gs; gx < W; gx += gs) {
    ctx.beginPath(); ctx.moveTo(gx, 0); ctx.lineTo(gx, H); ctx.stroke();
  }
  for (let gy = 0; gy < H; gy += gs) {
    ctx.beginPath(); ctx.moveTo(0, gy); ctx.lineTo(W, gy); ctx.stroke();
  }

  // Finish line
  const fx = level.finishX + ox;
  if (fx > 0 && fx < W) {
    ctx.strokeStyle = '#00ff88';
    ctx.lineWidth = 3;
    ctx.setLineDash([8, 4]);
    ctx.beginPath(); ctx.moveTo(fx, 0); ctx.lineTo(fx, H); ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = '#00ff88';
    ctx.font = '700 10px Orbitron, monospace';
    ctx.fillText('FINISH', fx + 4, 18);
  }

  // Platforms
  for (const p of level.platforms) {
    const px = p.x + ox;
    ctx.fillStyle = '#0a2040';
    ctx.fillRect(px, p.y, p.w, p.h);
    const grad = ctx.createLinearGradient(px, p.y, px, p.y + p.h);
    grad.addColorStop(0, 'rgba(0,180,255,0.25)');
    grad.addColorStop(1, 'rgba(0,60,120,0.1)');
    ctx.fillStyle = grad;
    ctx.fillRect(px, p.y, p.w, p.h);
    ctx.strokeStyle = '#1a4a7a';
    ctx.lineWidth = 1;
    ctx.strokeRect(px, p.y, p.w, p.h);
    ctx.strokeStyle = 'rgba(0,200,255,0.4)';
    ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(px, p.y); ctx.lineTo(px + p.w, p.y); ctx.stroke();
  }

  // Coins
  for (const c of level.coins) {
    if (c.collected) continue;
    const csx = c.x + ox;
    const bob = Math.sin(Date.now() / 400 + c.x) * 2;
    ctx.beginPath();
    ctx.arc(csx, c.y + bob, 7, 0, Math.PI * 2);
    ctx.fillStyle = '#ffd60a';
    ctx.fill();
    ctx.strokeStyle = '#ff9f0a';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(csx - 1.5, c.y + bob - 1.5, 2.5, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255,255,255,0.6)';
    ctx.fill();
  }

  // Hazards (spikes)
  for (const h of level.hazards) {
    const hx = h.x + ox;
    ctx.fillStyle = '#ff2d55';
    const ns = Math.floor(h.w / 8);
    for (let s = 0; s < ns; s++) {
      ctx.beginPath();
      ctx.moveTo(hx + s*8, h.y + h.h);
      ctx.lineTo(hx + s*8 + 4, h.y);
      ctx.lineTo(hx + s*8 + 8, h.y + h.h);
      ctx.closePath();
      ctx.fill();
    }
    ctx.shadowBlur = 8; ctx.shadowColor = '#ff2d55';
    ctx.fillStyle = 'rgba(255,45,85,0.2)';
    ctx.fillRect(hx, h.y, h.w, h.h);
    ctx.shadowBlur = 0;
  }

  // Enemies
  for (const e of level.enemies) {
    const ex = e.x + ox;
    ctx.fillStyle = '#ff6b35';
    ctx.fillRect(ex, e.y, e.w, e.h);
    ctx.fillStyle = '#fff';
    ctx.fillRect(ex + (e.vx > 0 ? 12 : 4), e.y + 5, 5, 5);
    ctx.fillStyle = '#000';
    ctx.fillRect(ex + (e.vx > 0 ? 14 : 5), e.y + 6, 3, 3);
    ctx.shadowBlur = 10; ctx.shadowColor = '#ff6b35';
    ctx.strokeStyle = 'rgba(255,107,53,0.5)';
    ctx.lineWidth = 1;
    ctx.strokeRect(ex, e.y, e.w, e.h);
    ctx.shadowBlur = 0;
  }

  // Agent
  const ag = agent;
  const agX = ag.x + ox;
  const agY = ag.y;
  const aColor = agentColor === 'cyan' ? '#00f5ff'
               : agentColor === 'orange' ? '#ff6b35'
               : '#00ff88';

  
  if (showSensorOverlays)
  {
    // Sensor overlays
    const s = ag.sensors;

    // Half-ring in front of the agent
    const ringCx = agX + ag.w / 2;
    const ringCy = agY + ag.h / 2;
    const ringR  = SENSOR_RANGE;

    // Facing right => front half is right semicircle
    // Facing left  => front half is left semicircle
    const frontBaseAngle = ag.dir === 1 ? 0 : Math.PI;
    const frontStartAngle = frontBaseAngle - Math.PI / 2;
    const frontEndAngle   = frontBaseAngle + Math.PI / 2;

    // Always-visible neutral dashed half-ring
    ctx.beginPath();
    ctx.arc(ringCx, ringCy, ringR, frontStartAngle, frontEndAngle);
    ctx.strokeStyle = 'rgba(180,180,180,0.35)';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([5, 5]);
    ctx.stroke();
    ctx.setLineDash([]);

    // Helper to draw a colored arc segment on the front half of the ring
    // relativeAngle is measured relative to the direction the agent faces:
    //   0 = directly ahead
    //  -Math.PI/4 = upper/front
    //   Math.PI/4 = lower/front
    function drawSensorArc(relativeAngle, arcWidth, color) {
      const centerAngle = frontBaseAngle + relativeAngle;

      ctx.beginPath();
      ctx.arc(
        ringCx,
        ringCy,
        ringR,
        centerAngle - arcWidth / 2,
        centerAngle + arcWidth / 2
      );
      ctx.strokeStyle = color;
      ctx.lineWidth = 3;
      ctx.lineCap = 'round';
      ctx.stroke();
    }

    // Sensor overlays as colored sections of the front half-ring
    if (s.coin_nearby) {
      // upper-front
      drawSensorArc(-Math.PI / 4, Math.PI / 4, 'rgba(255,214,10,0.95)');
    }

    if (s.gap_ahead) {
      // directly in front
      drawSensorArc(0, Math.PI / 4, 'rgba(0,245,255,0.95)');
    }

    if (s.hazard_nearby) {
      // lower-front
      drawSensorArc(Math.PI / 4, Math.PI / 4, 'rgba(255,45,85,0.95)');
    }

    if (s.near_wall) {
      // also on the front half, slightly wider
      drawSensorArc(0, Math.PI / 6, 'rgba(139,92,246,0.95)');
    }

    if (s.grounded) {
      // bottom-front
      drawSensorArc(Math.PI / 4, Math.PI / 3, 'rgba(0,255,136,0.95)');
    }
  }

  // Agent body
  ctx.shadowBlur = 14; ctx.shadowColor = aColor;
  ctx.fillStyle = aColor;
  ctx.fillRect(agX + 3, agY + 8, ag.w - 6, ag.h - 8);
  ctx.fillRect(agX + 4, agY,     ag.w - 8, 10);
  ctx.shadowBlur = 0;

  // Eyes
  const eyeX = ag.dir > 0 ? agX + ag.w - 10 : agX + 4;
  ctx.fillStyle = '#000';
  ctx.fillRect(eyeX, agY + 3, 4, 4);
  ctx.fillStyle = '#fff';
  ctx.fillRect(eyeX + 1, agY + 3, 2, 2);

  // Legs
  const legAnim = ag.grounded ? Math.sin(Date.now() / 100 * Math.abs(ag.vx)) * 4 : 0;
  ctx.fillStyle = 'rgba(0,255,136,0.6)';
  ctx.fillRect(agX + 4, agY + ag.h - 4, 6, 4 + legAnim);
  ctx.fillRect(agX + ag.w - 10, agY + ag.h - 4, 6, 4 - legAnim);

  // Finished banner
  if (ag.finished) {
    ctx.fillStyle = 'rgba(0,255,136,0.85)';
    ctx.font = 'bold 14px Orbitron, monospace';
    ctx.fillText('FINISHED!', Math.min(agX, W - 80), agY - 10);
  }
}