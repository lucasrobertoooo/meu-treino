/* Ordem do dia + troca de exercício: escopo (hoje/sempre), reversão, chave de log do
   substituto, e a inteligência de posição (meta recalculada, travado falso evitado). */
const {load, D, NS}=require('./harness');
let fails=0, n=0;
const ok=(c,m,x)=>{ n++; if(!c){ fails++; console.log('  ✗', m, x!==undefined?String(JSON.stringify(x)).slice(0,300):''); } else console.log('  ✓', m); };

async function cenario(app){
  console.log('\n=== '+app+' ===');
  const ns=NS[app];
  const w=await load(app, {}, {}); await w._tick(150);
  ok(w._errors.length===0,'boot sem erro', w._errors[0]);

  const dia='A';
  const base=w.dayExBase(dia).map(e=>e.id);
  const ini=w.dayEx(dia).map(e=>e.id);
  ok(base.length>=4,'dia A tem exercícios', base.length);
  ok(ini.join()===base.join(),'sem mudança, dayEx = programa');

  // ---- mover só hoje
  w.planAbrir(dia, 3); w.planSetEsc('hoje'); w.planMover(-1);
  const dep=w.dayEx(dia).map(e=>e.id);
  ok(dep[2]===base[3] && dep[3]===base[2],'subiu um lugar (só hoje)', dep.slice(0,5));
  ok(w._ls('meta').plan.hoje.ord[dia].join()===dep.join(),'gravou na camada de hoje');
  ok(!(w._ls('meta').plan.ord && w._ls('meta').plan.ord[app==='his'?'p':'academia'] && w._ls('meta').plan.ord[app==='his'?'p':'academia'][dia]),'não gravou no permanente');
  w.planFechar();
  w.renderDay(dia); await w._tick(30);
  const html=w.document.body.innerHTML;
  ok(html.includes('Desfazer hoje'),'faixa de aviso com "Desfazer hoje"');
  ok(html.includes('de costume'),'card marca a posição de costume');

  // ---- desfazer hoje
  w.planDesfazerHoje(dia); await w._tick(30);
  ok(w.dayEx(dia).map(e=>e.id).join()===base.join(),'desfazer hoje devolve a ordem padrão');

  // ---- mover sempre
  w.planAbrir(dia, 4); w.planSetEsc('sempre'); w.planMover(-1); w.planFechar();
  const esc0 = app==='his' ? 'p' : 'academia';
  ok(!!(w._ls('meta').plan.ord && w._ls('meta').plan.ord[esc0] && w._ls('meta').plan.ord[esc0][dia]),'gravou no permanente', Object.keys(w._ls('meta').plan));
  const perm=w.dayEx(dia).map(e=>e.id);
  ok(perm[3]===base[4],'ordem permanente aplicada');
  // recarrega: permanente sobrevive, hoje não
  const w2=await load(app, Object.fromEntries(w.localStorage._map), {}); await w2._tick(150);
  ok(w2.dayEx(dia).map(e=>e.id).join()===perm.join(),'ordem permanente sobrevive ao reload');
  w2.planRestaurarPadrao(dia); await w2._tick(20);
  ok(w2.dayEx(dia).map(e=>e.id).join()===base.join(),'restaurar padrão limpa o permanente');

  // ---- troca por equivalente
  const w3=await load(app, {}, {}); await w3._tick(150);
  const alvo=w3.dayEx(dia)[1];
  const alts=w3.altsDe(alvo);
  ok(alts.length>0,'tem equivalentes mapeados pro 2º exercício', alts.map(a=>a.n));
  w3.planAbrir(dia,1); w3.planSetEsc('hoje'); w3.planTrocar(alts[0].key);
  const novo=w3.dayEx(dia)[1];
  ok(novo.n===alts[0].n,'nome trocado no card', novo.n);
  ok(novo.id===alvo.id,'id base preservado (âncora de nota/foto/volume)');
  ok(w3.exId(dia,1)===alvo.id+'~'+alts[0].key,'chave de LOG é própria do substituto', w3.exId(dia,1));
  w3.renderDay(dia); await w3._tick(30);
  ok(w3.document.body.innerHTML.includes('No lugar de'),'card diz que está substituído');
  // log do substituto não entra no histórico do original
  w3.upsertToday(w3.exId(dia,1), [{kg:'40',reps:'10',rir:'2',done:true}]);
  const L=w3._ls('logs');
  ok(L[alvo.id+'~'+alts[0].key] && !L[alvo.id],'log foi pro substituto, original intacto', Object.keys(L));
  w3.planAbrir(dia,1); w3.planVoltarExercicio();
  ok(w3.dayEx(dia)[1].n===alvo.n,'voltar ao padrão devolve o exercício original');
  ok(w3.exId(dia,1)===alvo.id,'e a chave de log volta a ser a original');
  ok((w3._ls('logs')[alvo.id+'~'+alts[0].key]||[]).length===1,'histórico do substituto fica guardado');

  // ---- carimbo de posição na sessão
  const w4=await load(app, {}, {}); await w4._tick(150);
  const idA=w4.exId(dia,0), idE=w4.exId(dia,3);
  w4.upsertToday(idA,[{kg:'20',reps:'10',rir:'2',done:true}]);
  w4.upsertToday(idE,[{kg:'20',reps:'10',rir:'2',done:true}]);
  const s0=w4._ls('logs')[idA][0], s3=w4._ls('logs')[idE][0];
  ok(s0.f===0 && s0.p===0,'1º exercício: fadiga 0 gravada', s0);
  ok(typeof s3.f==='number' && s3.f>0 && s3.p===3,'4º exercício: fadiga >0 gravada', s3);
  ok(s0.fv===2 && s3.fv===2,'carimbo sai com a versão da fórmula', {a:s0.fv, b:s3.fv});

  // ---- inteligência: mesma sessão, posições diferentes
  const w5=await load(app, {}, {}); await w5._tick(150);
  const idX=w5.exId(dia,3);
  const ex3=w5.dayEx(dia)[3];
  const rng=w5.parseRange(ex3.r);
  if(rng.tempo||rng.livre){ console.log('  (4º exercício é tempo/livre — pulo o teste de meta)'); }
  else {
    // duas sessões no MEIO da faixa, na posição padrão
    const meio=Math.min(rng.max-1, rng.min+1);
    const logs={}; logs[idX]=[
      {date:D(9), sets:[{kg:'20',reps:String(meio),rir:'2',done:true}], f:w5.fadigaPadrao(idX), fv:2, p:3},
      {date:D(4), sets:[{kg:'20',reps:String(meio),rir:'2',done:true}], f:w5.fadigaPadrao(idX), fv:2, p:3}];
    const seed=Object.fromEntries(w5.localStorage._map); seed[ns+'_logs_v1']=JSON.stringify(logs);
    const A=await load(app, seed, {}); await A._tick(150);
    const normal=A.suggestNext(idX, A.dayEx(dia)[3]);
    ok(normal && normal.reps===meio+1,'na posição de sempre: +1 rep (dupla progressão)', normal);
    // move pro 1º lugar
    A.planAbrir(dia,3); A.planSetEsc('hoje'); A.planFazerAgora();
    const idY=A.exId(dia,0);
    ok(idY===idX,'o exercício foi pro 1º lugar', {idX, idY});
    const cedo=A.suggestNext(idX, A.dayEx(dia)[0]);
    ok(cedo && cedo.reps===rng.max,'mais cedo: meta mira o TOPO da faixa', cedo);
    ok(cedo && /mais cedo/.test(cedo.why||''),'e explica o porquê', cedo&&cedo.why);
    // agora joga pro fim
    A.planDesfazerHoje(dia);
    const ids=A.dayEx(dia).map(e=>e.id);
    const [mv]=ids.splice(3,1); ids.push(mv);
    A.planGravarOrdem(dia, ids, 'hoje');
    const fim=A.suggestNext(idX, A.dayEx(dia)[A.dayEx(dia).length-1]);
    ok(fim && fim.reps===rng.min,'mais tarde: meta cai pro piso da faixa', fim);
    ok(fim && /mais tarde/.test(fim.why||''),'e explica o porquê', fim&&fim.why);
    ok(A._errors.length===0,'sem erro global', A._errors[0]);

    /* ---- travado falso: PROGREDINDO nas comparáveis, e uma sessão feita bem mais tarde.
       Sem a guarda, essa última vira "parou de progredir" e dispara a sugestão de trocar. */
    const fPad=w5.fadigaPadrao(idX);
    const r1=rng.min, r2=Math.min(rng.max, rng.min+1), r3=Math.min(rng.max, rng.min+2);
    if(!(r3>r2 && r2>r1)){ console.log('  (faixa curta demais pro teste de travado falso)'); }
    else{
      const mk=(dt,reps,f)=>({date:dt, sets:[{kg:'20',reps:String(reps),rir:'2',done:true}], f, fv:2});   // fv:2 = carimbo da fórmula atual
      const subindo=[mk(D(21),r1,fPad), mk(D(14),r2,fPad), mk(D(7),r3,fPad)];
      const seedT=Object.fromEntries(w5.localStorage._map);
      seedT[ns+'_logs_v1']=JSON.stringify({[idX]:subindo.concat([mk(D(2),r1,fPad+6)])});
      const T=await load(app, seedT, {}); await T._tick(150);
      ok(T.detectPlateau(idX)===false,'sessão feita fora de posição não cria plateau falso');
      const st=T.progressState(idX, T.dayEx(dia)[3]);
      ok(st && st.k!=='trocar' && st.k!=='travado','nem estado de travado/trocar', st&&st.k);
      // controle: a MESMA queda, mas na posição de sempre => aí é travado de verdade
      const seedC=Object.fromEntries(w5.localStorage._map);
      seedC[ns+'_logs_v1']=JSON.stringify({[idX]:subindo.concat([mk(D(2),r1,fPad)])});
      const C=await load(app, seedC, {}); await C._tick(150);
      ok(C.detectPlateau(idX)===true,'controle: mesma queda na posição de sempre É plateau');
    }
  }

  // ---- id desconhecido na ordem gravada não some nem embaralha
  const w6=await load(app, {}, {}); await w6._tick(150);
  const ids6=w6.dayEx(dia).map(e=>e.id);
  w6.planGravarOrdem(dia, ids6.slice(0,2).concat(['id_que_nao_existe']), 'hoje');
  const r6=w6.dayEx(dia).map(e=>e.id);
  ok(r6.length===ids6.length && r6.slice().sort().join()===ids6.slice().sort().join(),'ordem parcial não perde nem duplica exercício', r6);
  ok(w6._errors.length===0,'sem erro global no fim', w6._errors[0]);

  // ---- volume semanal conta nos músculos do SUBSTITUTO
  const w7=await load(app, {}, {}); await w7._tick(150);
  const alvo7=w7.dayEx(dia)[1];
  const a7=(w7.altsDe(alvo7)||[])[0];
  if(a7){
    w7.planAbrir(dia,1); w7.planSetEsc('hoje'); w7.planTrocar(a7.key);
    const k7=w7.exId(dia,1);
    w7.upsertToday(k7, [{kg:'30',reps:'10',rir:'2',done:true},{kg:'30',reps:'10',rir:'2',done:true}]);
    const ex7=w7.exDoLog(k7);
    ok(ex7 && ex7.n===a7.n,'exDoLog resolve a chave do substituto', ex7&&ex7.n);
    const vol=w7.weeklyVolume();
    const mgAlvo=Object.keys(ex7.mg||{})[0];
    ok(mgAlvo && vol[mgAlvo]>0,'volume semanal contou as séries do substituto', {mgAlvo, v:mgAlvo?vol[mgAlvo]:null});
    ok(w7._errors.length===0,'sem erro global no volume', w7._errors[0]);
  }

  // ---- ordem/troca PERMANENTE viaja no backup; a de hoje não atropela a local
  const w8=await load(app, {}, {}); await w8._tick(150);
  const idsA=w8.dayEx(dia).map(e=>e.id);
  const remoto={meta:{plan:{ord:{[app==='his'?'p':'academia']:{[dia]:idsA.slice().reverse()}}, hoje:{data:'2000-01-01', ord:{}, tr:{}}}}};
  const rel=w8.fundirBackup(remoto);
  ok(w8.dayEx(dia).map(e=>e.id).join()===idsA.slice().reverse().join(),'ordem permanente entrou pelo backup');
  ok(!(w8._ls('meta').plan.hoje && w8._ls('meta').plan.hoje.data==='2000-01-01' && w8.ordemDe(dia).hoje),'camada de hoje velha não é aplicada');
  ok(w8._errors.length===0,'sem erro global na fusão', w8._errors[0]);

  // ---- a ordem efetiva vale pro app inteiro: último exercício, conclusão e descanso
  const w9=await load(app, {}, {}); await w9._tick(150);
  const n9=w9.dayEx(dia).length;
  ok(w9.isLastPlannedPosition(dia, n9-1, 0)===false || w9.isLastPlannedPosition(dia, n9-1, w9.exSets(w9.dayEx(dia)[n9-1])-1)===true,'último planejado casa com a lista efetiva');
  const idsOrig=w9.dayEx(dia).map(e=>e.id);
  w9.planGravarOrdem(dia, [idsOrig[n9-1]].concat(idsOrig.slice(0,n9-1)), 'hoje');
  const agoraUlt=w9.dayEx(dia)[n9-1];
  ok(agoraUlt.id===idsOrig[n9-2],'quem era penúltimo virou último', agoraUlt.id);
  ok(w9.isLastPlannedPosition(dia, n9-1, w9.exSets(agoraUlt)-1)===true,'auto-conclusão segue a ordem nova');
  // conclusão do treino conta os exercícios da lista efetiva
  w9.dayEx(dia).forEach((e,i)=>{
    const id=w9.exId(dia,i), n=w9.exSets(e);
    w9.upsertToday(id, Array.from({length:n},()=>({kg:'20',reps:'10',rir:'2',done:true})));
  });
  ok(w9.isWorkoutComplete(dia)===true,'treino completo reconhecido com a ordem trocada');
  ok(w9._errors.length===0,'sem erro global', w9._errors[0]);
}
(async()=>{ await cenario('his'); await cenario('hers'); console.log(`\n${n-fails}/${n} ok`+(fails?`, ${fails} FALHAS`:'')); process.exit(fails?1:0); })()
 .catch(e=>{ console.error('FATAL',e); process.exit(1); });
