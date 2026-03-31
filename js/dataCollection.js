/* ═══════════════════════════════════════════════
   dataCollection.js — Rule Runners Data Collection

   All data is stored in sessionStorage under a
   single key derived from player names + login time.
   On logout the full session JSON is downloaded and
   sessionStorage is cleared.

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
       pageTimings: { "sensorDetection.html": 42, ... }  // seconds
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

// ── SECONDS SINCE EPOCH ──────────────────────────
function dcNow() {
  return Math.floor(Date.now() / 1000);
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
  // path: array of keys, e.g. ['collaborativeWalkthrough', 'steps', 0, 'sensorPlayer']
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
  // Append to an array at path, creating it if needed
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
// PAGE TIMING — call dcPageStart() on load,
// dcPageEnd() just before navigating away
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
  // Accumulate in case the page is visited more than once
  session.meta.pageTimings[page] = (session.meta.pageTimings[page] || 0) + elapsed;
  dcSaveSession(session);
  _pageStartTime = null;
}

// Auto-save page timing on any navigation away
window.addEventListener('pagehide', dcPageEnd);

// ═══════════════════════════════════════════════
// CLICK COUNTING — call dcAttachClickCounter()
// once per page to track total clicks globally
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
// LOGOUT — set timestamp, download JSON, clear
// ═══════════════════════════════════════════════
function dcLogout() {
  dcPageEnd();

  const session = dcGetSession();
  if (session.meta) {
    session.meta.logoutTimestamp = dcTimestamp();
  }
  dcSaveSession(session);

  const filename = session.meta?.filename || `session_${dcTimestamp()}.json`;
  const dataStr  = 'data:text/json;charset=utf-8,' +
                   encodeURIComponent(JSON.stringify(session, null, 2));
  const a = document.createElement('a');
  a.setAttribute('href', dataStr);
  a.setAttribute('download', filename);
  document.body.appendChild(a);
  a.click();
  a.remove();

  sessionStorage.clear();
  window.location.href = 'login.html';
}

// ═══════════════════════════════════════════════
// LEVEL: PRACTICE COLLABORATIVE WALKTHROUGH
// ═══════════════════════════════════════════════

/*
  Call order for practiceCollaborativeWalkthrough:
    dcPCW_start()                  — on page load
    dcPCW_recordSubmit(data)       — when Check Answers is clicked
    dcPCW_recordResultsView()      — when reveal is shown
    dcPCW_endResultsView()         — when Try Again or Proceed is clicked
*/

let _pcwAttemptStartTime  = null;
let _pcwResultsStartTime  = null;
let _pcwAttemptNumber     = 0;

function dcPCW_start() {
  dcPageStart();
  dcAttachClickCounter();
  _pcwAttemptStartTime = dcNow();
  _pcwAttemptNumber    = 0;

  // Initialise level bucket if not present
  const session = dcGetSession();
  if (!session.practiceCollaborativeWalkthrough) {
    session.practiceCollaborativeWalkthrough = { attempts: [] };
    dcSaveSession(session);
  }
}

/*
  data = {
    sensorsSelected    : ['grounded', 'coin_nearby'],   // keys
    ruleSelected       : 2,                              // index into PCW_RULES
    correctSensors     : ['grounded', 'coin_nearby'],
    correctRule        : 2,
    sensorCorrect      : true,
    ruleCorrect        : true,
    ruleCorrectGivenSelectedSensors : true,
  }
*/
function dcPCW_recordSubmit(data) {
  _pcwAttemptNumber++;
  const timeOnActivity = _pcwAttemptStartTime ? dcNow() - _pcwAttemptStartTime : null;

  // Per-sensor accuracy
  const ALL_SENSOR_KEYS = ['gap_ahead', 'coin_nearby', 'hazard_nearby', 'near_wall', 'grounded'];
  const correctSet      = new Set(data.correctSensors);
  const selectedSet     = new Set(data.sensorsSelected);
  const sensorAccuracy  = {};
  ALL_SENSOR_KEYS.forEach(k => {
    const selected = selectedSet.has(k);
    const correct  = correctSet.has(k);
    // true positive or true negative = correct
    sensorAccuracy[k] = selected === correct;
  });

  // Per-rule accuracy (was the correct rule selected?)
  const ALL_RULE_LABELS = ['jump_gap', 'jump_hazard', 'dash', 'change_dir', 'move_right'];
  const ruleAccuracy    = {};
  ALL_RULE_LABELS.forEach((label, i) => {
    ruleAccuracy[label] = data.ruleSelected === i ? (data.ruleSelected === data.correctRule) : null;
  });

  const attempt = {
    attemptNumber               : _pcwAttemptNumber,
    timeOnActivity_seconds      : timeOnActivity,
    clickCount                  : dcGetClickCount(),
    sensorsSelected             : data.sensorsSelected,
    ruleSelected                : data.ruleSelected,
    correctSensors              : data.correctSensors,
    correctRule                 : data.correctRule,
    sensorCorrect               : data.sensorCorrect,
    ruleCorrect                 : data.ruleCorrect,
    ruleCorrectGivenSelectedSensors : data.ruleCorrectGivenSelectedSensors,
    sensorAccuracyPerType       : sensorAccuracy,
    ruleAccuracyPerType         : ruleAccuracy,
    timeOnResultsPage_seconds   : null,  // filled in by dcPCW_endResultsView
  };

  dcPush(['practiceCollaborativeWalkthrough', 'attempts'], attempt);
  dcResetClickCount();

  // Start timing results page
  _pcwResultsStartTime = dcNow();
}

function dcPCW_recordResultsView() {
  _pcwResultsStartTime = dcNow();
}

function dcPCW_endResultsView() {
  if (_pcwResultsStartTime === null) return;
  const elapsed   = dcNow() - _pcwResultsStartTime;
  const session   = dcGetSession();
  const attempts  = session.practiceCollaborativeWalkthrough?.attempts;
  if (attempts && attempts.length > 0) {
    attempts[attempts.length - 1].timeOnResultsPage_seconds = elapsed;
    dcSaveSession(session);
  }
  // Reset for next attempt
  _pcwAttemptStartTime = dcNow();
  _pcwResultsStartTime = null;
}

// ═══════════════════════════════════════════════
// LEVEL: COLLABORATIVE WALKTHROUGH
// ═══════════════════════════════════════════════

/*
  Call order per scenario:
    dcCW_startScenario(scenarioIdx, sensorPlayerIdx)
    dcCW_sensorPlayerDone(sensorsSelected)
    dcCW_rulePlayerDone(ruleSelected)
    dcCW_recordReveal(correctSensors, correctRule, sensorCorrect, ruleCorrect, roundScore)
    dcCW_endResultsView()
*/

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
let _cwPhaseClicksTracked   = null;  // 'sensor' | 'rule'

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

// Call when sensor phase begins (after overlay dismissed)
function dcCW_beginSensorPhase() {
  _cwSensorStartTime      = dcNow();
  _cwPhaseClicksTracked   = 'sensor';
  _cwSensorClicks         = 0;
  dcResetClickCount();
}

// Call when rule phase begins (after overlay dismissed)
function dcCW_beginRulePhase() {
  _cwSensorClicks         = dcGetClickCount();
  _cwRuleStartTime        = dcNow();
  _cwPhaseClicksTracked   = 'rule';
  dcResetClickCount();
}

function dcCW_sensorPlayerDone(sensorsSelected) {
  _cwSensorsSelected = sensorsSelected;
}

function dcCW_rulePlayerDone(ruleSelected) {
  _cwRuleSelected    = ruleSelected;
  _cwRuleClicks      = dcGetClickCount();
}

/*
  Call this when the reveal screen is shown.
  data = {
    correctSensors, correctRule,
    sensorCorrect, ruleCorrect, roundScore,
    ruleCorrectGivenSelectedSensors
  }
*/
function dcCW_recordReveal(data) {
  _cwResultsStartTime = dcNow();

  const ALL_SENSOR_KEYS = ['gap_ahead', 'coin_nearby', 'hazard_nearby', 'near_wall', 'grounded'];
  const ALL_RULE_LABELS = ['jump_gap', 'jump_hazard', 'dash', 'change_dir', 'move_right'];

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
    timeOnSensorPhase_seconds       : sensorTime,
    timeOnRulePhase_seconds         : ruleTime,
    timeOnResultsPage_seconds       : null,  // filled in by dcCW_endResultsView
    totalTimeOnStep_seconds         : null,  // filled in by dcCW_endResultsView
  };

  dcPush(['collaborativeWalkthrough', 'steps'], step);

  // Update running total score
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
    steps[steps.length - 1].timeOnResultsPage_seconds = resultsTime;
    steps[steps.length - 1].totalTimeOnStep_seconds   = totalTime;
    dcSaveSession(session);
  }
  _cwResultsStartTime = null;
}

// ═══════════════════════════════════════════════
// LEVEL: BUILD YOUR AGENT
// ═══════════════════════════════════════════════

/*
  Call order per run:
    dcBuild_start()                  — on page load
    dcBuild_startRuleEditing()       — when user starts editing rules
    dcBuild_stopRuleEditing()        — when run button clicked (stop edit timer)
    dcBuild_recordRun(data)          — when run completes
    dcBuild_recordRuleReorder()      — each time a rule is dragged
    dcBuild_recordRuleCreated()      — each time a new rule is added
    dcBuild_recordResetClicked()     — each time reset is clicked
    dcBuild_recordRunButtonClicked() — each time run/step is clicked
*/

let _buildPageStart          = null;
let _buildRuleEditStart      = null;
let _buildTotalRuleEditTime  = 0;
let _buildAnimStart          = null;
let _buildRunCount           = 0;
let _buildResetCount         = 0;
let _buildRunButtonCount     = 0;
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
  _buildReorderCount      = 0;
  _buildRulesCreatedCount = 0;

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

function dcBuild_recordResetClicked() {
  _buildResetCount++;
}

function dcBuild_recordRuleReorder() {
  _buildReorderCount++;
}

function dcBuild_recordRuleCreated() {
  _buildRulesCreatedCount++;
}

/*
  data = {
    finalRules      : [ { cond, action }, ... ],
    coinsCollected  : 3,
    distanceTraveled: 480,
    ruleFiringCounts: { 0: 5, 1: 2, ... }  // rule index → count
  }
*/
function dcBuild_recordRun(data) {
  _buildRunCount++;
  const animTime = (_buildAnimStart) ? dcNow() - _buildAnimStart : null;

  const run = {
    runNumber               : _buildRunCount,
    finalRules              : data.finalRules,
    coinsCollected          : data.coinsCollected,
    distanceTraveled        : data.distanceTraveled,
    ruleFiringCounts        : data.ruleFiringCounts,
    timeSpentEditingRules_seconds : _buildTotalRuleEditTime,
    timeWatchingAnimation_seconds : animTime,
    totalRulesCreated       : _buildRulesCreatedCount,
    ruleReorderCount        : _buildReorderCount,
    resetClickCount         : _buildResetCount,
    runButtonClickCount     : _buildRunButtonCount,
    clickCount              : dcGetClickCount(),
  };

  dcPush(['buildAgent', 'runs'], run);
  dcResetClickCount();
  _buildTotalRuleEditTime = 0;
  _buildAnimStart         = null;
}

// ═══════════════════════════════════════════════
// LEVEL: COMPETE
// ═══════════════════════════════════════════════

/*
  Call order:
    dcCompete_start()
    dcCompete_startRuleEditing(playerIdx)   — 1 or 2
    dcCompete_stopRuleEditing(playerIdx)
    dcCompete_recordRuleReorder(playerIdx)
    dcCompete_recordRuleCreated(playerIdx)
    dcCompete_startAnimation()
    dcCompete_recordResult(data)
*/

let _competeP1EditStart   = null;
let _competeP2EditStart   = null;
let _competeP1EditTime    = 0;
let _competeP2EditTime    = 0;
let _competeAnimStart     = null;
let _competeP1Reorders    = 0;
let _competeP2Reorders    = 0;
let _competeP1Created     = 0;
let _competeP2Created     = 0;
let _competeGameCount     = 0;

function dcCompete_start() {
  dcPageStart();
  dcAttachClickCounter();
  _competeP1EditTime  = 0;
  _competeP2EditTime  = 0;
  _competeP1Reorders  = 0;
  _competeP2Reorders  = 0;
  _competeP1Created   = 0;
  _competeP2Created   = 0;
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

function dcCompete_recordRuleCreated(playerIdx) {
  if (playerIdx === 1) _competeP1Created++;
  if (playerIdx === 2) _competeP2Created++;
}

function dcCompete_startAnimation() {
  dcCompete_stopRuleEditing(1);
  dcCompete_stopRuleEditing(2);
  _competeAnimStart = dcNow();
}

/*
  data = {
    p1FinalRules, p1AllRulesCreated, p1Score,
    p1CoinsCollected, p1DistanceMax, p1RuleFiringCounts,
    p2FinalRules, p2AllRulesCreated, p2Score,
    p2CoinsCollected, p2DistanceMax, p2RuleFiringCounts,
  }
*/
function dcCompete_recordResult(data) {
  _competeGameCount++;
  const animTime = _competeAnimStart ? dcNow() - _competeAnimStart : null;

  const game = {
    gameNumber                      : _competeGameCount,
    player1: {
      finalRules                    : data.p1FinalRules,
      allRulesCreated               : data.p1AllRulesCreated,
      ruleReorderCount              : _competeP1Reorders,
      score                         : data.p1Score,
      coinsCollected                : data.p1CoinsCollected,
      distanceMax                   : data.p1DistanceMax,
      ruleFiringCounts              : data.p1RuleFiringCounts,
      timeEditingRules_seconds      : _competeP1EditTime,
    },
    player2: {
      finalRules                    : data.p2FinalRules,
      allRulesCreated               : data.p2AllRulesCreated,
      ruleReorderCount              : _competeP2Reorders,
      score                         : data.p2Score,
      coinsCollected                : data.p2CoinsCollected,
      distanceMax                   : data.p2DistanceMax,
      ruleFiringCounts              : data.p2RuleFiringCounts,
      timeEditingRules_seconds      : _competeP2EditTime,
    },
    timeWatchingAnimation_seconds   : animTime,
    clickCount                      : dcGetClickCount(),
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

/*
  Call order:
    dcStory_start()
    dcStory_startTyping() / dcStory_stopTyping()   — when text area focused/blurred
    dcStory_startDrawing() / dcStory_stopDrawing() — when drawing canvas active
    dcStory_recordSubmit(data)
*/

let _storyTypingStart   = null;
let _storyTypingTime    = 0;
let _storyDrawingStart  = null;
let _storyDrawingTime   = 0;

function dcStory_start() {
  dcPageStart();
  dcAttachClickCounter();
  _storyTypingTime  = 0;
  _storyDrawingTime = 0;
  _storyTypingStart = null;
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

/*
  data = {
    scenarioText : "...",
    drawingDataUrl : "data:image/png;base64,..."  // canvas.toDataURL()
  }
*/
function dcStory_recordSubmit(data) {
  dcStory_stopTyping();
  dcStory_stopDrawing();

  dcSet(['story'], {
    scenarioText              : data.scenarioText || '',
    drawingImage              : data.drawingDataUrl || null,
    timeTyping_seconds        : _storyTypingTime,
    timeDrawing_seconds       : _storyDrawingTime,
    clickCount                : dcGetClickCount(),
  });
}

// ═══════════════════════════════════════════════
// EXPORTS — attach to window so all pages can call
// these functions without ES module imports
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