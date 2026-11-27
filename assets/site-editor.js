/* Edytor strony salonu (mini CMS). Ładowany dopiero po kliknięciu „Strona www” w panelu.
   Układ jak w edytorze motywu Shopify: po lewej sekcje i wygląd, w środku podgląd na żywo (iframe ?podglad=1),
   po prawej ustawienia zaznaczonej sekcji. Układ podstron jest stały: salon zmienia teksty, zdjęcia, kolory,
   czcionki i może ukryć sekcje opcjonalne. Szkic zapisuje się sam, klient widzi stronę dopiero po „Opublikuj”.
   API: SiteEditor.open({live,draft,ctx,services,svc(id)->usługa,svcId,fon,slug,save,publish,upload,nav,onClose,sel,page}) */
(function(){
'use strict';
const esc=s=>String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const clone=o=>JSON.parse(JSON.stringify(o||{}));
const strip=h=>{const d=document.createElement('div');d.innerHTML=String(h||'');return d.textContent.trim()};
const I={
  back:'<path d="M15 18l-6-6 6-6"/>',x:'<path d="M6 6l12 12M18 6L6 18"/>',phone:'<rect x="7" y="2.5" width="10" height="19" rx="2.5"/><path d="M11 18.5h2"/>',desk:'<rect x="2.5" y="4" width="19" height="13" rx="2"/><path d="M8 21h8M12 17v4"/>',
  undo:'<path d="M9 14L4 9l5-5"/><path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11"/>',redo:'<path d="M15 14l5-5-5-5"/><path d="M20 9H9.5a5.5 5.5 0 0 0 0 11H13"/>',
  eye:'<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',eyeoff:'<path d="M3 3l18 18"/><path d="M10.6 5.1A10 10 0 0 1 12 5c6.5 0 10 7 10 7a17 17 0 0 1-3.2 4.2M6.6 6.6A17 17 0 0 0 2 12s3.5 7 10 7a9.7 9.7 0 0 0 5.4-1.6"/><path d="M9.9 9.9a3 3 0 0 0 4.2 4.2"/>',
  lock:'<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>',info:'<circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/>',
  up:'<path d="M18 15l-6-6-6 6"/>',down:'<path d="M6 9l6 6 6-6"/>',trash:'<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/>',plus:'<path d="M12 5v14M5 12h14"/>',
  ext:'<path d="M14 4h6v6M20 4l-9 9"/><path d="M19 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1h5"/>',check:'<path d="M5 12.5l4.5 4.5L19 7"/>',warn:'<path d="M12 3l10 18H2L12 3z"/><path d="M12 10v5M12 18h.01"/>',
  img:'<rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="9" cy="10" r="2"/><path d="M21 16l-5-5-9 9"/>',up2:'<path d="M12 16V4M7 9l5-5 5 5"/><path d="M4 16v3a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-3"/>',
  layers:'<path d="M12 3l9 5-9 5-9-5 9-5z"/><path d="M3 13l9 5 9-5"/>',palette:'<path d="M12 3a9 9 0 1 0 0 18c1.7 0 2-1.2 1.4-2.3-.7-1.2.1-2.7 1.6-2.7H17a4 4 0 0 0 4-4c0-5-4-9-9-9z"/><circle cx="7.5" cy="11" r="1.2"/><circle cx="10" cy="7" r="1.2"/><circle cx="15" cy="7.5" r="1.2"/>',
  gear:'<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-2.9 1.2V21a2 2 0 1 1-4 0v-.1A1.7 1.7 0 0 0 7 19.4l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1A1.7 1.7 0 0 0 3 13.6H3a2 2 0 1 1 0-4h.1A1.7 1.7 0 0 0 4.6 7l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9.3A1.7 1.7 0 0 0 10.4 3V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 2.9 1.2l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1h.1a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>',
  edit:'<path d="M4 20h4L19 9l-4-4L4 16v4z"/><path d="M13.5 6.5l4 4"/>',view:'<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 9h18"/>',reset:'<path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5"/>',copy:'<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V5a1 1 0 0 0-1-1H5a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h3"/>',
  block:'<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M7 10h10M7 14h6"/>'
};
const rk=ref=>JSON.stringify(Object.fromEntries(Object.entries(ref).map(([a,b])=>[a,String(b)])));
const refOf=d=>d.g?{g:'logo',k:'img'}:Object.assign({fi:d.fi},d.j!==undefined?{j:d.j,lk:d.lk}:{});
const ic=(k,s=18)=>`<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${I[k]||I.block}</svg>`;
const SEC_IC={'home.header':'view','home.hero':'img','home.gallery':'img','home.ba':'img','home.about':'img','home.reviews':'check','home.faq':'info','home.footer':'view','home.dock':'view','svc.top':'img'};

let O=null,E=null,root=null,frame=null,ready=false,saveT=0,postRaf=0,lastG='',lastT=0,toastT=0,ro=null;

/* ---------- schemat i wartości ---------- */
const pages=()=>CMS.schema(O.ctx()).filter(p=>!p.when||O.fon(p.when));
const page=()=>pages().find(p=>p.id===E.page)||pages()[0];
const secs=()=>page().sections.filter(s=>!s.when||O.fon(s.when));
const secD=id=>CMS.secDef(O.ctx(),id);
const isShared=f=>!!(f[4]&&f[4].shared);
const perStore=(sd,f)=>sd.per&&!isShared(f);
function perDef(f){const s=O.svc(E.svc);if(!s)return f[1]==='list'?[]:'';
  if(f[0]==='incl')return (s.incl||[]).map(t=>({t:strip(t)}));if(f[0]==='faq')return (s.faq||[]).map(x=>({q:strip(x[0]),a:strip(x[1])}));return ''}
function val(sd,f){
  if(perStore(sd,f)){const o=((E.draft.svc||{})[E.svc])||{};return o[f[0]]!==undefined?o[f[0]]:(f[1]==='list'?perDef(f):'')}
  const o=((E.draft.sec||{})[sd.id])||{};return o[f[0]]!==undefined?o[f[0]]:(Array.isArray(f[3])?clone(f[3]):f[3])}
const isOn=sd=>sd.fixed||(((E.draft.sec||{})[sd.id]||{}).on!==false);
function autoPh(sd,k){const s=O.svc(E.svc);if(!sd.per||!s)return '';return k==='title'?s.seo||s.name:k==='short'?strip(s.short):''}

/* ---------- historia i zapis ---------- */
function snap(g){const now=Date.now();if(g!==lastG||now-lastT>900){E.hist.push(JSON.stringify(E.draft));if(E.hist.length>80)E.hist.shift();E.fut=[]}lastG=g;lastT=now}
function setV(sd,f,v){snap(sd.id+'|'+f[0]);
  if(perStore(sd,f)){E.draft.svc=E.draft.svc||{};const o=E.draft.svc[E.svc]=E.draft.svc[E.svc]||{};if(v===undefined)delete o[f[0]];else o[f[0]]=v}
  else{E.draft.sec=E.draft.sec||{};const o=E.draft.sec[sd.id]=E.draft.sec[sd.id]||{};if(v===undefined)delete o[f[0]];else o[f[0]]=v}
  changed()}
function setG(grp,k,v,g){snap(grp+'|'+(g||k));E.draft[grp]=E.draft[grp]||{};if(v===undefined)delete E.draft[grp][k];else E.draft[grp][k]=v;changed()}
const dirty=()=>JSON.stringify(E.draft)!==JSON.stringify(E.live);
function changed(){post();E.st='saving';clearTimeout(saveT);saveT=setTimeout(async()=>{const ok=await O.save(clone(E.draft));E.st=ok?'saved':'err';top()},700);top()}
function undo(){if(!E.hist.length)return;E.fut.push(JSON.stringify(E.draft));E.draft=JSON.parse(E.hist.pop());lastG='';changed();renderAll()}
function redo(){if(!E.fut.length)return;E.hist.push(JSON.stringify(E.draft));E.draft=JSON.parse(E.fut.pop());lastG='';changed();renderAll()}

/* ---------- podgląd (iframe) ---------- */
const send=m=>{if(ready&&frame&&frame.contentWindow)frame.contentWindow.postMessage(m,location.origin)};
function post(){cancelAnimationFrame(postRaf);postRaf=requestAnimationFrame(()=>send({t:'cms-cfg',cfg:clone(E.draft)}))}
function goPage(){send({t:'cms-go',page:E.page,svc:E.svc});setTimeout(()=>send({t:'cms-sel',id:E.sel,scroll:true}),120)}
function onMsg(e){if(!root||e.origin!==location.origin||!frame||e.source!==frame.contentWindow)return;const m=e.data||{};
  if(m.t==='cms-ready'){ready=true;stage(false);post();setTimeout(goPage,60)}
  if(m.t==='cms-pick'){if(m.id&&secD(m.id)){E.sel=m.id;E.tab='sec';left();right();if(narrow()&&E.mob==='view')pill()}}
  if(m.t==='cms-at'){const map={home:'home',svc:'svc',book:'book',done:'done',status:'status',voucher:'voucher'};let p=map[m.screen];if(m.screen==='doc')p=m.doc==='prywatnosc'?'pry':'reg';
    if(p&&pages().some(x=>x.id===p)&&(p!==E.page||(p==='svc'&&m.svc&&m.svc!==E.svc))){E.page=p;if(p==='svc'&&m.svc)E.svc=m.svc;if(E.sel&&!secs().some(s=>s.id===E.sel))E.sel=null;top();left();right()}}
}

/* ---------- budowa ---------- */
const narrow=()=>matchMedia('(max-width: 900px)').matches;
function open(opts){
  if(root)close(true);
  O=opts;const hasDraft=opts.draft&&Object.keys(opts.draft).length;
  E={draft:clone(hasDraft?opts.draft:opts.live),live:clone(opts.live),page:opts.page||'home',svc:opts.svcId||(O.services()[0]||{}).id,sel:opts.sel||null,tab:opts.tab||'sec',dev:narrow()?'m':'d',hist:[],fut:[],st:'saved',mob:opts.sel?'edit':'view',lib:null,busy:{}};
  if(!pages().some(p=>p.id===E.page))E.page='home';
  ready=false;injectCSS();
  root=document.createElement('div');root.className='cms';root.setAttribute('role','dialog');root.setAttribute('aria-modal','true');root.setAttribute('aria-label','Edytor strony salonu');
  root.innerHTML=`<header class="cms-top" id="cms-top"></header>
  <div class="cms-body" data-mob="${E.mob}"><aside class="cms-left" id="cms-left" aria-label="Sekcje i wygląd"></aside>
    <main class="cms-stage" id="cms-stage"><div class="cms-fw" id="cms-fw"><iframe id="cms-frame" title="Podgląd strony salonu" src="${esc(O.previewUrl)}"></iframe></div><div class="cms-loading" id="cms-loading"><span class="cms-spin"></span>Wczytuję podgląd…</div><div id="cms-pill"></div></main>
    <aside class="cms-right" id="cms-right" aria-label="Ustawienia sekcji"></aside></div>
  <nav class="cms-tabs" id="cms-tabs" aria-label="Widok edytora"></nav><div class="cms-toast" id="cms-toast" role="status" aria-live="polite"></div>`;
  document.body.append(root);document.body.classList.add('cms-open');
  frame=root.querySelector('#cms-frame');
  root.addEventListener('click',onClick);root.addEventListener('input',onInput);root.addEventListener('change',onChange);
  window.addEventListener('message',onMsg);document.addEventListener('keydown',onKey,true);
  ro=new ResizeObserver(()=>stage(false));ro.observe(root.querySelector('#cms-stage'));
  CMS.FONTS.forEach(f=>CMS.loadFont(f.id,document));
  renderAll();
}
function close(silent){if(!root)return;clearTimeout(saveT);if(E.st==='saving')O.save(clone(E.draft));
  window.removeEventListener('message',onMsg);document.removeEventListener('keydown',onKey,true);if(ro)ro.disconnect();
  root.remove();root=null;frame=null;document.body.classList.remove('cms-open');if(!silent&&O.onClose)O.onClose(dirty())}
function renderAll(){top();left();right();tabs();stage(false)}

/* ---------- górny pasek ---------- */
function top(){const t=root&&root.querySelector('#cms-top');if(!t)return;const d=dirty(),ps=pages(),pg=page();
  const st=E.st==='saving'?'<span class="cms-st"><span class="cms-spin sm"></span>Zapisuję szkic…</span>':E.st==='err'?`<span class="cms-st bad">${ic('warn',14)}Nie udało się zapisać</span>`:d?`<span class="cms-st">${ic('check',14)}Szkic zapisany, nieopublikowany</span>`:`<span class="cms-st ok">${ic('check',14)}Wszystko opublikowane</span>`;
  t.innerHTML=`<button class="cms-btn ghost" type="button" data-x="exit" title="Wróć do panelu">${ic('back')}<span class="hide-s">Panel</span></button>
  <div class="cms-where"><label class="cms-sel">${ic('layers',16)}<select data-x="page" aria-label="Podstrona">${ps.map(p=>`<option value="${p.id}" ${p.id===pg.id?'selected':''}>${esc(p.name)}</option>`).join('')}</select>${ic('down',14)}</label>
    ${pg.perSvc?`<label class="cms-sel">${ic('block',16)}<select data-x="svc" aria-label="Usługa">${O.services().map(s=>`<option value="${esc(s.id)}" ${s.id===E.svc?'selected':''}>${esc(s.name)}</option>`).join('')}</select>${ic('down',14)}</label>`:''}</div>
  <div class="cms-dev" role="group" aria-label="Urządzenie podglądu"><button type="button" data-x="dev" data-v="m" aria-pressed="${E.dev==='m'}" title="Telefon">${ic('phone')}</button><button type="button" data-x="dev" data-v="d" aria-pressed="${E.dev==='d'}" title="Komputer">${ic('desk')}</button></div>
  <div class="cms-ur"><button type="button" data-x="undo" ${E.hist.length?'':'disabled'} title="Cofnij (Ctrl+Z)" aria-label="Cofnij">${ic('undo')}</button><button type="button" data-x="redo" ${E.fut.length?'':'disabled'} title="Ponów (Ctrl+Y)" aria-label="Ponów">${ic('redo')}</button></div>
  <div class="cms-right-top">${st}<a class="cms-btn ghost hide-s" href="${esc(O.liveUrl)}" target="_blank" rel="noopener">${ic('ext',16)}Zobacz stronę</a>
  <button class="cms-btn pri" type="button" data-x="publish" ${d?'':'disabled'}>Opublikuj</button></div>`}

/* ---------- lewy panel ---------- */
function left(){const l=root&&root.querySelector('#cms-left');if(!l)return;
  const tb=(k,n,i)=>`<button type="button" role="tab" data-x="tab" data-v="${k}" aria-selected="${E.tab===k}">${ic(i,16)}${n}</button>`;
  l.innerHTML=`<div class="cms-ltabs" role="tablist">${tb('sec','Sekcje','layers')}${tb('look','Wygląd','palette')}${tb('set','Ustawienia','gear')}</div><div class="cms-lbody">${E.tab==='look'?lookHTML():E.tab==='set'?setHTML():secListHTML()}</div>`}
function secListHTML(){const pg=page();
  return `<div class="cms-h"><b>${esc(pg.name)}</b><span>Układ jest stały. Kliknij sekcję, żeby zmienić teksty i zdjęcia. Sekcje bez kłódki możesz ukryć.</span></div>
  <ul class="cms-secs">${secs().map(sd=>{const on=isOn(sd);return `<li class="${E.sel===sd.id?'on':''} ${on?'':'off'}"><button type="button" class="cms-sec" data-x="sel" data-v="${sd.id}" aria-current="${E.sel===sd.id}">${ic(SEC_IC[sd.id]||'block',16)}<span>${esc(sd.name)}</span></button>
    ${sd.fixed?`<span class="cms-lock" title="Stała sekcja, nie da się jej ukryć">${ic('lock',14)}</span>`:`<button type="button" class="cms-eye" data-x="eye" data-v="${sd.id}" aria-pressed="${on}" aria-label="${on?'Ukryj':'Pokaż'} sekcję ${esc(sd.name)}" title="${on?'Ukryj sekcję':'Pokaż sekcję'}">${ic(on?'eye':'eyeoff',16)}</button>`}</li>`}).join('')}</ul>
  ${pg.perSvc?`<p class="cms-note">${ic('info',14)}Opis, zdjęcie, „Co obejmuje” i pytania ustawiasz osobno dla każdej usługi (wybór usługi u góry). Tytuły sekcji są wspólne.</p>`:''}`}
function lookHTML(){const t=CMS.theme(E.draft),L=CMS.logo(E.draft),warn=CMS.checks(E.draft);
  const col=(k,n,h)=>`<div class="cms-col"><label for="cc-${k}"><b>${n}</b><small>${h}</small></label><span class="cms-sw"><input type="color" id="cc-${k}" data-th="${k}" value="${esc(CMS.hex(t[k])||'#000000')}" aria-label="${n}"></span><input class="cms-in hex" data-thx="${k}" value="${esc(t[k])}" maxlength="7" aria-label="${n}, kod koloru"></div>`;
  return `<section class="cms-grp"><h3>Paleta kolorów</h3><div class="cms-pals">${CMS.PALS.map(p=>`<button type="button" class="cms-pal" data-x="pal" data-v="${p.id}" aria-pressed="${t.pal===p.id}"><span class="dots"><i style="background:${p.bg}"></i><i style="background:${p.text}"></i><i style="background:${p.acc}"></i><i style="background:${p.dark}"></i></span><span>${esc(p.name)}</span></button>`).join('')}</div>
    <details class="cms-more" ${t.pal==='wlasna'?'open':''}><summary>Własne kolory</summary>${col('bg','Tło','strona i karty')}${col('text','Tekst','nagłówki i opisy')}${col('acc','Akcent','przyciski, zaznaczenia')}${col('dark','Ciemne sekcje','baner, stopka, bon')}</details>
    ${warn.length?`<div class="cms-warn">${ic('warn',16)}<div>${warn.map(w=>`<p>${esc(w.msg)}</p>`).join('')}<small>Słaby kontrast utrudnia czytanie, szczególnie na telefonie w słońcu.</small></div></div>`:`<div class="cms-ok">${ic('check',16)}Kontrast tekstu i przycisków jest w porządku.</div>`}</section>
  <section class="cms-grp"><h3>Czcionki</h3><div class="cms-fonts">${CMS.FONTS.map(f=>`<button type="button" class="cms-font" data-x="font" data-v="${f.id}" aria-pressed="${t.font===f.id}"><span class="aa" style="font-family:'${f.d}'">Aa</span><span><b>${esc(f.name)}</b><small>${esc(f.d)}${f.b!==f.d?' + '+esc(f.b):''}</small></span></button>`).join('')}</div></section>
  <section class="cms-grp"><h3>Zaokrąglenia</h3><div class="cms-seg">${[['ostre','Ostre'],['srednie','Średnie'],['okragle','Okrągłe']].map(([k,n])=>`<button type="button" data-x="rad" data-v="${k}" aria-pressed="${t.rad===k}"><i style="border-radius:${CMS.RADII[k]*7}px"></i>${n}</button>`).join('')}</div></section>
  <section class="cms-grp"><h3>Logo</h3>
    ${imgBox(L.img,{g:'logo',k:'img'},{hint:'PNG z przezroczystym tłem albo SVG zapisane jako PNG, min. 400 px szerokości.',none:0,auto:'logo z tekstu poniżej'})}
    ${L.img?`<label class="cms-f"><span>Wysokość logo: <b>${+L.h||32} px</b></span><input type="range" min="18" max="64" step="2" value="${+L.h||32}" data-lg="h" aria-label="Wysokość logo"></label>`:`
    <label class="cms-f"><span>Nazwa w logo</span><input class="cms-in" data-lg="t" value="${esc(L.t)}" maxlength="24" placeholder="${esc(O.salonName().split(' ')[0].toUpperCase())}"></label>
    <label class="cms-f"><span>Dopisek pod nazwą</span><input class="cms-in" data-lg="s" value="${esc(L.s)}" maxlength="24" placeholder="np. detailing"></label>`}
  </section>
  <button type="button" class="cms-link" data-x="resetlook">${ic('reset',14)}Przywróć domyślny wygląd</button>`}
function setHTML(){const so=CMS.seo(E.draft),d=dirty(),ti=so.title||O.salonName()+' · detailing, rezerwacja online';
  return `<section class="cms-grp"><h3>Adres strony</h3><div class="cms-url"><a href="${esc(O.liveUrl)}" target="_blank" rel="noopener">${esc(O.liveUrl.replace(/^https?:\/\//,''))}</a><button type="button" class="cms-btn ghost sm" data-x="copy">${ic('copy',14)}Kopiuj</button></div>
    <p class="cms-hint">Wklej go w bio na Instagramie, w wizytówce Google (przycisk „Zarezerwuj”) i na Facebooku.</p></section>
  <section class="cms-grp"><h3>Wygląd w Google</h3>
    <label class="cms-f"><span>Tytuł strony <em>${(so.title||'').length}/60</em></span><input class="cms-in" data-seo="title" value="${esc(so.title)}" maxlength="70" placeholder="${esc(O.salonName()+' · detailing '+(O.city()||'')).trim()}"></label>
    <label class="cms-f"><span>Opis <em>${(so.desc||'').length}/160</em></span><textarea class="cms-in" data-seo="desc" rows="3" maxlength="180" placeholder="np. Ceramika, korekta lakieru i PPF w ${esc(O.city()||'Twoim mieście')}. Cena przed wizytą, termin online w 2 minuty.">${esc(so.desc)}</textarea></label>
    <div class="cms-serp"><small>${esc(O.liveUrl.replace(/^https?:\/\//,'').split('?')[0])}</small><b>${esc(ti.slice(0,62))}${ti.length>62?'…':''}</b><p>${esc((so.desc||'Opis z Google pojawi się tutaj. Napisz w 1-2 zdaniach, co robisz, gdzie i dlaczego warto.').slice(0,160))}</p></div>
    <p class="cms-hint">Dobrze działa miasto w tytule, np. „Ceramika i PPF Poznań”. Połowa salonów z researchu ma je w nagłówku.</p></section>
  <section class="cms-grp"><h3>Dane salonu</h3><p class="cms-hint">Adres, telefon i godziny otwarcia są wspólne dla strony, protokołów i certyfikatów.</p><button type="button" class="cms-btn ghost sm" data-x="nav" data-v="ust">Otwórz Ustawienia → Dane salonu</button></section>
  <section class="cms-grp danger"><h3>Zmiany</h3>
    <button type="button" class="cms-btn ghost sm" data-x="discard" ${d?'':'disabled'}>Odrzuć nieopublikowane zmiany</button>
    <button type="button" class="cms-btn ghost sm" data-x="resetall">Przywróć całą stronę do ustawień początkowych</button></section>`}

/* ---------- prawy panel: ustawienia sekcji ---------- */
function right(){const r=root&&root.querySelector('#cms-right');if(!r)return;const sd=E.sel&&secs().some(s=>s.id===E.sel)?secD(E.sel):null;
  if(!sd){r.innerHTML=`<div class="cms-empty">${ic('edit',28)}<b>Wybierz sekcję</b><p>Kliknij element na podglądzie albo sekcję na liście po lewej. Tu pojawią się jej teksty i zdjęcia.</p>
    <div class="cms-quick"><small>Najczęściej zmieniane</small>${[['home.hero','Baner główny'],['home.reviews','Opinie'],['home.gallery','Realizacje']].filter(x=>pages()[0].sections.some(s=>s.id===x[0])).map(x=>`<button type="button" data-x="jump" data-v="${x[0]}">${esc(x[1])}</button>`).join('')}<button type="button" data-x="tab" data-v="look">Kolory i czcionki</button></div></div>`;return}
  const on=isOn(sd),s=sd.per?O.svc(E.svc):null;
  r.innerHTML=`<div class="cms-rh"><button type="button" class="cms-ib only-s" data-x="mob" data-v="sec" aria-label="Wróć do listy sekcji">${ic('back')}</button><div><b>${esc(sd.name)}</b><small>${esc(page().name)}${s?' · '+esc(s.name):''}</small></div>
    ${sd.fixed?`<span class="cms-badge" title="Stała sekcja">${ic('lock',12)}stała</span>`:`<label class="cms-tg" title="${on?'Widoczna na stronie':'Ukryta'}"><input type="checkbox" data-x="eyecb" data-v="${sd.id}" ${on?'checked':''}><i></i><span>${on?'Widoczna':'Ukryta'}</span></label>`}</div>
  <div class="cms-rb${on?'':' dim'}">${!on?`<p class="cms-note">${ic('eyeoff',14)}Sekcja jest ukryta. Klienci jej nie zobaczą, ale ustawienia zostają.</p>`:''}${sd.fields.map((f,i)=>fieldHTML(sd,f,i)).join('')}</div>
  <div class="cms-rf"><button type="button" class="cms-link" data-x="resetsec">${ic('reset',14)}Przywróć domyślne${sd.per?' dla tej usługi':''}</button></div>`}
function fieldHTML(sd,f,i){const [k,t,l,,x={}]=f,v=val(sd,f),ph=x.ph||autoPh(sd,k)||'';
  if(t==='info')return `<div class="cms-info">${ic('info',16)}<div><span>${esc(l)}</span>${x.nav?`<button type="button" class="cms-btn ghost sm" data-x="nav" data-v="${x.nav}">${esc(x.btn)}</button>`:''}</div></div>`;
  const cnt=x.max?`<em data-cnt="${i}">${String(v||'').length}/${x.max}</em>`:'';
  if(t==='text')return `<label class="cms-f"><span>${esc(l)} ${cnt}</span><input class="cms-in" data-fi="${i}" value="${esc(v)}" maxlength="${x.max||200}" placeholder="${esc(ph)}">${x.auto&&!v?`<small class="cms-auto">Puste = ${esc(x.auto)}</small>`:''}</label>`;
  if(t==='area')return `<label class="cms-f"><span>${esc(l)} ${cnt}</span><textarea class="cms-in" data-fi="${i}" rows="${x.rows||3}" maxlength="${x.max||500}" placeholder="${esc(ph)}">${esc(v)}</textarea>${x.auto&&!v?`<small class="cms-auto">Puste = ${esc(x.auto)}</small>`:''}</label>`;
  if(t==='toggle')return `<label class="cms-tgl"><span>${esc(l)}</span><span class="cms-tg"><input type="checkbox" data-fi="${i}" ${v?'checked':''}><i></i></span></label>`;
  if(t==='select')return `<div class="cms-f"><span>${esc(l)}</span><div class="cms-seg">${x.opts.map(([ov,on])=>`<button type="button" data-x="opt" data-fi="${i}" data-v="${esc(ov)}" aria-pressed="${v===ov}">${esc(on)}</button>`).join('')}</div></div>`;
  if(t==='num')return `<label class="cms-f"><span>${esc(l)}: <b data-numv="${i}">${+v}</b></span><input type="range" data-fi="${i}" min="${x.min}" max="${x.max}" step="${x.step||1}" value="${+v}"></label>`;
  if(t==='img')return `<div class="cms-f"><span>${esc(l)}</span>${imgBox(v,{fi:i},x)}</div>`;
  if(t==='list')return listHTML(sd,f,i,v||[]);
  return ''}
function imgBox(v,ref,x){const r=Object.entries(ref).map(([a,b])=>`data-${a}="${esc(b)}"`).join(' '),u=v&&v!=='none'?v:'',key=rk(ref),busy=E.busy[key];
  return `<div class="cms-img">${u?`<img src="${esc(u)}" alt="">`:`<div class="ph">${ic('img',22)}<small>${v==='none'?'Bez zdjęcia':x.auto?'Automatycznie: '+esc(x.auto):'Brak zdjęcia'}</small></div>`}${busy?'<div class="busy"><span class="cms-spin"></span>Wgrywam…</div>':''}</div>
  <div class="cms-imgb"><label class="cms-btn ghost sm">${ic('up2',14)}Wgraj<input type="file" accept="image/jpeg,image/png,image/webp" hidden data-up="1" ${r}></label><button type="button" class="cms-btn ghost sm" data-x="lib" ${r}>${ic('img',14)}Biblioteka</button>
    ${x.none&&v!=='none'?`<button type="button" class="cms-btn ghost sm" data-x="imgnone" ${r}>Bez zdjęcia</button>`:''}${v&&(x.auto||x.none||ref.g)?`<button type="button" class="cms-btn ghost sm" data-x="imgdef" ${r} title="Przywróć domyślne zdjęcie">${ic('reset',14)}Domyślne</button>`:''}</div>
  ${E.lib===key?libHTML(ref):''}${x.hint?`<small class="cms-hint">${esc(x.hint)}</small>`:''}`}
function libHTML(ref){const r=Object.entries(ref).map(([a,b])=>`data-${a}="${esc(b)}"`).join(' '),own=[...new Set(JSON.stringify([E.draft,E.live]).match(/https:\/\/[^"\\]+\/storage\/v1\/object\/public\/[^"\\]+/g)||[])];
  return `<div class="cms-lib"><small>Twoje zdjęcia</small><div class="g">${own.length?own.map(u=>`<button type="button" data-x="pick" data-v="${esc(u)}" ${r}><img src="${esc(u)}" alt=""></button>`).join(''):'<p>Wgrane zdjęcia pojawią się tutaj.</p>'}</div>
    <small>Zdjęcia przykładowe</small><div class="g">${CMS.STOCK.map(u=>`<button type="button" data-x="pick" data-v="${esc(u)}" ${r}><img src="${esc(u)}" alt=""></button>`).join('')}</div></div>`}
function listHTML(sd,f,i,arr){const [,,l,,x]=f,sub=x.f;
  return `<div class="cms-f"><span>${esc(l)} <em>${arr.length}${x.max?'/'+x.max:''}</em></span>${x.auto&&!(perStore(sd,f)&&((E.draft.svc||{})[E.svc]||{})[f[0]])?`<small class="cms-auto">Teraz: ${esc(x.auto)}. Zmiana zapisze własną listę.</small>`:''}
  <ol class="cms-list">${arr.map((it,j)=>`<li><details ${E.openItem===sd.id+i+'_'+j?'open':''} data-item="${i}_${j}"><summary><span>${esc(strip(it[x.title]||'')||'Element '+(j+1))}</span>
      <span class="acts"><button type="button" class="cms-ib" data-x="mv" data-fi="${i}" data-j="${j}" data-v="-1" ${j?'':'disabled'} aria-label="W górę">${ic('up',14)}</button><button type="button" class="cms-ib" data-x="mv" data-fi="${i}" data-j="${j}" data-v="1" ${j<arr.length-1?'':'disabled'} aria-label="W dół">${ic('down',14)}</button><button type="button" class="cms-ib" data-x="rm" data-fi="${i}" data-j="${j}" ${x.min&&arr.length<=x.min?'disabled':''} aria-label="Usuń">${ic('trash',14)}</button></span></summary>
      <div class="it">${sub.map(sf=>sf[1]==='img'?`<div class="cms-f"><span>${esc(sf[2])}</span>${imgBox(it[sf[0]]||'',{fi:i,j,lk:sf[0]},{})}</div>`:sf[1]==='area'?`<label class="cms-f"><span>${esc(sf[2])}</span><textarea class="cms-in" rows="${(sf[4]||{}).rows||3}" maxlength="${(sf[4]||{}).max||300}" data-fi="${i}" data-j="${j}" data-lk="${sf[0]}">${esc(it[sf[0]]||'')}</textarea></label>`:`<label class="cms-f"><span>${esc(sf[2])}</span><input class="cms-in" maxlength="${(sf[4]||{}).max||120}" data-fi="${i}" data-j="${j}" data-lk="${sf[0]}" value="${esc(it[sf[0]]||'')}"></label>`).join('')}</div></details></li>`).join('')}</ol>
  ${!x.max||arr.length<x.max?`<button type="button" class="cms-add" data-x="add" data-fi="${i}">${ic('plus',15)}${esc(x.add||'Dodaj')}</button>`:''}</div>`}

/* ---------- dolne zakładki (telefon) ---------- */
function tabs(){const t=root&&root.querySelector('#cms-tabs');if(!t)return;const b=(k,n,i)=>`<button type="button" data-x="mob" data-v="${k}" aria-pressed="${E.mob===k}">${ic(i)}<span>${n}</span></button>`;
  t.innerHTML=b('view','Podgląd','view')+b('sec','Sekcje','layers')+b('edit','Edycja','edit')+b('look','Wygląd','palette');root.querySelector('.cms-body').dataset.mob=E.mob}
function pill(){const p=root.querySelector('#cms-pill'),sd=E.sel&&secD(E.sel);p.innerHTML=sd?`<button type="button" class="cms-pill" data-x="mob" data-v="edit">${ic('edit',16)}Edytuj: ${esc(sd.name)}</button>`:''}

/* ---------- scena podglądu ---------- */
function stage(scroll){if(!root)return;const st=root.querySelector('#cms-stage'),fw=root.querySelector('#cms-fw');if(!st||!frame)return;
  const W=st.clientWidth,H=st.clientHeight,pad=narrow()?12:28;fw.className='cms-fw '+E.dev;
  if(E.dev==='m'){const w=390,h=Math.min(844,Math.max(560,H-pad*2)),s=Math.min(1,(W-pad*2)/w,(H-pad*2)/h);frame.style.width=w+'px';frame.style.height=h+'px';frame.style.transform=`scale(${s})`;fw.style.width=w*s+'px';fw.style.height=h*s+'px'}
  else{const w=Math.max(1280,W-pad*2),s=Math.min(1,(W-pad*2)/w),h=(H-pad*2)/s;frame.style.width=w+'px';frame.style.height=h+'px';frame.style.transform=`scale(${s})`;fw.style.width=w*s+'px';fw.style.height=h*s+'px'}
  root.querySelector('#cms-loading').hidden=ready}

/* ---------- zdarzenia ---------- */
function sdOf(el){return secD(E.sel)}
function fOf(el){const sd=sdOf(el);return sd&&sd.fields[+el.dataset.fi]}
function refSet(el,v){const d=el.dataset;
  if(d.g==='logo'){setG('logo','img',v);left();return}
  const sd=sdOf(el),f=fOf(el);if(!sd||!f)return;
  if(d.lk!==undefined){const arr=clone(val(sd,f));arr[+d.j][d.lk]=v||'';setV(sd,f,arr)}else setV(sd,f,v);right()}
async function upload(el,file){if(!file)return;if(!/^image\/(jpeg|png|webp)$/.test(file.type)){toast('Wgraj zdjęcie JPG, PNG albo WebP.');return}
  const keyS=rk(refOf(el.dataset));
  const data=Object.assign({},el.dataset);E.busy[keyS]=1;el.dataset.g?left():right();
  try{const small=await shrink(file,el.dataset.g?800:2000);if(small.size>5e6){toast('Zdjęcie jest za duże nawet po zmniejszeniu (ponad 5 MB).');return}
    const url=await O.upload(small);if(!url){toast('Nie udało się wgrać zdjęcia. Spróbuj jeszcze raz.');return}
    refSet({dataset:data},url);toast('Zdjęcie wgrane')}
  finally{delete E.busy[keyS];el.dataset&&data.g?left():right()}}
/* zmniejszenie dużych zdjęć przed wgraniem (szybsza strona na telefonie) */
function shrink(file,max){return new Promise(res=>{if(file.size<400e3&&file.type!=='image/png'){res(file);return}const u=URL.createObjectURL(file),im=new Image();
  im.onload=()=>{const s=Math.min(1,max/Math.max(im.width,im.height));if(s===1&&file.size<1.5e6){URL.revokeObjectURL(u);res(file);return}const c=document.createElement('canvas');c.width=Math.round(im.width*s);c.height=Math.round(im.height*s);c.getContext('2d').drawImage(im,0,0,c.width,c.height);URL.revokeObjectURL(u);
    const png=file.type==='image/png';c.toBlob(b=>res(b?new File([b],png?'logo.png':'zdjecie.jpg',{type:png?'image/png':'image/jpeg'}):file),png?'image/png':'image/jpeg',.85)};im.onerror=()=>{URL.revokeObjectURL(u);res(file)};im.src=u})}
function select(id,scroll=true){E.sel=id;E.lib=null;E.tab='sec';left();right();send({t:'cms-sel',id,scroll});if(narrow()){E.mob='edit';tabs()}}
function onClick(e){const b=e.target.closest('[data-x]');if(!b||b.disabled)return;const x=b.dataset.x,v=b.dataset.v;
  if(x==='exit'){close();return}
  if(x==='dev'){E.dev=v;top();stage(true);return}
  if(x==='undo'){undo();return}if(x==='redo'){redo();return}
  if(x==='publish'){prePublish();return}
  if(x==='tab'){E.tab=v;if(narrow()){E.mob=v==='sec'?'sec':v==='look'?'look':'sec';tabs()}left();return}
  if(x==='sel'){select(v);return}
  if(x==='jump'){const p=pages().find(p=>p.sections.some(s=>s.id===v));if(p&&p.id!==E.page){E.page=p.id;top();goPage()}select(v);return}
  if(x==='eye'){const sd=secD(v);const on=!isOn(sd);snap('eye'+v);E.draft.sec=E.draft.sec||{};(E.draft.sec[v]=E.draft.sec[v]||{}).on=on;changed();left();if(E.sel===v)right();toast(on?`„${sd.name}” widoczna`:`„${sd.name}” ukryta`);send({t:'cms-sel',id:v,scroll:on});return}
  if(x==='mob'){E.mob=v;if(v==='look'){E.tab='look';left()}if(v==='sec'&&E.tab==='look'){E.tab='sec';left()}tabs();pill();if(v==='view')stage(false);return}
  if(x==='pal'){const p=CMS.PALS.find(p=>p.id===v);snap('pal');E.draft.theme=Object.assign({},E.draft.theme,{pal:p.id,bg:p.bg,text:p.text,acc:p.acc,dark:p.dark});changed();left();return}
  if(x==='font'){setG('theme','font',v);left();return}
  if(x==='rad'){setG('theme','rad',v);left();return}
  if(x==='opt'){const sd=sdOf(b),f=fOf(b);setV(sd,f,v);right();return}
  if(x==='lib'){const k=rk(refOf(b.dataset));E.lib=E.lib===k?null:k;b.dataset.g?left():right();return}
  if(x==='pick'){E.lib=null;refSet(b,v);return}
  if(x==='imgnone'){refSet(b,'none');return}
  if(x==='imgdef'){if(b.dataset.g){setG('logo','img',undefined);left();return}if(b.dataset.lk!==undefined){refSet(b,'');return}const sd=sdOf(b),f=fOf(b);setV(sd,f,undefined);right();return}
  if(x==='add'){const sd=sdOf(b),f=fOf(b),arr=clone(val(sd,f)),it={};f[4].f.forEach(sf=>it[sf[0]]='');arr.push(it);E.openItem=sd.id+b.dataset.fi+'_'+(arr.length-1);setV(sd,f,arr);right();
    const n=root.querySelector(`#cms-right details[data-item="${b.dataset.fi}_${arr.length-1}"] .cms-in`);if(n)n.focus();return}
  if(x==='rm'){e.preventDefault();const sd=sdOf(b),f=fOf(b),arr=clone(val(sd,f));arr.splice(+b.dataset.j,1);setV(sd,f,arr);right();return}
  if(x==='mv'){e.preventDefault();const sd=sdOf(b),f=fOf(b),arr=clone(val(sd,f)),j=+b.dataset.j,k=j+(+v);[arr[j],arr[k]]=[arr[k],arr[j]];E.openItem=null;setV(sd,f,arr);right();return}
  if(x==='resetsec'){const sd=secD(E.sel);snap('reset'+sd.id);if(sd.per){if(E.draft.svc)delete E.draft.svc[E.svc];sd.fields.filter(isShared).forEach(f=>{if(E.draft.sec&&E.draft.sec[sd.id])delete E.draft.sec[sd.id][f[0]]})}else if(E.draft.sec){const on=(E.draft.sec[sd.id]||{}).on;delete E.draft.sec[sd.id];if(on===false)E.draft.sec[sd.id]={on:false}}changed();right();toast('Przywrócono domyślne treści sekcji');return}
  if(x==='resetlook'){if(arm(b,'Na pewno? Kliknij jeszcze raz'))return;snap('look');delete E.draft.theme;delete E.draft.logo;changed();left();toast('Przywrócono domyślny wygląd');return}
  if(x==='resetall'){if(arm(b,'Na pewno? Kliknij jeszcze raz'))return;snap('all');E.draft={};changed();renderAll();toast('Strona wróciła do ustawień początkowych. Opublikuj, żeby zobaczyli to klienci.');return}
  if(x==='discard'){if(arm(b,'Na pewno? Kliknij jeszcze raz'))return;snap('discard');E.draft=clone(E.live);changed();renderAll();toast('Odrzucono zmiany, szkic = opublikowana strona');return}
  if(x==='copy'){navigator.clipboard&&navigator.clipboard.writeText(O.liveUrl).then(()=>toast('Skopiowano adres strony'),()=>toast(O.liveUrl));return}
  if(x==='nav'){close();O.nav(v);return}
  if(x==='pubok'){doPublish();return}
  if(x==='pubno'){root.querySelector('#cms-dlg')&&root.querySelector('#cms-dlg').remove();return}
  if(x==='fix'){root.querySelector('#cms-dlg')&&root.querySelector('#cms-dlg').remove();const [pg,id]=v.split('|');if(pg==='look'){E.tab='look';if(narrow()){E.mob='look';tabs()}left();return}if(pg!==E.page){E.page=pg;top();goPage()}select(id);return}
}
const arm=(b,t)=>{if(b.dataset.armed==='1')return false;b.dataset.armed='1';b.dataset.l=b.innerHTML;b.textContent=t;setTimeout(()=>{if(b.isConnected){b.dataset.armed='';b.innerHTML=b.dataset.l}},3500);return true};
function onInput(e){const t=e.target,d=t.dataset;
  if(d.fi!==undefined&&!d.x&&t.type!=='file'&&t.type!=='checkbox'){const sd=sdOf(t),f=fOf(t);if(!sd||!f)return;
    if(d.lk!==undefined){const arr=clone(val(sd,f));arr[+d.j][d.lk]=t.value;setV(sd,f,arr);const s=t.closest('details');if(s&&f[4].title===d.lk)s.querySelector('summary span').textContent=t.value||'Element '+(+d.j+1);E.openItem=sd.id+d.fi+'_'+d.j;return}
    const v=f[1]==='num'?+t.value:t.value;setV(sd,f,v);const c=root.querySelector(`[data-cnt="${d.fi}"]`);if(c)c.textContent=`${t.value.length}/${f[4].max}`;const nv=root.querySelector(`[data-numv="${d.fi}"]`);if(nv)nv.textContent=t.value;return}
  if(d.th){setG('theme','pal','wlasna','col');setG('theme',d.th,t.value,'col');const h=root.querySelector(`[data-thx="${d.th}"]`);if(h)h.value=t.value;warnRefresh();return}
  if(d.thx){const h=CMS.hex(t.value);if(h){setG('theme','pal','wlasna','col');setG('theme',d.thx,h,'col');const c=root.querySelector(`#cc-${d.thx}`);if(c)c.value=h;warnRefresh()}return}
  if(d.lg){setG('logo',d.lg,d.lg==='h'?+t.value:t.value);if(d.lg==='h'){const b=t.closest('label').querySelector('b');if(b)b.textContent=t.value+' px'}return}
  if(d.seo){setG('seo',d.seo,t.value);const em=t.closest('label').querySelector('em');if(em)em.textContent=`${t.value.length}/${d.seo==='title'?60:160}`;const sp=root.querySelector('.cms-serp');if(sp){const so=CMS.seo(E.draft),ti=so.title||O.salonName()+' · detailing, rezerwacja online';sp.querySelector('b').textContent=ti.slice(0,62)+(ti.length>62?'…':'');sp.querySelector('p').textContent=(so.desc||'').slice(0,160)}return}
}
function warnRefresh(){clearTimeout(warnRefresh.t);warnRefresh.t=setTimeout(()=>{const g=root&&root.querySelector('.cms-warn,.cms-ok');if(!g)return;const w=CMS.checks(E.draft);const n=document.createElement('div');n.innerHTML=w.length?`<div class="cms-warn">${ic('warn',16)}<div>${w.map(x=>`<p>${esc(x.msg)}</p>`).join('')}<small>Słaby kontrast utrudnia czytanie, szczególnie na telefonie w słońcu.</small></div></div>`:`<div class="cms-ok">${ic('check',16)}Kontrast tekstu i przycisków jest w porządku.</div>`;g.replaceWith(n.firstChild);root.querySelectorAll('.cms-pal').forEach(p=>p.setAttribute('aria-pressed','false'))},120)}
function onChange(e){const t=e.target,d=t.dataset;
  if(d.x==='page'){E.page=t.value;E.sel=null;E.lib=null;top();left();right();goPage();return}
  if(d.x==='svc'){E.svc=t.value;right();goPage();return}
  if(d.x==='eyecb'){const sd=secD(d.v);snap('eye'+d.v);E.draft.sec=E.draft.sec||{};(E.draft.sec[d.v]=E.draft.sec[d.v]||{}).on=t.checked;changed();left();right();return}
  if(d.up){upload(t,t.files[0]);t.value='';return}
  if(t.type==='checkbox'&&d.fi!==undefined){const sd=sdOf(t),f=fOf(t);setV(sd,f,t.checked);return}
}
function onKey(e){if(!root)return;
  if(e.key==='Escape'){if(root.querySelector('#cms-dlg')){root.querySelector('#cms-dlg').remove();e.stopPropagation();return}if(E.lib){E.lib=null;right();left();e.stopPropagation();return}}
  const inField=/^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement&&document.activeElement.tagName);
  if((e.ctrlKey||e.metaKey)&&!inField){const k=e.key.toLowerCase();if(k==='z'&&!e.shiftKey){e.preventDefault();undo()}else if(k==='y'||(k==='z'&&e.shiftKey)){e.preventDefault();redo()}}}

/* ---------- publikacja: sprawdzenie przed ---------- */
function issues(){const out=[],ctx=O.ctx(),dd=E.draft.sec||{};
  CMS.checks(E.draft).forEach(w=>out.push({p:'look',id:'',name:'Wygląd',msg:w.msg}));
  pages().forEach(pg=>pg.sections.forEach(sd=>{if(sd.when&&!O.fon(sd.when))return;if(!sd.fixed&&(dd[sd.id]||{}).on===false)return;
    sd.fields.forEach(f=>{if(f[0]==='title'&&f[1]!=='list'&&!sd.per){const v=val(sd,f);if(!String(v||'').trim())out.push({p:pg.id,id:sd.id,name:sd.name,msg:'Pusty tytuł sekcji.'})}});
    if(!ctx.lumen){const o=dd[sd.id]||{};
      if(sd.id==='home.reviews'&&!o.items)out.push({p:pg.id,id:sd.id,name:sd.name,msg:'Opinie są przykładowe. Wpisz prawdziwe opinie klientów albo ukryj sekcję.'});
      if(sd.id==='home.gallery'&&!o.items)out.push({p:pg.id,id:sd.id,name:sd.name,msg:'Realizacje to zdjęcia przykładowe. Wgraj zdjęcia swoich aut albo ukryj sekcję.'});
      if(sd.id==='home.about'&&!o.text)out.push({p:pg.id,id:sd.id,name:sd.name,msg:'Tekst „O nas” jest wzorem. Napisz kilka zdań o swoim studiu.'});
      if(sd.id==='home.hero'&&o.rating&&!o.revs)out.push({p:pg.id,id:sd.id,name:sd.name,msg:'Sprawdź ocenę i liczbę opinii Google w banerze.'})}
  }));return out}
function prePublish(){const l=issues();if(!l.length){doPublish();return}
  const d=document.createElement('div');d.id='cms-dlg';d.className='cms-dlg';d.innerHTML=`<div class="cms-dlg-in" role="alertdialog" aria-labelledby="cms-dlg-h"><h3 id="cms-dlg-h">${ic('warn',18)}Zanim opublikujesz</h3><p>Znalazłem ${l.length} ${l.length===1?'rzecz':l.length<5?'rzeczy':'rzeczy'} do sprawdzenia. Kliknij, żeby przejść do sekcji.</p>
    <ul>${l.map(x=>`<li><button type="button" data-x="fix" data-v="${esc(x.p+'|'+x.id)}"><b>${esc(x.name)}</b><span>${esc(x.msg)}</span>${ic('back',14)}</button></li>`).join('')}</ul>
    <div class="row"><button type="button" class="cms-btn ghost" data-x="pubno">Wróć do edycji</button><button type="button" class="cms-btn pri" data-x="pubok">Opublikuj mimo to</button></div></div>`;
  root.append(d);d.querySelector('[data-x="pubno"]').focus()}
async function doPublish(){const dl=root.querySelector('#cms-dlg');if(dl)dl.remove();clearTimeout(saveT);E.st='saving';top();
  const ok=await O.publish(clone(E.draft));if(!ok){E.st='err';top();toast('Nie udało się opublikować. Sprawdź internet i spróbuj jeszcze raz.');return}
  E.live=clone(E.draft);E.st='saved';top();if(E.tab==='set')left();toast('Opublikowano. Klienci widzą nową wersję strony.')}
function toast(t){const el=root&&root.querySelector('#cms-toast');if(!el)return;el.textContent=t;el.classList.add('on');clearTimeout(toastT);toastT=setTimeout(()=>el.classList.remove('on'),2800)}

/* ---------- style edytora ---------- */
function injectCSS(){if(document.getElementById('cms-css'))return;const s=document.createElement('style');s.id='cms-css';s.textContent=`
.cms{--c-bg:#f1f1ef;--c-pan:#fff;--c-line:#e4e4e0;--c-ink:#1c1917;--c-mut:#6b6763;--c-acc:var(--brand,#ea580c);--c-acc-50:#fff4ed;--c-sel:#2563eb;position:fixed;inset:0;z-index:200;display:grid;grid-template-rows:56px 1fr;background:var(--c-bg);color:var(--c-ink);font-family:'Onest',system-ui,sans-serif;font-size:14px;animation:cmsIn .22s ease both}
@keyframes cmsIn{from{opacity:0;transform:scale(.995)}}
body.cms-open{overflow:hidden}
.cms *{box-sizing:border-box}.cms button{font:inherit;color:inherit;cursor:pointer}.cms button:disabled{cursor:not-allowed;opacity:.45}
.cms :focus-visible{outline:2px solid var(--c-sel);outline-offset:2px}
.cms-top{display:flex;align-items:center;gap:10px;padding:0 12px;background:var(--c-pan);border-bottom:1px solid var(--c-line);min-width:0}
.cms-where{display:flex;gap:8px;min-width:0;flex:1;justify-content:center}
.cms-sel{position:relative;display:flex;align-items:center;gap:6px;border:1px solid var(--c-line);border-radius:10px;padding:0 10px;height:36px;background:#fff;min-width:0;max-width:280px}
.cms-sel select{appearance:none;border:0;background:none;font-weight:600;padding:0 18px 0 0;height:100%;min-width:0;text-overflow:ellipsis;cursor:pointer}
.cms-sel>svg:last-child{position:absolute;right:9px;pointer-events:none;color:var(--c-mut)}
.cms-dev,.cms-ur{display:flex;border:1px solid var(--c-line);border-radius:10px;overflow:hidden;flex:none}
.cms-dev button,.cms-ur button{border:0;background:#fff;width:38px;height:34px;display:grid;place-items:center;color:var(--c-mut)}
.cms-dev button[aria-pressed=true]{background:var(--c-ink);color:#fff}
.cms-dev button:hover:not([aria-pressed=true]),.cms-ur button:hover:not(:disabled){background:#f5f5f3;color:var(--c-ink)}
.cms-ur button+button,.cms-dev button+button{border-left:1px solid var(--c-line)}
.cms-right-top{display:flex;align-items:center;gap:8px;flex:none}
.cms-st{display:inline-flex;align-items:center;gap:6px;font-size:12.5px;color:var(--c-mut);white-space:nowrap}.cms-st.ok{color:#1d6b45}.cms-st.bad{color:#a3261b}
.cms-btn{display:inline-flex;align-items:center;justify-content:center;gap:6px;height:36px;padding:0 14px;border-radius:10px;border:1px solid transparent;font-weight:600;text-decoration:none;color:var(--c-ink);white-space:nowrap;background:none}
.cms-btn.pri{background:var(--c-acc);color:#fff}.cms-btn.pri:hover:not(:disabled){filter:brightness(.94)}
.cms-btn.ghost{border-color:var(--c-line);background:#fff}.cms-btn.ghost:hover:not(:disabled){background:#f5f5f3}
.cms-btn.sm{height:32px;padding:0 10px;font-size:13px}
.cms-ib{width:30px;height:30px;border:0;background:none;border-radius:8px;display:inline-grid;place-items:center;color:var(--c-mut)}.cms-ib:hover:not(:disabled){background:#f1f1ef;color:var(--c-ink)}
.cms-body{display:grid;grid-template-columns:280px minmax(0,1fr) 340px;min-height:0}
.cms-left,.cms-right{background:var(--c-pan);min-height:0;overflow:auto;overscroll-behavior:contain}
.cms-left{border-right:1px solid var(--c-line);display:flex;flex-direction:column}.cms-right{border-left:1px solid var(--c-line);display:flex;flex-direction:column}
.cms-ltabs{display:grid;grid-template-columns:repeat(3,1fr);gap:4px;padding:10px;border-bottom:1px solid var(--c-line);position:sticky;top:0;background:#fff;z-index:2}
.cms-ltabs button{border:0;background:none;border-radius:8px;height:34px;display:flex;align-items:center;justify-content:center;gap:5px;font-weight:600;font-size:13px;color:var(--c-mut)}
.cms-ltabs button[aria-selected=true]{background:#f1f1ef;color:var(--c-ink)}
.cms-lbody{padding:12px 12px 24px}
.cms-h{display:grid;gap:4px;padding:4px 6px 12px}.cms-h span{color:var(--c-mut);font-size:12.5px;line-height:1.45}
.cms-secs{list-style:none;margin:0;padding:0;display:grid;gap:2px}
.cms-secs li{display:flex;align-items:center;border-radius:9px}.cms-secs li:hover{background:#f6f6f4}.cms-secs li.on{background:var(--c-acc-50);box-shadow:inset 3px 0 0 var(--c-acc)}
.cms-secs li.off .cms-sec{color:var(--c-mut)}.cms-secs li.off .cms-sec span{text-decoration:line-through;text-decoration-color:#c9c6c1}
.cms-sec{flex:1;display:flex;align-items:center;gap:10px;border:0;background:none;padding:9px 8px;text-align:left;min-width:0;border-radius:9px}.cms-sec svg{color:var(--c-mut);flex:none}.cms-sec span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.cms-lock{color:#b3afa9;padding:0 9px;display:grid}
.cms-eye{border:0;background:none;width:32px;height:32px;border-radius:8px;display:grid;place-items:center;color:var(--c-mut);margin-right:2px}.cms-eye:hover{background:#eceae6;color:var(--c-ink)}.cms-eye[aria-pressed=false]{color:#b3afa9}
.cms-note{display:flex;gap:8px;align-items:flex-start;font-size:12.5px;color:var(--c-mut);background:#f6f6f4;border-radius:10px;padding:10px;margin:12px 0 0;line-height:1.45}.cms-note svg{flex:none;margin-top:1px}
.cms-grp{display:grid;gap:10px;padding:6px 4px 18px;border-bottom:1px solid var(--c-line);margin-bottom:14px}.cms-grp:last-of-type{border-bottom:0}
.cms-grp h3{margin:0;font-size:13px;text-transform:uppercase;letter-spacing:.06em;color:var(--c-mut)}
.cms-pals{display:grid;grid-template-columns:1fr 1fr;gap:6px}
.cms-pal{border:1px solid var(--c-line);background:#fff;border-radius:10px;padding:8px;display:grid;gap:6px;text-align:left;font-size:12.5px;font-weight:600}
.cms-pal .dots{display:flex}.cms-pal .dots i{width:20px;height:20px;border-radius:50%;border:2px solid #fff;margin-right:-6px;box-shadow:0 0 0 1px rgba(0,0,0,.12)}
.cms-pal[aria-pressed=true],.cms-font[aria-pressed=true]{border-color:var(--c-ink);box-shadow:inset 0 0 0 1px var(--c-ink)}
.cms-pal:hover,.cms-font:hover{border-color:#bdb9b3}
.cms-more summary{cursor:pointer;font-weight:600;padding:4px 0;font-size:13px}.cms-more[open] summary{margin-bottom:8px}
.cms-col{display:grid;grid-template-columns:1fr 34px 86px;gap:8px;align-items:center;margin-bottom:8px}
.cms-col label{display:grid;line-height:1.25}.cms-col small{color:var(--c-mut);font-size:11.5px}
.cms-sw{width:34px;height:34px;border-radius:9px;overflow:hidden;border:1px solid var(--c-line);display:block}.cms-sw input{width:150%;height:150%;margin:-25%;border:0;padding:0;cursor:pointer}
.cms-warn{display:flex;gap:8px;background:#fdf3e7;color:#7a4a00;border-radius:10px;padding:10px;font-size:12.5px}.cms-warn p{margin:0 0 4px}.cms-warn small{opacity:.8}.cms-warn svg{flex:none}
.cms-ok{display:flex;gap:6px;align-items:center;color:#1d6b45;font-size:12.5px}
.cms-fonts{display:grid;gap:6px}
.cms-font{display:grid;grid-template-columns:44px 1fr;gap:10px;align-items:center;border:1px solid var(--c-line);background:#fff;border-radius:10px;padding:8px;text-align:left}
.cms-font .aa{font-size:24px;font-weight:700;line-height:1}.cms-font b{display:block;font-size:13px}.cms-font small{color:var(--c-mut);font-size:11.5px}
.cms-seg{display:flex;border:1px solid var(--c-line);border-radius:10px;padding:3px;gap:3px;background:#f6f6f4}
.cms-seg button{flex:1;border:0;background:none;border-radius:7px;min-height:32px;font-size:13px;font-weight:600;color:var(--c-mut);display:flex;align-items:center;justify-content:center;gap:6px;padding:0 6px}
.cms-seg button[aria-pressed=true]{background:#fff;color:var(--c-ink);box-shadow:0 1px 2px rgba(0,0,0,.12)}
.cms-seg i{width:16px;height:12px;border:2px solid currentColor;display:inline-block}
.cms-f{display:grid;gap:6px;margin-bottom:14px}.cms-f>span{font-size:12.5px;font-weight:600;display:flex;justify-content:space-between;gap:8px}.cms-f em{font-style:normal;font-weight:500;color:var(--c-mut);font-variant-numeric:tabular-nums}
.cms-in{width:100%;border:1px solid var(--c-line);border-radius:9px;padding:9px 10px;background:#fff;font:inherit;font-size:14px;color:var(--c-ink);resize:vertical;min-height:38px}
.cms-in:focus{border-color:var(--c-sel);outline:none;box-shadow:0 0 0 3px rgba(37,99,235,.15)}
.cms-in.hex{font-family:ui-monospace,Consolas,monospace;font-size:12.5px;padding:7px 8px}
.cms-auto,.cms-hint{color:var(--c-mut);font-size:12px;line-height:1.4}
.cms-f input[type=range]{width:100%;accent-color:var(--c-ink)}
.cms-tgl{display:flex;justify-content:space-between;align-items:center;gap:12px;margin-bottom:14px;font-size:13.5px;font-weight:500;cursor:pointer}
.cms-tg{display:inline-flex;align-items:center;gap:8px;cursor:pointer;font-size:12.5px;font-weight:600}
.cms-tg input{position:absolute;opacity:0;width:1px;height:1px}
.cms-tg i{width:36px;height:22px;border-radius:999px;background:#d6d3cf;position:relative;transition:background .2s;flex:none}
.cms-tg i::after{content:"";position:absolute;left:3px;top:3px;width:16px;height:16px;border-radius:50%;background:#fff;box-shadow:0 1px 2px rgba(0,0,0,.25);transition:transform .2s}
.cms-tg input:checked+i{background:#1d6b45}.cms-tg input:checked+i::after{transform:translateX(14px)}
.cms-tg input:focus-visible+i{outline:2px solid var(--c-sel);outline-offset:2px}
.cms-info{display:flex;gap:8px;background:#f4f6fb;color:#334155;border-radius:10px;padding:10px;font-size:12.5px;line-height:1.45;margin-bottom:14px}.cms-info svg{flex:none;margin-top:1px}.cms-info div{display:grid;gap:8px;justify-items:start}
.cms-img{position:relative;border:1px solid var(--c-line);border-radius:10px;overflow:hidden;aspect-ratio:16/9;background:repeating-conic-gradient(#f3f2ef 0 25%,#fff 0 50%) 0 0/16px 16px}
.cms-img img{width:100%;height:100%;object-fit:cover;display:block}
.cms-img .ph{position:absolute;inset:0;display:grid;place-items:center;align-content:center;gap:6px;color:var(--c-mut);text-align:center;padding:10px}
.cms-img .busy{position:absolute;inset:0;background:rgba(255,255,255,.8);display:flex;align-items:center;justify-content:center;gap:8px;font-weight:600}
.cms-imgb{display:flex;gap:6px;flex-wrap:wrap;align-items:center}
.cms-lib{border:1px solid var(--c-line);border-radius:10px;padding:10px;display:grid;gap:8px;background:#fafaf9}.cms-lib small{font-weight:600;color:var(--c-mut)}.cms-lib p{margin:0;font-size:12px;color:var(--c-mut)}
.cms-lib .g{display:grid;grid-template-columns:repeat(3,1fr);gap:6px}.cms-lib .g button{border:1px solid var(--c-line);border-radius:8px;padding:0;overflow:hidden;aspect-ratio:4/3;background:#fff}.cms-lib .g button:hover{outline:2px solid var(--c-sel)}.cms-lib img{width:100%;height:100%;object-fit:cover;display:block}
.cms-list{list-style:none;margin:0;padding:0;display:grid;gap:6px}
.cms-list details{border:1px solid var(--c-line);border-radius:10px;background:#fff}
.cms-list summary{list-style:none;display:flex;align-items:center;gap:6px;padding:6px 6px 6px 10px;cursor:pointer;font-size:13px;font-weight:600}
.cms-list summary::-webkit-details-marker{display:none}.cms-list summary>span:first-child{flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.cms-list .acts{display:flex}.cms-list .it{padding:4px 10px 0;border-top:1px solid var(--c-line)}
.cms-add{border:1px dashed #c9c6c1;background:none;border-radius:10px;height:38px;display:flex;align-items:center;justify-content:center;gap:6px;font-weight:600;color:var(--c-mut)}.cms-add:hover{border-color:var(--c-ink);color:var(--c-ink)}
.cms-rh{display:flex;align-items:center;gap:10px;padding:14px 14px 12px;border-bottom:1px solid var(--c-line);position:sticky;top:0;background:#fff;z-index:2}
.cms-rh>div{flex:1;min-width:0;display:grid}.cms-rh small{color:var(--c-mut);font-size:12px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.cms-badge{display:inline-flex;align-items:center;gap:4px;font-size:11.5px;color:var(--c-mut);background:#f1f1ef;border-radius:999px;padding:3px 8px}
.cms-rb{padding:14px;flex:1}.cms-rb.dim>*:not(.cms-note){opacity:.55}
.cms-rf{padding:10px 14px 16px;border-top:1px solid var(--c-line)}
.cms-link{border:0;background:none;color:var(--c-mut);font-size:12.5px;display:inline-flex;align-items:center;gap:6px;padding:6px 0;text-decoration:underline;text-underline-offset:3px}.cms-link:hover{color:var(--c-ink)}
.cms-empty{display:grid;justify-items:center;text-align:center;gap:8px;padding:48px 24px;color:var(--c-mut)}.cms-empty b{color:var(--c-ink);font-size:15px}.cms-empty p{margin:0;font-size:13px;line-height:1.5}
.cms-quick{display:grid;gap:6px;width:100%;margin-top:14px}.cms-quick small{font-weight:600;text-align:left}.cms-quick button{border:1px solid var(--c-line);background:#fff;border-radius:9px;padding:9px 10px;text-align:left;font-weight:600;color:var(--c-ink)}.cms-quick button:hover{border-color:#bdb9b3}
.cms-url{display:flex;gap:8px;align-items:center;border:1px solid var(--c-line);border-radius:10px;padding:6px 6px 6px 10px;background:#fafaf9}.cms-url a{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--c-sel);font-size:13px}
.cms-serp{border:1px solid var(--c-line);border-radius:10px;padding:12px;display:grid;gap:2px;font-family:Arial,sans-serif;background:#fff}.cms-serp small{color:#4d5156;font-size:12px}.cms-serp b{color:#1a0dab;font-weight:400;font-size:17px;line-height:1.3}.cms-serp p{margin:0;color:#4d5156;font-size:13px;line-height:1.45}
.cms-grp.danger .cms-btn{justify-self:start}
.cms-stage{position:relative;display:grid;place-items:center;overflow:hidden;min-width:0;background:radial-gradient(circle at 1px 1px,#dcdad5 1px,transparent 0) 0 0/18px 18px,var(--c-bg)}
.cms-fw{position:relative;transition:width .25s,height .25s}
.cms-fw iframe{border:0;display:block;transform-origin:0 0;background:#fff;position:absolute;left:0;top:0}
.cms-fw.m iframe{border-radius:28px;box-shadow:0 0 0 8px #111,0 0 0 9px #333,0 30px 60px -20px rgba(0,0,0,.45)}
.cms-fw.d iframe{border-radius:10px;box-shadow:0 0 0 1px var(--c-line),0 24px 50px -24px rgba(0,0,0,.35)}
.cms-loading{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;gap:10px;font-weight:600;color:var(--c-mut);background:var(--c-bg)}
.cms-spin{width:18px;height:18px;border:2px solid #d6d3cf;border-top-color:var(--c-ink);border-radius:50%;animation:cmsSp .7s linear infinite;display:inline-block}.cms-spin.sm{width:12px;height:12px}
@keyframes cmsSp{to{transform:rotate(360deg)}}
.cms-tabs{display:none}
.cms-toast{position:fixed;left:50%;bottom:24px;transform:translate(-50%,16px);background:var(--c-ink);color:#fff;padding:11px 16px;border-radius:10px;font-weight:600;opacity:0;pointer-events:none;transition:.25s;z-index:5;max-width:calc(100% - 32px);text-align:center}.cms-toast.on{opacity:1;transform:translate(-50%,0)}
.cms-dlg{position:fixed;inset:0;background:rgba(28,25,23,.45);display:grid;place-items:center;z-index:6;padding:16px;animation:cmsIn .18s ease both}
.cms-dlg-in{background:#fff;border-radius:16px;width:min(520px,100%);max-height:calc(100vh - 32px);overflow:auto;padding:20px;display:grid;gap:12px;box-shadow:0 30px 70px -30px rgba(0,0,0,.5)}
.cms-dlg-in h3{margin:0;display:flex;gap:8px;align-items:center;font-size:17px}.cms-dlg-in h3 svg{color:#b45309}.cms-dlg-in>p{margin:0;color:var(--c-mut)}
.cms-dlg-in ul{list-style:none;margin:0;padding:0;display:grid;gap:6px}
.cms-dlg-in li button{width:100%;border:1px solid var(--c-line);background:#fff;border-radius:10px;padding:10px 12px;text-align:left;display:grid;grid-template-columns:1fr auto;gap:2px 10px;align-items:center}
.cms-dlg-in li button:hover{border-color:#bdb9b3;background:#fafaf9}.cms-dlg-in li b{font-size:13px}.cms-dlg-in li span{grid-column:1;color:var(--c-mut);font-size:12.5px}.cms-dlg-in li svg{grid-row:1/3;grid-column:2;transform:rotate(180deg);color:var(--c-mut)}
.cms-dlg-in .row{display:flex;justify-content:flex-end;gap:8px;flex-wrap:wrap}
.only-s{display:none}
@media (max-width:1180px){.cms-body{grid-template-columns:250px minmax(0,1fr) 300px}.hide-s{display:none!important}}
@media (max-width:900px){
  .cms{grid-template-rows:auto 1fr 60px}
  .cms-top{flex-wrap:wrap;padding:8px;gap:6px;row-gap:8px}.cms-where{order:5;flex-basis:100%;justify-content:flex-start}.cms-sel{flex:1;max-width:none}
  .cms-st{display:none}.cms-right-top{margin-left:auto}
  .cms-body{grid-template-columns:minmax(0,1fr);position:relative}
  .cms-left,.cms-right{position:absolute;inset:0;z-index:3;border:0;display:none}
  .cms-body[data-mob=sec] .cms-left,.cms-body[data-mob=look] .cms-left{display:flex}
  .cms-body[data-mob=edit] .cms-right{display:flex}
  .cms-tabs{display:grid;grid-template-columns:repeat(4,1fr);background:#fff;border-top:1px solid var(--c-line);padding-bottom:env(safe-area-inset-bottom,0)}
  .cms-tabs button{border:0;background:none;display:grid;justify-items:center;align-content:center;gap:2px;font-size:11px;font-weight:600;color:var(--c-mut)}.cms-tabs button[aria-pressed=true]{color:var(--c-acc)}
  .only-s{display:inline-grid}
  .cms-pill{position:absolute;left:50%;bottom:14px;transform:translateX(-50%);display:flex;align-items:center;gap:8px;background:var(--c-ink);color:#fff;border:0;border-radius:999px;padding:11px 16px;font-weight:600;box-shadow:0 12px 24px -10px rgba(0,0,0,.5);white-space:nowrap;max-width:calc(100% - 24px);overflow:hidden;text-overflow:ellipsis;animation:cmsIn .2s ease both}
  .cms-in{font-size:16px}
}
@media (prefers-reduced-motion:reduce){.cms,.cms *{animation:none!important;transition:none!important}}
`;document.head.append(s)}

window.SiteEditor={open,close:()=>close(),isOpen:()=>!!root};
})();
