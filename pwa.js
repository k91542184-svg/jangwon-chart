/* 장원 차트: 앱 설치(PWA) 지원 */
(() => {
  const head = document.head;
  const add = (tag, attrs) => { const e = document.createElement(tag); Object.entries(attrs).forEach(([k, v]) => e.setAttribute(k, v)); head.appendChild(e); };
  add('meta', {name:'theme-color', content:'#10141c'});
  add('meta', {name:'apple-mobile-web-app-capable', content:'yes'});
  add('meta', {name:'apple-mobile-web-app-title', content:'장원 차트'});
  add('link', {rel:'apple-touch-icon', href:'icon-192.png'});
  add('link', {rel:'icon', type:'image/png', href:'icon-192.png'});
  if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) navigator.serviceWorker.register('sw.js').catch(() => {});

  const installed = () => matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
  const ua = navigator.userAgent, ios = /iphone|ipad|ipod/i.test(ua) || (/macintosh/i.test(ua) && navigator.maxTouchPoints > 1);
  const safari = /safari/i.test(ua) && !/chrome|crios|edg|android|fxios/i.test(ua);
  let deferred = null;
  function button(){
    if (installed()) return null;
    let b = document.getElementById('installBtn'); if (b) return b;
    const bar = document.getElementById('indbar'); if (!bar) return null;
    b = document.createElement('button'); b.id = 'installBtn'; b.className = 'chip on'; b.textContent = '⬇ 앱 설치';
    b.title = '이 차트를 PC·휴대폰에 프로그램처럼 설치';
    bar.insertBefore(b, document.getElementById('saveBtn'));
    b.addEventListener('click', async () => {
      if (deferred){ deferred.prompt(); const r = await deferred.userChoice; deferred = null; if (r.outcome === 'accepted') b.remove(); }
      else guide();
    });
    return b;
  }
  function guide(){
    const how = ios ? '<li>Safari 아래쪽 <b>공유 버튼(네모에 위쪽 화살표)</b>을 누릅니다.</li><li><b>홈 화면에 추가</b>를 누릅니다.</li><li>오른쪽 위 <b>추가</b>를 누르면 홈 화면에 ‘장원 차트’ 아이콘이 생깁니다.</li>'
      : safari ? '<li>Safari 메뉴의 <b>파일 → Dock에 추가</b>를 누릅니다.</li>'
      : '<li>Chrome·Edge 주소창 오른쪽의 <b>설치 아이콘(모니터에 아래 화살표)</b>을 누릅니다.</li><li>보이지 않으면 오른쪽 위 <b>⋮ 메뉴 → 전송, 저장, 공유 → 페이지를 앱으로 설치</b> (Edge는 <b>… → 앱 → 이 사이트를 앱으로 설치</b>)를 누릅니다.</li>';
    const ov = document.createElement('div'); ov.className = 'ov open'; ov.setAttribute('role', 'dialog'); ov.setAttribute('aria-modal', 'true');
    ov.innerHTML = `<div class="dlg sm"><div class="head"><h3>앱으로 설치하기</h3><button class="x" aria-label="닫기">×</button></div>
      <ol style="margin:6px 0 4px;padding-left:20px;line-height:1.7">${how}</ol>
      <p>설치하면 바탕화면·홈 화면 아이콘으로 바로 열리고, 데이터는 지금처럼 자동으로 갱신됩니다.</p>
      <div class="actions"><button class="btn primary">확인</button></div></div>`;
    ov.addEventListener('click', e => { if (e.target === ov || e.target.closest('.x') || e.target.closest('.primary')) ov.remove(); });
    document.body.appendChild(ov);
  }
  window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); deferred = e; button(); });
  window.addEventListener('appinstalled', () => { const b = document.getElementById('installBtn'); if (b) b.remove(); });
  if (!installed() && (ios || safari)) button();
  /* 설치 이벤트가 오지 않는 브라우저(예: 이미 설치 안내를 닫은 경우)에서도 안내 버튼은 보여 줌 */
  setTimeout(() => { if (!installed() && !document.getElementById('installBtn')) button(); }, 4000);
})();
