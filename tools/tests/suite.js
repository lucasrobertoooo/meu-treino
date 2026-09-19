/* Suíte de regressão (reconstruída 19/09): boot, telas, timer, iOS timer stack, import não
   destrutivo, sync. Rodar ANTES de cada push e LER o resultado. */
const {load, D, fakeWorker, NS}=require('./harness');
let fails=0, n=0;
const ok=(c,msg,extra)=>{ n++; if(!c){ fails++; console.log('  ✗', msg, extra!==undefined?String(JSON.stringify(extra)).slice(0,300):''); } else console.log('  ✓', msg); };

async function telas(app){
  console.log('\n=== '+app+': boot + telas ===');
  const ns=NS[app];
  const seed={ [ns+'_logs_v1']:JSON.stringify({a_1:[{date:D(3), sets:[{kg:20,r:10,rir:2,done:true},{kg:20,r:10,rir:2,done:true}]}]}), [ns+'_bw_v1']:JSON.stringify([{date:D(3),kg:60}]) };
  const w=await load(app, seed, {}); await w._tick(150);
  ok(w._errors.length===0,'boot sem erro global', w._errors[0]);
  const html0=w.document.body.innerHTML;
  ok(html0.length>20000,'home renderizou');
  for(const fn of ['renderHoje','renderDays','renderCorpo','renderMais']){
    const before=w._errors.length;
    try{ w[fn](); }catch(e){ w._errors.push(String(e)); }
    await w._tick(30);
    ok(w._errors.length===before, fn+'() sem erro', w._errors[before]);
  }
  const mais=w.document.body.innerHTML;
  ok(mais.includes('Timer nativo do iPhone'),'Mais tem seção do Timer nativo do iPhone');
  ok(mais.includes('Sincroniza sozinho entre aparelhos') || mais.includes('Configure o Worker'),'Mais tem a seção de nuvem (texto novo)');
  ok(mais.includes('navegador') || mais.includes('Navegador'),'Mais tem o botão de abrir no navegador');
  ok(!!w.document.getElementById('shortcutLink'),'overlay tem o link do Atalho');
  ok(typeof w.maybeInvokeShortcutTimer==='function' && typeof w.updateShortcutLink==='function' && typeof w.toggleShortcutTimer==='function' && typeof w.setShortcutName==='function','stack do timer iOS presente');
  // rodapé de instalação menciona iPhone
  ok(html0.includes('Adicionar à Tela de Início') || mais.includes('Adicionar à Tela de Início'),'instruções de instalação no iPhone presentes');

  // timer: openTimer mostra overlay e atualiza o link do Atalho quando há nome
  w.setShortcutName('TesteTimer');
  w.openTimer(90); await w._tick(20);
  const ov=w.document.getElementById('overlay');
  ok(ov && !ov.classList.contains('hidden'),'openTimer abre o overlay');
  const link=w.document.getElementById('shortcutLink');
  ok(link && !link.classList.contains('hidden') && link.href.includes('shortcuts://run-shortcut?name=TesteTimer') && link.href.includes('text=90'),'link do Atalho aponta pro nome + segundos', link&&link.href);
  w.closeTimer(); await w._tick(10);

  // import de JSON de medidas NÃO apaga logs (o brick antigo)
  const imp=w.document.getElementById('imp'); if(imp){ imp.value=JSON.stringify({measures:[{date:D(1), cintura:70}]}); w.importData(); await w._tick(30); }
  const logs=w._ls('logs');
  ok(logs && logs.a_1 && logs.a_1.length===1,'import de medidas não apagou os logs', logs&&Object.keys(logs));
  ok(w._errors.length===0,'sem erro global ao final', w._errors[0]);
}

async function timerNoToggle(app){
  console.log('\n=== '+app+': toggleDone dispara timer ===');
  const w=await load(app, {}, {}); await w._tick(150);
  const el=w.document.createElement('div');
  // primeiro set do primeiro exercício de A — assinatura difere entre os apps
  let threw=null;
  try{
    // precisa de inputs de kg/reps no DOM pra collect(); renderiza o dia A
    w.renderDay && w.renderDay('A');
    await w._tick(30);
    const inp=w.document.querySelector('input[type="number"], input[inputmode="decimal"], input[inputmode="numeric"]');
    if(inp) inp.value='20';
    if(app==='his') w.toggleDone('a_1',0,el); else w.toggleDone('A',0,0,el);
  }catch(e){ threw=String(e&&e.stack||e); }
  await w._tick(50);
  ok(!threw,'toggleDone não lança', threw);
  const ov=w.document.getElementById('overlay');
  ok(ov && !ov.classList.contains('hidden'),'timer abriu após marcar o set');
  ok(w._errors.length===0,'sem erro global', w._errors[0]);
}

async function syncBasico(app){
  console.log('\n=== '+app+': sync básico ===');
  const ns=NS[app], worker=fakeWorker();
  const A=await load(app, {[ns+'_meta_v1']:JSON.stringify({workerUrl:'https://w.test',workerToken:'tok'}), [ns+'_logs_v1']:JSON.stringify({a_1:[{date:D(2), sets:[{kg:20,r:10,rir:2,done:true}]}]})}, {fetch:worker, idb:new Map([['p1','data:image/jpeg;base64,X']])});
  await A._tick(120);
  A.localStorage.setItem(ns+'_photometa_v1', JSON.stringify([{id:'p1',date:D(2),angle:'frente'}]));
  const A2=await load(app, Object.fromEntries(A.localStorage._map), {fetch:worker, idb:new Map([['p1','data:image/jpeg;base64,X']])}); await A2._tick(120);
  A2.saveK('logs'); await A2.sincronizarNuvem('volta'); await A2._tick(80);
  ok(worker.puts.filter(p=>p.ns===ns).length===1 && worker.puts.filter(p=>p.ns===ns+'_fotos').length===1,'subiu dados + fotos', worker.puts);
  const idbB=new Map();
  const B=await load(app, {}, {fetch:worker, idb:idbB}); await B._tick(120);
  B.setWorkerUrl("https://w.test"); B.setWorkerToken("tok"); await B._tick(1600);
  ok(B._ls('logs') && B._ls('logs').a_1 && B._ls('logs').a_1.length===1,'aparelho novo puxou os logs ao configurar o Worker');
  ok(idbB.get('p1')==='data:image/jpeg;base64,X' && (B._ls('photometa')||[]).some(m=>m.id==='p1'),'aparelho novo puxou a foto');
  ok(B._errors.length===0 && A2._errors.length===0,'sem erro global', B._errors[0]||A2._errors[0]);
}

(async()=>{
  for(const app of ['his','hers']){ await telas(app); await timerNoToggle(app); await syncBasico(app); }
  console.log(`\n${n-fails}/${n} ok`+(fails?`, ${fails} FALHAS`:''));
  process.exit(fails?1:0);
})().catch(e=>{ console.error('FATAL',e); process.exit(1); });
