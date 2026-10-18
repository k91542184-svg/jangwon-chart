/* 장원 차트: 앱에서 관심 폴더에 넣은 종목을 GitHub의 config.json에 자동 등록 */
(() => {
  const J = () => window.JWC;
  if (!J()) return;
  const LSg = (k, d) => { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch(e){ return d; } };
  const LSs = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch(e){} };
  const esc = s => String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const $ = s => document.querySelector(s);
  const hm = location.hostname.match(/^([^.]+)\.github\.io$/i), seg = location.pathname.split('/').filter(Boolean)[0];
  const owner = (window.JWC_GH && window.JWC_GH.owner) || (hm && hm[1]), repo = (window.JWC_GH && window.JWC_GH.repo) || seg;
  const token = () => LSg('jwc2.ghtoken', '');
  const toast = t => J().toast(t);
  const b64dec = s => new TextDecoder().decode(Uint8Array.from(atob(s.replace(/\s/g, '')), c => c.charCodeAt(0)));
  const b64enc = s => { let bin = ''; new TextEncoder().encode(s).forEach(x => { bin += String.fromCharCode(x); }); return btoa(bin); };
  async function api(path, opt = {}, tok){
    let r, j = null;
    try {
      r = await fetch(`https://api.github.com/repos/${owner}/${repo}${path}`, {...opt, cache:'no-store', headers:{
        'Accept':'application/vnd.github+json', 'Authorization':`Bearer ${tok || token()}`, 'X-GitHub-Api-Version':'2022-11-28', ...(opt.body ? {'Content-Type':'application/json'} : {})}});
    } catch(_){ throw {status:0, msg:'인터넷 연결을 확인하세요'}; }
    try { j = await r.json(); } catch(_){}
    if (!r.ok) throw {status:r.status, msg:(j && j.message) || ('HTTP ' + r.status)};
    return j;
  }
  const errText = e => e.status === 401 ? '토큰이 맞지 않거나 만료되었습니다' : e.status === 403 || e.status === 404 ? '토큰에 이 저장소(jangwon-chart)의 Contents 쓰기 권한이 없습니다' : e.msg;

  /* ---------- 앱 폴더 ↔ config.json ---------- */
  const appFolders = () => J().folders.map(f => ({name:f.name, symbols:f.syms.filter(s => !s.startsWith('DEMO'))})).filter(f => f.symbols.length);
  const norm = fs => JSON.stringify((fs || []).map(f => [f.name, [...(f.symbols || [])].map(s => String(s).toUpperCase()).sort()]).sort((a, b) => a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0));
  const allSyms = fs => new Set((fs || []).flatMap(f => (f.symbols || []).map(s => String(s).toUpperCase())));
  const serverSyms = () => new Set(Object.keys(((J().srv || {}).meta || {}).symbols || {}));
  const serverErr = s => (((J().srv || {}).meta || {}).errors || {})[s];
  function missing(){ const have = serverSyms(), out = new Set(); J().folders.forEach(f => f.syms.forEach(s => { if (!s.startsWith('DEMO') && !have.has(s)) out.add(s); })); return [...out]; }
  let lastSig = null, busy = false, timer = 0, poll = 0, again = false;
  async function push(quiet){
    if (!owner || !token() || !J().srv.on) return;
    if (busy){ again = true; return; }
    busy = true; setState('서버에 등록 중…');
    try {
      for (let attempt = 0; attempt < 2; attempt++){
        const f = await api('/contents/config.json');
        const cfg = JSON.parse(b64dec(f.content)), mine = appFolders();
        if (norm(cfg.folders) === norm(mine)){ lastSig = norm(mine); break; }
        const before = allSyms(cfg.folders), after = allSyms(mine);
        const add = [...after].filter(s => !before.has(s)), del = [...before].filter(s => !after.has(s));
        const note = [add.length ? '+' + add.join(', +') : '', del.length ? '−' + del.join(', −') : ''].filter(Boolean).join(' ') || '폴더 구성';
        cfg.folders = mine;
        try {
          await api('/contents/config.json', {method:'PUT', body:JSON.stringify({message:`관심 종목 갱신: ${note}`, content:b64enc(JSON.stringify(cfg, null, 2) + '\n'), sha:f.sha})});
        } catch(e){ if ((e.status === 409 || e.status === 422) && attempt === 0) continue; throw e; }
        lastSig = norm(mine); LSs('jwc2.cfgSig', JSON.stringify(mine));
        if (!quiet || add.length) toast(add.length ? `${add.join(', ')} 서버에 등록했습니다. 2~5분 뒤 차트 데이터가 자동으로 들어옵니다.` : `서버 목록을 갱신했습니다 (${note}).`);
        if (add.length) fastPoll();
        break;
      }
    } catch(e){ toast(`서버 등록 실패: ${errText(e)}`); }
    busy = false; setState(); decorate();
    if (again){ again = false; push(true); }
  }
  function fastPoll(){
    clearInterval(poll); let n = 0;
    poll = setInterval(async () => {
      n++; await J().srvSync(false); decorate();
      if (!missing().filter(s => !serverErr(s)).length || n > 16){ clearInterval(poll); poll = 0; decorate(); }
    }, 40000);
  }
  setInterval(() => {
    if (!owner || !token() || !J().srv.on) return;
    const sig = norm(appFolders());
    if (lastSig === null) return;
    if (sig !== lastSig){ lastSig = sig; clearTimeout(timer); timer = setTimeout(() => push(false), 2000); }
  }, 1200);

  /* ---------- 여러 종목 한 번에 추가 ---------- */
  function addMany(raw, folder){
    const f = folder || J().curFolder();
    const list = String(raw).toUpperCase().split(/[\s,;/]+/).map(s => s.trim()).filter(Boolean);
    const bad = list.filter(s => !J().validSym(s)), ok = list.filter(s => J().validSym(s));
    const added = ok.filter(s => !f.syms.includes(s));
    added.forEach(s => f.syms.push(s));
    if (added.length){ J().saveFolders(); J().renderFolders(); J().renderList(); J().renderQuote(); }
    const parts = [];
    if (added.length) parts.push(`‘${f.name}’에 ${added.join(', ')} 추가`);
    if (ok.length > added.length) parts.push(`${ok.filter(s => !added.includes(s)).join(', ')}은(는) 이미 있음`);
    if (bad.length) parts.push(`${bad.join(', ')}은(는) 코드 형식이 아님`);
    if (added.length && !token() && J().srv.on) parts.push('자동으로 데이터를 받으려면 ‘GitHub 연결’을 한 번 해 두세요');
    if (parts.length) toast(parts.join('. ') + '.');
    if (added.length && !token() && J().srv.on && !LSg('jwc2.ghHinted', false)){ LSs('jwc2.ghHinted', true); setTimeout(() => openConnect(), 600); }
    return added;
  }
  const inp = $('#addSym'), btn = $('#addBtn');
  if (inp && btn){
    inp.placeholder = '종목 추가 (예: AAPL, MSFT)'; inp.maxLength = 200;
    const go = e => { e.preventDefault(); e.stopImmediatePropagation(); if (inp.value.trim()){ addMany(inp.value); inp.value = ''; } };
    btn.addEventListener('click', go, true);
    inp.addEventListener('keydown', e => { if (e.key === 'Enter') go(e); }, true);
  }

  /* ---------- 연결 화면 ---------- */
  const panel = $('#srvPanel');
  const sec = document.createElement('div');
  sec.innerHTML = `<div class="qh" style="margin-top:14px">GitHub 연결: 앱에서 종목을 넣으면 서버에 자동 등록</div>
    <p id="ghState" style="margin:2px 0 6px"></p>
    <div class="srow" id="ghForm"><input id="ghTok" type="password" autocomplete="off" placeholder="github_pat_ 로 시작하는 토큰" style="flex:1;min-width:180px;height:30px;border:1px solid var(--line);border-radius:6px;background:var(--panel2);padding:0 8px"><button class="btn primary" id="ghConnect">연결</button></div>
    <div class="srow" id="ghOn" hidden><button class="btn" id="ghSyncNow">지금 서버와 맞추기</button><button class="btn" id="ghOff">연결 해제</button></div>
    <details id="ghHow"><summary>토큰 만드는 법 (처음 한 번, 3분)</summary>
      <ol style="margin:6px 0;padding-left:20px;line-height:1.7;font-size:12.5px">
        <li><a href="https://github.com/settings/personal-access-tokens/new" target="_blank" rel="noopener">GitHub 토큰 만들기 화면</a>을 엽니다.</li>
        <li><b>Token name</b>: 장원 차트, <b>Expiration</b>: 1년(366 days) 등 원하는 기간</li>
        <li><b>Repository access</b>: <b>Only select repositories</b> → <b>${esc(repo || 'jangwon-chart')}</b> 선택</li>
        <li><b>Permissions</b> → Repository permissions → <b>Contents</b>를 <b>Read and write</b>로</li>
        <li>맨 아래 <b>Generate token</b> → 나온 토큰을 복사해 위 칸에 붙여넣고 <b>연결</b></li>
      </ol>
      <p style="font-size:12px">이 토큰은 이 저장소의 파일만 고칠 수 있고, 이 브라우저에만 저장됩니다. 다른 기기에서도 쓰려면 같은 토큰을 그 기기에서 한 번 넣으면 됩니다.</p>
    </details>`;
  if (panel) panel.insertBefore(sec, panel.querySelector('.qh'));
  function setState(busyText){
    const st = $('#ghState'); if (!st) return;
    const on = !!token();
    $('#ghForm').hidden = on; $('#ghOn').hidden = !on; $('#ghHow').open = !on && $('#ghHow').open;
    const miss = missing();
    st.innerHTML = busyText ? esc(busyText) : on
      ? `연결됨 (${esc(owner)}/${esc(repo)}). 관심 폴더에 종목을 넣거나 빼면 서버 목록이 자동으로 따라갑니다.${miss.length ? ` 데이터 기다리는 종목: <b>${miss.map(esc).join(', ')}</b>` : ''}`
      : '연결되어 있지 않습니다. 연결해 두면 앱에서 종목을 넣기만 하면 됩니다.';
  }
  function openConnect(){ J().openApi(); setTimeout(() => { setState(); const h = $('#ghHow'); if (h && !token()) h.open = true; const t = $('#ghTok'); if (t && !token()) t.focus(); sec.scrollIntoView({block:'nearest'}); }, 50); }
  $('#ghConnect') && $('#ghConnect').addEventListener('click', async () => {
    const t = $('#ghTok').value.trim(); if (!t){ toast('토큰을 붙여넣어 주세요.'); return; }
    setState('연결 확인 중…');
    try {
      const r = await api('', {}, t);
      if (!r.permissions || !r.permissions.push) throw {status:403};
      LSs('jwc2.ghtoken', t); $('#ghTok').value = ''; lastSig = null;
      toast('GitHub에 연결했습니다. 이제 앱에서 종목을 넣기만 하면 됩니다.');
      await push(true);
    } catch(e){ toast(`연결 실패: ${errText(e)}`); }
    setState();
  });
  $('#ghOff') && $('#ghOff').addEventListener('click', () => { LSs('jwc2.ghtoken', ''); lastSig = null; setState(); toast('연결을 해제했습니다. 토큰은 이 브라우저에서 지웠습니다.'); });
  $('#ghSyncNow') && $('#ghSyncNow').addEventListener('click', () => push(false));
  $('#srvBtn') && $('#srvBtn').addEventListener('click', () => setTimeout(setState, 30));

  /* ---------- 목록·빈 화면·검색에 상태와 추가 버튼 ---------- */
  const css = document.createElement('style');
  css.textContent = `.slist li{display:flex;align-items:center;gap:4px}.slist li>button[data-ss]{flex:1}.sadd{flex:none;height:30px;border:1px solid var(--line);border-radius:6px;background:var(--panel);color:var(--accent);font-size:12px;padding:0 8px}.wc.reg{color:var(--accent)!important}.wc.bad{color:#d33d43!important}`;
  document.head.appendChild(css);
  let decorating = false;
  function decorate(){
    if (decorating || !J().srv.on) return; decorating = true;
    const pending = new Set(missing());
    document.querySelectorAll('#list li[data-li]').forEach(li => {
      const s = li.dataset.li, wc = li.querySelector('.wc.none'); if (!wc || !pending.has(s)) return;
      const e = serverErr(s), text = e ? '코드 확인 필요' : token() ? '등록 중…' : '서버 미등록';
      if (wc.textContent !== text){ wc.textContent = text; wc.classList.toggle('bad', !!e); wc.classList.toggle('reg', !e && !!token()); wc.title = e || (token() ? '서버가 데이터를 받는 중입니다 (2~5분)' : '‘GitHub 연결’을 하면 자동으로 등록됩니다'); }
    });
    const em = $('#empty');
    if (em && !em.hidden && !em.querySelector('[data-gh]')){
      const s = (J().sym || '').toUpperCase(), inFolder = J().folders.some(f => f.syms.includes(s));
      if (s && !serverSyms().has(s) && !s.startsWith('DEMO')){
        const acts = em.querySelector('.acts'), p = em.querySelector('p');
        if (p) p.textContent = serverErr(s) ? `서버가 ${s} 데이터를 받지 못했습니다: ${serverErr(s)}` : inFolder ? (token() ? '서버에 등록했습니다. 2~5분 뒤 자동으로 나타납니다.' : '‘GitHub 연결’을 해 두면 관심 폴더에 넣은 종목이 자동으로 등록됩니다.') : '관심 폴더에 넣으면 서버에 등록되고 2~5분 뒤 차트가 나타납니다.';
        if (acts){
          acts.innerHTML = (inFolder ? '' : `<button class="btn primary" data-gh="add">‘${esc(J().curFolder().name)}’에 추가</button>`) + (token() ? '' : `<button class="btn" data-gh="conn">GitHub 연결</button>`) || `<span data-gh="x"></span>`;
        }
      }
    }
    decorating = false;
  }
  $('#empty') && $('#empty').addEventListener('click', e => {
    const b = e.target.closest('[data-gh]'); if (!b) return;
    if (b.dataset.gh === 'add'){ addMany(J().sym); $('#empty').innerHTML = ''; $('#empty').dataset.h = ''; }
    else if (b.dataset.gh === 'conn') openConnect();
  });
  const sl = $('#searchList');
  function decorateSearch(){
    if (!sl) return;
    const f = J().curFolder();
    sl.querySelectorAll('li').forEach(li => {
      const b = li.querySelector('button[data-ss]'); if (!b || li.querySelector('.sadd')) return;
      const s = b.dataset.ss; if (f.syms.includes(s)) return;
      const a = document.createElement('button'); a.className = 'sadd'; a.textContent = '＋ 추가'; a.title = `‘${f.name}’에 추가`;
      a.addEventListener('click', ev => { ev.stopPropagation(); addMany(s); a.remove(); });
      li.appendChild(a);
    });
  }
  new MutationObserver(() => decorate()).observe($('#list'), {childList:true});
  new MutationObserver(() => setTimeout(decorate, 0)).observe($('#empty'), {childList:true, attributes:true, attributeFilter:['hidden']});
  if (sl) new MutationObserver(decorateSearch).observe(sl, {childList:true});

  /* 빠르게 입력해도 검색창이 글자를 놓치지 않도록: 검색창이 열려 있는데 초점이 다른 곳이면 바로 옮김 */
  document.addEventListener('keydown', e => {
    const ov = $('#searchOv'), si = $('#searchIn');
    if (!ov || !si || !ov.classList.contains('open') || document.activeElement === si) return;
    if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey){ si.focus(); const n = si.value.length; si.setSelectionRange(n, n); }
  }, true);

  /* 시작: 서버 모드가 켜지면 한 번 맞춰 보고 감시 시작 */
  const start = setInterval(() => {
    if (!J().srv.on) return;
    clearInterval(start); setState(); decorate();
    if (token() && owner){ lastSig = norm(appFolders()); push(true); }
    else lastSig = norm(appFolders());
  }, 500);
  setTimeout(() => clearInterval(start), 30000);
})();
