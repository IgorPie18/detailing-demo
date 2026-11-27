/* Mini CMS strony salonu: stały układ podstron, domyślne treści, motyw (kolory, czcionki, zaokrąglenia).
   Wspólne dla strony klienta (salon.html) i edytora (assets/site-editor.js).
   Dane: catalog.settings.site (opublikowane) i catalog.settings.site_draft (szkic z edytora).
   Moduł samodzielny, do przeniesienia przy przejściu na React. */
(function(){
'use strict';
const STOCK=['assets/hero.jpg','assets/ceramika.jpg','assets/korekta.jpg','assets/ppf.jpg','assets/mycie.jpg','assets/wnetrze.jpg'];

/* pary czcionek: nagłówki + tekst, wszystkie z polskimi znakami (latin-ext) */
const FONTS=[
  {id:'archivo',name:'Klasyczny',d:'Archivo',b:'Inter',q:'family=Archivo:wght@500;600;700;800&family=Inter:wght@400;500;600;700'},
  {id:'onest',name:'Nowoczesny',d:'Onest',b:'Onest',q:'family=Onest:wght@400;500;600;700;800'},
  {id:'grotesk',name:'Techniczny',d:'Space Grotesk',b:'Inter',q:'family=Space+Grotesk:wght@500;600;700&family=Inter:wght@400;500;600;700'},
  {id:'oswald',name:'Sportowy',d:'Oswald',b:'Roboto',q:'family=Oswald:wght@500;600;700&family=Roboto:wght@400;500;700'},
  {id:'unbounded',name:'Wyrazisty',d:'Unbounded',b:'Manrope',q:'family=Unbounded:wght@500;600;700&family=Manrope:wght@400;500;600;700'},
  {id:'playfair',name:'Premium',d:'Playfair Display',b:'Lato',q:'family=Playfair+Display:wght@600;700;800&family=Lato:wght@400;700'},
  {id:'sora',name:'Miękki',d:'Sora',b:'Sora',q:'family=Sora:wght@400;500;600;700'},
  {id:'montserrat',name:'Uniwersalny',d:'Montserrat',b:'Open Sans',q:'family=Montserrat:wght@500;600;700;800&family=Open+Sans:wght@400;600;700'}
];
/* gotowe palety: tło, tekst, akcent (przyciski), ciemne sekcje (baner, stopka, bon) */
const PALS=[
  {id:'grafit',name:'Grafit',bg:'#ffffff',text:'#111213',acc:'#111213',dark:'#151617'},
  {id:'noc',name:'Noc i czerwień',bg:'#0e0f11',text:'#f1f2f4',acc:'#e11d2e',dark:'#050506'},
  {id:'zloto',name:'Czerń i złoto',bg:'#0f0f0e',text:'#f4efe4',acc:'#c9a24a',dark:'#060605'},
  {id:'blekit',name:'Biel i błękit',bg:'#ffffff',text:'#0f172a',acc:'#1d4ed8',dark:'#0b1220'},
  {id:'pomarancz',name:'Ciepła pomarańcz',bg:'#fafaf9',text:'#1c1917',acc:'#c2410c',dark:'#1c1917'},
  {id:'zielen',name:'Głęboka zieleń',bg:'#f6f7f4',text:'#14201a',acc:'#1f6f4a',dark:'#13201a'},
  {id:'sport',name:'Sportowa czerwień',bg:'#ffffff',text:'#111111',acc:'#c8102e',dark:'#111111'},
  {id:'petrol',name:'Grafit i turkus',bg:'#101418',text:'#e8eef2',acc:'#14b8a6',dark:'#06090b'}
];
const RADII={ostre:.3,srednie:1,okragle:1.6};

/* ---------- kolory ---------- */
const hex=c=>{c=String(c||'').trim();if(/^#[0-9a-f]{3}$/i.test(c))c='#'+[...c.slice(1)].map(x=>x+x).join('');return /^#[0-9a-f]{6}$/i.test(c)?c.toLowerCase():null};
const rgb=c=>{c=hex(c)||'#000000';return [1,3,5].map(i=>parseInt(c.slice(i,i+2),16))};
const toHex=a=>'#'+a.map(v=>Math.max(0,Math.min(255,Math.round(v))).toString(16).padStart(2,'0')).join('');
const mix=(a,b,t)=>{const x=rgb(a),y=rgb(b);return toHex(x.map((v,i)=>v*t+y[i]*(1-t)))};
const lum=c=>{const [r,g,b]=rgb(c).map(v=>{v/=255;return v<=.03928?v/12.92:Math.pow((v+.055)/1.055,2.4)});return .2126*r+.7152*g+.0722*b};
const contrast=(a,b)=>{const x=lum(a),y=lum(b);return (Math.max(x,y)+.05)/(Math.min(x,y)+.05)};
const onCol=c=>contrast(c,'#ffffff')>=contrast(c,'#111213')?'#ffffff':'#111213';
const rgba=(c,a)=>{const [r,g,b]=rgb(c);return `rgba(${r},${g},${b},${a})`};

/* ---------- schemat: stały układ podstron ----------
   pole: [klucz, typ, etykieta, domyślnie, dodatki]
   typy: text, area, img, toggle, select, list (pola elementów w f), num, info */
function schema(ctx){
  const lumen=!!ctx.lumen;
  return [
  {id:'home',name:'Strona główna',screen:'home',sections:[
    {id:'home.header',name:'Nagłówek',fixed:1,fields:[
      ['info','info','Logo, kolory i czcionki zmieniasz w zakładce Wygląd.'],
      ['call','toggle','Przycisk „Zadzwoń”',true],
      ['cta','text','Przycisk w nagłówku (komputer)','Zarezerwuj',{max:24}]]},
    {id:'home.hero',name:'Baner główny',fixed:1,fields:[
      ['eyebrow','text','Nadtytuł','',{max:50,ph:'Detailing · miasto z ustawień'}],
      ['title','area','Tytuł','Auto jak z salonu. Termin online w 2 minuty.',{max:90,rows:2}],
      ['sub','area','Opis pod tytułem','Mycie, korekta lakieru, ceramika i folia PPF. Cenę widzisz przed rezerwacją.',{max:200,rows:3}],
      ['img','img','Zdjęcie w tle','assets/hero.jpg',{hint:'Poziome, min. 1600 × 1000 px. Na telefonie widać środek zdjęcia.',none:1}],
      ['pos','select','Kadr zdjęcia','center',{opts:[['top','Góra'],['center','Środek'],['bottom','Dół']]}],
      ['dim','num','Przyciemnienie zdjęcia (%)',55,{min:0,max:85,step:5}],
      ['cta','text','Główny przycisk','Zarezerwuj termin',{max:30}],
      ['cta2','text','Drugi przycisk (pusty = ukryty)','Cennik',{max:30}],
      ['rating','toggle','Ocena z Google',lumen],
      ['rate','text','Ocena','4,9',{max:4}],
      ['revs','text','Liczba opinii','212 opinii Google',{max:30}]]},
    {id:'home.chips',name:'Pasek zalet',fields:[
      ['items','list','Zalety',[{t:'Cena znana przed wizytą'},{t:'Zadatek BLIK'},{t:'Potwierdzenie SMS'},{t:'Gwarancja na powłoki'}],{f:[['t','text','Tekst','',{max:40}]],max:6,add:'Dodaj zaletę',title:'t'}]]},
    {id:'home.services',name:'Usługi i ceny',fixed:1,fields:[
      ['title','text','Tytuł','Usługi i ceny',{max:50}],
      ['lead','area','Opis','Cena zależy od wielkości auta. Dokładną kwotę zobaczysz przy rezerwacji.',{max:200,rows:2}],
      ['info','info','Usługi, ceny i zdjęcia usług zmieniasz w Cenniku. Opisy usług: podstrona „Strona usługi”.',{nav:'cen',btn:'Otwórz Cennik'}]]},
    {id:'home.ba',name:'Przed i po',fields:[
      ['title','text','Tytuł','Przed i po',{max:50}],
      ['lead','area','Opis','Korekta lakieru i ceramika, Hyundai Tucson. Przesuń suwak.',{max:160,rows:2}],
      ['before','img','Zdjęcie „przed”','',{hint:'To samo ujęcie co „po”, poziome.',auto:'zdjęcie ceramiki (przyciemnione)'}],
      ['after','img','Zdjęcie „po”','',{hint:'Poziome, min. 1200 × 800 px.',auto:'zdjęcie ceramiki'}]]},
    {id:'home.gallery',name:'Realizacje',fields:[
      ['title','text','Tytuł','Nasze realizacje',{max:50}],
      ['lead','area','Opis','Auta, które wyjechały od nas w ostatnich tygodniach.',{max:160,rows:2}],
      ['items','list','Zdjęcia',STOCK.slice(1).map((u,i)=>({img:u,t:['Ceramika, BMW serii 3','Korekta lakieru, Audi A5','Folia PPF, Porsche Macan','Mycie detailingowe, Kia Sportage','Pranie wnętrza, Skoda Superb'][i]})),{f:[['img','img','Zdjęcie',''],['t','text','Podpis','',{max:60}]],max:12,add:'Dodaj zdjęcie',title:'t'}],
      ['ig','text','Link do Instagrama (opcjonalnie)','',{max:120,ph:'https://instagram.com/twojsalon'}]]},
    {id:'home.steps',name:'Jak wygląda rezerwacja',fields:[
      ['title','text','Tytuł','Jak wygląda rezerwacja',{max:50}],
      ['items','list','Kroki',[{t:'Wybierasz usługę i auto',d:'Cena przelicza się od razu.'},{t:'Wybierasz dzień oddania auta',d:'Przy usługach wielodniowych widzisz też datę odbioru.'},{t:'Dostajesz SMS z potwierdzeniem',d:'Dzień przed wizytą przypomnimy o terminie.'}],{f:[['t','text','Krok','',{max:50}],['d','text','Opis','',{max:100}]],min:2,max:4,add:'Dodaj krok',title:'t'}]]},
    {id:'home.about',name:'O nas',fields:[
      ['title','text','Tytuł','O nas',{max:50}],
      ['text','area','Tekst','Jesteśmy małym studiem detailingu. Każde auto robimy sami, bez pośpiechu. Przy przyjęciu spisujemy stan auta ze zdjęciami, a po odbiorze dostajesz kartę gwarancyjną na powłoki.',{max:600,rows:5}],
      ['img','img','Zdjęcie (zespół albo studio)','assets/wnetrze.jpg',{hint:'Poziome albo kwadratowe.',none:1}],
      ['brands','text','Marki i certyfikaty (po przecinku)','',{max:160,ph:'np. Gyeon, Gtechniq, XPEL'}],
      ['since','text','Wyróżnik w liczbach (opcjonalnie)','',{max:40,ph:'np. 1200+ aut od 2016 roku'}]]},
    {id:'home.reviews',name:'Opinie',fields:[
      ['title','text','Tytuł','Opinie klientów',{max:50}],
      ['items','list','Opinie',(ctx.reviews||[]).map(r=>({n:r[0],car:r[2],t:r[1]})),{f:[['n','text','Imię','',{max:40}],['car','text','Auto','',{max:40}],['t','area','Treść','',{max:300,rows:3}]],max:10,add:'Dodaj opinię',title:'n'}],
      ['link','text','Link do opinii w Google (opcjonalnie)','',{max:200,ph:'https://g.page/r/…'}]]},
    {id:'home.voucher',name:'Bon podarunkowy',when:'bon',fields:[
      ['title','text','Tytuł','Voucher na prezent',{max:50}],
      ['text','area','Opis','Mycie, wnętrze albo ceramika. Kwota od 150 zł, PDF od razu na maila.',{max:160,rows:2}],
      ['cta','text','Przycisk','Kup voucher',{max:30}]]},
    {id:'home.map',name:'Dojazd i godziny',fixed:1,fields:[
      ['title','text','Tytuł','Dojazd i godziny',{max:50}],
      ['info','info','Adres, telefon i godziny otwarcia pobieramy z Ustawień → Dane salonu.',{nav:'ust',btn:'Otwórz Ustawienia'}],
      ['route','toggle','Przycisk „Wyznacz trasę” (Google Maps)',true]]},
    {id:'home.faq',name:'Pytania',fields:[
      ['title','text','Tytuł','Pytania',{max:50}],
      ['items','list','Pytania i odpowiedzi',[
        {q:'Czy muszę płacić z góry?',a:'Przy myciu i wnętrzu pobieramy zadatek 50-100 zł BLIK-iem, resztę płacisz na miejscu. Przy ceramice, korekcie i PPF najpierw potwierdzamy cenę po zdjęciach.'},
        {q:'Mogę zmienić termin?',a:'Tak, do 24 godzin przed wizytą odpowiedz na SMS albo zadzwoń. Zadatek przechodzi na nowy termin.'},
        {q:'Czy mogę zostawić auto dzień wcześniej?',a:'Tak, napisz o tym w uwagach przy rezerwacji.'}],{f:[['q','text','Pytanie','',{max:120}],['a','area','Odpowiedź','',{max:500,rows:3}]],max:12,add:'Dodaj pytanie',title:'q'}]]},
    {id:'home.cta',name:'Zaproszenie na końcu',fields:[
      ['title','text','Tytuł','Umów auto w 2 minuty',{max:60}],
      ['text','area','Opis','Wybierasz usługę, auto i termin. Cenę znasz od razu, potwierdzenie przychodzi SMS-em.',{max:180,rows:2}],
      ['cta','text','Przycisk','Zarezerwuj termin',{max:30}]]},
    {id:'home.footer',name:'Stopka',fixed:1,fields:[
      ['text','area','Dodatkowy tekst','',{max:200,rows:2,ph:'np. NIP, informacja o parkingu'}],
      ['ig','text','Instagram','',{max:120,ph:'https://instagram.com/…'}],
      ['fb','text','Facebook','',{max:120,ph:'https://facebook.com/…'}],
      ['tt','text','TikTok','',{max:120,ph:'https://tiktok.com/@…'}],
      ['yt','text','YouTube','',{max:120,ph:'https://youtube.com/@…'}]]},
    {id:'home.dock',name:'Pasek rezerwacji (telefon)',fixed:1,fields:[
      ['small','text','Mały tekst','Mycie, wnętrze, ceramika, PPF',{max:40}],
      ['cta','text','Przycisk','Zarezerwuj termin',{max:24}],
      ['info','info','Cena „od” liczy się sama z najtańszej usługi. Na komputerze zamiast paska jest przycisk w nagłówku.']]}
  ]},
  {id:'svc',name:'Strona usługi',screen:'svc',perSvc:1,sections:[
    {id:'svc.top',name:'Opis usługi',fixed:1,per:1,fields:[
      ['title','text','Tytuł strony','',{max:80,auto:'nazwa usługi'}],
      ['short','area','Krótki opis','',{max:240,rows:3,auto:'opis z Cennika'}],
      ['img','img','Zdjęcie usługi','',{hint:'Poziome, min. 1600 × 900 px.',auto:'zdjęcie z Cennika'}]]},
    {id:'svc.price',name:'Cennik według auta',fixed:1,fields:[
      ['title','text','Tytuł','Cennik według auta',{max:50}],
      ['info','info','Ceny zmieniasz w Cenniku.',{nav:'cen',btn:'Otwórz Cennik'}]]},
    {id:'svc.incl',name:'Co obejmuje',per:1,fields:[
      ['title','text','Tytuł (wszystkie usługi)','Co obejmuje',{max:50,shared:1}],
      ['incl','list','Punkty tej usługi',null,{f:[['t','text','Punkt','',{max:120}]],max:12,add:'Dodaj punkt',title:'t',auto:'z opisu usługi'}]]},
    {id:'svc.ba',name:'Efekt (przed i po)',fields:[
      ['title','text','Tytuł','Efekt',{max:50}],
      ['info','info','Zdjęcia „przed i po” biorą się ze zdjęcia usługi.']]},
    {id:'svc.faq',name:'Pytania',per:1,fields:[
      ['title','text','Tytuł (wszystkie usługi)','Pytania',{max:50,shared:1}],
      ['faq','list','Pytania tej usługi',null,{f:[['q','text','Pytanie','',{max:120}],['a','area','Odpowiedź','',{max:500,rows:3}]],max:10,add:'Dodaj pytanie',title:'q',auto:'z opisu usługi'}]]},
    {id:'svc.more',name:'Inne usługi',fields:[
      ['title','text','Tytuł','Inne usługi',{max:50}]]}
  ]},
  {id:'book',name:'Rezerwacja',screen:'book',sections:[
    {id:'book.steps',name:'Kroki rezerwacji',fixed:1,fields:[
      ['info','info','Układ i kolejność kroków są stałe, zmieniasz tylko teksty.'],
      ['usluga','text','Krok „Usługa”: pytanie','Co robimy z autem?',{max:60}],
      ['usluga_h','text','Krok „Usługa”: podpowiedź','Możesz wybrać jedną usługę główną. Dodatki będą za chwilę.',{max:140}],
      ['auto','text','Krok „Auto”: pytanie','Jakie masz auto?',{max:60}],
      ['auto_h','text','Krok „Auto”: podpowiedź','Od wielkości zależy cena i czas pracy.',{max:140}],
      ['zdjecia','text','Krok „Zdjęcia”: pytanie','Pokaż stan lakieru',{max:60}],
      ['zdjecia_h','text','Krok „Zdjęcia”: podpowiedź','2-4 zdjęcia z telefonu wystarczą. Dzięki nim salon potwierdzi dokładną cenę bez oględzin.',{max:160}],
      ['termin','text','Krok „Termin”: pytanie','Kiedy oddajesz auto?',{max:60}],
      ['dane','text','Krok „Dane”: pytanie','Twoje dane',{max:60}],
      ['dane_h','text','Krok „Dane”: podpowiedź','Bez zakładania konta. Numer telefonu jest potrzebny do SMS-a z potwierdzeniem.',{max:160}]]}
  ]},
  {id:'done',name:'Potwierdzenie rezerwacji',screen:'done',sections:[
    {id:'done.main',name:'Potwierdzenie',fixed:1,fields:[
      ['t1','text','Tytuł (termin od ręki)','Termin zarezerwowany',{max:50}],
      ['t2','text','Tytuł (do potwierdzenia)','Prośba wysłana',{max:50}],
      ['p2','area','Tekst (do potwierdzenia)','Salon potwierdzi termin i cenę SMS-em, zwykle w ciągu 2 godzin.',{max:200,rows:2}],
      ['n2','text','Co dalej: krok 2','Przypomnienie dzień przed wizytą',{max:80}],
      ['n3','text','Co dalej: krok 3','Po odbiorze prośba o opinię w Google',{max:80}]]}
  ]},
  {id:'status',name:'Status auta (link z SMS)',screen:'status',sections:[
    {id:'status.main',name:'Status auta',fixed:1,fields:[
      ['info','info','Tę stronę klient otwiera z linku w SMS-ie. Treść tworzy się sama z wizyty, tu zmieniasz tylko wygląd (zakładka Wygląd). W podglądzie widać przykładową wizytę.']]}
  ]},
  {id:'voucher',name:'Bon podarunkowy',screen:'voucher',when:'bon',sections:[
    {id:'voucher.main',name:'Zakup bonu',fixed:1,fields:[
      ['title','text','Tytuł na bonie','Bon podarunkowy',{max:40}],
      ['text','text','Opis na bonie','Na dowolną usługę w salonie. Ważny 12 miesięcy.',{max:100}],
      ['amounts','text','Kwoty do wyboru (zł, po przecinku)','150, 300, 500, 1000',{max:40}]]}
  ]},
  {id:'reg',name:'Regulamin',screen:'doc',doc:'regulamin',sections:[
    {id:'doc.regulamin',name:'Treść regulaminu',fixed:1,fields:[
      ['info','info','Domyślnie pokazujemy wzór z danymi salonu. Wpisz własną treść, jeśli masz regulamin od prawnika. Linia zaczynająca się od # to nagłówek.'],
      ['own','area','Własna treść (pusta = wzór)','',{max:12000,rows:12}]]}
  ]},
  {id:'pry',name:'Polityka prywatności',screen:'doc',doc:'prywatnosc',sections:[
    {id:'doc.prywatnosc',name:'Treść polityki',fixed:1,fields:[
      ['info','info','Domyślnie pokazujemy wzór z danymi salonu. Linia zaczynająca się od # to nagłówek.'],
      ['own','area','Własna treść (pusta = wzór)','',{max:12000,rows:12}]]}
  ]}
  ];
}
/* ustawienia globalne (zakładka Wygląd) */
const THEME_DEF={pal:'grafit',bg:'#ffffff',text:'#111213',acc:'#111213',dark:'#151617',font:'archivo',rad:'srednie'};
const LOGO_DEF={t:'',s:'detailing',img:'',h:32};
const SEO_DEF={title:'',desc:''};

let SC_CACHE=null,SC_KEY='';
function getSchema(ctx){const k=JSON.stringify(ctx);if(k!==SC_KEY){SC_KEY=k;SC_CACHE=schema(ctx)}return SC_CACHE}
function secDef(ctx,id){for(const p of getSchema(ctx))for(const s of p.sections)if(s.id===id)return s;return null}
function defaults(ctx,id){const s=secDef(ctx,id),o={on:true};if(s)s.fields.forEach(f=>{if(f[1]!=='info')o[f[0]]=f[3]});return o}
/* treść sekcji: domyślne + zapisane (lista nadpisuje całą listę) */
function sec(cfg,ctx,id){const o=(cfg&&cfg.sec&&cfg.sec[id])||{};return Object.assign(defaults(ctx,id),o)}
function svcOv(cfg,sid){return (cfg&&cfg.svc&&cfg.svc[sid])||{}}
const theme=cfg=>Object.assign({},THEME_DEF,cfg&&cfg.theme||{});
const logo=cfg=>Object.assign({},LOGO_DEF,cfg&&cfg.logo||{});
const seo=cfg=>Object.assign({},SEO_DEF,cfg&&cfg.seo||{});
const fontOf=id=>FONTS.find(f=>f.id===id)||FONTS[0];

/* zmienne CSS strony z motywu */
function vars(cfg){
  const t=theme(cfg),bg=hex(t.bg)||THEME_DEF.bg,tx=hex(t.text)||THEME_DEF.text,ac=hex(t.acc)||THEME_DEF.acc,dk=hex(t.dark)||THEME_DEF.dark,f=fontOf(t.font),dark=lum(bg)<.25;
  const heroBtn=contrast(ac,dk)>=2.2?ac:onCol(dk);
  return {
    '--s-bg':bg,'--s-bg-a':rgba(bg,.94),'--ink':tx,'--ink-2':mix(tx,bg,.86),'--grey':mix(tx,bg,.64),'--grey-2':mix(tx,bg,.44),
    '--line':mix(tx,bg,dark?.16:.12),'--mist':mix(tx,bg,dark?.08:.05),'--paper':dark?mix(tx,bg,.045):(lum(bg)>.97?'#ffffff':mix('#ffffff',bg,.7)),
    '--s-acc':ac,'--s-on':onCol(ac),'--s-dk':dk,'--s-dk2':mix('#ffffff',dk,.14),'--s-on-dk':onCol(dk),'--s-hb':heroBtn,'--s-hb-on':onCol(heroBtn),
    '--display':`'${f.d}','Helvetica Neue',Arial,sans-serif`,'--body':`'${f.b}',system-ui,-apple-system,'Segoe UI',Arial,sans-serif`,
    '--s-r':String(RADII[t.rad]||1),'color-scheme':dark?'dark':'light'
  };
}
function loadFont(id,doc=document){const f=fontOf(id);if(f.id==='archivo')return;const hid='cmsf-'+f.id;if(doc.getElementById(hid))return;
  const l=doc.createElement('link');l.id=hid;l.rel='stylesheet';l.href='https://fonts.googleapis.com/css2?'+f.q+'&display=swap';doc.head.append(l)}
function apply(el,cfg){if(!el)return;const v=vars(cfg);for(const k in v){if(k==='color-scheme')el.style.colorScheme=v[k];else el.style.setProperty(k,v[k])}loadFont(theme(cfg).font,el.ownerDocument)}
/* problemy z kontrastem (WCAG 2.2: 4.5 dla tekstu, 3 dla dużych elementów) */
function checks(cfg){
  const t=theme(cfg),out=[];
  const c1=contrast(t.text,t.bg);if(c1<4.5)out.push({k:'text',msg:`Tekst słabo widać na tle (kontrast ${c1.toFixed(1)}:1, potrzeba min. 4,5:1).`});
  const c2=contrast(t.acc,t.bg);if(c2<3)out.push({k:'acc',msg:`Przyciski zlewają się z tłem (kontrast ${c2.toFixed(1)}:1, potrzeba min. 3:1).`});
  return out;
}
/* tekst wielolinijkowy -> akapity (z nagłówkami po #) */
function paras(s,esc){return String(s||'').split(/\n{2,}/).map(p=>p.trim()).filter(Boolean).map(p=>p.startsWith('#')?`<h2>${esc(p.replace(/^#+\s*/,''))}</h2>`:`<p>${esc(p).replace(/\n/g,'<br>')}</p>`).join('')}
function doc(s,esc){return String(s||'').split('\n').reduce((a,l)=>{const t=l.trim();if(!t){a.push('');return a}if(t.startsWith('#')){a.push('#'+t);a.push('');return a}const i=a.length-1;if(i>=0&&a[i]&&!a[i].startsWith('#'))a[i]+='\n'+t;else a.push(t);return a},[]).filter(Boolean).map(p=>p.startsWith('#')?`<h2>${esc(p.replace(/^#+\s*/,''))}</h2>`:`<p>${esc(p).replace(/\n/g,'<br>')}</p>`).join('')}
const safeUrl=u=>{u=String(u||'').trim();return /^https:\/\/[^\s"'<>]+$/i.test(u)?u:''};

window.CMS={STOCK,FONTS,PALS,RADII,THEME_DEF,LOGO_DEF,SEO_DEF,schema:getSchema,secDef,defaults,sec,svcOv,theme,logo,seo,fontOf,vars,apply,loadFont,checks,paras,doc,safeUrl,contrast,hex,mix,onCol};
})();
