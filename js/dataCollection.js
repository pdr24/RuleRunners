/* ═══════════════════════════════════════════════
   dataCollection.js — Rule Runners Data Collection

   All data is stored in sessionStorage under the
   key "session". On logout the full session JSON
   is downloaded and sessionStorage is cleared.

   SESSION STORAGE STRUCTURE
   ─────────────────────────
   Key: "session"
   Value (JSON):
   {
     meta: {
       player1: { first, last, grade },
       player2: { first, last, grade },
       loginTimestamp: "2025-03-30_14-22-05",
       logoutTimestamp: "...",
       filename: "Alice_A____Bob_B__2025-03-30_14-22-05.json",
       pageTimings: { "sensorDetection.html": 4200, ... }  // ms
     },
     practiceCollaborativeWalkthrough: { ... },
     collaborativeWalkthrough: { ... },
     buildAgent: { ... },
     compete: { ... },
     story: { ... }
   }
   ═══════════════════════════════════════════════ */

'use strict';

// ── TIMESTAMP HELPER ─────────────────────────────
function dcTimestamp(date = new Date()) {
  const pad = n => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth()+1)}-${pad(date.getDate())}` +
         `_${pad(date.getHours())}-${pad(date.getMinutes())}-${pad(date.getSeconds())}`;
}

// ── MILLISECONDS SINCE EPOCH ─────────────────────
// FIX #4: use Date.now() for millisecond precision
// instead of Math.floor(Date.now()/1000)
function dcNow() {
  return Date.now();
}

// ── READ / WRITE SESSION ─────────────────────────
function dcGetSession() {
  try {
    return JSON.parse(sessionStorage.getItem('session')) || {};
  } catch { return {}; }
}

function dcSaveSession(data) {
  sessionStorage.setItem('session', JSON.stringify(data));
}

function dcSet(path, value) {
  const session = dcGetSession();
  let node = session;
  for (let i = 0; i < path.length - 1; i++) {
    if (node[path[i]] === undefined) {
      node[path[i]] = typeof path[i+1] === 'number' ? [] : {};
    }
    node = node[path[i]];
  }
  node[path[path.length - 1]] = value;
  dcSaveSession(session);
}

function dcGet(path) {
  let node = dcGetSession();
  for (const key of path) {
    if (node === undefined || node === null) return undefined;
    node = node[key];
  }
  return node;
}

function dcPush(path, value) {
  const session = dcGetSession();
  let node = session;
  for (let i = 0; i < path.length - 1; i++) {
    if (node[path[i]] === undefined) node[path[i]] = {};
    node = node[path[i]];
  }
  const key = path[path.length - 1];
  if (!Array.isArray(node[key])) node[key] = [];
  node[key].push(value);
  dcSaveSession(session);
}

// ═══════════════════════════════════════════════
// INITIALIZATION — called once on login
// ═══════════════════════════════════════════════
function dcInitSession() {
  const players = JSON.parse(sessionStorage.getItem('players') || '{}');
  const p1 = players.p1 || {};
  const p2 = players.p2 || {};
  const loginTs = dcTimestamp();

  const filename =
    `${p1.first || 'P1'}_${p1.last || 'X'}____` +
    `${p2.first || 'P2'}_${p2.last || 'X'}__${loginTs}.json`;

  const session = {
    meta: {
      player1: { first: p1.first, last: p1.last, grade: p1.grade },
      player2: { first: p2.first, last: p2.last, grade: p2.grade },
      loginTimestamp: loginTs,
      logoutTimestamp: null,
      filename,
      pageTimings: {},
    },
  };
  dcSaveSession(session);
  return session;
}

// ═══════════════════════════════════════════════
// PAGE TIMING
// ═══════════════════════════════════════════════
let _pageStartTime = null;

function dcPageStart() {
  _pageStartTime = dcNow();
}

function dcPageEnd() {
  if (_pageStartTime === null) return;
  const page = window.location.pathname.split('/').pop() || 'index.html';
  const elapsed = dcNow() - _pageStartTime;
  const session = dcGetSession();
  if (!session.meta) return;
  if (!session.meta.pageTimings) session.meta.pageTimings = {};
  session.meta.pageTimings[page] = (session.meta.pageTimings[page] || 0) + elapsed;
  dcSaveSession(session);
  _pageStartTime = null;
}

window.addEventListener('pagehide', dcPageEnd);

// ═══════════════════════════════════════════════
// CLICK COUNTING
// ═══════════════════════════════════════════════
let _clickCount = 0;
let _clickCounterAttached = false;

function dcAttachClickCounter() {
  if (_clickCounterAttached) return;
  _clickCount = 0;
  _clickCounterAttached = true;
  document.addEventListener('click', () => { _clickCount++; });
}

function dcGetClickCount() {
  return _clickCount;
}

function dcResetClickCount() {
  _clickCount = 0;
}

// ═══════════════════════════════════════════════
// LOGOUT
// ═══════════════════════════════════════════════
function dcLogout() {
  dcPageEnd();

  const session = dcGetSession();
  if (session.meta) {
    session.meta.logoutTimestamp = dcTimestamp();
  }

  // Strip the drawing out of the JSON before saving —
  // it will be downloaded as its own PNG file instead
  const drawingDataUrl = session.story?.drawingImage || null;
  if (session.story) {
    session.story.drawingImage = 'see accompanying .png file';
  }

  dcSaveSession(session);

  const baseName = (session.meta?.filename || `session_${dcTimestamp()}.json`)
    .replace('.json', '');

  // ── Download JSON ──
  const dataStr = 'data:text/json;charset=utf-8,' +
                  encodeURIComponent(JSON.stringify(session, null, 2));
  const a = document.createElement('a');
  a.setAttribute('href', dataStr);
  a.setAttribute('download', baseName + '.json');
  document.body.appendChild(a);
  a.click();
  a.remove();

  // ── Download PNG (if drawing exists) ──
  if (drawingDataUrl && drawingDataUrl.startsWith('data:image')) {
    const img = document.createElement('a');
    img.setAttribute('href', drawingDataUrl);
    img.setAttribute('download', baseName + '_drawing.png');
    document.body.appendChild(img);
    img.click();
    img.remove();
  }

  sessionStorage.clear();
  window.location.href = 'login.html';
}

// ═══════════════════════════════════════════════
// LEVEL: PRACTICE COLLABORATIVE WALKTHROUGH
// ═══════════════════════════════════════════════

let _pcwAttemptStartTime  = null;
let _pcwResultsStartTime  = null;
let _pcwAttemptNumber     = 0;

function dcPCW_start() {
  dcPageStart();
  dcAttachClickCounter();
  _pcwAttemptStartTime = dcNow();
  _pcwAttemptNumber    = 0;

  const session = dcGetSession();
  if (!session.practiceCollaborativeWalkthrough) {
    session.practiceCollaborativeWalkthrough = { attempts: [] };
    dcSaveSession(session);
  }
}

function dcPCW_recordSubmit(data) {
  _pcwAttemptNumber++;
  const timeOnActivity = _pcwAttemptStartTime ? dcNow() - _pcwAttemptStartTime : null;

  // FIX #5: removed 'near_wall' from ALL_SENSOR_KEYS
  const ALL_SENSOR_KEYS = ['gap_ahead', 'coin_nearby', 'hazard_nearby', 'grounded'];
  const correctSet      = new Set(data.correctSensors);
  const selectedSet     = new Set(data.sensorsSelected);
  const sensorAccuracy  = {};
  ALL_SENSOR_KEYS.forEach(k => {
    sensorAccuracy[k] = selectedSet.has(k) === correctSet.has(k);
  });

  const ALL_RULE_LABELS = ['jump_gap', 'jump_hazard', 'dash', 'move_right'];
  const ruleAccuracy    = {};
  ALL_RULE_LABELS.forEach((label, i) => {
    ruleAccuracy[label] = data.ruleSelected === i ? (data.ruleSelected === data.correctRule) : null;
  });

  const attempt = {
    attemptNumber                   : _pcwAttemptNumber,
    timeOnActivity_ms               : timeOnActivity,   // FIX #4: renamed _seconds → _ms
    clickCount                      : dcGetClickCount(),
    sensorsSelected                 : data.sensorsSelected,
    ruleSelected                    : data.ruleSelected,
    correctSensors                  : data.correctSensors,
    correctRule                     : data.correctRule,
    sensorCorrect                   : data.sensorCorrect,
    ruleCorrect                     : data.ruleCorrect,
    ruleCorrectGivenSelectedSensors : data.ruleCorrectGivenSelectedSensors,
    sensorAccuracyPerType           : sensorAccuracy,
    ruleAccuracyPerType             : ruleAccuracy,
    timeOnResultsPage_ms            : null,  // filled in by dcPCW_endResultsView
  };

  dcPush(['practiceCollaborativeWalkthrough', 'attempts'], attempt);
  dcResetClickCount();

  // FIX #8 (redundancy): only start results timer here; removed dcPCW_recordResultsView()
  _pcwResultsStartTime = dcNow();
}

// FIX #8: kept for API compatibility but no longer called from pcwSubmit
function dcPCW_recordResultsView() {
  _pcwResultsStartTime = dcNow();
}

function dcPCW_endResultsView() {
  if (_pcwResultsStartTime === null) return;
  const elapsed  = dcNow() - _pcwResultsStartTime;
  const session  = dcGetSession();
  const attempts = session.practiceCollaborativeWalkthrough?.attempts;
  if (attempts && attempts.length > 0) {
    attempts[attempts.length - 1].timeOnResultsPage_ms = elapsed;
    dcSaveSession(session);
  }
  _pcwAttemptStartTime = dcNow();
  _pcwResultsStartTime = null;
}

// ═══════════════════════════════════════════════
// LEVEL: COLLABORATIVE WALKTHROUGH
// ═══════════════════════════════════════════════

let _cwScenarioStartTime    = null;
let _cwSensorStartTime      = null;
let _cwRuleStartTime        = null;
let _cwResultsStartTime     = null;
let _cwCurrentScenarioIdx   = null;
let _cwSensorPlayerIdx      = null;
let _cwSensorsSelected      = null;
let _cwRuleSelected         = null;
let _cwSensorClicks         = 0;
let _cwRuleClicks           = 0;
let _cwPhaseClicksTracked   = null;

function dcCW_start() {
  dcPageStart();
  dcAttachClickCounter();

  const session = dcGetSession();
  if (!session.collaborativeWalkthrough) {
    session.collaborativeWalkthrough = { steps: [], totalScore: 0 };
    dcSaveSession(session);
  }
}

function dcCW_startScenario(scenarioIdx, sensorPlayerIdx) {
  _cwScenarioStartTime  = dcNow();
  _cwSensorStartTime    = null;
  _cwRuleStartTime      = null;
  _cwResultsStartTime   = null;
  _cwCurrentScenarioIdx = scenarioIdx;
  _cwSensorPlayerIdx    = sensorPlayerIdx;
  _cwSensorsSelected    = null;
  _cwRuleSelected       = null;
  _cwSensorClicks       = 0;
  _cwRuleClicks         = 0;
  dcResetClickCount();
}

function dcCW_beginSensorPhase() {
  _cwSensorStartTime    = dcNow();
  _cwPhaseClicksTracked = 'sensor';
  _cwSensorClicks       = 0;
  dcResetClickCount();
}

function dcCW_beginRulePhase() {
  _cwSensorClicks       = dcGetClickCount();
  _cwRuleStartTime      = dcNow();
  _cwPhaseClicksTracked = 'rule';
  dcResetClickCount();
}

function dcCW_sensorPlayerDone(sensorsSelected) {
  _cwSensorsSelected = sensorsSelected;
}

function dcCW_rulePlayerDone(ruleSelected) {
  _cwRuleSelected = ruleSelected;
  _cwRuleClicks   = dcGetClickCount();
}

function dcCW_recordReveal(data) {
  _cwResultsStartTime = dcNow();

  // FIX #5: removed 'near_wall' from ALL_SENSOR_KEYS
  const ALL_SENSOR_KEYS = ['gap_ahead', 'coin_nearby', 'hazard_nearby', 'grounded'];
  const ALL_RULE_LABELS = ['jump_gap', 'jump_hazard', 'dash', 'move_right'];

  const correctSet  = new Set(data.correctSensors);
  const selectedSet = new Set(_cwSensorsSelected || []);

  const sensorAccuracy = {};
  ALL_SENSOR_KEYS.forEach(k => {
    sensorAccuracy[k] = selectedSet.has(k) === correctSet.has(k);
  });

  const ruleAccuracy = {};
  ALL_RULE_LABELS.forEach((label, i) => {
    ruleAccuracy[label] = _cwRuleSelected === i ? (_cwRuleSelected === data.correctRule) : null;
  });

  const sensorTime = (_cwRuleStartTime && _cwSensorStartTime)
    ? _cwRuleStartTime - _cwSensorStartTime : null;
  const ruleTime   = (_cwResultsStartTime && _cwRuleStartTime)
    ? _cwResultsStartTime - _cwRuleStartTime : null;

  const step = {
    stepNumber                      : (_cwCurrentScenarioIdx ?? 0) + 1,
    sensorPlayer                    : _cwSensorPlayerIdx === 0 ? 'player1' : 'player2',
    rulePlayer                      : _cwSensorPlayerIdx === 0 ? 'player2' : 'player1',
    sensorsSelected                 : _cwSensorsSelected,
    ruleSelected                    : _cwRuleSelected,
    correctSensors                  : data.correctSensors,
    correctRule                     : data.correctRule,
    sensorPlayerCorrect             : data.sensorCorrect,
    rulePlayerCorrect               : data.ruleCorrect,
    ruleCorrectGivenSelectedSensors : data.ruleCorrectGivenSelectedSensors,
    roundScore                      : data.roundScore,
    sensorAccuracyPerType           : sensorAccuracy,
    ruleAccuracyPerType             : ruleAccuracy,
    clicksBySensorPlayer            : _cwSensorClicks,
    clicksByRulePlayer              : _cwRuleClicks,
    timeOnSensorPhase_ms            : sensorTime,   // FIX #4
    timeOnRulePhase_ms              : ruleTime,     // FIX #4
    timeOnResultsPage_ms            : null,         // filled in by dcCW_endResultsView
    totalTimeOnStep_ms              : null,         // filled in by dcCW_endResultsView
  };

  dcPush(['collaborativeWalkthrough', 'steps'], step);

  const session = dcGetSession();
  if (session.collaborativeWalkthrough) {
    session.collaborativeWalkthrough.totalScore =
      (session.collaborativeWalkthrough.totalScore || 0) + (data.roundScore || 0);
    dcSaveSession(session);
  }
}

function dcCW_endResultsView() {
  if (_cwResultsStartTime === null) return;
  const resultsTime = dcNow() - _cwResultsStartTime;
  const totalTime   = _cwScenarioStartTime ? dcNow() - _cwScenarioStartTime : null;

  const session = dcGetSession();
  const steps   = session.collaborativeWalkthrough?.steps;
  if (steps && steps.length > 0) {
    steps[steps.length - 1].timeOnResultsPage_ms = resultsTime;   // FIX #4
    steps[steps.length - 1].totalTimeOnStep_ms   = totalTime;     // FIX #4
    dcSaveSession(session);
  }
  _cwResultsStartTime = null;
}

// ═══════════════════════════════════════════════
// LEVEL: BUILD YOUR AGENT
// ═══════════════════════════════════════════════

let _buildPageStart          = null;
let _buildRuleEditStart      = null;
let _buildTotalRuleEditTime  = 0;
let _buildAnimStart          = null;
let _buildRunCount           = 0;
let _buildResetCount         = 0;
let _buildRunButtonCount     = 0;
let _buildStepCount          = 0;   // FIX #3: new step-click counter
let _buildReorderCount       = 0;
let _buildRulesCreatedCount  = 0;

function dcBuild_start() {
  dcPageStart();
  dcAttachClickCounter();
  _buildPageStart         = dcNow();
  _buildTotalRuleEditTime = 0;
  _buildRuleEditStart     = null;
  _buildAnimStart         = null;
  _buildRunCount          = 0;
  _buildResetCount        = 0;
  _buildRunButtonCount    = 0;
  _buildStepCount         = 0;
  _buildReorderCount      = 0;
  _buildRulesCreatedCount = 0;

  // FIX #1a: start editing timer immediately on page load
  dcBuild_startRuleEditing();

  const session = dcGetSession();
  if (!session.buildAgent) {
    session.buildAgent = { runs: [] };
    dcSaveSession(session);
  }
}

function dcBuild_startRuleEditing() {
  if (_buildRuleEditStart === null) _buildRuleEditStart = dcNow();
}

function dcBuild_stopRuleEditing() {
  if (_buildRuleEditStart !== null) {
    _buildTotalRuleEditTime += dcNow() - _buildRuleEditStart;
    _buildRuleEditStart = null;
  }
}

function dcBuild_recordRunButtonClicked() {
  _buildRunButtonCount++;
  dcBuild_stopRuleEditing();
  _buildAnimStart = dcNow();
}

// FIX #3: new function for step-click tracking
function dcBuild_recordStepClicked() {
  _buildStepCount++;
}

function dcBuild_recordResetClicked() {
  _buildResetCount++;
}

function dcBuild_recordRuleReorder() {
  _buildReorderCount++;
}

function dcBuild_recordRuleCreated() {
  _buildRulesCreatedCount++;
}

function dcBuild_recordRun(data) {
  _buildRunCount++;
  const animTime = (_buildAnimStart) ? dcNow() - _buildAnimStart : null;

  const run = {
    runNumber               : _buildRunCount,
    finalRules              : data.finalRules,
    coinsCollected          : data.coinsCollected,
    distanceTraveled        : data.distanceTraveled,
    ruleFiringCounts        : data.ruleFiringCounts,
    timeSpentEditingRules_ms : _buildTotalRuleEditTime,   // FIX #4
    timeWatchingAnimation_ms : animTime,                  // FIX #4
    totalRulesCreated        : _buildRulesCreatedCount,
    ruleReorderCount         : _buildReorderCount,
    resetClickCount          : _buildResetCount,
    runButtonClickCount      : _buildRunButtonCount,
    stepClickCount           : _buildStepCount,           // FIX #3
    clickCount               : dcGetClickCount(),
  };

  dcPush(['buildAgent', 'runs'], run);
  dcResetClickCount();

  // FIX #2: reset all per-run counters after saving so run N+1 starts fresh
  _buildTotalRuleEditTime = 0;
  _buildAnimStart         = null;
  _buildRulesCreatedCount = 0;
  _buildReorderCount      = 0;
  _buildResetCount        = 0;
  _buildRunButtonCount    = 0;
  _buildStepCount         = 0;

  // Restart editing timer for the next run
  dcBuild_startRuleEditing();
}

// ═══════════════════════════════════════════════
// LEVEL: COMPETE
// ═══════════════════════════════════════════════

let _competeP1EditStart   = null;
let _competeP2EditStart   = null;
let _competeP1EditTime    = 0;
let _competeP2EditTime    = 0;
let _competeAnimStart     = null;
let _competeP1Reorders    = 0;
let _competeP2Reorders    = 0;
// FIX #6: removed dead _competeP1Created / _competeP2Created counters
let _competeGameCount     = 0;

function dcCompete_start() {
  dcPageStart();
  dcAttachClickCounter();
  _competeP1EditTime  = 0;
  _competeP2EditTime  = 0;
  _competeP1Reorders  = 0;
  _competeP2Reorders  = 0;
  _competeGameCount   = 0;

  const session = dcGetSession();
  if (!session.compete) {
    session.compete = { games: [] };
    dcSaveSession(session);
  }
}

function dcCompete_startRuleEditing(playerIdx) {
  if (playerIdx === 1 && _competeP1EditStart === null) _competeP1EditStart = dcNow();
  if (playerIdx === 2 && _competeP2EditStart === null) _competeP2EditStart = dcNow();
}

function dcCompete_stopRuleEditing(playerIdx) {
  if (playerIdx === 1 && _competeP1EditStart !== null) {
    _competeP1EditTime += dcNow() - _competeP1EditStart;
    _competeP1EditStart = null;
  }
  if (playerIdx === 2 && _competeP2EditStart !== null) {
    _competeP2EditTime += dcNow() - _competeP2EditStart;
    _competeP2EditStart = null;
  }
}

function dcCompete_recordRuleReorder(playerIdx) {
  if (playerIdx === 1) _competeP1Reorders++;
  if (playerIdx === 2) _competeP2Reorders++;
}

// FIX #6: kept for API compatibility but no longer increments dead counters
function dcCompete_recordRuleCreated(playerIdx) {
  // counts are captured via allRulesCreated array length in compete.js
}

function dcCompete_startAnimation() {
  dcCompete_stopRuleEditing(1);
  dcCompete_stopRuleEditing(2);
  _competeAnimStart = dcNow();
}

function dcCompete_recordResult(data) {
  _competeGameCount++;
  const animTime = _competeAnimStart ? dcNow() - _competeAnimStart : null;

  const game = {
    gameNumber                       : _competeGameCount,
    player1: {
      finalRules                     : data.p1FinalRules,
      allRulesCreated                : data.p1AllRulesCreated,
      rulesCreatedCount              : data.p1AllRulesCreated?.length ?? 0,
      ruleReorderCount               : _competeP1Reorders,
      score                          : data.p1Score,
      coinsCollected                 : data.p1CoinsCollected,
      distanceMax                    : data.p1DistanceMax,
      ruleFiringCounts               : data.p1RuleFiringCounts,
      timeEditingRules_ms            : _competeP1EditTime,   // FIX #4
    },
    player2: {
      finalRules                     : data.p2FinalRules,
      allRulesCreated                : data.p2AllRulesCreated,
      rulesCreatedCount              : data.p2AllRulesCreated?.length ?? 0,
      ruleReorderCount               : _competeP2Reorders,
      score                          : data.p2Score,
      coinsCollected                 : data.p2CoinsCollected,
      distanceMax                    : data.p2DistanceMax,
      ruleFiringCounts               : data.p2RuleFiringCounts,
      timeEditingRules_ms            : _competeP2EditTime,   // FIX #4
    },
    timeWatchingAnimation_ms         : animTime,             // FIX #4
    clickCount                       : dcGetClickCount(),
  };

  dcPush(['compete', 'games'], game);
  dcResetClickCount();
  _competeP1EditTime = 0;
  _competeP2EditTime = 0;
  _competeP1Reorders = 0;
  _competeP2Reorders = 0;
  _competeAnimStart  = null;
}

// ═══════════════════════════════════════════════
// LEVEL: STORY
// ═══════════════════════════════════════════════

let _storyTypingStart   = null;
let _storyTypingTime    = 0;
let _storyDrawingStart  = null;
let _storyDrawingTime   = 0;

function dcStory_start() {
  dcPageStart();
  dcAttachClickCounter();
  _storyTypingTime   = 0;
  _storyDrawingTime  = 0;
  _storyTypingStart  = null;
  _storyDrawingStart = null;

  const session = dcGetSession();
  if (!session.story) {
    session.story = {};
    dcSaveSession(session);
  }
}

function dcStory_startTyping() {
  if (_storyTypingStart === null) _storyTypingStart = dcNow();
}

function dcStory_stopTyping() {
  if (_storyTypingStart !== null) {
    _storyTypingTime += dcNow() - _storyTypingStart;
    _storyTypingStart = null;
  }
}

function dcStory_startDrawing() {
  if (_storyDrawingStart === null) _storyDrawingStart = dcNow();
}

function dcStory_stopDrawing() {
  if (_storyDrawingStart !== null) {
    _storyDrawingTime += dcNow() - _storyDrawingStart;
    _storyDrawingStart = null;
  }
}

function dcStory_recordSubmit(data) {
  dcStory_stopTyping();
  dcStory_stopDrawing();

  dcSet(['story'], {
    scenarioText       : data.scenarioText || '',
    drawingImage       : data.drawingDataUrl || null,
    timeTyping_ms      : _storyTypingTime,    // FIX #4
    timeDrawing_ms     : _storyDrawingTime,   // FIX #4
    clickCount         : dcGetClickCount(),
  });
}

// ═══════════════════════════════════════════════
// EXPORTS
// ═══════════════════════════════════════════════
Object.assign(window, {
  // Core
  dcInitSession,
  dcPageStart,
  dcPageEnd,
  dcAttachClickCounter,
  dcGetClickCount,
  dcResetClickCount,
  dcLogout,

  // Practice Collaborative Walkthrough
  dcPCW_start,
  dcPCW_recordSubmit,
  dcPCW_recordResultsView,
  dcPCW_endResultsView,

  // Collaborative Walkthrough
  dcCW_start,
  dcCW_startScenario,
  dcCW_beginSensorPhase,
  dcCW_beginRulePhase,
  dcCW_sensorPlayerDone,
  dcCW_rulePlayerDone,
  dcCW_recordReveal,
  dcCW_endResultsView,

  // Build Agent
  dcBuild_start,
  dcBuild_startRuleEditing,
  dcBuild_stopRuleEditing,
  dcBuild_recordRunButtonClicked,
  dcBuild_recordStepClicked,       // FIX #3
  dcBuild_recordResetClicked,
  dcBuild_recordRuleReorder,
  dcBuild_recordRuleCreated,
  dcBuild_recordRun,

  // Compete
  dcCompete_start,
  dcCompete_startRuleEditing,
  dcCompete_stopRuleEditing,
  dcCompete_recordRuleReorder,
  dcCompete_recordRuleCreated,
  dcCompete_startAnimation,
  dcCompete_recordResult,

  // Story
  dcStory_start,
  dcStory_startTyping,
  dcStory_stopTyping,
  dcStory_startDrawing,
  dcStory_stopDrawing,
  dcStory_recordSubmit,
});