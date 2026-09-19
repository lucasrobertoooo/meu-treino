const {load, D, fakeWorker, NS}=require('./harness');
let fails=0, n=0;
const ok=(c,msg,extra)=>{ n++; if(!c){ fails++; console.log('  ✗', msg, extra!==undefined?JSON.stringify(extra).slice(0,400):''); } else console.log('  ✓', msg); };
const reload=async(app,w,worker,idb)=>{ const x=await load(app, Object.fromEntries(w.localStorage._map), {fetch:worker, idb}); await x._tick(150); return x; };

async function cenario(app){
  console.log('\n=== '+app+' ===');
  const ns=NS[app]; const worker=fakeWorker(); const ex='a_1';
  const cfg={workerUrl:'https://w.test', workerToken:'tok'};
  const seed={ [ns+'_meta_v1']:JSON.stringify(cfg), [ns+'_logs_v1']:JSON.stringify({[ex]:[{date:D(5), sets:[{kg:20,r:10,rir:2,done:true}]}]}), [ns+'_freelog_v1']:JSON.stringify({livre1:[{date:D(6), sets:[{kg:10,r:12}]}]}) };
  let A=await load(app, seed, {fetch:worker, idb:new Map()}); await A._tick(100);
  // 1ª rodada não carimba registro antigo
  A.carimbarMudancas();
  ok(A._ls('logs')[ex][0]._m===undefined,'1ª rodada: registro antigo fica sem _m');
  A.saveK('logs'); await A.sincronizarNuvem('volta'); await A._tick(60);
  let B=await load(app, {}, {fetch:worker, idb:new Map()}); await B._tick(100);
  B.setWorkerUrl("https://w.test"); B.setWorkerToken("tok"); await B._tick(1600);
  ok(B._ls('logs')[ex].length===1,'B recebeu o log');
  ok(B._ls('freelog').livre1 && B._ls('freelog').livre1.length===1,'B recebeu o treino livre (freelog agora funde por sessão)');
  ok(B._ls('meta').nuvemVistoId!==undefined && B._ls('meta').workerUrl==='https://w.test','B tem config própria');

  // ping-pong: ambos em repouso → nenhum PUT novo
  const puts0=worker.puts.length;
  await A.sincronizarNuvem('volta'); await A._tick(60); await B.sincronizarNuvem('volta'); await B._tick(60);
  await A.sincronizarNuvem('volta'); await A._tick(60); await B.sincronizarNuvem('volta'); await B._tick(60);
  ok(worker.puts.length===puts0,'em repouso, nenhum aparelho re-sobe (sem ping-pong)', {antes:puts0, depois:worker.puts.length});

  // edição concorrente da MESMA sessão: A edita e sincroniza; B edita depois e sincroniza → B vence em todos
  const editar=(w,kg)=>{ const l=w._ls('logs'); l[ex][0].sets[0].kg=kg; w.localStorage.setItem(ns+'_logs_v1', JSON.stringify(l)); };
  editar(A,21); A=await reload(app,A,worker,new Map()); A.saveK('logs'); await A.sincronizarNuvem('volta'); await A._tick(60);
  ok(worker.latest(ns).logs[ex][0].sets[0].kg===21 && worker.latest(ns).logs[ex][0]._m>0,'edição de A subiu com carimbo');
  editar(B,23); B=await reload(app,B,worker,new Map()); B.saveK('logs'); 
  await new Promise(r=>setTimeout(r,5));
  await B.sincronizarNuvem('volta'); await B._tick(60);
  ok(B._ls('logs')[ex][0].sets[0].kg===23,'B (sincronizou por último) manteve a própria edição');
  ok(worker.latest(ns).logs[ex][0].sets[0].kg===23,'nuvem tem a versão de B');
  await A.sincronizarNuvem('volta'); await A._tick(60);
  ok(A._ls('logs')[ex][0].sets[0].kg===23,'A recebeu a edição mais nova de B');

  // apagar em B → some em A; recriar em A depois → volta nos dois
  const l=B._ls('logs'); l[ex]=[]; B.localStorage.setItem(ns+'_logs_v1', JSON.stringify(l)); B=await reload(app,B,worker,new Map()); B.saveK('logs'); await B.sincronizarNuvem('volta'); await B._tick(60);
  ok(worker.latest(ns).meta.tomb['logs:'+ex+'|'+D(5)]>0,'lápide da sessão subiu');
  await A.sincronizarNuvem('volta'); await A._tick(60);
  ok((A._ls('logs')[ex]||[]).length===0,'A apagou a sessão apagada em B');
  await new Promise(r=>setTimeout(r,5));
  const la=A._ls('logs'); la[ex]=[{date:D(5), sets:[{kg:30,r:8,rir:1,done:true}]}]; A.localStorage.setItem(ns+'_logs_v1', JSON.stringify(la)); A=await reload(app,A,worker,new Map()); A.saveK('logs'); await A.sincronizarNuvem('volta'); await A._tick(60);
  ok(A._ls('logs')[ex].length===1 && A._ls('logs')[ex][0].sets[0].kg===30,'A recriou a sessão e ela não foi engolida pela lápide');
  ok(!worker.latest(ns).meta.tomb['logs:'+ex+'|'+D(5)],'lápide removida ao recriar');
  await B.sincronizarNuvem('volta'); await B._tick(60);
  ok((B._ls('logs')[ex]||[]).length===1 && B._ls('logs')[ex][0].sets[0].kg===30,'B recebeu a sessão recriada');

  // fotos: snapshot de fotos precisa caber; foto grande demais não trava o resto
  const idbA=new Map([['pG','data:image/jpeg;base64,'+'X'.repeat(19*1024*1024)],['pP','data:image/jpeg;base64,PEQUENA']]);
  const seedF=Object.fromEntries(A.localStorage._map); seedF[ns+'_photometa_v1']=JSON.stringify([{id:'pG',date:D(0),angle:'frente'},{id:'pP',date:D(1),angle:'frente'}]);
  const AF=await load(app, seedF, {fetch:worker, idb:idbA}); await AF._tick(150); AF.saveK('photometa'); await AF.sincronizarNuvem('volta'); await AF._tick(100);
  const fs=worker.latest(ns+'_fotos');
  ok(fs && fs.fotos.length===1 && fs.fotos[0].id==='pP','foto acima do teto fica de fora, a pequena sobe', fs&&fs.fotos.map(f=>f.id));
  ok(AF._errors.length===0,'sem erro global', AF._errors[0]);

  if(app==='hers'){
    // prog: edição do programa viaja pelo carimbo meta.progM
    const seedP=Object.fromEntries(A.localStorage._map); seedP[ns+'_prog_v1']=JSON.stringify({academia:{A:[{id:'a_1',n:'Editado A'}]}});
    const AP=await load(app, seedP, {fetch:worker, idb:new Map()}); await AP._tick(150); AP.carimbarMudancas(); AP.saveK('prog'); await AP.sincronizarNuvem('volta'); await AP._tick(60);
    // B tinha prog vazio → entra
    await B.sincronizarNuvem('volta'); await B._tick(60);
    ok(B._ls('prog') && B._ls('prog').academia && B._ls('prog').academia.A[0].n==='Editado A','B recebeu o programa editado');
    await new Promise(r=>setTimeout(r,5));
    const seedP2=Object.fromEntries(B.localStorage._map); seedP2[ns+'_prog_v1']=JSON.stringify({academia:{A:[{id:'a_1',n:'Editado B'}]}});
    const BP=await load(app, seedP2, {fetch:worker, idb:new Map()}); await BP._tick(150); BP.saveK('prog'); await BP.sincronizarNuvem('volta'); await BP._tick(60);
    await AP.sincronizarNuvem('volta'); await AP._tick(60);
    ok(AP._ls('prog').academia.A[0].n==='Editado B','edição mais nova do programa venceu em A');
  }
}
(async()=>{ await cenario('his'); await cenario('hers'); console.log(`\n${n-fails}/${n} ok`+(fails?`, ${fails} FALHAS`:'')); process.exit(fails?1:0); })().catch(e=>{ console.error('FATAL',e); process.exit(1); });
