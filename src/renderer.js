(() => {
  'use strict';

  // ---------------------------------------------------------------
  // Flip digit primitive
  // ---------------------------------------------------------------

  class DigitCard {
    constructor(container, initial = '0') {
      this.value = initial;
      this.el = document.createElement('div');
      this.el.className = 'flip-unit';
      this.el.innerHTML = `
        <div class="card-half top"><div class="num-wrap"><span class="num"></span></div></div>
        <div class="card-half bottom"><div class="num-wrap"><span class="num"></span></div></div>
        <div class="seam"></div>
        <div class="hinge-shadow"></div>
        <div class="flap flap-top">
          <div class="flap-face flap-front"><div class="num-wrap"><span class="num"></span></div></div>
          <div class="flap-face flap-back"><div class="num-wrap"><span class="num"></span></div></div>
        </div>`;
      container.appendChild(this.el);
      this.topNum = this.el.querySelector('.card-half.top .num');
      this.bottomNum = this.el.querySelector('.card-half.bottom .num');
      this.frontNum = this.el.querySelector('.flap-front .num');
      this.backNum = this.el.querySelector('.flap-back .num');
      this.flap = this.el.querySelector('.flap-top');
      this._timeout = null;
      this.set(initial, true);
    }

    set(value, immediate = false) {
      value = String(value);
      if (immediate) {
        this.value = value;
        [this.topNum, this.bottomNum, this.frontNum, this.backNum].forEach((n) => {
          n.textContent = value;
        });
        return;
      }
      if (value === this.value) return;
      const old = this.value;
      this.frontNum.textContent = old;
      this.backNum.textContent = value;
      this.bottomNum.textContent = value;
      this.value = value;

      this.el.classList.remove('flipping');
      void this.flap.offsetWidth; // restart animation
      this.el.classList.add('flipping');

      clearTimeout(this._timeout);
      this._timeout = setTimeout(() => {
        this.el.classList.remove('flipping');
        this.topNum.textContent = value;
        this.frontNum.textContent = value;
      }, 460);
    }
  }

  const pad = (n, len = 2) => String(Math.max(0, Math.trunc(n))).padStart(len, '0');

  const display = document.getElementById('display');
  let cardMap = {};

  function buildDisplay(groups) {
    display.innerHTML = '';
    const map = {};
    groups.forEach((group, idx) => {
      const groupEl = document.createElement('div');
      groupEl.className = 'flip-group';

      const digitsEl = document.createElement('div');
      digitsEl.className = 'digits';
      const cards = [new DigitCard(digitsEl), new DigitCard(digitsEl)];

      const labelEl = document.createElement('div');
      labelEl.className = 'group-label';
      labelEl.textContent = group.label;

      groupEl.appendChild(digitsEl);
      groupEl.appendChild(labelEl);
      display.appendChild(groupEl);
      map[group.key] = cards;

      if (idx < groups.length - 1) {
        const colon = document.createElement('div');
        colon.className = 'colon';
        colon.innerHTML = '<span></span><span></span>';
        display.appendChild(colon);
      }
    });
    return map;
  }

  function setGroup(cards, twoDigitStr, instant = false) {
    cards[0].set(twoDigitStr[0], instant);
    cards[1].set(twoDigitStr[1], instant);
  }

  const GROUP_LAYOUTS = {
    clock: [{ key: 'h', label: 'HOURS' }, { key: 'm', label: 'MINUTES' }, { key: 's', label: 'SECONDS' }],
    timer: [{ key: 'h', label: 'HOURS' }, { key: 'm', label: 'MINUTES' }, { key: 's', label: 'SECONDS' }],
    pomodoro: [{ key: 'm', label: 'MINUTES' }, { key: 's', label: 'SECONDS' }],
    stopwatch: [{ key: 'm', label: 'MINUTES' }, { key: 's', label: 'SECONDS' }, { key: 'cs', label: 'CENTISEC' }]
  };

  // ---------------------------------------------------------------
  // Sound
  // ---------------------------------------------------------------

  function beep() {
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = 880;
      gain.gain.value = 0.0001;
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      gain.gain.exponentialRampToValueAtTime(0.2, ctx.currentTime + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.5);
      osc.stop(ctx.currentTime + 0.55);
      setTimeout(() => ctx.close(), 700);
    } catch (e) {
      /* audio unavailable, ignore */
    }
  }

  function chime() {
    beep();
    setTimeout(beep, 280);
  }

  // ---------------------------------------------------------------
  // Theme
  // ---------------------------------------------------------------

  const themeToggleBtn = document.getElementById('theme-toggle');

  function applyTheme(theme) {
    document.body.classList.toggle('theme-light', theme === 'light');
    document.body.classList.toggle('theme-dark', theme !== 'light');
    localStorage.setItem('flipclock-theme', theme);
  }

  applyTheme(localStorage.getItem('flipclock-theme') || 'dark');

  themeToggleBtn.addEventListener('click', () => {
    const isLight = document.body.classList.contains('theme-light');
    applyTheme(isLight ? 'dark' : 'light');
  });

  // ---------------------------------------------------------------
  // Mode switching
  // ---------------------------------------------------------------

  let currentMode = 'clock';
  const tabs = Array.from(document.querySelectorAll('.tab'));
  const panels = {
    pomodoro: document.getElementById('panel-pomodoro'),
    timer: document.getElementById('panel-timer'),
    stopwatch: document.getElementById('panel-stopwatch')
  };

  function switchMode(mode) {
    currentMode = mode;
    tabs.forEach((t) => t.classList.toggle('active', t.dataset.mode === mode));
    Object.entries(panels).forEach(([key, el]) => {
      el.hidden = key !== mode;
    });

    cardMap = buildDisplay(GROUP_LAYOUTS[mode]);

    if (mode === 'clock') renderClock();
    else if (mode === 'timer') renderTimer();
    else if (mode === 'pomodoro') { renderPomodoro(); updatePomodoroUI(); }
    else if (mode === 'stopwatch') renderStopwatch();
  }

  tabs.forEach((btn) => btn.addEventListener('click', () => switchMode(btn.dataset.mode)));

  // ---------------------------------------------------------------
  // Clock
  // ---------------------------------------------------------------

  function renderClock() {
    const d = new Date();
    setGroup(cardMap.h, pad(d.getHours()));
    setGroup(cardMap.m, pad(d.getMinutes()));
    setGroup(cardMap.s, pad(d.getSeconds()), true);
  }

  setInterval(() => {
    if (currentMode === 'clock') renderClock();
  }, 1000);

  // ---------------------------------------------------------------
  // Pomodoro
  // ---------------------------------------------------------------

  const pomo = {
    phase: 'focus', // focus | short | long
    remaining: 25 * 60,
    running: false,
    session: 1,
    totalSessions: 4,
    durations: { focus: 25 * 60, short: 5 * 60, long: 15 * 60 },
    interval: null
  };

  const pomoToggleBtn = document.getElementById('pomo-toggle');
  const pomoPhaseEl = document.getElementById('pomo-phase');
  const pomoSessionEl = document.getElementById('pomo-session');
  const pomoFocusInput = document.getElementById('pomo-focus');
  const pomoShortInput = document.getElementById('pomo-short');
  const pomoLongInput = document.getElementById('pomo-long');
  const pomoSessionsInput = document.getElementById('pomo-sessions');

  const PHASE_LABEL = { focus: 'FOCUS', short: 'SHORT BREAK', long: 'LONG BREAK' };

  function renderPomodoro() {
    setGroup(cardMap.m, pad(Math.floor(pomo.remaining / 60)));
    setGroup(cardMap.s, pad(pomo.remaining % 60), true);
  }

  function updatePomodoroUI() {
    pomoPhaseEl.textContent = PHASE_LABEL[pomo.phase];
    pomoSessionEl.textContent = `Session ${pomo.session} / ${pomo.totalSessions}`;
  }

  function pomoAdvancePhase() {
    if (pomo.phase === 'focus') {
      if (pomo.session >= pomo.totalSessions) {
        pomo.phase = 'long';
        pomo.remaining = pomo.durations.long;
        pomo.session = 1;
      } else {
        pomo.phase = 'short';
        pomo.remaining = pomo.durations.short;
      }
    } else {
      if (pomo.phase === 'short') pomo.session += 1;
      pomo.phase = 'focus';
      pomo.remaining = pomo.durations.focus;
    }
    if (currentMode === 'pomodoro') { renderPomodoro(); updatePomodoroUI(); }
  }

  function pomoTick() {
    pomo.remaining -= 1;
    if (currentMode === 'pomodoro') renderPomodoro();
    if (pomo.remaining <= 0) {
      chime();
      pomoAdvancePhase();
    }
  }

  function pomoStart() {
    if (pomo.running) return;
    pomo.running = true;
    pomoToggleBtn.textContent = 'Pause';
    pomo.interval = setInterval(pomoTick, 1000);
  }

  function pomoPause() {
    pomo.running = false;
    pomoToggleBtn.textContent = 'Start';
    clearInterval(pomo.interval);
  }

  pomoToggleBtn.addEventListener('click', () => (pomo.running ? pomoPause() : pomoStart()));

  document.getElementById('pomo-skip').addEventListener('click', () => pomoAdvancePhase());

  document.getElementById('pomo-reset').addEventListener('click', () => {
    pomoPause();
    pomo.phase = 'focus';
    pomo.session = 1;
    pomo.remaining = pomo.durations.focus;
    renderPomodoro();
    updatePomodoroUI();
  });

  function syncPomodoroDurations() {
    pomo.durations.focus = Math.max(1, Number(pomoFocusInput.value) || 25) * 60;
    pomo.durations.short = Math.max(1, Number(pomoShortInput.value) || 5) * 60;
    pomo.durations.long = Math.max(1, Number(pomoLongInput.value) || 15) * 60;
    pomo.totalSessions = Math.max(1, Number(pomoSessionsInput.value) || 4);
    if (!pomo.running) {
      pomo.remaining = pomo.durations[pomo.phase];
      renderPomodoro();
    }
    updatePomodoroUI();
  }

  [pomoFocusInput, pomoShortInput, pomoLongInput, pomoSessionsInput].forEach((el) =>
    el.addEventListener('change', syncPomodoroDurations)
  );

  // ---------------------------------------------------------------
  // Timer
  // ---------------------------------------------------------------

  const timer = { remaining: 5 * 60, running: false, interval: null };

  const timerToggleBtn = document.getElementById('timer-toggle');
  const timerHInput = document.getElementById('timer-h');
  const timerMInput = document.getElementById('timer-m');
  const timerSInput = document.getElementById('timer-s');

  function renderTimer() {
    const total = timer.remaining;
    setGroup(cardMap.h, pad(Math.floor(total / 3600)));
    setGroup(cardMap.m, pad(Math.floor((total % 3600) / 60)));
    setGroup(cardMap.s, pad(total % 60), true);
  }

  function timerFromInputs() {
    const h = Math.max(0, Number(timerHInput.value) || 0);
    const m = Math.max(0, Number(timerMInput.value) || 0);
    const s = Math.max(0, Number(timerSInput.value) || 0);
    return h * 3600 + m * 60 + s;
  }

  function timerTick() {
    timer.remaining -= 1;
    if (currentMode === 'timer') renderTimer();
    if (timer.remaining <= 0) {
      timer.remaining = 0;
      if (currentMode === 'timer') renderTimer();
      chime();
      timerPause();
    }
  }

  function timerStart() {
    if (timer.running) return;
    if (timer.remaining <= 0) timer.remaining = timerFromInputs();
    if (timer.remaining <= 0) return;
    timer.running = true;
    timerToggleBtn.textContent = 'Pause';
    timer.interval = setInterval(timerTick, 1000);
  }

  function timerPause() {
    timer.running = false;
    timerToggleBtn.textContent = 'Start';
    clearInterval(timer.interval);
  }

  timerToggleBtn.addEventListener('click', () => (timer.running ? timerPause() : timerStart()));

  document.getElementById('timer-reset').addEventListener('click', () => {
    timerPause();
    timer.remaining = timerFromInputs();
    renderTimer();
  });

  [timerHInput, timerMInput, timerSInput].forEach((el) =>
    el.addEventListener('change', () => {
      if (!timer.running) {
        timer.remaining = timerFromInputs();
        renderTimer();
      }
    })
  );

  timer.remaining = timerFromInputs();

  // ---------------------------------------------------------------
  // Stopwatch
  // ---------------------------------------------------------------

  const sw = { elapsedMs: 0, running: false, startedAt: 0, interval: null };

  const swToggleBtn = document.getElementById('sw-toggle');
  const swLapsEl = document.getElementById('sw-laps');

  function formatStopwatch(ms) {
    const cs = pad(Math.floor(ms / 10) % 100);
    const s = pad(Math.floor(ms / 1000) % 60);
    const m = pad(Math.floor(ms / 60000));
    return { m, s, cs };
  }

  function renderStopwatch() {
    const { m, s, cs } = formatStopwatch(sw.elapsedMs);
    setGroup(cardMap.m, m);
    setGroup(cardMap.s, s, true);
    setGroup(cardMap.cs, cs, true);
  }

  function swTick() {
    sw.elapsedMs = Date.now() - sw.startedAt;
    if (currentMode === 'stopwatch') renderStopwatch();
  }

  function swStart() {
    if (sw.running) return;
    sw.running = true;
    sw.startedAt = Date.now() - sw.elapsedMs;
    swToggleBtn.textContent = 'Pause';
    sw.interval = setInterval(swTick, 30);
  }

  function swPause() {
    sw.running = false;
    swToggleBtn.textContent = 'Start';
    clearInterval(sw.interval);
  }

  swToggleBtn.addEventListener('click', () => (sw.running ? swPause() : swStart()));

  document.getElementById('sw-reset').addEventListener('click', () => {
    swPause();
    sw.elapsedMs = 0;
    renderStopwatch();
    swLapsEl.innerHTML = '';
  });

  document.getElementById('sw-lap').addEventListener('click', () => {
    const { m, s, cs } = formatStopwatch(sw.elapsedMs);
    const li = document.createElement('li');
    const lapNumber = swLapsEl.children.length + 1;
    li.innerHTML = `<span>Lap ${lapNumber}</span><span>${m}:${s}.${cs}</span>`;
    swLapsEl.insertBefore(li, swLapsEl.firstChild);
  });

  // ---------------------------------------------------------------
  // Init
  // ---------------------------------------------------------------

  switchMode('clock');
})();
