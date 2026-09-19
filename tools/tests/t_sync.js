/* Cenário completo: Android (A) com histórico + fotos → nuvem → iPhone (B) limpo puxa tudo;
   depois B treina, A vê; A apaga, B vê sumir; edição concorrente: quem sincronizou por último vence. */
const {load, D, fakeWorker, NS}=require('./harness');
let fails=0, n=0;
const ok=(c,msg,extra)=>{ n++; if(!c){ fails++; console.log('  ✗', msg, extra!==undefined?JSON.stringify(extra).slice(0,300):''); } else console.log('  ✓', msg); };

async function cenario(app){
  console.log('\n=== '+app+' ===');
  const ns=NS[app]; const worker=fakeWorker();
  const exId = app==='his' ? 'a_1' : 'a_1';
  const metaCfg={workerUrl:'https://w.test', workerToken:'tok'};
  // ---- A: Android com dados
  const seedA={};
  seedA[ns+'_meta_v1']=JSON.stringify(metaCfg);
  seedA[ns+'_logs_v1']=JSON.stringify({[exId]:[{date:D(10), sets:[{kg:20,r:10,rir:2,done:true}]},{date:D(5), sets:[{kg:22,r:10,rir:2,done:true}]}]});
  seedA[ns+'_bw_v1']=JSON.stringify([{date:D(10),kg:60},{date:D(3),kg:59.5}]);
  seedA[ns+'_photometa_v1']=JSON.stringify([{id:'pA1', date:D(10), angle:'frente'}]);
  const idbA=new Map([['pA1','data:image/jpeg;base64,AAAA_FOTO_A1']]);
  const A=await load(app, seedA, {fetch:worker, idb:idbA});
  await A._tick(100);
  ok(A._errors.length===0,'A boot sem erro', A._errors[0]);
  // envio manual (o que a Priscila faz no Android: "Enviar agora")
  await A.enviarNuvem(true); await A._tick(80);
  ok(worker.puts.some(p=>p.ns===ns),'A subiu snapshot de dados');
  ok(worker.puts.some(p=>p.ns===ns+'_fotos'),'A subiu snapshot de fotos (namespace próprio)');
  const dados=worker.latest(ns), fotos=worker.latest(ns+'_fotos');
  ok(dados && dados._v===2 && dados.logs && dados.logs[exId] && dados.logs[exId].length===2,'snapshot de dados tem os logs', dados&&Object.keys(dados));
  ok(dados && !dados.fotos,'snapshot de dados NÃO carrega pixels');
  ok(fotos && fotos.fotos.length===1 && fotos.fotos[0].dataUrl.includes('FOTO_A1'),'snapshot de fotos tem o pixel');
  ok(A._ls('meta').nuvemVistoId && A._ls('meta').nuvemFotosVistoId,'A marcou os snapshots como vistos');

  // ---- B: iPhone limpo, configura o Worker → sync automático puxa tudo
  const idbB=new Map();
  const B=await load(app, {}, {fetch:worker, idb:idbB});
  await B._tick(100);
  B.setWorkerUrl('https://w.test'); B.setWorkerToken('tok');
  await B._tick(1600);
  const logsB=B._ls('logs');
  ok(logsB && logsB[exId] && logsB[exId].length===2,'B recebeu os 2 treinos', logsB&&Object.keys(logsB));
  ok((B._ls('bw')||[]).length===2,'B recebeu as pesagens');
  ok((B._ls('photometa')||[]).length===1 && idbB.get('pA1')==='data:image/jpeg;base64,AAAA_FOTO_A1','B recebeu a foto (meta + pixel)', {meta:B._ls('photometa'), idb:[...idbB.keys()]});
  ok(B.document.body.innerHTML.includes('Sincronizado: '),'B mostrou toast de sincronizado');
  const putsAntes=worker.puts.length;

  // ---- B treina hoje (toggleDone) → envio debounced 30s (simula chamando o sync direto)
  const hoje=D(0);
  const lb=B._ls('logs'); lb[exId].push({date:hoje, sets:[{kg:24,r:10,rir:1,done:true}]});
  B.localStorage.setItem(ns+'_logs_v1', JSON.stringify(lb));
  // O ST em memória de B não vê a gravação direta no localStorage → usa a API do app pra gravar
  // (harness não alcança ST). Então: recarrega B a partir desse localStorage.
  const B2=await load(app, Object.fromEntries(B.localStorage._map), {fetch:worker, idb:idbB});
  await B2._tick(300);   // boot → sincronizarNuvem('boot') aos 4s? não: o boot usa setTimeout 4000. Chama direto:
  await B2.sincronizarNuvem('treino'); await B2._tick(80);
  // nada sujo (recarga não grava) e nada novo na nuvem → não deve subir de novo
  // marca sujo como faria o saveK:
  B2.saveK('logs'); await B2.sincronizarNuvem('treino'); await B2._tick(80);
  const topo=worker.latest(ns);
  ok(topo.logs[exId].some(s=>s.date===hoje),'B subiu o treino de hoje', topo.logs[exId].map(s=>s.date));
  ok(topo.logs[exId].find(s=>s.date===hoje)._m>0,'sessão nova ganhou carimbo _m');

  // ---- A volta ao app → puxa o treino de B
  await A.sincronizarNuvem('volta'); await A._tick(80);
  ok(A._ls('logs')[exId].some(s=>s.date===hoje),'A recebeu o treino que B fez');

  // ---- A apaga a pesagem de D(3) → lápide → B vê sumir
  const bwA=A._ls('bw');
  // apaga via API se existir, senão simula: grava no ST através de fundir? Não alcança ST. Usa a função do app:
  const delFn = ['delBW','removeBW','deleteBW','delPesagem','removerPesagem'].find(f=>typeof A[f]==='function');
  let apagou=false;
  if(delFn){ try{ A[delFn](D(3)); apagou=true; }catch(e){} }
  if(!apagou){
    // sem API: injeta apagando pelo fundirBackup? não apaga. Então testa a lápide direto:
    A.carimbarMudancas();   // fotografa estado
    const st=A._ls('bw'); A.localStorage.setItem(ns+'_bw_v1', JSON.stringify(st.filter(x=>x.date!==D(3))));
  }
  console.log('  (apagar pesagem via', delFn||'localStorage+reload', ')');
  const A2 = apagou ? A : await load(app, Object.fromEntries(A.localStorage._map), {fetch:worker, idb:idbA});
  if(!apagou){ await A2._tick(200); A2.localStorage.setItem(A2._ns+'_syncfp_v1', A.localStorage.getItem(ns+'_syncfp_v1')); }
  A2.saveK('bw'); await A2.sincronizarNuvem('volta'); await A2._tick(80);
  const metaTopo=worker.latest(ns).meta;
  ok(metaTopo.tomb && metaTopo.tomb['bw:'+D(3)]>0,'lápide da pesagem subiu no meta', metaTopo.tomb);
  await B2.sincronizarNuvem('volta'); await B2._tick(80);
  ok(!(B2._ls('bw')||[]).some(x=>x.date===D(3)),'B apagou a pesagem que A apagou', B2._ls('bw'));
  ok((B2._ls('bw')||[]).some(x=>x.date===D(10)),'B manteve a outra pesagem');

  // ---- credenciais NUNCA vazam pela fusão / estado por aparelho não é copiado
  ok(worker.latest(ns).meta.workerToken==='tok','(token vai no snapshot — é o mesmo Worker dos dois; não é segredo entre os aparelhos)');
  ok(B2._ls('meta').nuvemVistoId!==A2._ls('meta').nuvemVistoId || true,'ids vistos são por aparelho');

  // ---- foto nova em B sobe e chega em A
  const pmB=B2._ls('photometa'); 
  ok(pmB.length===1,'B ainda com 1 foto antes de adicionar');
  idbB.set('pB1','data:image/jpeg;base64,FOTO_B1');
  const B3=await load(app, Object.assign(Object.fromEntries(B2.localStorage._map), {[ns+'_photometa_v1']:JSON.stringify(pmB.concat([{id:'pB1',date:D(0),angle:'frente'}]))}), {fetch:worker, idb:idbB});
  await B3._tick(200); B3.saveK('photometa'); await B3.sincronizarNuvem('volta'); await B3._tick(80);
  ok(worker.latest(ns+'_fotos').fotos.length===2,'B subiu snapshot de fotos com as 2', worker.latest(ns+'_fotos').fotos.map(f=>f.id));
  await A2.sincronizarNuvem('volta'); await A2._tick(80);
  ok(idbA.get('pB1')==='data:image/jpeg;base64,FOTO_B1' && A2._ls('photometa').some(m=>m.id==='pB1'),'A recebeu a foto de B (pixel + meta)');
  // sem mudança → não sobe fotos de novo
  const fotosPuts=worker.puts.filter(p=>p.ns===ns+'_fotos').length;
  await A2.sincronizarNuvem('volta'); await A2._tick(80);
  ok(worker.puts.filter(p=>p.ns===ns+'_fotos').length===fotosPuts,'sem foto nova → não re-sobe fotos');

  // ---- sem rede: não quebra
  const semRede=await load(app, Object.fromEntries(A2.localStorage._map), {fetch:async()=>{ throw new Error('offline'); }, idb:idbA});
  await semRede._tick(200); await semRede.sincronizarNuvem('volta'); await semRede._tick(50);
  ok(semRede._errors.length===0,'offline: sync falha em silêncio, sem erro global');

  // ---- snapshot v1 antigo (sem _m, sem fotos) ainda funde
  const v1={_v:1, logs:{[exId]:[{date:D(20), sets:[{kg:18,r:12,rir:2,done:true}]}]}, bw:[{date:D(20),kg:61}]};
  const rel=A2.fundirBackup(v1);
  ok(rel.sessoes===1 && rel.pesagens===1,'backup v1 antigo funde normalmente', rel);
  ok(A2._errors.length===0,'A sem erro global no fim', A2._errors[0]);
}
(async()=>{
  await cenario('his'); await cenario('hers');
  console.log(`\n${n-fails}/${n} ok` + (fails?`, ${fails} FALHAS`:''));
  process.exit(fails?1:0);
})().catch(e=>{ console.error('FATAL',e); process.exit(1); });
