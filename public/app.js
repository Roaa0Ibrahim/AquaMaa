'use strict';
(function () {
  /* ================= helpers ================= */
  const $ = (s, r = document) => r.querySelector(s);
  const esc = (v) => String(v == null ? '' : v).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const store = {
    get(k) { try { return localStorage.getItem(k); } catch { return null; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch { /* ignore */ } },
  };

  async function api(path, opts) {
    const res = await fetch(path, { credentials: 'same-origin', headers: { 'content-type': 'application/json' }, ...opts });
    let body = null;
    try { body = await res.json(); } catch { /* no body */ }
    if (res.status === 401 && !path.startsWith('/api/auth/login')) { showLogin(); throw new Error('unauthenticated'); }
    if (!res.ok) throw new Error((body && body.error) || `Request failed (${res.status})`);
    return body;
  }

  /* ================= i18n (shell + dashboard labels) ================= */
  const AR = {
    'Dashboard': 'لوحة المعلومات', 'Groundwater Map': 'خريطة المياه الجوفية', 'Wells & Monitoring': 'الآبار والمراقبة',
    'Water Quality': 'جودة المياه', 'Water Extraction': 'استخراج المياه', 'Aquifer Assessment': 'تقييم الخزان الجوفي',
    'Risk Assessment': 'تقييم المخاطر', 'Hydrological Resilience': 'المرونة الهيدرولوجية', 'Alternative Water Sources': 'مصادر المياه البديلة',
    'Predictive Analysis': 'التحليل التنبؤي', 'Research & Statistics': 'الأبحاث والإحصاءات', 'Sustainability Goals': 'أهداف الاستدامة',
    'Reports': 'التقارير', 'Notifications': 'الإشعارات', 'Settings': 'الإعدادات',
    'OVERVIEW': 'نظرة عامة', 'MONITORING & MEASUREMENT': 'المراقبة والقياس', 'ANALYSIS & INTELLIGENCE': 'التحليل والذكاء',
    'INSTITUTION & KNOWLEDGE': 'المؤسسة والمعرفة', 'Overview': 'نظرة عامة',
    'Groundwater Intelligence Summary': 'ملخص المعلومات عن المياه الجوفية',
    'Real-time insights, trends, and resource status for the State of Qatar': 'رؤى واتجاهات وحالة الموارد لدولة قطر',
    'AT A GLANCE': 'لمحة سريعة', 'Total extraction': 'إجمالي الاستخراج', 'Estimated safe yield': 'العائد الآمن المقدّر',
    'Registered wells': 'الآبار المسجلة', 'Monitoring stations': 'محطات المراقبة', 'Water quality': 'جودة المياه', 'Data availability': 'توفر البيانات',
    'RESOURCE BALANCE': 'توازن الموارد', 'GEOGRAPHIC INTELLIGENCE': 'الذكاء الجغرافي', 'HISTORICAL SIGNAL': 'الإشارة التاريخية', 'USE PROFILE': 'نمط الاستخدام',
    'Extraction vs. estimated safe yield': 'الاستخراج مقابل العائد الآمن المقدّر', 'Monitoring coverage': 'تغطية المراقبة',
    'Annual extraction trend': 'اتجاه الاستخراج السنوي', 'Extraction by sector': 'الاستخراج حسب القطاع',
    'Agriculture': 'الزراعة', 'Municipal': 'البلدية', 'Industrial': 'الصناعة', 'Wells': 'الآبار', 'Stations': 'المحطات', 'Data gaps': 'فجوات البيانات',
    'Sign out': 'تسجيل الخروج', 'Search platform…': 'ابحث في المنصة…', 'Database live': 'قاعدة البيانات متصلة',
    'Demonstration mode': 'وضع العرض التجريبي', 'Open map': 'افتح الخريطة',
  };
  let lang = store.get('aq_lang') === 'ar' ? 'ar' : 'en';
  const t = (s) => (lang === 'ar' && AR[s]) || s;
  function applyLang() {
    document.documentElement.lang = lang;
    document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';
  }

  /* ================= icons ================= */
  const P = {
    grid: '<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>',
    pin: '<path d="M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 1 1 16 0Z"/><circle cx="12" cy="10" r="3"/>',
    radio: '<circle cx="12" cy="12" r="2"/><path d="M16.2 7.8a6 6 0 0 1 0 8.4M7.8 16.2a6 6 0 0 1 0-8.4M19 5a10 10 0 0 1 0 14M5 19a10 10 0 0 1 0-14"/>',
    drop: '<path d="M12 2.7s7 7.3 7 12.3a7 7 0 0 1-14 0c0-5 7-12.3 7-12.3Z"/>',
    waves: '<path d="M2 7c2.5-2 4.5-2 7 0s4.5 2 7 0 4.5-2 6 0M2 13c2.5-2 4.5-2 7 0s4.5 2 7 0 4.5-2 6 0M2 19c2.5-2 4.5-2 7 0s4.5 2 7 0 4.5-2 6 0"/>',
    layers: '<path d="M12 2 2 7l10 5 10-5-10-5Z"/><path d="m2 17 10 5 10-5M2 12l10 5 10-5"/>',
    alert: '<path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z"/><path d="M12 9v4M12 17h.01"/>',
    leaf: '<path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.5 19 2c1 2 2 4.2 2 8 0 5.5-4.8 10-10 10Z"/><path d="M2 21c0-3 1.9-5.5 6-7"/>',
    nodes: '<circle cx="6" cy="6" r="2"/><circle cx="18" cy="8" r="2"/><circle cx="8" cy="18" r="2"/><circle cx="18" cy="18" r="2"/><path d="m8 7 8 1M7 8l1 8M10 17l6 1M17 10v6"/>',
    book: '<path d="M2 4h7a3 3 0 0 1 3 3v14a2 2 0 0 0-2-2H2zM22 4h-7a3 3 0 0 0-3 3v14a2 2 0 0 1 2-2h8z"/>',
    file: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6M9 13h6M9 17h6"/>',
    bell: '<path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9M13.7 21a2 2 0 0 1-3.4 0"/>',
    sliders: '<path d="M4 6h8M18 6h2M4 12h2M12 12h8M4 18h10M20 18h0"/><circle cx="15" cy="6" r="2"/><circle cx="9" cy="12" r="2"/><circle cx="17" cy="18" r="2"/>',
    search: '<circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/>',
    cal: '<rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>',
    chevs: '<path d="m11 17-5-5 5-5M18 17l-5-5 5-5"/>',
    pulse: '<path d="M22 12h-4l-3 9L9 3l-3 9H2"/>',
    shield: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z"/><path d="m9 12 2 2 4-4"/>',
    check: '<circle cx="12" cy="12" r="10"/><path d="m9 12 2 2 4-4"/>',
    refresh: '<path d="M21 12a9 9 0 1 1-3-6.7L21 8M21 3v5h-5"/>',
    ext: '<path d="M7 17 17 7M7 7h10v10"/>',
    logout: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"/>',
    info: '<circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/>',
    bld: '<rect x="4" y="2" width="16" height="20" rx="2"/><path d="M9 22v-4h6v4M8 6h.01M12 6h.01M16 6h.01M8 10h.01M12 10h.01M16 10h.01M8 14h.01M12 14h.01M16 14h.01"/>',
    fac: '<path d="M2 20h20V9l-6 4V9l-6 4V4H6v16"/>',
    dots: '<circle cx="5" cy="12" r="1.4"/><circle cx="12" cy="12" r="1.4"/><circle cx="19" cy="12" r="1.4"/>',
    chevd: '<path d="m6 9 6 6 6-6"/>',
    up: '<path d="m5 14 7-7 7 7"/>',
    down: '<path d="m5 10 7 7 7-7"/>',
    gauge: '<path d="M4 17a8 8 0 1 1 16 0"/><path d="m12 17 4-5"/>',
    bars: '<path d="M5 20V11M10 20V6M15 20v-7M20 20V9"/>',
    cog: '<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M4.9 19.1 7 17M17 7l2.1-2.1"/>',
    dl: '<path d="M12 3v12m0 0-4-4m4 4 4-4M4 21h16"/>',
  };
  const icon = (n) => `<svg class="i" viewBox="0 0 24 24" aria-hidden="true">${P[n] || ''}</svg>`;
  const logo = `<svg class="logo" viewBox="0 0 48 48" aria-hidden="true"><path d="M24 4s14 14.6 14 24.6A14 14 0 0 1 10 28.6C10 18.6 24 4 24 4Z" fill="none" stroke="currentColor" stroke-width="3" stroke-linejoin="round"/><path d="M15 30c3-2.5 6-2.5 9 0s6 2.5 9 0" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"/></svg>`;

  /* ================= navigation ================= */
  const NAV = [
    ['OVERVIEW', [['dashboard', 'Dashboard', 'grid'], ['map', 'Groundwater Map', 'pin']]],
    ['MONITORING & MEASUREMENT', [['wells', 'Wells & Monitoring', 'radio'], ['quality', 'Water Quality', 'drop'], ['extraction', 'Water Extraction', 'waves']]],
    ['ANALYSIS & INTELLIGENCE', [['aquifer', 'Aquifer Assessment', 'layers'], ['risk', 'Risk Assessment', 'alert'], ['resilience', 'Hydrological Resilience', 'leaf'],
      ['alternatives', 'Alternative Water Sources', 'leaf'], ['predictive', 'Predictive Analysis', 'nodes']]],
    ['INSTITUTION & KNOWLEDGE', [['research', 'Research & Statistics', 'book'], ['sustainability', 'Sustainability Goals', 'leaf'], ['reports', 'Reports', 'file'],
      ['notifications', 'Notifications', 'bell'], ['settings', 'Settings', 'sliders']]],
  ];
  const PAGE_INFO = {};
  NAV.forEach(([sec, items]) => items.forEach(([id, label]) => { PAGE_INFO[id] = { label, section: sec === 'OVERVIEW' ? 'Overview' : sec }; }));

  /* ================= state ================= */
  const state = { user: null, year: 2022, unread: 0, dash: null, live: true, maps: [] };

  /* ================= login ================= */
  async function showLogin() {
    state.user = null;
    $('#app').hidden = true;
    const el = $('#login');
    el.hidden = false;
    let accounts = [];
    try { accounts = (await (await fetch('/api/auth/demo-accounts')).json()).accounts || []; } catch { /* ignore */ }
    el.innerHTML = `
      <form class="login-card" id="login-form" autocomplete="on">
        <div class="brand" style="color:var(--navy)">${logo}<div><b>AquaMaa</b><span>Groundwater Intelligence</span></div></div>
        <h1>Sign in</h1>
        <p>Turning groundwater data into smarter decisions for Qatar's water future.</p>
        <label class="field">Email<input id="lg-email" type="email" required autocomplete="username"></label>
        <label class="field">Password<input id="lg-pass" type="password" required autocomplete="current-password"></label>
        <div class="err" id="lg-err" role="alert"></div>
        <button class="btn block" type="submit">Sign in</button>
        ${accounts.length ? `<div class="demo-list"><small>Demonstration accounts (click to fill email):</small>
          ${accounts.map((a) => `<button type="button" class="chip" data-email="${esc(a.email)}" title="${esc(a.institution)}">${esc(a.institution.split(' ').slice(0, 3).join(' '))} · ${esc(a.title)}</button>`).join('')}</div>` : ''}
      </form>`;
    el.querySelectorAll('.chip').forEach((c) => c.addEventListener('click', () => { $('#lg-email').value = c.dataset.email; $('#lg-pass').focus(); }));
    $('#login-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      $('#lg-err').textContent = '';
      try {
        const r = await api('/api/auth/login', { method: 'POST', body: JSON.stringify({ email: $('#lg-email').value, password: $('#lg-pass').value }) });
        state.user = r.user;
        el.hidden = true;
        boot();
      } catch (err) { $('#lg-err').textContent = err.message; }
    });
  }

  /* ================= shell ================= */
  function initials(name) { return name.split(/\s+/).filter((w) => /^[A-Za-z]/.test(w)).map((w) => w[0]).slice(0, 2).join('').toUpperCase(); }

  function toggleMenu(anchor) {
    const old = $('.umenu');
    if (old) { old.remove(); return; }
    const u = state.user;
    const m = document.createElement('div');
    m.className = 'umenu';
    m.innerHTML = `<div><b style="color:var(--navy)">${esc(u.name)}</b><br>${esc(u.institution)}</div><button id="um-out">${icon('logout')} ${esc(t('Sign out'))}</button>`;
    document.body.appendChild(m);
    const r = anchor.getBoundingClientRect();
    const w = m.offsetWidth, h = m.offsetHeight;
    let left = lang === 'ar' ? r.left : r.right - w;
    left = Math.max(8, Math.min(left, window.innerWidth - w - 8));
    let top = r.bottom + 8;
    if (top + h > window.innerHeight - 8) top = Math.max(8, r.top - h - 8);
    m.style.left = `${left}px`; m.style.top = `${top}px`;
    $('#um-out', m).addEventListener('click', async () => { m.remove(); await api('/api/auth/logout', { method: 'POST' }); location.hash = ''; showLogin(); });
    const close = (e) => { if (!m.contains(e.target) && !anchor.contains(e.target)) { m.remove(); document.removeEventListener('mousedown', close); } };
    setTimeout(() => document.addEventListener('mousedown', close), 0);
    document.addEventListener('keydown', function esc1(e) { if (e.key === 'Escape') { m.remove(); document.removeEventListener('keydown', esc1); } });
  }

  function buildShell() {
    const app = $('#app');
    app.hidden = false;
    app.className = store.get('aq_collapsed') === '1' || window.innerWidth < 1000 ? 'collapsed' : '';
    const u = state.user;
    app.innerHTML = `
      <aside class="sidebar" aria-label="Main navigation">
        <div class="brand">${logo}<div><b>AquaMaa</b><span>Groundwater Intelligence</span></div>
          <button class="collapse-btn" id="collapse" aria-label="Collapse sidebar">${icon('chevs')}</button></div>
        <nav class="nav" id="nav">
          ${NAV.map(([sec, items]) => `<div class="nav-label">${esc(t(sec))}</div>` + items.map(([id, label, ic]) =>
            `<a href="#/${id}" data-page="${id}" title="${esc(t(label))}">${icon(ic)}<span class="t">${esc(t(label))}</span>${id === 'notifications' ? '<span class="badge" id="nav-badge" hidden></span>' : ''}</a>`).join('')).join('')}
        </nav>
        <div class="side-foot">
          <div class="demo-flag" id="demo-flag" hidden><i></i><span>${esc(t('Demonstration mode'))}</span></div>
          <div class="user"><div class="avatar">${esc(initials(u.name))}</div>
            <div class="u-meta"><div class="u-name">${esc(u.name)}</div><div class="u-role">${esc(u.title)}</div></div>
            <button id="usermenu" aria-label="Account menu">${icon('dots')}</button></div>
        </div>
      </aside>
      <div class="main">
        <div class="hero-art" id="hero-art" aria-hidden="true"></div>
        <header class="topbar">
          <div class="crumbs" id="crumbs"></div>
          <div class="top-actions">
            <label class="search">${icon('search')}<input id="gsearch" placeholder="${esc(t('Search platform…'))}" aria-label="Search platform"></label>
            <label class="select-pill">${icon('cal')}<select id="year" aria-label="Reporting year"></select></label>
            <div class="live" id="live"><i></i><span>${esc(t('Database live'))}</span></div>
            <button class="lang" id="lang">${lang === 'ar' ? 'English' : 'عربي'}</button>
            <a class="bell" href="#/notifications" aria-label="Notifications">${icon('bell')}<em id="bell-dot" hidden></em></a>
            <button class="me-btn" id="me" aria-label="Account menu"><div class="avatar">${esc(initials(u.name))}</div>${icon('chevd')}</button>
          </div>
        </header>
        <main class="content" id="view"></main>
        <footer class="statusbar" id="statusbar"></footer>
      </div>`;

    const sel = $('#year');
    for (let y = 2022; y >= 1998; y--) sel.insertAdjacentHTML('beforeend', `<option value="${y}">${y}</option>`);
    sel.value = String(state.year);
    sel.addEventListener('change', () => { state.year = Number(sel.value); route(); });
    $('#collapse').addEventListener('click', () => {
      app.classList.toggle('collapsed');
      store.set('aq_collapsed', app.classList.contains('collapsed') ? '1' : '0');
      setTimeout(() => state.maps.forEach((m) => m.invalidateSize()), 300);
    });
    $('#usermenu').addEventListener('click', (e) => toggleMenu(e.currentTarget));
    $('#me').addEventListener('click', (e) => toggleMenu(e.currentTarget));
    $('#lang').addEventListener('click', () => { lang = lang === 'ar' ? 'en' : 'ar'; store.set('aq_lang', lang); applyLang(); buildShell(); route(); refreshBadge(); });
    $('#gsearch').addEventListener('keydown', (e) => {
      if (e.key !== 'Enter') return;
      const q = e.target.value.trim().toLowerCase();
      const hit = Object.entries(PAGE_INFO).find(([, v]) => v.label.toLowerCase().includes(q));
      if (hit) location.hash = `#/${hit[0]}`; else if (q) { location.hash = '#/wells'; store.set('aq_q', q); route(); }
    });
  }

  async function refreshBadge() {
    try {
      const r = await api('/api/notifications');
      state.unread = r.unread;
      const b = $('#nav-badge'); const d = $('#bell-dot');
      if (b) { b.textContent = r.unread; b.hidden = !r.unread; }
      if (d) d.hidden = !r.unread;
    } catch { /* ignore */ }
  }

  /* ================= charts ================= */
  function sparkline(values, w = 112, h = 42) {
    if (!values || values.length < 2) return '';
    const min = Math.min(...values), max = Math.max(...values);
    const pts = values.map((v, i) => [(i / (values.length - 1)) * (w - 4) + 2, h - 5 - ((v - min) / (max - min || 1)) * (h - 14)]);
    const line = pts.map((p, i) => `${i ? 'L' : 'M'}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' ');
    return `<svg class="spark" viewBox="0 0 ${w} ${h}" aria-hidden="true"><defs><linearGradient id="spg" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="#12bfb7" stop-opacity=".3"/><stop offset="1" stop-color="#12bfb7" stop-opacity="0"/></linearGradient></defs>
      <path class="line-area" d="${line} L${w - 2},${h} L2,${h} Z" fill="url(#spg)"/><path class="line-path" pathLength="1" d="${line}" fill="none" stroke="#12bfb7" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
  }

  function ring({ frac, color, track = '#e8eff3', size = 78, stroke = 9, center }) {
    const r = (size - stroke) / 2, c = 2 * Math.PI * r, f = Math.max(0, Math.min(1, frac || 0));
    return `<svg class="ring" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" role="img">
      <circle cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke="${track}" stroke-width="${stroke}"/>
      <circle class="arc" cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke="${color}" stroke-width="${stroke}" stroke-linecap="round"
        style="stroke-dasharray:0 ${c.toFixed(1)}" data-d="${(c * f).toFixed(1)} ${c.toFixed(1)}" transform="rotate(-90 ${size / 2} ${size / 2})"/>${center || ''}</svg>`;
  }

  function donut(items, centerTop, centerBottom) {
    const size = 142, stroke = 22, r = (size - stroke) / 2, c = 2 * Math.PI * r;
    const total = items.reduce((s, i) => s + i.value, 0) || 1;
    let offset = 0;
    const arcs = items.map((i) => {
      const len = (i.value / total) * c;
      const el = `<circle class="seg" cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke="${i.color}" stroke-width="${stroke}"
        style="stroke-dasharray:0 ${c.toFixed(1)}" data-d="${Math.max(0, len - 3).toFixed(1)} ${c.toFixed(1)}" stroke-dashoffset="${(-offset).toFixed(1)}" transform="rotate(-90 ${size / 2} ${size / 2})"><title>${esc(i.label)}: ${i.value}</title></circle>`;
      offset += len; return el;
    }).join('');
    return `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" role="img" aria-label="Extraction by sector">${arcs}
      <text x="50%" y="49%" text-anchor="middle" font-size="24" font-weight="700" fill="#0b2a4a">${esc(centerTop)}</text>
      <text x="50%" y="64%" text-anchor="middle" font-size="12.5" fill="#5d7589">${esc(centerBottom)}</text></svg>`;
  }

  // Run the entrance animations for everything inside `root` (draw lines, fill rings, count numbers).
  function animateIn(root) {
    root.querySelectorAll('[data-count]').forEach((el) => { el.textContent = fmt(0, Number(el.dataset.dec || 0)); });
    requestAnimationFrame(() => requestAnimationFrame(() => {
      root.querySelectorAll('[data-d]').forEach((el) => { el.style.strokeDasharray = el.dataset.d; });
      root.querySelectorAll('.line-path').forEach((el) => { el.style.strokeDashoffset = '0'; });
      root.querySelectorAll('.line-area').forEach((el) => { el.style.opacity = '1'; });
      root.querySelectorAll('[data-pos]').forEach((el) => { el.style.insetInlineStart = el.dataset.pos; });
      root.querySelectorAll('[data-count]').forEach((el) => {
        const target = Number(el.dataset.count), dec = Number(el.dataset.dec || 0), t0 = performance.now(), dur = 900;
        const step = (now) => {
          const k = Math.min(1, (now - t0) / dur), e = 1 - Math.pow(1 - k, 3);
          el.textContent = fmt(target * e, dec);
          if (k < 1) requestAnimationFrame(step);
        };
        requestAnimationFrame(step);
      });
    }));
  }

  function lineChart(host, data, { unit = 'MCM' } = {}) {
    const W = Math.max(host.clientWidth, 320), H = 176, L = 40, R = 16, T = 16, B = 26;
    const max = Math.max(...data.map((d) => d.v));
    const yMax = Math.ceil(max / 100) * 100 || 100;
    const x = (i) => L + (i / (data.length - 1 || 1)) * (W - L - R);
    const y = (v) => T + (1 - v / yMax) * (H - T - B);
    const pts = data.map((d, i) => [x(i), y(d.v)]);
    const path = pts.map((p, i) => `${i ? 'L' : 'M'}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' ');
    const ticks = []; for (let v = 0; v <= yMax; v += 100) ticks.push(v);
    const step = data.length > 12 ? 6 : 2;
    const labeled = data.map((d, i) => i).filter((i) => i % step === 0 || i === data.length - 1);
    const xl = labeled.map((i) => `<line x1="${x(i)}" x2="${x(i)}" y1="${T}" y2="${y(0)}" stroke="#d5e6ee" stroke-dasharray="2 4"/><text x="${x(i)}" y="${H - 6}" text-anchor="middle" font-size="11.5" fill="#5d7589">${data[i].label}</text>`).join('');
    host.innerHTML = `<svg viewBox="0 0 ${W} ${H}" width="100%" height="${H}" role="img" aria-label="Annual extraction trend">
      <defs><linearGradient id="lcg" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="#12bfb7" stop-opacity=".42"/><stop offset="1" stop-color="#12bfb7" stop-opacity=".02"/></linearGradient></defs>
      ${ticks.map((v) => `<line x1="${L}" x2="${W - R}" y1="${y(v)}" y2="${y(v)}" stroke="#e3eef2"/><text x="${L - 9}" y="${y(v) + 4}" text-anchor="end" font-size="11.5" fill="#5d7589">${v}</text>`).join('')}
      ${xl}
      <path class="line-area" d="${path} L${pts[pts.length - 1][0]},${y(0)} L${pts[0][0]},${y(0)} Z" fill="url(#lcg)"/>
      <path class="line-path" pathLength="1" d="${path}" fill="none" stroke="#0ea5a0" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round"/>
      <line id="lc-v" y1="${T}" y2="${y(0)}" stroke="#0ea5a0" stroke-dasharray="3 3" opacity="0"/>
      <circle id="lc-d" r="5" fill="#fff" stroke="#0ea5a0" stroke-width="2.5" style="opacity:0;transition:opacity .4s"/></svg><div class="tip" id="lc-t" style="opacity:0"></div>`;
    const svg = host.firstElementChild;
    const dot = $('#lc-d', host), vl = $('#lc-v', host), tip = $('#lc-t', host);
    const show = (i, hover) => {
      const p = pts[i];
      dot.setAttribute('cx', p[0]); dot.setAttribute('cy', p[1]);
      vl.setAttribute('x1', p[0]); vl.setAttribute('x2', p[0]); vl.setAttribute('opacity', hover ? '.6' : '0');
      tip.textContent = `${data[i].label}: ${fmt(data[i].v, 1).replace(/\.0$/, '')} ${unit}`;
      const sw = svg.getBoundingClientRect().width, tw = tip.offsetWidth;
      const px = (p[0] / W) * sw, left = Math.min(Math.max(px, tw / 2), sw - tw / 2);
      tip.style.left = `${left}px`; tip.style.top = `${p[1] - 12}px`; tip.style.transform = 'translate(-50%, -100%)';
      tip.style.setProperty('--ax', `${px - left + tw / 2}px`);
    };
    show(data.length - 1, false);
    setTimeout(() => { dot.style.opacity = '1'; tip.style.transition = 'opacity .4s, left .12s ease-out, top .12s ease-out'; tip.style.opacity = '1'; }, 1000);
    svg.addEventListener('mousemove', (e) => {
      const rect = svg.getBoundingClientRect();
      const px = ((e.clientX - rect.left) / rect.width) * W;
      let best = 0, bd = Infinity;
      pts.forEach((p, i) => { const d = Math.abs(p[0] - px); if (d < bd) { bd = d; best = i; } });
      show(best, true);
    });
    svg.addEventListener('mouseleave', () => show(data.length - 1, false));
    animateIn(host);
  }

  function stackedBars(host, series) {
    const W = Math.max(host.clientWidth, 360), H = 300, L = 44, R = 12, T = 12, B = 32;
    const max = Math.max(...series.map((s) => s.total));
    const yMax = Math.ceil(max / 50) * 50;
    const bw = (W - L - R) / series.length;
    const y = (v) => T + (1 - v / yMax) * (H - T - B);
    let out = '';
    for (let v = 0; v <= yMax; v += 50) out += `<line x1="${L}" x2="${W - R}" y1="${y(v)}" y2="${y(v)}" stroke="#e3eef2"/><text x="${L - 6}" y="${y(v) + 4}" text-anchor="end" font-size="11" fill="#5b7488">${v}</text>`;
    series.forEach((s, i) => {
      let acc = 0;
      [['agriculture', '#12b5a6'], ['municipal', '#2f80ed'], ['industrial', '#f6b93b']].forEach(([k, c]) => {
        const h = y(acc) - y(acc + s[k]);
        out += `<rect x="${L + i * bw + 2}" y="${y(acc + s[k])}" width="${Math.max(bw - 4, 2)}" height="${h}" fill="${c}"><title>${s.year} ${k}: ${s[k]} MCM</title></rect>`;
        acc += s[k];
      });
      if (i % 4 === 0 || i === series.length - 1) out += `<text x="${L + i * bw + bw / 2}" y="${H - 10}" text-anchor="middle" font-size="11" fill="#5b7488">${s.year}</text>`;
    });
    host.innerHTML = `<svg viewBox="0 0 ${W} ${H}" width="100%" height="${H}" role="img" aria-label="Extraction by sector and year">${out}</svg>`;
  }

  /* ================= maps ================= */
  function makeMap(el, { wells, stations }, { popups = true, layerControl = false } = {}) {
    if (!window.L) { el.innerHTML = '<div class="map-fallback">The map library could not be loaded (network access to the map CDN is required).</div>'; return null; }
    const map = L.map(el, { zoomControl: popups, attributionControl: true, scrollWheelZoom: popups }).setView([25.32, 51.2], 8);
    const sat = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', { attribution: 'Tiles © Esri', maxZoom: 17 });
    const osm = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: '© OpenStreetMap contributors', maxZoom: 18 });
    (layerControl ? osm : sat).addTo(map);
    if (layerControl) L.control.layers({ Street: osm, Satellite: sat }).addTo(map);
    map.fitBounds([[24.45, 50.7], [26.2, 51.7]]);
    const layers = { wells: L.layerGroup().addTo(map), stations: L.layerGroup().addTo(map), gaps: L.layerGroup().addTo(map) };
    wells.forEach((w) => {
      const gap = w.data_gap;
      const m = L.circleMarker([w.lat, w.lon], { radius: 6, color: '#fff', weight: 1.5, fillColor: gap ? '#94a3b8' : '#12bfb7', fillOpacity: 1 });
      if (popups) m.bindPopup(`<b>${esc(w.name)}</b> (${esc(w.code)})<br>Aquifer: ${esc(w.aquifer)}<br>Depth: ${w.depth_m} m<br>TDS: ${w.tds_mgl == null ? 'no data' : w.tds_mgl + ' mg/L'}<br>Status: ${esc(w.data_status)} data`);
      (gap ? layers.gaps : layers.wells).addLayer(m);
    });
    stations.forEach((s) => {
      const m = L.circleMarker([s.lat, s.lon], { radius: 8, color: '#fff', weight: 2, fillColor: s.status === 'active' ? '#f6b93b' : '#ef4444', fillOpacity: 1 });
      if (popups) m.bindPopup(`<b>${esc(s.name)}</b> (${esc(s.code)})<br>Status: ${esc(s.status)}<br>Readings in 2022: ${s.readings_2022}/12<br>Data: ${esc(s.data_status)}`);
      layers.stations.addLayer(m);
    });
    map._layers_ = layers;
    state.maps.push(map);
    return map;
  }
  function disposeMaps() { state.maps.forEach((m) => { try { m.remove(); } catch { /* ignore */ } }); state.maps = []; }

  /* ================= format ================= */
  const fmt = (n, d = 0) => (n == null ? '—' : Number(n).toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d }));
  const statusTag = (st) => {
    const [cls, ic] = { verified: ['green', 'check'], official: ['green', 'check'], measured: ['green', 'check'], estimated: ['amber', 'info'], preliminary: ['amber', 'info'], modelled: ['amber', 'info'], demonstration: ['amber', 'alert'] }[st] || ['grey', null];
    return `<span class="tag ${cls}">${ic ? icon(ic) : '<i></i>'}${esc(st ? st[0].toUpperCase() + st.slice(1) : 'Unavailable')}</span>`;
  };
  const stamp = (iso) => {
    if (!iso) return '—';
    const d = new Date(iso);
    const p = new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Asia/Qatar' }).formatToParts(d)
      .reduce((a, x) => ({ ...a, [x.type]: x.value }), {});
    return `${p.day} ${p.month} ${p.year}, ${p.hour}:${p.minute} AST`;
  };

  /* ================= pages ================= */
  /* ---- schematic coverage map: land silhouette cut from the design, markers placed from real lat/lon ---- */
  let maskCache = null;
  async function loadMask() {
    if (!maskCache) { try { maskCache = await (await fetch('/assets/qatar-mask.json')).json(); } catch { maskCache = { w: 1, h: 1, rows: ['1'] }; } }
    return maskCache;
  }
  function snapToLand(mask, lat, lon) {
    const u = Math.min(1, Math.max(0, (lon - 50.75) / 0.9)), v = Math.min(1, Math.max(0, (26.18 - lat) / 1.71));
    const { w, h } = mask;
    const c = Math.min(w - 1, Math.floor(u * w)), r = Math.min(h - 1, Math.floor(v * h));
    const land = (rr, cc) => rr >= 0 && rr < h && cc >= 0 && cc < w && mask.rows[rr][cc] === '1';
    if (land(r, c)) return [u * 100, v * 100];
    let found = null;
    for (let d = 1; d < Math.max(w, h) && !found; d++) {
      let best = Infinity;
      for (let dr = -d; dr <= d; dr++) for (let dc = -d; dc <= d; dc++) {
        if (Math.max(Math.abs(dr), Math.abs(dc)) !== d || !land(r + dr, c + dc)) continue;
        const dist = dr * dr + dc * dc;
        if (dist < best) { best = dist; found = [r + dr, c + dc]; }
      }
    }
    return found ? [((found[1] + 0.5) / w) * 100, ((found[0] + 0.5) / h) * 100] : [u * 100, v * 100];
  }
  async function drawCoverage(landEl, wells, stations) {
    const mask = await loadMask();
    const mk = (cls, color, lat, lon, title, i) => {
      const [x, y] = snapToLand(mask, lat, lon);
      return `<span class="pt ${cls}" style="left:${x.toFixed(1)}%;top:${y.toFixed(1)}%;background:${color};--d:${400 + i * 22}ms" title="${esc(title)}"></span>`;
    };
    landEl.insertAdjacentHTML('beforeend',
      wells.map((w, i) => mk('', w.data_gap ? '#94a3b8' : '#12bfb7', w.lat, w.lon, `${w.name} (${w.code})`, i)).join('') +
      stations.map((s, i) => mk('st', s.status === 'active' ? '#f6b93b' : '#ef4444', s.lat, s.lon, `${s.name} (${s.code}) – ${s.status}`, wells.length + i)).join(''));
  }

  async function pageDashboard(view) {
    view.innerHTML = '<div class="skeleton">Loading…</div>';
    const d = await api(`/api/dashboard?year=${state.year}`);
    state.dash = d;
    const ex = d.extraction, sy = d.safe_yield;
    const flag = $('#demo-flag'); if (flag) flag.hidden = d.mode !== 'demonstration';
    const covTag = d.stations.coverage_pct == null ? 'No readings' : `Coverage ${d.stations.coverage_pct}%`;
    const sec = d.sectors;
    const colors = { agriculture: '#12b5a6', municipal: '#2f80ed', industrial: '#f6b93b' };
    const secIcon = { agriculture: ['leaf', '#16a34a'], municipal: ['bld', '#2f80ed'], industrial: ['fac', '#f59e0b'] };
    const secLabel = { agriculture: 'Agriculture', municipal: 'Municipal', industrial: 'Industrial' };
    const ratio = d.ratio;
    const markerPct = ex && sy ? Math.min(100, (sy.value / Math.max(ex.value, sy.value)) * 100) : 0;
    const infoTip = (txt) => `<span class="info" title="${esc(txt)}">i</span>`;
    const tag = (txt, cls, ic) => `<span class="tag ${cls}">${ic ? icon(ic) : '<i></i>'}${esc(txt)}</span>`;
    const num = (v, dec = 0) => `<span data-count="${v == null ? 0 : v}" data-dec="${dec}">${fmt(v, dec)}</span>`;
    let n = 0; const dl = () => `style="--d:${60 * n++}ms"`;

    view.innerHTML = `
      <section class="hero rise" style="--d:0ms"><h1>${esc(t('Groundwater Intelligence Summary'))}</h1>
        <p>${esc(t('Real-time insights, trends, and resource status for the State of Qatar'))}</p></section>
      <div class="section-label rise" style="--d:60ms">${esc(t('AT A GLANCE'))} ${infoTip('Each figure shows its unit, period and data status.')}</div>
      <div class="glance">
        <article class="card kpi k1 rise" ${dl()}><div class="k-head"><span class="k-ico">${icon('waves')}</span>${esc(t('Total extraction'))}</div>
          <div class="k-body"><div><div class="big">${num(ex && ex.value)}</div><div class="unit">MCM / year</div></div>
            <div class="k-right">${ex ? sparkline(ex.spark) : ''}${ex && ex.yoy_pct != null ? tag(`${ex.yoy_pct > 0 ? '+' : ''}${ex.yoy_pct}%`, ex.yoy_pct > 0 ? 'amber' : 'green', ex.yoy_pct > 0 ? 'up' : 'down') : ''}</div></div>
          <div class="k-foot">${ex ? statusTag(ex.status) : '<span></span>'}</div></article>
        <article class="card kpi k2 rise" ${dl()}><div class="k-head"><span class="k-ico amber">${icon('gauge')}</span>${esc(t('Estimated safe yield'))}</div>
          <div class="k-body"><div><div class="big">${num(sy && sy.value, 1)}</div><div class="unit">MCM / year</div></div>
            ${ring({ frac: 1, color: '#f5a524', track: '#fde9bd', size: 78, stroke: 8, center: ratio ? `<text x="50%" y="46%" text-anchor="middle" font-size="13.5" font-weight="700" fill="#0b2a4a">${ratio}×</text><text x="50%" y="60%" text-anchor="middle" font-size="8" fill="#5d7589">Extraction</text><text x="50%" y="70%" text-anchor="middle" font-size="8" fill="#5d7589">Ratio</text>` : '' })}</div>
          <div class="k-foot">${sy ? statusTag(sy.status) : ''}<span>${sy ? esc(sy.period) : ''}</span></div></article>
        <article class="card kpi k3 rise" ${dl()}><div class="k-head"><span class="k-ico blue">${icon('drop')}</span>${esc(t('Registered wells'))}</div>
          <div class="k-body"><div><div class="big">${num(d.wells.count)}</div><div class="unit">wells</div></div><div class="minibars"><i style="width:100%"></i><i style="width:45%;opacity:.55"></i></div></div>
          <div class="k-foot">${statusTag(d.wells.status)}</div></article>
        <article class="card kpi k4 rise" ${dl()}><div class="k-head"><span class="k-ico">${icon('pulse')}</span>${esc(t('Monitoring stations'))}</div>
          <div class="k-body"><div><div class="big">${num(d.stations.count)}</div><div class="unit">stations</div></div>
            <div class="dots" aria-hidden="true">${Array.from({ length: d.stations.count }, (_, i) => `<i class="${i < d.stations.active ? '' : 'off'}" style="animation-delay:${200 + i * 70}ms"></i>`).join('')}</div></div>
          <div class="k-foot">${tag(`${d.stations.active} active`, 'green')}${tag(covTag, 'grey')}</div></article>
        <article class="card kpi k5 rise" ${dl()}><div class="k-head"><span class="k-ico green">${icon('shield')}</span>${esc(t('Water quality'))}</div>
          <div class="k-body"><div><div class="big">${num(d.quality.suitable_pct)}</div><div class="unit">% suitable</div></div>
            ${ring({ frac: (d.quality.suitable_pct || 0) / 100, color: '#16a34a', size: 70, stroke: 7, center: `<text x="50%" y="47%" text-anchor="middle" font-size="13" font-weight="700" fill="#0b2a4a">${fmt(d.quality.suitable_pct)}%</text><text x="50%" y="62%" text-anchor="middle" font-size="8.5" fill="#5d7589">Suitable</text>` })}</div>
          <div class="k-foot">${statusTag(d.quality.status)}<span title="TDS ≤ ${d.quality.threshold_tds_mgl} mg/L">${d.quality.suitable_count}/${d.quality.total} wells</span></div></article>
        <article class="card kpi k6 rise" ${dl()}><div class="k-head"><span class="k-ico blue">${icon('layers')}</span>${esc(t('Data availability'))}</div>
          <div class="k-body"><div><div class="big">${d.integrations.connected}/${d.integrations.total}</div><div class="unit">integrations</div></div>
            <div class="vbars" aria-hidden="true">${d.integrations.sources.map((s, i) => `<i class="${s.connected ? '' : 'off'}" style="height:${20 + i * 4}px;animation-delay:${200 + i * 80}ms"></i>`).join('')}</div></div>
          <div class="k-foot">${tag(d.integrations.connected < d.integrations.total ? 'Incomplete' : 'Complete', d.integrations.connected < d.integrations.total ? 'amber' : 'green', d.integrations.connected < d.integrations.total ? 'alert' : 'check')}<span>${d.integrations.pct}% connected</span></div></article>
      </div>

      <div class="row2">
        <section class="card panel balance-card rise" ${dl()}><div class="panel-head"><div><div class="eyebrow">${icon('layers')} ${esc(t('RESOURCE BALANCE'))} ${infoTip('Extraction and safe yield for the same reporting period.')}</div>
          <h2>${esc(t('Extraction vs. estimated safe yield'))}</h2></div>
          <select class="select-sm" aria-label="Period"><option>Annual</option></select></div>
          ${ex && sy ? `<div class="balance">
            <div><div class="big">${num(ex.value)}</div><div class="sub">Extraction MCM / year</div></div>
            <div class="mid"><div class="big amber">${ratio ? ratio + '×' : '—'}</div><div class="sub">Comparison ratio</div></div>
            <div><div class="big amber">${num(sy.value, 1)}</div><div class="sub">Safe yield MCM / year</div></div></div>
            <div class="bal-bar"><div class="bal-marker" style="inset-inline-start:0" data-pos="calc(${markerPct}% - 2px)"></div></div>
            <div class="bal-scale"><span>0</span><span>Estimated safe yield <b>${fmt(sy.value, 1)}</b></span><span>${fmt(Math.max(ex.value, sy.value))} MCM</span></div>
            <div class="note">${icon('info')}<span>${ratio ? 'Ratio uses figures from the same reporting period; it is not a scientific sustainability score.' : `The safe-yield estimate covers ${esc(sy.period)} only, so no ratio is shown for ${d.year}.`}</span></div>`
            : '<p class="unit">No extraction record for this year.</p>'}
          <div class="insight"><b>INSIGHT FOR YOUR ROLE</b>${esc(d.insight)}</div></section>
        <section class="card panel map-card rise" ${dl()}><div class="panel-head"><div><div class="eyebrow">${icon('drop')} ${esc(t('GEOGRAPHIC INTELLIGENCE'))}</div><h2>${esc(t('Monitoring coverage'))}</h2></div>
          <a class="link-btn" href="#/map">${esc(t('Open map'))} ${icon('ext')}</a></div>
          <div class="map-mini" id="mini-map" title="Schematic overview. Open the map for exact positions."><div class="sea"></div>
            <div class="land" id="land"><img src="/assets/qatar.png" alt="Outline of Qatar"></div>
            <div class="legend"><div><i style="background:#12bfb7"></i>${esc(t('Wells'))}<b>${d.coverage.wells}</b></div>
            <div><i style="background:#f6b93b"></i>${esc(t('Stations'))}<b>${d.coverage.stations}</b></div><div><i style="background:#94a3b8"></i>${esc(t('Data gaps'))}<b>${d.coverage.data_gaps}</b></div></div></div></section>
      </div>

      <div class="row2">
        <section class="card panel rise" ${dl()}><div class="panel-head"><div><div class="eyebrow">${icon('bars')} ${esc(t('HISTORICAL SIGNAL'))} ${infoTip('Annual groundwater extraction, million cubic metres.')}</div><h2>${esc(t('Annual extraction trend'))}</h2></div>
          <select class="select-sm" id="range" aria-label="Range"><option value="0">1998 – 2022</option><option value="10">2008 – 2022</option><option value="5">2013 – 2022</option></select></div>
          <div class="chart-wrap" id="trend"></div>
          <div class="chart-foot"><span class="l"><span>${icon('file').replace('class="i"', 'class="i sm"')} ${ex ? esc(ex.status === 'demonstration' ? 'Demonstration series' : ex.status[0].toUpperCase() + ex.status.slice(1)) : ''}</span><span><i class="dot"></i>Million m³ / year</span></span><span>Source: ${esc(ex ? ex.source : 'n/a')}</span></div></section>
        <section class="card panel use-card rise" ${dl()}><div class="palm" aria-hidden="true"></div>
          <div class="panel-head"><div><div class="eyebrow">${icon('cog')} ${esc(t('USE PROFILE'))} ${infoTip('Share of extraction by sector for the selected year.')}</div><h2>${esc(t('Extraction by sector'))}</h2></div></div>
          ${sec ? `<div class="sector"><div>${donut(sec.items.map((i) => ({ label: secLabel[i.key], value: i.value, color: colors[i.key] })), fmt(sec.total), 'MCM')}</div>
            <div class="sector-list">${sec.items.map((i) => `<div><span class="ic" style="color:${secIcon[i.key][1]}">${icon(secIcon[i.key][0])}</span><span>${esc(t(secLabel[i.key]))}</span><b>${i.pct}%</b></div>`).join('')}</div></div>
            <div class="chart-foot"><span class="l"><span>${statusTag(sec.status)}</span></span><span>Source: ${esc(sec.source)}</span></div>` : '<p class="unit">No sector data for this year.</p>'}</section>
      </div>`;

    animateIn(view);

    const trendHost = $('#trend');
    const draw = () => {
      const k = Number($('#range').value);
      let rows = d.trend.filter((r) => r.year <= d.year);
      if (k) rows = rows.slice(-k - 1);
      if (rows.length > 1) lineChart(trendHost, rows.map((r) => ({ label: String(r.year), v: r.total })));
      else trendHost.innerHTML = '<p class="unit">Not enough data.</p>';
    };
    $('#range').addEventListener('change', draw);
    draw();

    // statusbar
    $('#statusbar').innerHTML = `<span>${icon('refresh')} Platform updated ${esc(stamp(d.updated_at))}</span>
      <span><i class="dot ${d.integrations.connected < d.integrations.total ? 'amber' : ''}"></i>Data status: <b>${d.integrations.connected} of ${d.integrations.total}</b> sources connected</span>
      <span>${icon('pin')} Geographic scope: <b>State of Qatar</b></span>`;

    // markers for the schematic map (after layout so the page is not blocked by the extra requests)
    const [wells, stations] = await Promise.all([api('/api/wells'), api('/api/stations')]);
    const landEl = $('#land');
    if (landEl) await drawCoverage(landEl, wells.wells, stations.stations);
  }

  async function pageMap(view) {
    view.innerHTML = `<div class="page-head"><div><h1>${esc(t('Groundwater Map'))}</h1><p>Wells and monitoring stations. Coordinates are demonstration values.</p></div></div>
      <div class="map-layout"><div class="card" style="padding:8px"><div class="map-full" id="full-map"></div></div>
      <aside class="card filters"><div class="eyebrow">LAYERS</div>
        <label><input type="checkbox" data-l="wells" checked> <i class="sw" style="background:#12bfb7"></i> Wells</label>
        <label><input type="checkbox" data-l="stations" checked> <i class="sw" style="background:#f6b93b"></i> Monitoring stations</label>
        <label><input type="checkbox" data-l="gaps" checked> <i class="sw" style="background:#94a3b8"></i> Wells with data gaps</label>
        <p class="unit">Red station marker = inactive.</p></aside></div>`;
    const [wells, stations] = await Promise.all([api('/api/wells'), api('/api/stations')]);
    const map = makeMap($('#full-map'), { wells: wells.wells, stations: stations.stations }, { popups: true, layerControl: true });
    if (!map) return;
    view.querySelectorAll('.filters input').forEach((cb) => cb.addEventListener('change', () => {
      const lg = map._layers_[cb.dataset.l];
      if (cb.checked) lg.addTo(map); else map.removeLayer(lg);
    }));
  }

  function sortableTable(host, cols, rows, { filter = '' } = {}) {
    let sortKey = cols[0].key, dir = 1, q = filter.toLowerCase();
    const render = () => {
      const list = rows.filter((r) => !q || cols.some((c) => String(r[c.key] ?? '').toLowerCase().includes(q)))
        .sort((a, b) => ((a[sortKey] ?? -Infinity) > (b[sortKey] ?? -Infinity) ? 1 : -1) * dir);
      host.innerHTML = `<div class="tbl-wrap"><table class="t"><thead><tr>${cols.map((c) => `<th data-k="${c.key}" aria-sort="${c.key === sortKey ? (dir > 0 ? 'ascending' : 'descending') : 'none'}">${esc(c.label)}${c.key === sortKey ? (dir > 0 ? ' ▲' : ' ▼') : ''}</th>`).join('')}</tr></thead>
        <tbody>${list.map((r) => `<tr>${cols.map((c) => `<td>${c.render ? c.render(r) : esc(r[c.key] ?? '—')}</td>`).join('')}</tr>`).join('') || `<tr><td colspan="${cols.length}">No matching records</td></tr>`}</tbody></table></div>`;
      host.querySelectorAll('th').forEach((th) => th.addEventListener('click', () => { const k = th.dataset.k; if (k === sortKey) dir = -dir; else { sortKey = k; dir = 1; } render(); }));
    };
    render();
    return { setFilter(v) { q = v.toLowerCase(); render(); } };
  }

  async function pageWells(view) {
    const [w, s] = await Promise.all([api('/api/wells'), api('/api/stations')]);
    view.innerHTML = `<div class="page-head"><div><h1>${esc(t('Wells & Monitoring'))}</h1><p>${w.wells.length} registered wells · ${s.stations.length} monitoring stations. All records are demonstration data.</p></div>
      <div class="toolbar"><label class="search" style="width:240px">${icon('search')}<input id="wq" placeholder="Filter wells…" aria-label="Filter wells"></label></div></div>
      <section class="card"><div id="wt"></div></section>
      <section class="card" style="margin-top:14px"><div class="eyebrow">MONITORING STATIONS</div><div id="st" style="margin-top:8px"></div></section>`;
    const tbl = sortableTable($('#wt'), [
      { key: 'code', label: 'Code' }, { key: 'name', label: 'Name' }, { key: 'aquifer', label: 'Aquifer' },
      { key: 'depth_m', label: 'Depth (m)' }, { key: 'tds_mgl', label: 'TDS (mg/L)', render: (r) => r.tds_mgl == null ? '<span class="tag grey">No data</span>' : fmt(r.tds_mgl) },
      { key: 'station_code', label: 'Station' },
      { key: 'last_measured', label: 'Last measured', render: (r) => esc(r.last_measured || '—') },
      { key: 'data_status', label: 'Status', render: (r) => statusTag(r.data_status) }], w.wells, { filter: store.get('aq_q') || '' });
    if (store.get('aq_q')) { $('#wq').value = store.get('aq_q'); store.set('aq_q', ''); }
    $('#wq').addEventListener('input', (e) => tbl.setFilter(e.target.value));
    sortableTable($('#st'), [
      { key: 'code', label: 'Code' }, { key: 'name', label: 'Name' },
      { key: 'status', label: 'Status', render: (r) => `<span class="tag ${r.status === 'active' ? 'green' : 'red'}"><i></i>${esc(r.status)}</span>` },
      { key: 'readings_2022', label: 'Readings 2022', render: (r) => `${r.readings_2022} / 12` },
      { key: 'data_status', label: 'Data', render: (r) => statusTag(r.data_status) }], s.stations);
  }

  async function pageQuality(view) {
    const w = await api('/api/wells');
    const rows = w.wells.filter((x) => x.tds_mgl != null).sort((a, b) => a.tds_mgl - b.tds_mgl);
    const max = Math.max(...rows.map((r) => r.tds_mgl), w.threshold_tds_mgl);
    const barH = 20, H = rows.length * (barH + 6) + 20, Wd = 700, L = 150;
    const x = (v) => L + (v / max) * (Wd - L - 60);
    view.innerHTML = `<div class="page-head"><div><h1>${esc(t('Water Quality'))}</h1><p>Total dissolved solids (TDS) per well against the ${fmt(w.threshold_tds_mgl)} mg/L demonstration suitability threshold.</p></div></div>
      <section class="card"><div class="legend-inline"><span><i class="sw" style="background:#16a34a"></i>≤ threshold</span><span><i class="sw" style="background:#e08a00"></i>above threshold</span>
        <span>${rows.length} wells with measurements · ${w.wells.length - rows.length} without data</span></div>
        <div class="tbl-wrap"><svg viewBox="0 0 ${Wd} ${H}" width="100%" style="min-width:560px" role="img" aria-label="TDS per well">
        <line x1="${x(w.threshold_tds_mgl)}" x2="${x(w.threshold_tds_mgl)}" y1="0" y2="${H}" stroke="#16a34a" stroke-dasharray="4 4"/>
        ${rows.map((r, i) => `<text x="${L - 8}" y="${10 + i * (barH + 6) + 14}" text-anchor="end" font-size="12" fill="#0b2a4a">${esc(r.name)}</text>
          <rect x="${L}" y="${10 + i * (barH + 6)}" width="${x(r.tds_mgl) - L}" height="${barH}" rx="5" fill="${r.tds_mgl <= w.threshold_tds_mgl ? '#16a34a' : '#e08a00'}"><title>${esc(r.name)}: ${r.tds_mgl} mg/L</title></rect>
          <text x="${x(r.tds_mgl) + 6}" y="${10 + i * (barH + 6) + 14}" font-size="11.5" fill="#5b7488">${fmt(r.tds_mgl)}</text>`).join('')}</svg></div></section>`;
  }

  async function pageExtraction(view) {
    const r = await api('/api/extraction');
    view.innerHTML = `<div class="page-head"><div><h1>${esc(t('Water Extraction'))}</h1><p>Annual groundwater extraction by sector, 1998–2022 (MCM/year). Demonstration series.</p></div></div>
      <section class="card"><div class="legend-inline"><span><i class="sw" style="background:#12b5a6"></i>Agriculture</span><span><i class="sw" style="background:#2f80ed"></i>Municipal</span><span><i class="sw" style="background:#f6b93b"></i>Industrial</span></div>
      <div id="sb"></div></section><section class="card" style="margin-top:14px"><div id="et"></div></section>`;
    stackedBars($('#sb'), r.series);
    sortableTable($('#et'), [{ key: 'year', label: 'Year' }, { key: 'agriculture', label: 'Agriculture' }, { key: 'municipal', label: 'Municipal' },
      { key: 'industrial', label: 'Industrial' }, { key: 'total', label: 'Total (MCM)' }, { key: 'data_status', label: 'Status', render: (x) => statusTag(x.data_status) }], r.series);
  }

  async function pageNotifications(view) {
    const r = await api('/api/notifications');
    const col = { info: '#3aa8e0', warning: '#f5a524', critical: '#dc2626' };
    view.innerHTML = `<div class="page-head"><div><h1>${esc(t('Notifications'))}</h1><p>${r.unread} unread</p></div></div>
      <section class="card">${r.notifications.map((n) => `<div class="notif ${n.read ? '' : 'unread'}" data-id="${n.id}"><span class="sev" style="background:${col[n.severity]}"></span>
        <div style="flex:1"><h3>${esc(n.title)}</h3><p>${esc(n.body)}</p><time>${esc(stamp(n.created_at))}</time></div>
        ${n.read ? '' : '<button class="btn ghost mark" style="height:34px">Mark read</button>'}</div>`).join('')}</section>`;
    view.querySelectorAll('.mark').forEach((b) => b.addEventListener('click', async () => {
      await api(`/api/notifications/${b.closest('.notif').dataset.id}/read`, { method: 'POST' });
      pageNotifications(view); refreshBadge();
    }));
  }

  function download(name, text) {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([text], { type: 'text/csv;charset=utf-8' }));
    a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }
  const csv = (rows, cols) => [cols.join(','), ...rows.map((r) => cols.map((c) => JSON.stringify(r[c] ?? '')).join(','))].join('\n');

  async function pageReports(view) {
    view.innerHTML = `<div class="page-head"><div><h1>${esc(t('Reports'))}</h1><p>Export current platform data as CSV. Exports include each record's data status.</p></div></div>
      <section class="card"><div class="toolbar"><button class="btn" id="x-w">${icon('dl')} Wells</button><button class="btn" id="x-e">${icon('dl')} Extraction by sector</button>
      <button class="btn" id="x-s">${icon('dl')} Stations</button></div></section>`;
    $('#x-w').onclick = async () => { const r = await api('/api/wells'); download('aquamaa-wells.csv', csv(r.wells, ['code', 'name', 'lat', 'lon', 'aquifer', 'depth_m', 'tds_mgl', 'last_measured', 'station_code', 'data_status'])); };
    $('#x-e').onclick = async () => { const r = await api('/api/extraction'); download('aquamaa-extraction.csv', csv(r.series, ['year', 'agriculture', 'municipal', 'industrial', 'total', 'unit', 'source', 'data_status'])); };
    $('#x-s').onclick = async () => { const r = await api('/api/stations'); download('aquamaa-stations.csv', csv(r.stations, ['code', 'name', 'lat', 'lon', 'status', 'readings_2022', 'data_status'])); };
  }

  function pageSettings(view) {
    const u = state.user;
    view.innerHTML = `<div class="page-head"><div><h1>${esc(t('Settings'))}</h1></div></div>
      <section class="card"><table class="t"><tbody><tr><td>Name</td><td>${esc(u.name)}</td></tr><tr><td>Role</td><td>${esc(u.title)}</td></tr>
      <tr><td>Institution</td><td>${esc(u.institution)}</td></tr><tr><td>Email</td><td>${esc(u.email)}</td></tr></tbody></table></section>`;
  }

  function pagePlaceholder(view, id) {
    const info = PAGE_INFO[id];
    view.innerHTML = `<section class="card placeholder"><div class="k-ico" style="margin:0 auto;width:52px;height:52px">${icon('layers')}</div>
      <h2>${esc(t(info.label))}</h2><p>This module is not implemented yet. It needs data feeds that are not integrated in this build, so no figures are shown rather than invented ones.</p>
      <p><a href="#/dashboard">Back to dashboard</a></p></section>`;
  }

  /* ================= router ================= */
  const PAGES = { dashboard: pageDashboard, map: pageMap, wells: pageWells, quality: pageQuality, extraction: pageExtraction, notifications: pageNotifications, reports: pageReports, settings: pageSettings };

  async function route() {
    if (!state.user) return;
    const id = (location.hash.replace(/^#\//, '') || 'dashboard').split('?')[0];
    const page = PAGE_INFO[id] ? id : 'dashboard';
    disposeMaps();
    document.querySelectorAll('.nav a').forEach((a) => a.classList.toggle('active', a.dataset.page === page));
    $('#crumbs').innerHTML = `${esc(t(PAGE_INFO[page].section.replace(/^./, (c) => c)))}<span>/</span><b>${esc(t(PAGE_INFO[page].label))}</b>`;
    $('#year').closest('.select-pill').style.visibility = page === 'dashboard' ? 'visible' : 'hidden';
    const art = $('#hero-art'); if (art) art.hidden = page !== 'dashboard';
    if (page !== 'dashboard') $('#statusbar').innerHTML = '';
    const view = $('#view');
    try {
      if (PAGES[page]) await PAGES[page](view); else pagePlaceholder(view, page);
      $('#live').classList.remove('off');
    } catch (e) {
      if (e.message === 'unauthenticated') return;
      view.innerHTML = `<section class="card placeholder"><h2>Something went wrong</h2><p>${esc(e.message)}</p></section>`;
      $('#live').classList.add('off');
    }
    window.scrollTo(0, 0);
  }

  function boot() {
    applyLang();
    buildShell();
    refreshBadge();
    route();
  }

  window.addEventListener('hashchange', route);
  window.addEventListener('resize', () => { if (state.dash && ($('#trend'))) { /* charts redraw on next navigation */ } });

  (async function init() {
    applyLang();
    try {
      const r = await fetch('/api/auth/me', { credentials: 'same-origin' });
      if (r.ok) { state.user = (await r.json()).user; $('#login').hidden = true; boot(); return; }
    } catch { /* fall through */ }
    showLogin();
  })();
})();
