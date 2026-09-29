/* Regressões da auditoria de 29/09. Cada teste corresponde a um achado real. */
const {load, D, NS}=require('./harness');
let fails=0, n=0;
const ok=(c,m,x)=>{ n++; if(!c){ fails++; console.log('  ✗', m, x!==undefined?String(JSON.stringify(x)).slice(0,260):''); } else console.log('  ✓', m); };

async function cenario(app){
  console.log('\n=== '+app+' ===');
  const ns=NS[app];

  // F1 · registro de sessão sem data derrubava a aba Corpo inteira
  const s1={}; s1[ns+'_session_v1']=JSON.stringify({active:null, history:[
    {date:D(3), workoutId:'A', activeMs:3600000},
    {workoutId:'B', activeMs:3000000, endAt:Date.now()-2*86400000},   // sem date, MAS com endAt: recuperável
    {workoutId:'C'},                                                   // sem conserto
    null ]});
  const A=await load(app, s1, {}); await A._tick(160);
  let erro=null; try{ A.renderCorpo(); }catch(e){ erro=String(e.message||e); }
  await A._tick(40);
  ok(!erro && A._errors.length===0,'aba Corpo sobrevive a histórico de sessão malformado', erro||A._errors[0]);
  const hist=A._ls('session').history;
  ok(hist.length===2,'guarda ficou com os 2 recuperáveis', hist.map(r=>r&&r.date));
  ok(hist.some(r=>r.workoutId==='B' && typeof r.date==='string'),'registro sem data foi RECUPERADO pelo endAt (não descartado)', hist);
  A.renderDay(A.diasProg()[0]); await A._tick(40);
  ok(A._errors.length===0,'e o mini-histórico do treino também', A._errors[0]);

  // F2 · tipo sem descanso (cardio) não abre timer com valor antigo
  const B=await load(app, {}, {}); await B._tick(150);
  const d=B.diasProg()[0];
  const iCardio=B.dayEx(d).findIndex(e=>e.t==='cardio');
  if(iCardio>=0){
    const ids=B.dayEx(d).map(e=>e.id); const [c]=ids.splice(iCardio,1); ids.unshift(c);
    B.planGravarOrdem(d, ids, 'hoje');
    B.closeTimer && B.closeTimer(); await B._tick(20);
    const el=B.document.createElement('div');
    try{ if(app==='his') B.toggleDone(B.exId(d,0),0,el); else B.toggleDone(d,0,0,el); }catch(e){ ok(false,'toggleDone no cardio lançou', String(e).slice(0,80)); }
    await B._tick(60);
    const ov=B.document.getElementById('overlay');
    ok(ov && ov.classList.contains('hidden'),'cardio marcado NÃO abre timer de descanso');
    ok(B._errors.length===0,'e sem erro global', B._errors[0]);
  } else ok(true,'(este app não tem cardio no programa)');

  // F3 · modelo de duração: aquecimento e unilateral contam, cardio entra à parte
  const C=await load(app, {}, {}); await C._tick(150);
  const comp={n:'x', s:4, r:'8-12', t:'comp', mg:{}};
  const uni ={n:'y', s:3, r:'10-12 por perna', t:'comp', mg:{}};
  const card={n:'z', s:1, r:'25-35 min', t:'cardio', mg:{}};
  ok(Math.abs(C.exMinutes(comp)-15.3)<0.2,'composto 4x8-12 = ~15,3 min (com aquecimento)', C.exMinutes(comp).toFixed(1));
  ok(C.exMinutes(uni) > C.exMinutes({...uni, r:'10-12'}),'unilateral custa mais que bilateral', {uni:C.exMinutes(uni).toFixed(1), bi:C.exMinutes({...uni,r:'10-12'}).toFixed(1)});
  ok(C.exMinutes(card)===0 && C.cardioMinutes(card)===30,'cardio: 0 min de peso, 30 min de bike', {p:C.exMinutes(card), c:C.cardioMinutes(card)});
  ok(typeof C.paceFactor==='function' && C.paceFactor(C.diasProg()[0])===1,'paceFactor existe e vale 1 sem histórico');
  const dm=C.dayMinutes(C.diasProg()[0]);
  ok(dm>40 && dm<130,'dayMinutes dá um número plausível', Math.round(dm));

  // paceFactor calibra pelo histórico real
  const modelo=C.dayEx(d).reduce((a,e)=>a+C.exMinutes(e),0);
  const s4={}; s4[ns+'_session_v1']=JSON.stringify({active:null, history:[
    {date:D(7), workoutId:d, activeMs:modelo*60000*1.3, endAt:Date.now()-7*86400000},
    {date:D(3), workoutId:d, activeMs:modelo*60000*1.3, endAt:Date.now()-3*86400000}]});
  const E=await load(app, s4, {}); await E._tick(150);
  ok(Math.abs(E.paceFactor(d)-1.3)<0.05,'paceFactor aprende o ritmo real (1,3x)', E.paceFactor(d).toFixed(2));

  // F5 · aviso ao pôr cardio antes dos pesos
  if(iCardio>=0){
    const F=await load(app, {}, {}); await F._tick(150);
    const ids=F.dayEx(d).map(e=>e.id); const [c]=ids.splice(iCardio,1); ids.unshift(c);
    F.planGravarOrdem(d, ids, 'hoje');
    F.planAbrir(d, 0); await F._tick(40);
    const txt=F.document.getElementById('exPlano').textContent;
    ok(/antes dos pesos/i.test(txt),'painel avisa que cardio antes dos pesos rouba o estímulo');
    F.planFechar();
  }

  // F4 · campos de bloco não viajam mais no backup do app dela
  if(app==='hers'){
    const G=await load(app, {}, {}); await G._tick(150);
    G.fundirBackup({meta:{bloco:'perna', blocoDesde:'2026-01-01', mesoDesde:'2026-01-01'}});
    const m=G._ls('meta');
    ok(!m.bloco && !m.blocoDesde,'bloco/blocoDesde (conceito do app dele) não entram aqui', {b:m.bloco, bd:m.blocoDesde});
    ok(m.mesoDesde==='2026-01-01','mas mesoDesde, que é lido, entra normalmente', m.mesoDesde);
  }
}
(async()=>{ await cenario('his'); await cenario('hers'); console.log(`\n${n-fails}/${n} ok`+(fails?`, ${fails} FALHAS`:'')); process.exit(fails?1:0); })()
 .catch(e=>{ console.error('FATAL',e); process.exit(1); });
