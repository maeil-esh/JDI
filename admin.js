/**
 * ESH-MASTER · admin.js
 * ────────────────────────────────────────────────────────
 * 관리자 패널 전용 로직
 * admin.html에서만 로드
 * ────────────────────────────────────────────────────────
 */

ESH.Admin = (function () {

  /* ── 잠금 설정 ──────────────────────────────────────── */
  const LOCK_KEY    = '_adm_lock';
  const ATTEMPT_KEY = '_adm_try';
  const MAX_TRY     = 3;           // ISMS 권고: 5회 → 보수적으로 3회
  const LOCK_MS     = 30 * 60 * 1000;

  function _getLockRemain()   { return Math.max(0, parseInt(localStorage.getItem(LOCK_KEY) || '0') - Date.now()); }
  function _setLocked()       { localStorage.setItem(LOCK_KEY, Date.now() + LOCK_MS); localStorage.setItem(ATTEMPT_KEY, '0'); }
  function _getAttempts()     { return parseInt(localStorage.getItem(ATTEMPT_KEY) || '0'); }
  function _addAttempt()      { const n = _getAttempts() + 1; localStorage.setItem(ATTEMPT_KEY, String(n)); return n; }
  function _resetAttempts()   { localStorage.removeItem(LOCK_KEY); localStorage.removeItem(ATTEMPT_KEY); }
  function _fmtRemain(ms)     { return Math.ceil(ms / 60000) + '분 후 다시 시도하세요.'; }

  /* ── 로그인 ─────────────────────────────────────────── */
  async function login() {
    const remain = _getLockRemain();
    const errEl  = document.getElementById('adm-login-err');
    const btn    = document.getElementById('adm-pw-btn');
    const input  = document.getElementById('adm-pw-input');
    if (remain > 0) { errEl.textContent = '⛔ 잠금 중 — ' + _fmtRemain(remain); return; }

    const pw = input.value;
    if (!pw) return;
    btn.disabled = true;
    btn.textContent = '확인 중...';
    errEl.textContent = '';

    // 접근 시도 로그 (보안 감사)
    ESH.Security.logAccess('admin_login_attempt', {});

    try {
      const data = await ESH.API.post({ action: 'adminLogin', pw });
      if (data.success) {
        _resetAttempts();
        ESH.Security.logAccess('admin_login_success', {});
        document.getElementById('adm-login').style.display = 'none';
        _fillForm();
      } else {
        const tries = _addAttempt();
        const left  = MAX_TRY - tries;
        input.value = '';
        if (tries >= MAX_TRY) {
          _setLocked();
          ESH.Security.logAccess('admin_locked', { attempts: tries });
          errEl.textContent = `⛔ ${MAX_TRY}회 실패 — 30분간 접근이 제한됩니다.`;
          input.disabled = btn.disabled = true;
        } else {
          errEl.textContent = `비밀번호가 올바르지 않습니다. (남은 시도: ${left}회)`;
          input.focus();
        }
      }
    } catch {
      errEl.textContent = '서버 연결 오류. 잠시 후 다시 시도해 주세요.';
    } finally {
      if (!input.disabled) { btn.disabled = false; btn.textContent = '로그인'; }
    }
  }

  /* ── 잠금 상태 체크 (열릴 때) ───────────────────────── */
  function _checkLockOnOpen() {
    const errEl = document.getElementById('adm-login-err');
    const btn   = document.getElementById('adm-pw-btn');
    const input = document.getElementById('adm-pw-input');
    const remain = _getLockRemain();
    if (remain > 0) {
      errEl.textContent = '⛔ 잠금 중 — ' + _fmtRemain(remain);
      btn.disabled = input.disabled = true;
      const timer = setInterval(() => {
        const r = _getLockRemain();
        if (r <= 0) { clearInterval(timer); errEl.textContent = ''; btn.disabled = input.disabled = false; }
        else errEl.textContent = '⛔ 잠금 중 — ' + _fmtRemain(r);
      }, 15000);
    }
  }

  /* ── 폼 채우기 ──────────────────────────────────────── */
  function _fillForm() {
    const cfg = window._ESH_CFG || {};

    const _g = id => document.getElementById(id);
    if (_g('adm-brand-name'))    _g('adm-brand-name').value    = cfg.brand_name || '';
    if (_g('adm-brand-sub'))     _g('adm-brand-sub').value     = cfg.brand_sub  || '';
    if (_g('adm-favicon'))       _g('adm-favicon').value       = cfg.favicon    || '';
    if (_g('adm-og-image'))      _g('adm-og-image').value      = cfg.og_image   || '';
    if (_g('adm-badge'))         _g('adm-badge').value         = cfg.badge      || '';
    if (_g('adm-h1-1'))          _g('adm-h1-1').value          = cfg.h1_1       || '';
    if (_g('adm-h1-2'))          _g('adm-h1-2').value          = cfg.h1_2       || '';
    if (_g('adm-lead'))          _g('adm-lead').value          = cfg.lead       || '';
    if (_g('adm-contact-h2'))    _g('adm-contact-h2').value    = cfg.contact_h2    || '';
    if (_g('adm-contact-email')) _g('adm-contact-email').value = cfg.contact_email || '';
    if (_g('adm-contact-note'))  _g('adm-contact-note').value  = cfg.contact_note  || '';

    _renderCreds(cfg.creds || []);
    _renderServices(cfg.services || []);
    _renderIndustryList(cfg.industries || []);
    _renderAgencyList(cfg.agencies || []);
    _renderAgencyOrderList(cfg.agencyOrder || []);
    _updateFaviconPreview(cfg.favicon || '');
    _updateOgPreview(cfg.og_image || '');
  }

  /* ── 신뢰 지표 렌더 ────────────────────────────────── */
  function _renderCreds(creds) {
    const wrap = document.getElementById('adm-creds-list');
    if (!wrap) return;
    const labels = ['① 첫 번째','② 두 번째','③ 세 번째','④ 네 번째'];
    wrap.innerHTML = creds.map((c, i) => `
      <div class="adm-card">
        <div class="adm-card-label">${labels[i] || ''}</div>
        <div class="adm-grid">
          <div class="adm-field"><label>수치 (HTML 가능)</label><input type="text" data-cred-n="${i}" value="${_esc(c.n)}"></div>
          <div class="adm-field"><label>레이블</label><input type="text" data-cred-l="${i}" value="${_esc(c.l)}"></div>
        </div>
      </div>`).join('');
  }

  /* ── 서비스 카드 렌더 ──────────────────────────────── */
  function _renderServices(services) {
    const wrap = document.getElementById('adm-services-list');
    if (!wrap) return;
    const labels = ['01 · Safety Do It','02 · JSA 위험성평가','03 · AI 뉴스레터','04 · 안전보건정보','05 · 전문기관 찾기'];
    wrap.innerHTML = services.map((s, i) => {
      const isLive = (s.status || '준비중') === '운영중';
      return `<div class="adm-card">
        <div class="adm-card-label">${labels[i] || ''}</div>
        <div class="adm-grid adm-grid-1" style="gap:10px">
          <div class="adm-field"><label>제목</label><input type="text" data-svc-t="${i}" value="${_esc(s.title)}"></div>
          <div class="adm-field"><label>설명 (\\n 줄바꿈)</label><input type="text" data-svc-d="${i}" value="${_esc(s.desc)}"></div>
          <div class="adm-field">
            <label>운영 상태</label>
            <div style="display:flex;gap:8px;margin-top:2px">
              <button type="button" id="svc-sts-ready-${i}" onclick="ESH.Admin.setSvcStatus(${i},'준비중')"
                style="flex:1;padding:8px;border-radius:8px;font-size:13px;font-weight:700;cursor:pointer;transition:all .2s;
                       border:1.5px solid ${!isLive?'#F59E0B':'rgba(255,255,255,.1)'};
                       background:${!isLive?'rgba(245,158,11,.2)':'rgba(255,255,255,.04)'};
                       color:${!isLive?'#F59E0B':'rgba(255,255,255,.3)'}">준비중</button>
              <button type="button" id="svc-sts-live-${i}" onclick="ESH.Admin.setSvcStatus(${i},'운영중')"
                style="flex:1;padding:8px;border-radius:8px;font-size:13px;font-weight:700;cursor:pointer;transition:all .2s;
                       border:1.5px solid ${isLive?'#16A34A':'rgba(255,255,255,.1)'};
                       background:${isLive?'rgba(22,163,74,.2)':'rgba(255,255,255,.04)'};
                       color:${isLive?'#4ADE80':'rgba(255,255,255,.3)'}">운영중</button>
            </div>
            <input type="hidden" data-svc-s="${i}" value="${_esc(s.status||'준비중')}">
          </div>
        </div>
      </div>`;
    }).join('');
  }

  /* ── 업종 목록 렌더 ────────────────────────────────── */
  const STATUS_COLORS = { '신청중':'#94A3B8','발송준비':'#14B8A6','발송중':'#1E6BD8' };

  function _renderIndustryList(industries) {
    const ul = document.getElementById('adm-industry-list');
    if (!ul) return;
    ul.innerHTML = industries.map((ind, i) => {
      const name   = ind.name || ind;
      const status = ind.status || '신청중';
      return `<li class="adm-industry-item">
        <span class="drag-handle">⠿</span>
        <input type="text" value="${_esc(name)}" data-ind-name="${i}" style="flex:1">
        <select data-ind-status="${i}" style="background:#131F30;border:1.5px solid rgba(255,255,255,.15);border-radius:7px;padding:6px 10px;font-size:12px;font-weight:700;color:${STATUS_COLORS[status]};cursor:pointer;outline:none">
          ${['신청중','발송준비','발송중'].map(s => `<option value="${s}" ${s===status?'selected':''}>${s}</option>`).join('')}
        </select>
        <button class="del-btn" onclick="this.closest('li').remove()" title="삭제">✕</button>
      </li>`;
    }).join('');
    ul.querySelectorAll('[data-ind-status]').forEach(sel => {
      sel.addEventListener('change', () => { sel.style.color = STATUS_COLORS[sel.value] || '#94A3B8'; });
    });
  }

  /* ── 관공서 링크 렌더 ──────────────────────────────── */
  function _renderAgencyList(agencies) {
    const ul = document.getElementById('adm-agency-list');
    if (!ul) return;
    ul.innerHTML = agencies.map((ag, i) => {
      const domain = ag.favicon || (ag.url ? ag.url.replace(/https?:\/\/www\./, '').split('/')[0] : '');
      return `<li class="adm-industry-item" style="gap:6px;padding:6px 8px">
        <img src="https://www.google.com/s2/favicons?domain=${domain}&sz=24" width="16" height="16" style="border-radius:3px;flex-shrink:0" onerror="this.style.display='none'">
        <input type="text" value="${_esc(ag.name)}" data-ag-name="${i}" style="flex:1;min-width:70px" placeholder="기관명">
        <input type="text" value="${_esc(ag.url)}" data-ag-url="${i}" style="flex:2" placeholder="https://...">
        <button class="del-btn" onclick="this.closest('li').remove()" title="삭제">✕</button>
      </li>`;
    }).join('');
  }

  /* ── 기관분야 순번 렌더 ────────────────────────────── */
  const AGENCY_LABELS = {
    '건설재해예방':'🏗️ 건설재해예방전문지도기관','안전관리':'🛡️ 안전관리전문기관',
    '보건관리':'🩺 보건관리전문기관','특수건강진단':'🏥 특수건강진단기관',
    '자율안전검사':'🔍 자율안전검사기관','석면조사':'🔬 석면조사기관',
    '작업환경측정':'📊 작업환경측정기관','안전보건진단':'📋 안전보건진단기관',
  };

  function _renderAgencyOrderList(order) {
    const ul = document.getElementById('adm-agency-order-list');
    if (!ul) return;
    ul.innerHTML = order.map((key, i) => `
      <li class="adm-industry-item" data-key="${key}">
        <span style="width:20px;text-align:center;font-size:12px;font-weight:700;color:rgba(255,255,255,.3)">${i+1}</span>
        <span style="flex:1;font-size:13px;font-weight:600;color:#fff">${AGENCY_LABELS[key] || key}</span>
        <div style="display:flex;flex-direction:column;gap:2px">
          <button onclick="ESH.Admin.moveAgencyOrder(${i},-1)" style="background:rgba(255,255,255,.1);border:none;border-radius:3px;width:24px;height:20px;cursor:pointer;color:#fff;font-size:10px" ${i===0?'disabled':''}>▲</button>
          <button onclick="ESH.Admin.moveAgencyOrder(${i},1)"  style="background:rgba(255,255,255,.1);border:none;border-radius:3px;width:24px;height:20px;cursor:pointer;color:#fff;font-size:10px" ${i===order.length-1?'disabled':''}>▼</button>
        </div>
      </li>`).join('');
  }

  function moveAgencyOrder(idx, dir) {
    const cfg = window._ESH_CFG || {};
    const order = cfg.agencyOrder || [];
    const newIdx = idx + dir;
    if (newIdx < 0 || newIdx >= order.length) return;
    [order[idx], order[newIdx]] = [order[newIdx], order[idx]];
    cfg.agencyOrder = order;
    _renderAgencyOrderList(order);
  }

  /* ── 서비스 상태 토글 ──────────────────────────────── */
  function setSvcStatus(idx, status) {
    const cfg = window._ESH_CFG || {};
    if (cfg.services) cfg.services[idx].status = status;
    const isLive = status === '운영중';
    const rBtn = document.getElementById('svc-sts-ready-' + idx);
    const lBtn = document.getElementById('svc-sts-live-'  + idx);
    if (rBtn) { rBtn.style.border = '1.5px solid ' + (!isLive?'#F59E0B':'rgba(255,255,255,.1)'); rBtn.style.background = !isLive?'rgba(245,158,11,.2)':'rgba(255,255,255,.04)'; rBtn.style.color = !isLive?'#F59E0B':'rgba(255,255,255,.3)'; }
    if (lBtn) { lBtn.style.border = '1.5px solid ' + (isLive?'#16A34A':'rgba(255,255,255,.1)');  lBtn.style.background = isLive?'rgba(22,163,74,.2)':'rgba(255,255,255,.04)';  lBtn.style.color = isLive?'#4ADE80':'rgba(255,255,255,.3)'; }
    const hidden = document.querySelector(`[data-svc-s="${idx}"]`);
    if (hidden) hidden.value = status;
  }

  /* ── 파비콘 미리보기 ────────────────────────────────── */
  const DEFAULT_FAVICON = "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'><rect width='32' height='32' rx='7' fill='%230A2540'/><text x='50%25' y='52%25' dominant-baseline='middle' text-anchor='middle' font-family='Arial Black,Arial' font-weight='900' font-size='13' fill='white'>EM</text><circle cx='25' cy='25' r='4.5' fill='%2314B8A6'/></svg>";

  function _updateFaviconPreview(url) {
    const img = document.getElementById('adm-favicon-preview');
    const ph  = document.getElementById('adm-favicon-placeholder');
    if (!img || !ph) return;
    img.src = url || DEFAULT_FAVICON;
    img.style.display = 'block';
    ph.style.display  = 'none';
    img.onerror = () => { img.style.display = 'none'; ph.style.display = 'block'; };
  }

  function previewFavicon() {
    const url = (document.getElementById('adm-favicon')?.value || '').trim();
    _updateFaviconPreview(url);
  }

  function resetFavicon() {
    const inp = document.getElementById('adm-favicon');
    if (inp) inp.value = '';
    _updateFaviconPreview('');
  }

  function _updateOgPreview(url) {
    const img = document.getElementById('adm-og-preview');
    const ph  = document.getElementById('adm-og-placeholder');
    if (!img || !ph) return;
    if (url) { img.src = url; img.style.display = 'block'; ph.style.display = 'none'; img.onerror = () => { img.style.display = 'none'; ph.style.display = 'block'; }; }
    else     { img.style.display = 'none'; ph.style.display = 'block'; }
  }

  function previewOgImage() {
    _updateOgPreview((document.getElementById('adm-og-image')?.value || '').trim());
  }

  /* ── 폼 데이터 수집 ─────────────────────────────────── */
  function _collectForm() {
    const cfg = window._ESH_CFG || {};
    const _g  = id => document.getElementById(id)?.value || '';

    cfg.brand_name     = _g('adm-brand-name')    || cfg.brand_name;
    cfg.brand_sub      = _g('adm-brand-sub')     || cfg.brand_sub;
    cfg.favicon        = _g('adm-favicon');
    cfg.og_image       = _g('adm-og-image')      || cfg.og_image;
    cfg.badge          = _g('adm-badge')          || cfg.badge;
    cfg.h1_1           = _g('adm-h1-1')           || cfg.h1_1;
    cfg.h1_2           = _g('adm-h1-2')           || cfg.h1_2;
    cfg.lead           = _g('adm-lead')           || cfg.lead;
    cfg.contact_h2     = _g('adm-contact-h2')     || cfg.contact_h2;
    cfg.contact_email  = _g('adm-contact-email')  || cfg.contact_email;
    cfg.contact_note   = _g('adm-contact-note')   || cfg.contact_note;

    document.querySelectorAll('[data-cred-n]').forEach(el => { if (cfg.creds) cfg.creds[+el.dataset.credN].n = el.value; });
    document.querySelectorAll('[data-cred-l]').forEach(el => { if (cfg.creds) cfg.creds[+el.dataset.credL].l = el.value; });
    document.querySelectorAll('[data-svc-t]').forEach(el => { if (cfg.services) cfg.services[+el.dataset.svcT].title = el.value; });
    document.querySelectorAll('[data-svc-d]').forEach(el => { if (cfg.services) cfg.services[+el.dataset.svcD].desc  = el.value; });
    document.querySelectorAll('[data-svc-s]').forEach(el => { if (cfg.services) cfg.services[+el.dataset.svcS].status = el.value; });

    cfg.industries = Array.from(document.querySelectorAll('#adm-industry-list li')).map(li => ({
      name:   (li.querySelector('[data-ind-name]')?.value   || '').trim(),
      status: li.querySelector('[data-ind-status]')?.value || '신청중',
    })).filter(i => i.name);

    cfg.agencyOrder = Array.from(document.querySelectorAll('#adm-agency-order-list li')).map(li => li.dataset.key).filter(Boolean);

    cfg.agencies = Array.from(document.querySelectorAll('#adm-agency-list li')).map(li => {
      const name = (li.querySelector('[data-ag-name]')?.value || '').trim();
      const url  = (li.querySelector('[data-ag-url]')?.value  || '').trim();
      const domain = url.replace(/https?:\/\/www\./, '').split('/')[0];
      return { name, url, favicon: domain };
    }).filter(a => a.name && a.url);

    window._ESH_CFG = cfg;
    return cfg;
  }

  /* ── 저장 ───────────────────────────────────────────── */
  async function save() {
    const cfg  = _collectForm();
    const btn  = document.getElementById('adm-save-btn');
    btn.disabled = true;
    btn.textContent = '⏳ 저장 중...';
    ESH.Security.logAccess('admin_save', {});

    try {
      const data = await ESH.API.post({ action: 'saveConfig', config: cfg });
      _showSaveMsg(data.success ? '✓ 저장 완료' : '⚠ 저장 실패');
      if (data.success) ESH.Config.apply();
    } catch {
      _showSaveMsg('⚠ 연결 오류');
    } finally {
      btn.disabled = false;
      btn.textContent = '💾 저장';
    }
  }

  function _showSaveMsg(txt) {
    const el = document.getElementById('adm-save-msg');
    if (!el) return;
    el.textContent = txt;
    el.classList.add('show');
    setTimeout(() => el.classList.remove('show'), 3000);
  }

  /* ── 비밀번호 변경 ──────────────────────────────────── */
  async function changePassword() {
    const cur  = document.getElementById('adm-pw-cur')?.value;
    const nw   = document.getElementById('adm-pw-new')?.value;
    const nw2  = document.getElementById('adm-pw-new2')?.value;
    const msg  = document.getElementById('adm-pw-msg');
    const btn  = document.getElementById('adm-pw-change-btn');

    if (!cur || !nw || !nw2)    { msg.style.color='#FCA5A5'; msg.textContent='모든 항목을 입력해 주세요.'; return; }
    if (nw.length < 6)          { msg.style.color='#FCA5A5'; msg.textContent='새 비밀번호는 6자 이상이어야 합니다.'; return; }
    if (nw !== nw2)             { msg.style.color='#FCA5A5'; msg.textContent='새 비밀번호가 일치하지 않습니다.'; return; }
    btn.disabled = true; btn.textContent = '변경 중...'; msg.textContent = '';

    try {
      const data = await ESH.API.post({ action: 'changePassword', currentPw: cur, newPw: nw });
      if (data.success) {
        msg.style.color = '#4ADE80';
        msg.textContent = '✓ 비밀번호가 변경됐습니다.';
        ['adm-pw-cur','adm-pw-new','adm-pw-new2'].forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });
      } else {
        msg.style.color = '#FCA5A5'; msg.textContent = data.message || '변경에 실패했습니다.';
      }
    } catch {
      msg.style.color = '#FCA5A5'; msg.textContent = '서버 연결 오류.';
    } finally {
      btn.disabled = false; btn.textContent = '비밀번호 변경';
    }
  }

  /* ── 탭 내비게이션 ──────────────────────────────────── */
  function _initNavTabs() {
    document.querySelectorAll('.adm-nav-item').forEach(item => {
      item.addEventListener('click', () => {
        document.querySelectorAll('.adm-nav-item').forEach(n => n.classList.remove('active'));
        document.querySelectorAll('.adm-section').forEach(s => s.classList.remove('active'));
        item.classList.add('active');
        document.getElementById('adm-sec-' + item.dataset.section)?.classList.add('active');
      });
    });
  }

  /* ── 업종 추가 ──────────────────────────────────────── */
  function addIndustry() {
    const cfg = window._ESH_CFG || {};
    if (!cfg.industries) cfg.industries = [];
    cfg.industries.push({ name: '새 업종', status: '신청중' });
    _renderIndustryList(cfg.industries);
    const inputs = document.querySelectorAll('#adm-industry-list input');
    const last = inputs[inputs.length - 1];
    if (last) { last.focus(); last.select(); }
  }

  /* ── 관공서 추가 ────────────────────────────────────── */
  function addAgency() {
    const cfg = window._ESH_CFG || {};
    if (!cfg.agencies) cfg.agencies = [];
    cfg.agencies.push({ name: '새 기관', url: 'https://', favicon: '' });
    _renderAgencyList(cfg.agencies);
    const inputs = document.querySelectorAll('#adm-agency-list [data-ag-name]');
    const last = inputs[inputs.length - 1];
    if (last) { last.focus(); last.select(); }
  }

  /* ── 입력값 이스케이프 ──────────────────────────────── */
  function _esc(s) { return (s || '').replace(/"/g, '&quot;'); }

  /* ── 실시간 미리보기 리스너 ─────────────────────────── */
  function _initPreviewListeners() {
    document.addEventListener('input', e => {
      if (e.target.id === 'adm-favicon')  _updateFaviconPreview(e.target.value.trim());
      if (e.target.id === 'adm-og-image') _updateOgPreview(e.target.value.trim());
    });
  }

  /* ══════════════════════════════════════════════
     초기화
  ══════════════════════════════════════════════ */
  async function init() {
    // URL 파라미터로 패널 진입
    const overlay = document.getElementById('adm-overlay');
    if (!overlay) return;
    overlay.classList.add('open');
    _checkLockOnOpen();

    // 로그인
    document.getElementById('adm-pw-btn')?.addEventListener('click', login);
    document.getElementById('adm-pw-input')?.addEventListener('keydown', e => { if (e.key === 'Enter') login(); });

    // 닫기
    document.getElementById('adm-close-btn')?.addEventListener('click', () => {
      window.location.href = 'index.html';
    });

    // 저장
    document.getElementById('adm-save-btn')?.addEventListener('click', save);

    // 비밀번호 변경
    document.getElementById('adm-pw-change-btn')?.addEventListener('click', changePassword);

    // 탭 내비
    _initNavTabs();

    // 미리보기 리스너
    _initPreviewListeners();

    // 추가 버튼
    document.getElementById('adm-add-industry')?.addEventListener('click', addIndustry);
    document.getElementById('adm-add-agency')?.addEventListener('click', addAgency);

    // 전역으로 노출 (HTML 인라인 onclick에서 호출)
    window.ESH = window.ESH || {};
    window.ESH.Admin = module;
  }

  const module = {
    init,
    save,
    login,
    setSvcStatus,
    moveAgencyOrder,
    previewFavicon,
    resetFavicon,
    previewOgImage,
  };

  return module;
})();
