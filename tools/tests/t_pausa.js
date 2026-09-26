/* Pausa de 7+ dias (viagem, doença): o mesociclo recomeça na volta em vez de avançar a fase
   no calendário — e a migração da âncora não pode mudar a semana de ninguém. */
const {load, D, NS}=require('./harness');
let fails=0, n=0;
const ok=(c,m,x)=>{ n++; if(!c){ fails++; console.log('  ✗', m, x!==undefined?String(JSON.stringify(x)).slice(0,300):''); } else console.log('  ✓', m); };

async function cenario(app){
  console.log('\n=== '+app+' ===');
  const ns=NS[app];
  const w0=await load(app,{},{}); await w0._tick(150);
  const dia=w0.diasProg()[0], id=w0.exId(dia,0);
  const sess=(dt)=>({date:dt, sets:[{kg:'20',reps:'10',rir:'2',done:true}]});

  // ---- migração (só o app dele muda de relógio): a semana de hoje não pode pular
  if(app==='his'){
    for(const semanas of [0,1,2,3]){
      const anc=D(semanas*7+3);
      const s={}; s[ns+'_meta_v1']=JSON.stringify({blocoDesde:anc, bloco:'peito_bracos'});   // sem mesoDesde: estado antigo
      const w=await load('his', s, {}); await w._tick(150);
      const esperada=((Math.floor(w.daysBetween(anc, w.today())/7)) % 4) + 1;
      ok(w.mesoSemana()===esperada, `migração preserva a semana ${esperada} do mesociclo`, {viu:w.mesoSemana(), esperada});
      ok(!!w._ls('meta').mesoDesde,'semeou a âncora própria');
    }
  }

  // ---- treinou até 3 dias atrás: nada acontece
  const logsRecente={}; logsRecente[id]=[sess(D(10)), sess(D(6)), sess(D(3))];
  const sA={}; sA[ns+'_meta_v1']=JSON.stringify({mesoDesde:D(17), blocoDesde:D(17)}); sA[ns+'_logs_v1']=JSON.stringify(logsRecente);
  const A=await load(app, sA, {}); await A._tick(150);
  ok(!A._ls('meta').mesoPausa,'treino recente: não re-ancora nada');
  ok(A.mesoSemana()===3,'e a semana segue o calendário normalmente', A.mesoSemana());

  // ---- 8 dias parado: recomeça na semana 1
  const logsPausa={}; logsPausa[id]=[sess(D(22)), sess(D(15)), sess(D(8))];
  const sB={}; sB[ns+'_meta_v1']=JSON.stringify({mesoDesde:D(22), blocoDesde:D(22)}); sB[ns+'_logs_v1']=JSON.stringify(logsPausa);
  const semAntes=Math.floor(22/7)%4+1;
  const B=await load(app, sB, {}); await B._tick(150);
  ok(B.mesoSemana()===1,`8 dias parado: volta na semana 1 (sem a regra seria ${semAntes})`, B.mesoSemana());
  ok(B.emDeload()===false,'e NÃO cai direto numa semana leve depois da parada');
  const mp=B._ls('meta').mesoPausa;
  ok(mp && mp.dias===8 && mp.ultimo===D(8),'registrou a pausa', mp);
  ok(mp && mp.antes===D(22),'guardou a âncora anterior pra desfazer');

  // ---- idempotente: reabrir o app não re-ancora de novo
  const B2=await load(app, Object.fromEntries(B.localStorage._map), {}); await B2._tick(150);
  ok(B2._ls('meta').mesoDesde===B._ls('meta').mesoDesde,'reabrir não muda a âncora de novo');

  // ---- card na tela + desfazer
  B.renderTreinos ? B.renderTreinos() : B.render(); await B._tick(40);
  ok(B.document.body.innerHTML.includes('contei como a sua semana leve'),'card explica na tela');
  B.desfazerReancoraMeso(); await B._tick(30);
  ok(B._ls('meta').mesoDesde===D(22),'desfazer devolve a âncora anterior');
  ok(B._ls('meta').mesoPausa.desfeito===true,'e marca como desfeito (não re-dispara)');
  const B3=await load(app, Object.fromEntries(B.localStorage._map), {}); await B3._tick(150);
  ok(B3._ls('meta').mesoDesde===D(22),'e continua desfeito depois de reabrir');

  // ---- treino em CASA conta como treino (não é pausa)
  const sC={}; sC[ns+'_meta_v1']=JSON.stringify({mesoDesde:D(22), blocoDesde:D(22)});
  sC[ns+'_logs_v1']=JSON.stringify({[id]:[sess(D(22)), sess(D(15)), sess(D(8))]});
  sC[ns+'_freelog_v1']=JSON.stringify({algum:[sess(D(2))]});
  const C=await load(app, sC, {}); await C._tick(150);
  ok(!C._ls('meta').mesoPausa,'exercício em casa segura o relógio (não é pausa)');

  // ---- a carga não é mexida por 7 dias
  const vv=B3.fatorVolta(id);
  ok(!vv,'7-8 dias parado não corta carga nenhuma', vv);
  ok(B3._errors.length===0 && A._errors.length===0,'sem erro global', B3._errors[0]||A._errors[0]);
}
(async()=>{ await cenario('his'); await cenario('hers'); console.log(`\n${n-fails}/${n} ok`+(fails?`, ${fails} FALHAS`:'')); process.exit(fails?1:0); })()
 .catch(e=>{ console.error('FATAL',e); process.exit(1); });
