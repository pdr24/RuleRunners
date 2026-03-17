/* ═══════════════════════════════════════════════
   nav.js — Shared phase navigation builder

   Usage: add to every page before </body>:
     <script src="js/nav.js"></script>

   Each page identifies itself with a data attribute
   on its <header> element:
     <header class="app-header" data-phase="1.2">

   The home/index page uses:
     <header class="app-header" data-phase="home">
   which renders the logo only (no phase dots).

   ADDING OR REMOVING A PHASE IN FUTURE:
     Edit only the PHASES array below.
     Every page header rebuilds automatically — no
     other files need to change.
   ═══════════════════════════════════════════════ */

const PHASES = [
  { id: '01',  label: '01',  title: 'What Is Rule-Based AI?', href: 'whatIsRuleBasedAI.html' },
  { id: '02', label: '02', title: 'Sensor Detection',       href: 'sensorDetection.html'  },
  { id: '03', label: '03', title: 'Guided Walkthrough',     href: 'guidedWalkthrough.html' },
  { id: '04',  label: '04',  title: 'Build Your Agent',       href: 'buildAgent.html'        },
  { id: '05',  label: '05',  title: 'Compete',                href: 'compete.html'           },
];

(function buildNav() {
  const header = document.querySelector('header.app-header[data-phase]');
  if (!header) return;

  const currentId  = header.getAttribute('data-phase');
  const currentIdx = PHASES.findIndex(p => p.id === currentId);

  // ── Logo (always present) ──────────────────────
  const logo = document.createElement('a');
  logo.className   = 'logo';
  logo.href        = 'index.html';
  logo.textContent = 'Rule-Runners';

  // Clear whatever static HTML was in the header
  header.innerHTML = '';
  header.appendChild(logo);

  // ── Phase indicator ────────────────────────────
  // currentIdx is -1 for home (no phase active), which means
  // isDone is never true and isActive is never true — all dots
  // render as plain upcoming dots.
  const nav = document.createElement('nav');
  nav.className = 'phase-indicator';

  PHASES.forEach((phase, idx) => {
    const isDone   = idx < currentIdx;
    const isActive = idx === currentIdx;

    // Dot — link if done, plain span otherwise
    let dot;
    if (isDone) {
      dot             = document.createElement('a');
      dot.href        = phase.href;
      dot.className   = 'phase-dot done clickable';
      dot.textContent = '✓';
    } else if (isActive) {
      dot             = document.createElement('span');
      dot.className   = 'phase-dot active';
      dot.textContent = phase.label;
    } else {
      dot             = document.createElement('span');
      dot.className   = 'phase-dot';
      dot.textContent = phase.label;
    }
    dot.title = phase.title;
    nav.appendChild(dot);

    // Connector between dots (not after the last one)
    if (idx < PHASES.length - 1) {
      const conn     = document.createElement('div');
      conn.className = 'phase-connector' + (isDone ? ' done' : '');
      nav.appendChild(conn);
    }
  });

  header.appendChild(nav);
})();