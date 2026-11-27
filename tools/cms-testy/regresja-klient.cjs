// Regresja: demo telefonu (#klient) bez zmian w działaniu + ekrany klienta w ciemnej palecie
const {chromium}=require(process.env.PW);const fs=require('fs'),path=require('path');
const ROOT=require('path').resolve(__dirname,'../..'),SP=process.env.SP||require('os').tmpdir();
const TYPES={'.html':'text/html','.js':'application/javascript','.jpg':'image/jpeg','.png':'image/png'};
let pass=0,fail=0;const ok=(c,m)=>{c?pass++:fail++;console.log((c?'PASS ':'FAIL ')+m)};
(async()=>{const b=await chromium.launch({channel:'msedge'});const errs=[];
  const ctx=await b.newContext({viewport:{width:1366,height:900}});
  await ctx.route('http://app.test/**',r=>{const u=new URL(r.request().url());const f=path.join(ROOT,decodeURIComponent(u.pathname));if(!fs.existsSync(f))return r.fulfill({status:404,body:''});r.fulfill({status:200,body:fs.readFileSync(f),contentType:TYPES[path.extname(f)]||'application/octet-stream'})});
  await ctx.route(/rest\/v1\/(bookings|studios|waitlist|vouchers)/,r=>{if(r.request().method()!=='GET'){return r.fulfill({status:201,contentType:'application/json',body:'[]'})}r.continue()});
  const p=await ctx.newPage();p.on('pageerror',e=>errs.push('page: '+e.message));
  await p.goto('http://app.test/salon.html');await p.waitForTimeout(3000);
  ok(await p.isVisible('.phone .hero'),'demo telefonu: strona salonu w ramce');
  ok(!(await p.evaluate(()=>document.documentElement.classList.contains('bare'))),'demo telefonu nie jest w trybie strony');
  await p.screenshot({path:SP+'/r-demo.png'});
  // przejścia klienta jak dotąd
  await p.click('[data-jump="svc"]');await p.waitForTimeout(500);ok(await p.locator('#scroller .svc-title h1').count()===1,'skok: strona usługi');
  await p.click('[data-jump="book-instant"]');await p.waitForTimeout(500);ok(await p.locator('#scroller .bk-body h2').count()>=1,'skok: rezerwacja z zadatkiem');
  await p.click('[data-jump="voucher"]');await p.waitForTimeout(500);ok(await p.locator('#scroller .voucher h3').textContent()==='Bon podarunkowy','skok: bon (tytuł z CMS)');
  ok(await p.locator('#scroller [data-vamt]').count()===4,'bon: 4 kwoty domyślne');
  await p.click('[data-jump="status"]');await p.waitForTimeout(2500);ok(await p.locator('#scroller .stp h1').count()===1,'skok: status auta z linku');
  await p.click('[data-jump="home"]');await p.waitForTimeout(400);
  await p.click('#scroller .mmenu');await p.waitForTimeout(300);ok(await p.locator('#scroller .smenu').count()===1,'menu w nagłówku się otwiera');
  await p.click('#scroller .smenu [data-scroll="opinie"]');await p.waitForTimeout(600);ok(await p.locator('#scroller .smenu').count()===0,'menu: przejście do opinii zamyka menu');
  // ciemna paleta na ekranach klienta
  const dark=JSON.stringify({theme:{pal:'noc',bg:'#0e0f11',text:'#f1f2f4',acc:'#e11d2e',dark:'#050506'}});
  await p.evaluate(c=>{PV_CFG=JSON.parse(c);location.hash='';PV_CFG=JSON.parse(c);setTimeout(()=>location.hash='status='+DEMO_TOKEN,50)},dark);await p.waitForTimeout(2500);
  await p.screenshot({path:SP+'/r-status-dark.png'});
  const loy=await p.locator('#scroller .loy').count()?await p.locator('#scroller .loy').evaluate(e=>[getComputedStyle(e).backgroundColor,getComputedStyle(e).color]):null;
  ok(!loy||loy[0]!==loy[1],'status: punkty czytelne w ciemnej palecie '+JSON.stringify(loy));
  await p.evaluate(()=>{location.hash='';go('book',{svc:'mycie'});S.bk.step=1;renderClient()});await p.waitForTimeout(500);await p.screenshot({path:SP+'/r-book-dark.png'});
  console.log(`\n${pass} PASS, ${fail} FAIL`);console.log(errs.join('\n')||'bez błędów JS');await b.close()})().catch(e=>{console.error('CRASH',e.message);process.exit(1)});
