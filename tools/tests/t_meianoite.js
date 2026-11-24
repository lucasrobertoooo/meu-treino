/* Treino que passa da meia-noite (24/11/2026: o treino da Priscila "sumiu" à meia-noite). */
const {load, D, NS}=require('./harness');
let fails=0, n=0;
const ok=(c,m,x)=>{ n++; if(!c){ fails++; console.log('  ✗', m, x!==undefined?String(JSON.stringify(x)).slice(0,300):''); } else console.log('  ✓', m); };
const S=(kg,reps)=>({kg:String(kg),reps:String(reps),rir:'2',done:true});
const at=(dia,hm)=>new Date(dia+'T'+hm+':00').getTime();
async function cenario(app){
  console.log('\n=== '+app+' ===');
  const ns=NS[app], K=k=>ns+'_'+k+'_v1';
  const ontem=D(1), hoje=D(0);
  const W0=await load(app,{},{}); await W0._tick(120);
  const d=W0.diasProg()[0], L=W0.dayEx(d).filter(e=>e.t!=='cardio');
  const [e0,e1,e2]=L;

  console.log('-- continuando o treino às 00:10');
  const s1={}; s1[K('session')]=JSON.stringify({active:{workoutId:d, startAt:at(ontem,'23:00'), lastSetAt:at(hoje,'00:04'), pausedAt:null, pausedTotal:0}, history:[]});
  s1[K('logs')]=JSON.stringify({[e0.id]:[{date:ontem, sets:[S(20,10),S(20,10),S(20,9)]}]});
  const A=await load(app,s1,{agora:at(hoje,'00:10')}); await A._tick(200);
  ok(A._ls('session').active,'virar o dia não encerra a sessão');
  ok(A.diaTreino()===ontem,'o dia do treino continua sendo ontem', A.diaTreino());
  const tod=A.todaySession(e0.id);
  ok(tod && tod.sets.length===3,'a tela ainda vê as séries de antes da meia-noite', tod);
  A.renderDay(d);
  ok(/value="20"/.test(A.document.getElementById('app').innerHTML),'e elas aparecem nos campos do card');
  A.upsertToday(e1.id,[S(30,12)]);
  const l1=A._ls('logs')[e1.id];
  ok(l1.length===1 && l1[0].date===ontem,'série marcada depois da meia-noite vai pro dia do treino', l1);
  ok(!A.alreadyCelebratedToday(d) && A.todayTrainedDays().includes(d),'"treinou hoje" segue o dia do treino');
  A.endSession(true);
  const r=A._ls('session').history[0];
  ok(r && r.date===ontem && r.sets===4,'ao encerrar: um registro, data de ontem, as 4 séries', r);

  console.log('-- sessão parada há 2 h depois da meia-noite: encerra');
  const s2={}; s2[K('session')]=JSON.stringify({active:{workoutId:d, startAt:at(ontem,'22:00'), lastSetAt:at(ontem,'23:30'), pausedAt:null, pausedTotal:0}, history:[]});
  s2[K('logs')]=JSON.stringify({[e0.id]:[{date:ontem, sets:[S(20,10)]}]});
  const B=await load(app,s2,{agora:at(hoje,'01:30')}); await B._tick(200);
  ok(!B._ls('session').active && B._ls('session').history[0].date===ontem && B.diaTreino()===hoje,'encerrada no último set, registro de ontem, dia volta pro calendário');

  console.log('-- conserto: uma sessão que atravessou a meia-noite (versão antiga)');
  const s3={}; s3[K('session')]=JSON.stringify({active:null, history:[{date:hoje, workoutId:d, startAt:at(ontem,'23:00'), endAt:at(hoje,'00:30'), activeMs:90*60000, sets:5}]});
  s3[K('logs')]=JSON.stringify({
    [e0.id]:[{date:ontem, sets:[S(20,10),S(20,10)]}],
    [e1.id]:[{date:ontem, sets:[S(30,12)]},{date:hoje, sets:[S(30,12),S(30,11)]}],     // a tela levou a 1ª junto
    [e2.id]:[{date:hoje, sets:[S(15,15)]}]});
  const C=await load(app,s3,{}); await C._tick(200);
  const lc=C._ls('logs');
  ok(lc[e1.id].length===1 && lc[e1.id][0].date===ontem && lc[e1.id][0].sets.length===2,'séries de depois juntadas sem duplicar', lc[e1.id]);
  ok(lc[e2.id].length===1 && lc[e2.id][0].date===ontem,'exercício feito só depois da meia-noite vai pro dia do treino', lc[e2.id]);
  ok(lc[e0.id][0].sets.length===2,'o de antes ficou intacto');
  ok(C._ls('session').history[0].date===ontem && C._ls('session').history[0].juntado,'registro com a data do início');

  console.log('-- conserto: sessão encerrada e reaberta logo depois da meia-noite');
  const s4={}; s4[K('session')]=JSON.stringify({active:null, history:[
    {date:ontem, workoutId:d, startAt:at(ontem,'22:50'), endAt:at(ontem,'23:55'), durationMs:65*60000, activeMs:65*60000, sets:6, volume:600},
    {date:hoje, workoutId:d, startAt:at(hoje,'00:12'), endAt:at(hoje,'00:40'), durationMs:28*60000, activeMs:28*60000, sets:3, volume:300}]});
  s4[K('logs')]=JSON.stringify({[e0.id]:[{date:ontem, sets:[S(20,10),S(20,10)]}], [e2.id]:[{date:hoje, sets:[S(15,15),S(15,14),S(15,14)]}]});
  const E=await load(app,s4,{}); await E._tick(200);
  const h4=E._ls('session').history;
  ok(h4.length===1 && h4[0].sets===9 && h4[0].activeMs===93*60000,'as duas sessões viraram um treino só (9 séries, 93 min)', h4);
  ok(E._ls('logs')[e2.id][0].date===ontem,'séries da 2ª sessão no dia do treino');
  const E2=await load(app,Object.fromEntries(E.localStorage._map),{}); await E2._tick(200);
  ok(E2._ls('session').history.length===1 && E2._ls('session').history[0].sets===9,'reabrir não junta de novo');
  for(const w of [A,B,C,E,E2]) if(w._errors.length){ ok(false,'erro global',w._errors[0]); break; }
}
(async()=>{ await cenario('his'); await cenario('hers'); console.log(`\n${n-fails}/${n} ok`+(fails?`, ${fails} FALHAS`:'')); process.exit(fails?1:0); })().catch(e=>{ console.error('FATAL',e); process.exit(1); });
