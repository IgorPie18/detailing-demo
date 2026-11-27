// Test edytora strony (mini CMS): pliki z dysku pod http://app.test, zapisy do bazy podmienione atrapą
const {chromium}=require(process.env.PW);const fs=require('fs'),path=require('path');
const ROOT=require('path').resolve(__dirname,'../..'),SP=process.env.SP||require('os').tmpdir();
const env=Object.fromEntries(fs.readFileSync('C:/Users/Igor/Documents/shopify-workspace/a_detailing/.env','utf8').split(/\r?\n/).filter(l=>l.includes('=')).map(l=>[l.slice(0,l.indexOf('=')).trim(),l.slice(l.indexOf('=')+1).trim()]));
const TYPES={'.html':'text/html','.js':'application/javascript','.jpg':'image/jpeg','.png':'image/png','.css':'text/css'};
let pass=0,fail=0;const ok=(c,m)=>{c?pass++:fail++;console.log((c?'PASS ':'FAIL ')+m)};
(async()=>{const b=await chromium.launch({channel:'msedge'});const errs=[],patches=[];
  const ctx=await b.newContext({viewport:{width:1440,height:900}});
  await ctx.route('http://app.test/**',r=>{const u=new URL(r.request().url());const f=path.join(ROOT,decodeURIComponent(u.pathname));if(!fs.existsSync(f))return r.fulfill({status:404,body:''});r.fulfill({status:200,body:fs.readFileSync(f),contentType:TYPES[path.extname(f)]||'application/octet-stream'})});
  await ctx.route(/rest\/v1\/studios/,r=>{if(r.request().method()==='PATCH'){patches.push(r.request().postData());return r.fulfill({status:204,body:''})}r.continue()});
  await ctx.route(/storage\/v1\/object\/public\//,r=>r.continue());
  await ctx.route(/storage\/v1\/object\/(?!public)/,r=>r.fulfill({status:200,contentType:'application/json',body:JSON.stringify({Key:'x'})}));
  const p=await ctx.newPage();p.on('pageerror',e=>errs.push('page: '+e.message));p.on('console',m=>{if(m.type()==='error'&&!/favicon|ERR_|404/.test(m.text()))errs.push('console: '+m.text())});
  await p.goto('http://app.test/salon.html#panel');await p.waitForSelector('#l-mail',{timeout:15000});
  await p.fill('#l-mail',env.ADMIN_EMAIL);await p.fill('#l-pw',env.ADMIN_PASSWORD);await p.press('#l-pw','Enter');
  await p.waitForSelector('[data-nav="www"]',{timeout:20000});await p.waitForTimeout(1500);
  await p.evaluate(()=>{const t=document.querySelector('#tour');if(typeof tourEnd==='function'&&t)tourEnd()});
  await p.click('#sbody [data-nav="www"]');await p.waitForTimeout(600);
  ok(await p.isVisible('text=Szybkie zmiany'),'ekran Strona www w panelu');
  await p.screenshot({path:SP+'/c-panel.png'});
  await p.click('.ptop [data-www=""]');
  await p.waitForSelector('.cms',{timeout:10000});
  await p.waitForFunction(()=>document.querySelector('#cms-loading')&&document.querySelector('#cms-loading').hidden,null,{timeout:20000});await p.waitForTimeout(1200);
  ok(true,'edytor i podgląd wczytane');
  const fr=p.frameLocator('#cms-frame');
  await p.screenshot({path:SP+'/c-ed-d.png'});
  // klik w podgląd zaznacza sekcję
  await fr.locator('.hero h1').click();await p.waitForTimeout(400);
  ok(await p.locator('.cms-rh b').textContent()==='Baner główny','klik w banerze na podglądzie otwiera jego ustawienia');
  const ta=p.locator('#cms-right textarea').first();await ta.fill('Nowy tytuł z edytora');await p.waitForTimeout(500);
  ok((await fr.locator('.hero h1').textContent()).includes('Nowy tytuł z edytora'),'podgląd na żywo: tytuł banera');
  await p.screenshot({path:SP+'/c-ed-sel.png'});
  // ukrycie sekcji
  await p.click('[data-x="eye"][data-v="home.gallery"]');await p.waitForTimeout(400);
  ok(await fr.locator('#realizacje').count()===0,'ukrycie sekcji Realizacje');
  await p.keyboard.press('Control+z');await p.waitForTimeout(400);
  ok(await fr.locator('#realizacje').count()===1,'cofnij (Ctrl+Z) przywraca sekcję');
  // lista: opinie
  await p.click('[data-x="sel"][data-v="home.reviews"]');await p.waitForTimeout(400);
  await p.click('#cms-right [data-x="add"]');await p.waitForTimeout(300);
  const inp=p.locator('#cms-right details[open] .cms-in');await inp.nth(0).fill('Kamil');await inp.nth(2).fill('Świetna robota przy ceramice.');await p.waitForTimeout(500);
  ok((await fr.locator('.rev').last().textContent()).includes('Świetna robota'),'dodanie opinii widać w podglądzie');
  // biblioteka zdjęć
  await p.click('[data-x="sel"][data-v="home.about"]');await p.waitForTimeout(300);
  await p.click('#cms-right [data-x="lib"]');await p.waitForTimeout(300);
  ok(await p.locator('.cms-lib').count()===1,'biblioteka zdjęć się otwiera');
  await p.click('.cms-lib [data-v="assets/ppf.jpg"]');await p.waitForTimeout(500);
  ok((await fr.locator('.ab-img').getAttribute('src'))==='assets/ppf.jpg','wybór zdjęcia z biblioteki');
  // wygląd
  await p.click('[data-x="tab"][data-v="look"]');await p.click('[data-x="pal"][data-v="noc"]');await p.click('[data-x="font"][data-v="oswald"]');await p.waitForTimeout(1200);
  const bg=await fr.locator('#scroller').evaluate(e=>getComputedStyle(e).backgroundColor);ok(bg==='rgb(14, 15, 17)','paleta Noc w podglądzie ('+bg+')');
  const ff=await fr.locator('.sec h2').first().evaluate(e=>getComputedStyle(e).fontFamily);ok(/Oswald/.test(ff),'czcionka Oswald w nagłówkach');
  await fr.locator('#scroller').evaluate(e=>e.scrollTop=0);await p.screenshot({path:SP+'/c-ed-dark.png'});
  await fr.locator('#scroller').evaluate(e=>{e.style.scrollBehavior='auto';e.scrollTop=e.scrollHeight*.42});await p.waitForTimeout(300);await p.screenshot({path:SP+'/c-ed-dark2.png'});
  // telefon
  await p.click('[data-x="dev"][data-v="m"]');await p.waitForTimeout(700);await p.screenshot({path:SP+'/c-ed-m.png'});
  // podstrona usługi
  await p.click('[data-x="tab"][data-v="sec"]');await p.selectOption('[data-x="page"]','svc');await p.waitForTimeout(1500);
  ok(await fr.locator('.svc-top').count()===1,'przełączenie na Stronę usługi');
  await p.click('[data-x="sel"][data-v="svc.top"]');await p.waitForTimeout(300);
  await p.locator('#cms-right input.cms-in').first().fill('Ceramika Poznań, 5 lat ochrony');await p.waitForTimeout(500);
  ok((await fr.locator('.svc-title h1').textContent()).includes('5 lat'),'tytuł usługi z edytora');
  await p.selectOption('[data-x="page"]','book');await p.waitForTimeout(1000);
  ok(await fr.locator('.bk-body h2').count()===1,'podstrona Rezerwacja');
  await p.selectOption('[data-x="page"]','done');await p.waitForTimeout(1000);
  ok(await fr.locator('div.done h2').count()===1,'podstrona Potwierdzenie (dane przykładowe)');
  await p.selectOption('[data-x="page"]','status');await p.waitForTimeout(1000);
  ok(await fr.locator('.stp h1').count()===1,'podstrona Status auta (dane przykładowe)');
  await p.click('[data-x="dev"][data-v="d"]');await p.waitForTimeout(600);await p.screenshot({path:SP+'/c-ed-status.png'});
  // publikacja
  const before=patches.length;await p.click('[data-x="publish"]');await p.waitForTimeout(400);
  if(await p.locator('#cms-dlg').count()){await p.screenshot({path:SP+'/c-dlg.png'});await p.click('[data-x="pubok"]')}
  await p.waitForTimeout(1200);
  const last=patches.slice(before).pop()||'';ok(/"site":\{/.test(last)&&/Nowy tytuł z edytora/.test(last),'publikacja zapisuje settings.site');
  ok(await p.locator('.cms-st.ok').count()===1,'status: wszystko opublikowane');
  await p.click('[data-x="exit"]');await p.waitForTimeout(500);ok(await p.locator('.cms').count()===0,'wyjście z edytora');
  // telefon: edytor
  await p.setViewportSize({width:390,height:844});await p.click('.ptop [data-www=""]').catch(async()=>{await p.evaluate(()=>openSite(''))});
  await p.waitForFunction(()=>document.querySelector('#cms-loading')&&document.querySelector('#cms-loading').hidden,null,{timeout:20000});await p.waitForTimeout(1000);
  await p.screenshot({path:SP+'/c-mob-view.png'});
  await fr.locator('.hero h1').click();await p.waitForTimeout(400);
  ok(await p.locator('.cms-pill').count()===1,'telefon: klik w podgląd pokazuje „Edytuj”');
  await p.click('.cms-pill');await p.waitForTimeout(300);await p.screenshot({path:SP+'/c-mob-edit.png'});
  await p.click('.cms-tabs [data-v="look"]');await p.waitForTimeout(300);await p.screenshot({path:SP+'/c-mob-look.png'});
  console.log(`\n${pass} PASS, ${fail} FAIL`);console.log(errs.join('\n')||'bez błędów JS');await b.close()})().catch(e=>{console.error('CRASH',e.message);process.exit(1)});
