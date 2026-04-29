/**
 * ESH-MASTER · shared.js
 * ────────────────────────────────────────────────────────
 * 모든 페이지 공통 로직
 *   - GAS API 통신 (config 읽기 / 구독 / 통계)
 *   - 뉴스 티커
 *   - 뉴스레터 모달
 *   - 구독 현황
 *   - 보안 훅 (로그, CSP, 향후 인증 확장 자리)
 * ────────────────────────────────────────────────────────
 */

/* ══════════════════════════════════════════════
   0. 설정 상수
══════════════════════════════════════════════ */
const ESH = window.ESH || {};

ESH.CONFIG = {
  GAS_URL: 'https://script.google.com/macros/s/AKfycbykCxcVBZki0-wrNpd5a63D_wttCJUs14_-OyvrEGcozwueS3BMnlRxNALz_KijeyTO/exec',
  STATS_THRESHOLD: 10,
  VERSION: '2.0.0',
};

/* ══════════════════════════════════════════════
   1. 보안 레이어
   향후 ISMS 준비 시 이 섹션 확장
══════════════════════════════════════════════ */
ESH.Security = (function () {

  // 개발자 도구 차단 (프로덕션 보호)
  function blockDevTools() {
    document.addEventListener('contextmenu', e => e.preventDefault());
    document.addEventListener('keydown', e => {
      if (e.key === 'F12') { e.preventDefault(); return; }
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && ['i','I','j','J','c','C','k','K'].includes(e.key)) {
        e.preventDefault(); return;
      }
      if ((e.ctrlKey || e.metaKey) && ['u','U','s','S'].includes(e.key)) e.preventDefault();
    });
  }

  // 접근 로그 (GAS로 전송 — 관리자 감사 추적용, 향후 ISMS 대응)
  function logAccess(action, detail = {}) {
    // TODO: ISMS 준비 시 아래 주석 해제 + GAS logAccess 엔드포인트 추가
    /*
    fetch(ESH.CONFIG.GAS_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({
        action: 'logAccess',
        page: location.pathname,
        event: action,
        detail,
        ts: new Date().toISOString(),
        ua: navigator.userAgent.slice(0, 80),
      }),
    }).catch(() => {});
    */
  }

  // 입력값 XSS 방어 이스케이프
  function escHtml(s) {
    return String(s || '').replace(/[&<>"']/g, c => ({
      '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'
    })[c]);
  }

  // 이메일 유효성 검사
  function isEmail(v) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
  }

  // TODO: 향후 JWT / 세션 토큰 검증 자리
  function verifySession() {
    return true; // placeholder
  }

  return { blockDevTools, logAccess, escHtml, isEmail, verifySession };
})();

// 개발자 도구 차단 즉시 실행
ESH.Security.blockDevTools();


/* ══════════════════════════════════════════════
   2. API 클라이언트
══════════════════════════════════════════════ */
ESH.API = (function () {
  const URL = ESH.CONFIG.GAS_URL;

  async function get(params) {
    const qs = new URLSearchParams(params).toString();
    const res = await fetch(URL + '?' + qs, { signal: AbortSignal.timeout(8000) });
    return res.json();
  }

  async function post(body) {
    const res = await fetch(URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(10000),
    });
    return res.json();
  }

  return { get, post };
})();


/* ══════════════════════════════════════════════
   3. Config 로더
   GAS에서 설정 읽어와 전 페이지 동시 적용
══════════════════════════════════════════════ */
ESH.Config = (function () {

  const DEFAULTS = {
    brand_name:    'ESH-MASTER.KR  l  SDI',
    brand_sub:     'ENVIRONMENT · SAFETY · HEALTH',
    favicon:       '',
    og_image:      'https://esh-master.kr/og-image.svg',
    badge:         'COMING SOON · 2026',
    h1_1:          '현장에서 검증된',
    h1_2:          '안전보건환경 디지털 설계',
    lead:          'ESH-MASTER는 <strong>제조·통신업 현장</strong>의 안전보건을 수행해온 산업안전기획·안전보건전산화 전문가가 직접 설계합니다. <strong>산안법·중처법</strong> 의무 이행과 현장 언어를 결합한<br>4가지 서비스를 준비하고 있습니다.',
    creds: [
      { n: '16<sub>년+</sub>', l: '제조·통신업 안전관리' },
      { n: '산안법',           l: '법정 의무 완전 준수' },
      { n: '중처법',           l: '경영책임자 이행 증거' },
      { n: '다수 사업장',      l: '통합 안전보건 체계' },
    ],
    services: [
      { title: 'Safety Do It',              desc: '계층별 누구나 쉽게 따라하고\n안전을 즐겁게 만드는 통합 솔루션', status: '준비중' },
      { title: 'JSA 위험성평가',             desc: '업종별 작업표준화를 통해\nAI를 활용한 JSA 위험성평가',     status: '준비중' },
      { title: 'AI 안전보건 뉴스레터',        desc: '업종별 특성을 반영한\nAI 안전보건 주간 큐레이션',        status: '운영중' },
      { title: '안전보건정보',               desc: '업종별 특성을 반영한\n법령·사례·서식 자료실',            status: '준비중' },
      { title: '고용노동부 지정 안전보건전문기관 찾기', desc: '안전·보건·건설재해예방\n고용노동부 지정기관 검색 · 지도', status: '운영중' },
    ],
    contact_h2:    '서비스 출시 · 파트너십 · 문의는\n아래 이메일로 연락 주세요.',
    contact_email: 'ehsmaster.kr@gmail.com',
    contact_note:  '문의 전 간단한 소속·용건을 메일에 적어주시면 빠르게 회신드립니다.',
    industries: [
      { name: '식품·음료 제조업', status: '신청중' },
      { name: '일반 제조업',      status: '신청중' },
      { name: '화학·석유·고무업', status: '신청중' },
      { name: '건설업',           status: '신청중' },
      { name: '물류·운수업',      status: '신청중' },
      { name: '서비스업',         status: '신청중' },
      { name: '통신·IT업',        status: '신청중' },
      { name: '기타',             status: '신청중' },
    ],
    agencies: [
      { name: '고용노동부',       url: 'https://www.moel.go.kr',  favicon: 'moel.go.kr' },
      { name: '안전보건공단',     url: 'https://www.kosha.or.kr', favicon: 'kosha.or.kr' },
      { name: '환경부',           url: 'https://www.me.go.kr',    favicon: 'me.go.kr' },
      { name: '소방청',           url: 'https://www.nfa.go.kr',   favicon: 'nfa.go.kr' },
      { name: '국가법령정보센터', url: 'https://www.law.go.kr',   favicon: 'law.go.kr' },
      { name: '안전보건법령정보', url: 'https://www.meis.go.kr',  favicon: 'meis.go.kr' },
    ],
  };

  let _cfg = JSON.parse(JSON.stringify(DEFAULTS));

  async function load() {
    try {
      const data = await ESH.API.get({ action: 'getConfig' });
      if (data.success && data.config) {
        _cfg = Object.assign({}, DEFAULTS, data.config);
        if (data.config.creds)      _cfg.creds      = data.config.creds;
        if (data.config.industries) _cfg.industries  = data.config.industries;
        if (data.config.agencies)   _cfg.agencies    = data.config.agencies;
        if (data.config.services) {
          _cfg.services = DEFAULTS.services.map((def, i) =>
            Object.assign({}, def, data.config.services[i] || {})
          );
        }
      }
    } catch (e) { /* 네트워크 오류 시 기본값 사용 */ }
    apply();
    return _cfg;
  }

  function get() { return _cfg; }

  // 전 페이지 공통 적용 (nav, footer, og 등)
  function apply() {
    _applyNav();
    _applyFooter();
    _applyMeta();
    _applyFavicon();
    window._ESH_INDUSTRIES = _cfg.industries;
    window._ESH_CFG = _cfg;
  }

  function _applyNav() {
    const t1 = document.querySelector('.nav-logo-text .t1');
    const t2 = document.querySelector('.nav-logo-text .t2');
    if (t1) t1.textContent = _cfg.brand_name;
    if (t2) t2.textContent = _cfg.brand_sub;
    // guidance-agencies 헤더도 적용
    const hdName = document.querySelector('.hd-name');
    if (hdName) hdName.innerHTML = _cfg.brand_name.replace(' l ', ' <span style="opacity:.4;font-weight:400">|</span> ');
  }

  function _applyFooter() {
    // 모든 페이지 공통 푸터 agency 링크 재구성
    const wrap = document.getElementById('foot-agency-links');
    if (!wrap || !_cfg.agencies) return;
    wrap.innerHTML = _cfg.agencies.map(a => {
      const domain = a.favicon || new URL(a.url).hostname.replace('www.', '');
      return `<a class="foot-agency" href="${a.url}" target="_blank" rel="noopener" title="${a.name}">
        <img src="https://www.google.com/s2/favicons?domain=${domain}&sz=24" width="16" height="16" alt="" onerror="this.style.display='none'">
        ${ESH.Security.escHtml(a.name)}
      </a>`;
    }).join('');
  }

  function _applyMeta() {
    if (_cfg.og_image) {
      const og = document.getElementById('og-image');
      const tw = document.getElementById('twitter-image');
      if (og) og.content = _cfg.og_image;
      if (tw) tw.content = _cfg.og_image;
    }
  }

  function _applyFavicon() {
    if (!_cfg.favicon) return;
    const fv = document.getElementById('site-favicon');
    const fa = document.getElementById('site-favicon-apple');
    if (fv) { fv.href = _cfg.favicon; fv.type = _cfg.favicon.startsWith('data:image/svg') ? 'image/svg+xml' : 'image/x-icon'; }
    if (fa) fa.href = _cfg.favicon;
  }

  return { load, get, apply };
})();


/* ══════════════════════════════════════════════
   4. 모달 유틸
══════════════════════════════════════════════ */
ESH.Modal = (function () {
  function open(el)  { if (!el) return; el.classList.add('open');    document.body.style.overflow = 'hidden'; }
  function close(el) { if (!el) return; el.classList.remove('open'); document.body.style.overflow = ''; }

  function init() {
    // ESC 키로 모달 닫기
    document.addEventListener('keydown', e => {
      if (e.key !== 'Escape') return;
      document.querySelectorAll('.modal-overlay.open').forEach(el => close(el));
    });
    // 배경 클릭으로 닫기
    document.querySelectorAll('.modal-overlay').forEach(ov => {
      ov.addEventListener('click', e => { if (e.target === ov) close(ov); });
    });
  }

  return { open, close, init };
})();


/* ══════════════════════════════════════════════
   5. 뉴스 티커
══════════════════════════════════════════════ */
ESH.Ticker = (function () {
  const FEEDS = [
    { url: 'https://api.rss2json.com/v1/api.json?count=10&rss_url=' + encodeURIComponent('https://www.moel.go.kr/news/enews/report/rss.do'), cat: '노동부', cls: 'bd-moel' },
    { url: 'https://api.rss2json.com/v1/api.json?count=10&rss_url=' + encodeURIComponent('https://www.kosha.or.kr/kosha/data/rssCenter.do?gubun=A'), cat: 'KOSHA', cls: 'bd-kosha' },
    { url: 'https://api.rss2json.com/v1/api.json?count=10&rss_url=' + encodeURIComponent('http://www.anjunj.com/rss/allArticle.xml'), cat: '안전저널', cls: 'bd-news' },
    { url: 'https://api.rss2json.com/v1/api.json?count=10&rss_url=' + encodeURIComponent('https://www.me.go.kr/home/web/rss/rss.do?menuId=10257'), cat: '환경부', cls: 'bd-env' },
    { url: 'https://api.rss2json.com/v1/api.json?count=10&rss_url=' + encodeURIComponent('https://www.kosha.or.kr/kosha/data/rssCenter.do?gubun=B'), cat: 'KOSHA', cls: 'bd-kosha' },
  ];
  const FALLBACK = [
    { cat: '노동부',   cls: 'bd-moel',  text: '고용노동부 산업안전보건 정책 · 보도자료',          link: 'https://www.moel.go.kr' },
    { cat: 'KOSHA',   cls: 'bd-kosha', text: '안전보건공단 공지사항 · 안전보건 자료실',          link: 'https://www.kosha.or.kr' },
    { cat: '안전저널', cls: 'bd-news',  text: '안전저널 최신 산업재해 · 안전보건 뉴스',          link: 'http://www.anjunj.com' },
    { cat: '환경부',   cls: 'bd-env',   text: '환경부 화학물질 · 환경안전 최신 공지',            link: 'https://www.me.go.kr' },
    { cat: '법령',     cls: 'bd-rule',  text: '국가법령정보센터 산업안전보건법 · 중대재해처벌법', link: 'https://www.law.go.kr' },
  ];

  let _inner, _timeEl;

  function _buildItem(cat, cls, text, link) {
    const inner = link ? `<a href="${link}" target="_blank" rel="noopener">${ESH.Security.escHtml(text)}</a>` : ESH.Security.escHtml(text);
    return `<span class="tk-item"><span class="tk-badge ${cls}">${cat}</span>${inner}</span><span class="tk-dot"></span>`;
  }

  function _render(items) {
    if (!_inner || !items.length) return;
    const dur = Math.min(240, Math.max(90, items.length * 10));
    _inner.innerHTML = items.map(i => _buildItem(i.cat, i.cls, i.text, i.link)).join('') +
                       items.map(i => _buildItem(i.cat, i.cls, i.text, i.link)).join('');
    _inner.style.setProperty('--tk-dur', dur + 's');
    _inner.classList.remove('running');
    void _inner.offsetWidth;
    _inner.classList.add('running');
    _updateTime();
  }

  function _updateTime() {
    if (!_timeEl) return;
    const n = new Date();
    _timeEl.textContent = String(n.getHours()).padStart(2,'0') + ':' + String(n.getMinutes()).padStart(2,'0') + ' 기준';
  }

  async function _fetchFeed(f) {
    try {
      const ts = Math.floor(Date.now() / (5 * 60 * 1000));
      const r = await fetch(f.url + '&_t=' + ts, { signal: AbortSignal.timeout(6000), cache: 'no-store' });
      if (!r.ok) return [];
      const d = await r.json();
      if (d.status !== 'ok' || !Array.isArray(d.items)) return [];
      return d.items.slice(0, 6).map(i => ({
        cat: f.cat, cls: f.cls,
        text: (i.title || '').replace(/<[^>]+>/g, '').trim().slice(0, 60),
        link: i.link || null,
        date: i.pubDate ? new Date(i.pubDate) : null,
      })).filter(i => i.text.length > 4);
    } catch { return []; }
  }

  async function _fetchAll() {
    const results = await Promise.allSettled(FEEDS.map(f => _fetchFeed(f)));
    const items = results.filter(x => x.status === 'fulfilled').flatMap(x => x.value);
    items.sort((a, b) => {
      if (!a.date && !b.date) return 0;
      if (!a.date) return 1;
      if (!b.date) return -1;
      return b.date - a.date;
    });
    _render(items.length ? items : FALLBACK);
  }

  function refresh() {
    if (_inner) {
      _inner.innerHTML = '<div class="tk-load"><div class="tk-spin"></div>새로고침 중...</div>';
      _inner.classList.remove('running');
    }
    _fetchAll();
  }

  function init() {
    _inner  = document.getElementById('tk-inner');
    _timeEl = document.getElementById('tk-time');
    if (!_inner) return;
    _fetchAll();
    setInterval(_fetchAll,    5 * 60 * 1000);
    setInterval(_updateTime,  60 * 1000);
    const btn = document.getElementById('tk-refresh-btn');
    if (btn) btn.addEventListener('click', refresh);
  }

  return { init, refresh };
})();


/* ══════════════════════════════════════════════
   6. 뉴스레터 (구독 / 취소 / 현황)
══════════════════════════════════════════════ */
ESH.Newsletter = (function () {

  function _showResult(el, type, msg) {
    if (!el) return;
    el.className   = 'nl-result ' + type;
    el.textContent = msg;
  }

  function _rebuildSelect() {
    const sel = document.getElementById('sub-industry');
    if (!sel) return;
    const industries = window._ESH_INDUSTRIES || [];
    sel.innerHTML = '<option value="">-- 선택해주세요 --</option>';
    industries.forEach(ind => {
      const opt = document.createElement('option');
      opt.value = opt.textContent = ind.name || ind;
      sel.appendChild(opt);
    });
    sel.onchange = () => toggleEtcField(sel.value);
  }

  async function subscribe() {
    const name        = (document.getElementById('sub-name')?.value        || '').trim();
    const email       = (document.getElementById('sub-email')?.value       || '').trim();
    const affiliation = (document.getElementById('sub-affiliation')?.value || '').trim();
    const industry    = document.getElementById('sub-industry')?.value     || '';
    const industryEtc = (document.getElementById('sub-industry-etc')?.value || '').trim();
    const agree       = document.getElementById('sub-agree')?.checked;
    const resultEl    = document.getElementById('sub-result');
    const btn         = document.getElementById('btn-subscribe');

    _showResult(resultEl, '', '');
    if (!name)                        return _showResult(resultEl, 'error', '이름을 입력해 주세요.');
    if (!ESH.Security.isEmail(email)) return _showResult(resultEl, 'error', '올바른 이메일을 입력해 주세요.');
    if (industry === '기타' && !industryEtc) return _showResult(resultEl, 'error', '업종을 직접 입력해 주세요.');
    if (!agree)                       return _showResult(resultEl, 'error', '개인정보 수집 동의가 필요합니다.');

    btn?.classList.add('loading');
    if (btn) btn.disabled = true;
    ESH.Security.logAccess('subscribe_attempt', { email: email.slice(0, 3) + '***' });

    try {
      const data = await ESH.API.post({ action: 'subscribe', name, email, affiliation, industry, industryEtc });
      if (data.success) {
        _showResult(resultEl, 'success', '✓ ' + data.message);
        ['sub-name','sub-email','sub-affiliation'].forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });
        const sel = document.getElementById('sub-industry'); if (sel) sel.value = '';
        const etc = document.getElementById('sub-industry-etc'); if (etc) etc.value = '';
        const etcFd = document.getElementById('sub-etc-field'); if (etcFd) etcFd.style.display = 'none';
        const chk = document.getElementById('sub-agree'); if (chk) chk.checked = false;
        ESH.Stats.load();
      } else {
        _showResult(resultEl, 'error', data.message || '신청 처리 중 오류가 발생했습니다.');
      }
    } catch {
      _showResult(resultEl, 'error', '서버 연결 오류. 잠시 후 다시 시도해 주세요.');
    } finally {
      btn?.classList.remove('loading');
      if (btn) btn.disabled = false;
    }
  }

  async function unsubscribe() {
    const name    = (document.getElementById('unsub-name')?.value  || '').trim();
    const email   = (document.getElementById('unsub-email')?.value || '').trim();
    const resultEl = document.getElementById('unsub-result');
    const btn      = document.getElementById('btn-unsubscribe');

    _showResult(resultEl, '', '');
    if (!name)                        return _showResult(resultEl, 'error', '이름을 입력해 주세요.');
    if (!ESH.Security.isEmail(email)) return _showResult(resultEl, 'error', '올바른 이메일을 입력해 주세요.');

    btn?.classList.add('loading');
    if (btn) btn.disabled = true;

    try {
      const data = await ESH.API.post({ action: 'unsubscribe', name, email });
      if (data.success) {
        _showResult(resultEl, 'success', '✓ ' + data.message);
        const n = document.getElementById('unsub-name');  if (n) n.value = '';
        const e = document.getElementById('unsub-email'); if (e) e.value = '';
        ESH.Stats.load();
      } else {
        _showResult(resultEl, 'error', data.message || '취소 처리 중 오류가 발생했습니다.');
      }
    } catch {
      _showResult(resultEl, 'error', '서버 연결 오류. 잠시 후 다시 시도해 주세요.');
    } finally {
      btn?.classList.remove('loading');
      if (btn) btn.disabled = false;
    }
  }

  function init() {
    _rebuildSelect();
    document.getElementById('btn-subscribe')?.addEventListener('click', subscribe);
    document.getElementById('btn-unsubscribe')?.addEventListener('click', unsubscribe);

    // 구독/취소 탭 전환
    document.querySelectorAll('.nl-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        document.querySelectorAll('.nl-tab').forEach(t => t.classList.remove('active'));
        document.querySelectorAll('.nl-panel').forEach(p => p.classList.remove('active'));
        tab.classList.add('active');
        document.getElementById('panel-' + tab.dataset.tab)?.classList.add('active');
      });
    });

    // 개인정보 상세 토글
    document.getElementById('agree-toggle-btn')?.addEventListener('click', () => {
      const tbl = document.getElementById('agree-table');
      const btn = document.getElementById('agree-toggle-btn');
      if (!tbl || !btn) return;
      tbl.classList.toggle('open');
      btn.textContent = tbl.classList.contains('open') ? '수집 항목 접기 ▲' : '수집 항목 상세보기 ▼';
    });

    // 뉴스레터 트리거
    document.getElementById('nl-trigger')?.addEventListener('click', () => ESH.Modal.open(document.getElementById('nl-overlay')));
    document.getElementById('nl-close')?.addEventListener('click',   () => ESH.Modal.close(document.getElementById('nl-overlay')));

    // 미리보기 모달
    document.getElementById('nl-preview-btn')?.addEventListener('click', () => ESH.Modal.open(document.getElementById('preview-overlay')));
    document.getElementById('preview-close')?.addEventListener('click',  () => ESH.Modal.close(document.getElementById('preview-overlay')));
    document.getElementById('preview-subscribe-btn')?.addEventListener('click', () => {
      ESH.Modal.close(document.getElementById('preview-overlay'));
      setTimeout(() => ESH.Modal.open(document.getElementById('nl-overlay')), 200);
    });
  }

  return { init };
})();

// 기타 업종 토글 (전역 함수로 HTML onchange에서 호출)
window.toggleEtcField = function (val) {
  const field = document.getElementById('sub-etc-field');
  const input = document.getElementById('sub-industry-etc');
  if (!field) return;
  if (val === '기타') { field.style.display = 'block'; if (input) input.focus(); }
  else                { field.style.display = 'none';  if (input) input.value = ''; }
};


/* ══════════════════════════════════════════════
   7. 구독 현황
══════════════════════════════════════════════ */
ESH.Stats = (function () {
  const THRESHOLD = ESH.CONFIG.STATS_THRESHOLD;

  function _escHtml(s) { return ESH.Security.escHtml(s); }

  function _render(industries) {
    const container = document.getElementById('stats-container');
    if (!container) return;
    if (!industries || !industries.length) {
      container.innerHTML = '<div class="stats-loading">표시할 업종이 없습니다.</div>';
      return;
    }
    container.innerHTML = '<div class="stats-grid">' + industries.map(ind => {
      const pct       = Math.min(100, (ind.count / THRESHOLD) * 100);
      const isSending = ind.status === '발송중';
      const isReady   = ind.status === '발송준비' || (!isSending && ind.count >= THRESHOLD);
      let barClass = 'pending', tagClass = 'soon', tagText = '준비중';
      if (isSending)    { barClass = 'sending';       tagClass = 'sending'; tagText = '<span class="sending-dot"></span>발송중'; }
      else if (isReady) { barClass = 'ready animate'; tagClass = 'ready';   tagText = '발송준비'; }
      const barWidth = isSending ? 100 : pct;
      return `<div class="stat-row">
        <div class="stat-top">
          <span class="stat-label">${_escHtml(ind.name)}</span>
          <span class="stat-count">${ind.count}명<span class="stat-tag ${tagClass}">${tagText}</span></span>
        </div>
        <div class="stat-bar-wrap">
          <div class="stat-bar ${barClass}" style="width:${barWidth}%"></div>
          ${!isSending ? '<div class="stat-marker" style="left:100%"></div>' : ''}
        </div>
      </div>`;
    }).join('') + '</div>';
  }

  async function load() {
    const container    = document.getElementById('stats-container');
    const updateTimeEl = document.getElementById('stats-update-time');
    if (!container) return;

    try {
      const data = await ESH.API.get({ action: 'getStats' });
      const inds  = window._ESH_INDUSTRIES || [];
      const stats = (data.success && Array.isArray(data.stats)) ? data.stats : [];
      const merged = inds.map(ind => {
        const name  = ind.name || ind;
        const found = stats.find(s => s.industry === name || s.name === name);
        return { name, count: found ? (found.count || 0) : 0, status: ind.status || '신청중' };
      });
      _render(merged);
      const now = new Date();
      if (updateTimeEl) updateTimeEl.textContent = String(now.getHours()).padStart(2,'0') + ':' + String(now.getMinutes()).padStart(2,'0') + ' 업데이트';
    } catch {
      const inds = window._ESH_INDUSTRIES || [];
      _render(inds.map(ind => ({ name: ind.name || ind, count: 0, status: ind.status || '신청중' })));
      if (updateTimeEl) updateTimeEl.textContent = '업데이트 대기 중';
    }
  }

  function init() {
    if (!document.getElementById('stats-container')) return;
    setTimeout(load, 900);
    setInterval(load, 5 * 60 * 1000);
  }

  return { init, load };
})();


/* ══════════════════════════════════════════════
   8. 스크롤 리빌
══════════════════════════════════════════════ */
ESH.Reveal = (function () {
  function init(selector = '.reveal', cls = 'on') {
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e, i) => {
        if (e.isIntersecting) {
          setTimeout(() => e.target.classList.add(cls), i * 55);
          io.unobserve(e.target);
        }
      });
    }, { threshold: 0.08, rootMargin: '0px 0px -24px 0px' });
    document.querySelectorAll(selector).forEach(el => io.observe(el));
  }
  return { init };
})();


/* ══════════════════════════════════════════════
   9. 토스트 알림 유틸
══════════════════════════════════════════════ */
ESH.Toast = (function () {
  let _el;
  function _ensure() {
    if (_el) return;
    _el = document.createElement('div');
    _el.className = 'toast';
    document.body.appendChild(_el);
  }
  function show(msg, type = '', duration = 3000) {
    _ensure();
    _el.textContent = msg;
    _el.className   = 'toast' + (type ? ' ' + type : '');
    void _el.offsetWidth;
    _el.classList.add('show');
    setTimeout(() => _el.classList.remove('show'), duration);
  }
  return { show };
})();


/* ══════════════════════════════════════════════
   10. 네이버 애널리틱스
══════════════════════════════════════════════ */
ESH.Analytics = (function () {
  function init() {
    if (typeof wcs_add === 'undefined') return;
    wcs_add['wa'] = '13a68914808cdb';
    if (window.wcs) wcs_do();
  }
  return { init };
})();


/* ══════════════════════════════════════════════
   11. 페이지 초기화 헬퍼
══════════════════════════════════════════════ */
ESH.init = async function (pageModules = []) {
  // 1) config 로드 (GAS → 전 페이지 적용)
  await ESH.Config.load();

  // 2) 공통 모듈 초기화
  ESH.Modal.init();
  ESH.Ticker.init();
  ESH.Reveal.init();

  // 3) 페이지별 모듈 초기화
  pageModules.forEach(mod => typeof mod === 'function' && mod());

  // 4) 애널리틱스
  ESH.Analytics.init();
};

window.ESH = ESH;
