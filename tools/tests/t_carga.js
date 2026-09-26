/* Mudança grande de carga: pra baixo de propósito (corrigir execução) não pode virar
   "travado"/"trocar"; pra cima cai no estado "tentando". E o botão de recomeçar limpa a base. */
const {load, D, NS}=require('./harness');
let fails=0, n=0;
const ok=(c,m,x)=>{ n++; if(!c){ fails++; console.log('  ✗', m, x!==undefined?String(JSON.stringify(x)).slice(0,300):''); } else console.log('  ✓', m); };

async function cenario(app){
  console.log('\n=== '+app+' ===');
  const ns=NS[app];
  const w0=await load(app,{},{}); await w0._tick(150);
  // acha um exercício de faixa normal (nem tempo nem "máx")
  let dia=null, idx=-1, ex=null;
  for(const d of w0.diasProg()){
    w0.dayEx(d).forEach((e,i)=>{ if(ex) return; const r=w0.parseRange(e.r); if(!r.tempo && !r.livre && r.max>r.min){ dia=d; idx=i; ex=e; } });
    if(ex) break;
  }
  ok(!!ex,'achou exercício com faixa de reps', ex&&ex.n);
  const id=w0.exId(dia,idx);
  const rng=w0.parseRange(ex.r);
  const mk=(dt,kg,reps)=>({date:dt, sets:[{kg:String(kg),reps:String(reps),rir:'2',done:true}], f:w0.fadigaPadrao(id), p:idx});
  const semear=(sess)=>{ const s=Object.fromEntries(w0.localStorage._map); s[ns+'_logs_v1']=JSON.stringify({[id]:sess}); return s; };

  // ---- queda deliberada: 3 sessões a 60kg no topo da faixa, depois 40kg dentro da faixa
  const A=await load(app, semear([mk(D(21),60,rng.max), mk(D(14),60,rng.max), mk(D(7),60,rng.max), mk(D(2),40,rng.min+1)]), {});
  await A._tick(150);
  const st=A.progressState(id, A.dayEx(dia)[idx]);
  ok(st && st.k==='recomecando','baixar a carga com as reps em dia vira "recomecando", não regressão', st&&st.k);
  ok(A.detectPlateau(id)===false,'e não conta como plateau (não manda trocar de exercício)');
  const sug=A.suggestNext(id, A.dayEx(dia)[idx]);
  ok(sug && sug.kg===40,'a meta seguinte parte da carga NOVA, não da antiga', sug);
  A.renderDay(dia); await A._tick(40);
  ok(A.document.body.innerHTML.includes('recomeçar daqui'),'card oferece "recomeçar daqui"');

  // ---- queda PEQUENA (oscilação) continua sendo tratada como antes
  const passo=w0.loadStepFor(id, ex)||2.5;
  const B=await load(app, semear([mk(D(21),60,rng.max), mk(D(14),60,rng.max), mk(D(2),60-Math.min(passo,60*0.05),rng.min+1)]), {});
  await B._tick(150);
  const stB=B.progressState(id, B.dayEx(dia)[idx]);
  ok(stB && stB.k!=='recomecando','queda pequena não é tratada como mudança deliberada', stB&&stB.k);

  // ---- queda COM as reps despencando = regressão de verdade, o app não pode disfarçar
  const C=await load(app, semear([mk(D(21),60,rng.max), mk(D(14),60,rng.max), mk(D(2),40,Math.max(1,rng.min-2))]), {});
  await C._tick(150);
  const stC=C.progressState(id, C.dayEx(dia)[idx]);
  ok(stC && stC.k!=='recomecando','carga menor E reps abaixo da faixa NÃO vira "foi de propósito"', stC&&stC.k);

  // ---- sem a guarda isto acusaria travado: 3 sessões na carga nova, subindo
  const Dd=await load(app, semear([mk(D(28),60,rng.max), mk(D(21),40,rng.min), mk(D(14),40,rng.min+1), mk(D(7),40,rng.min+2)]), {});
  await Dd._tick(150);
  ok(Dd.detectPlateau(id)===false,'progredindo na carga nova não é plateau');
  const stD=Dd.progressState(id, Dd.dayEx(dia)[idx]);
  ok(stD && ['progredindo','mantendo','tentando','recomecando'].includes(stD.k),'estado saudável depois da correção', stD&&stD.k);

  // ---- subir muito de uma vez cai em "tentando"
  const E=await load(app, semear([mk(D(14),40,rng.max), mk(D(7),40,rng.max), mk(D(2),60,Math.max(1,rng.min-2))]), {});
  await E._tick(150);
  const stE=E.progressState(id, E.dayEx(dia)[idx]);
  ok(stE && stE.k==='tentando','subir muito de uma vez = "carga nova, chegue no mínimo"', stE&&stE.k);

  // ---- recomeçar de propósito apaga a base antiga do conselho
  const F=await load(app, semear([mk(D(21),60,rng.max), mk(D(14),60,rng.max), mk(D(7),60,rng.max), mk(D(2),40,rng.min+1)]), {});
  await F._tick(150);
  F.confirm=()=>true;
  ok(F.progressSessions(id).length===4,'antes: 4 sessões alimentam a progressão');
  F.recomecarProgressao(id);
  ok(F._ls('meta').swapAt && F._ls('meta').swapAt[id],'gravou a data de recomeço');
  ok((F._ls('logs')[id]||[]).length===4,'o histórico NÃO foi apagado');
  ok(F.progressSessions(id).length===0,'mas as sessões antigas saem do cálculo', F.progressSessions(id).length);
  ok(F._errors.length===0,'sem erro global', F._errors[0]);
}
(async()=>{ await cenario('his'); await cenario('hers'); console.log(`\n${n-fails}/${n} ok`+(fails?`, ${fails} FALHAS`:'')); process.exit(fails?1:0); })()
 .catch(e=>{ console.error('FATAL',e); process.exit(1); });
