/* Correções da auditoria de 15/11/2026 (3 auditores: sessão, progressão, camadas). Cada teste
   reproduz um achado confirmado. Os dois apps. */
const {load, D, NS}=require('./harness');
let fails=0, n=0;
const ok=(c,m,x)=>{ n++; if(!c){ fails++; console.log('  ✗', m, x!==undefined?String(JSON.stringify(x)).slice(0,300):''); } else console.log('  ✓', m); };
const S=(kg,reps,rir='2')=>({kg:String(kg),reps:String(reps),rir,done:true});
const sess=(dt,arr,extra)=>Object.assign({date:dt,sets:arr.map(([k,r,rr])=>S(k,r,rr))}, extra||{});
const H=3600000;

async function cenario(app){
  console.log('\n=== '+app+' ===');
  const ns=NS[app], K=k=>ns+'_'+k+'_v1';
  const W0=await load(app,{},{}); await W0._tick(120);
  const d0=W0.diasProg()[0], e0=W0.dayEx(d0)[0], id0=e0.id;

  console.log('-- sessão');
  // 1. sessão esquecida há 3 dias: o boot encerra no último set, não "72 h"
  const ini=Date.now()-72*H, ult=ini+50*60000;
  const s1={}; s1[K('session')]=JSON.stringify({active:{workoutId:d0, startAt:ini, lastSetAt:ult, pausedAt:null, pausedTotal:0}, history:[]});
  s1[K('logs')]=JSON.stringify({[id0]:[sess(D(3),[[20,10],[20,10]])]});
  const A=await load(app,s1,{}); await A._tick(200);
  const sA=A._ls('session');
  ok(!sA.active,'sessão de 3 dias atrás foi encerrada no boot', sA.active);
  const rA=sA.history[0]||{};
  ok(rA.activeMs===50*60000 && rA.date===D(3) && rA.sets===2,'registro com fim no último set, data do início e os sets daquele dia', rA);
  // 2. sem nenhum set: descarta, não grava registro vazio (que bloqueava o dia)
  const s2={}; s2[K('session')]=JSON.stringify({active:{workoutId:d0, startAt:Date.now()-5*H, pausedAt:null, pausedTotal:0}, history:[]});
  const B=await load(app,s2,{}); await B._tick(200);
  ok(!B._ls('session').active && B._ls('session').history.length===0,'sessão parada sem set: descartada sem registro');
  B.startSession(d0); B.endSession(true);
  ok(B._ls('session').history.length===0 && !B.alreadyCelebratedToday(d0),'"Iniciar" e "Parar" sem set não bloqueia o dia');
  // 3. paceFactor ignora o registro absurdo e usa mediana verdadeira
  const modelo=W0.dayEx(d0).reduce((a,e)=>a+W0.exMinutes(e),0), bike=W0.dayEx(d0).reduce((a,e)=>a+W0.cardioMinutes(e),0);
  const r=(m,dt)=>({date:D(dt), workoutId:d0, activeMs:(m+bike)*60000, sets:10, endAt:Date.now()-dt*86400000});
  const s3={}; s3[K('session')]=JSON.stringify({active:null, history:[r(modelo,9), r(modelo,6), r(modelo,3), {date:D(1), workoutId:d0, activeMs:72*H, sets:5, endAt:Date.now()-86400000}]});
  const C=await load(app,s3,{}); await C._tick(150);
  ok(Math.abs(C.paceFactor(d0)-1)<0.05,'paceFactor ignora sessão de 72 h (era 1,8)', C.paceFactor(d0));

  console.log('-- progressão');
  // 4. sessão carimbada como semana leve não vira referência
  const id='a_2', ex=W0.exDoLog(id); const rng=W0.parseRange(ex.r), nb=W0.setsBase(ex);
  const normal=Array.from({length:nb},(_,j)=>[20, rng.max-1-(j%2)]);
  const leve=Array.from({length:Math.max(1,nb-1)},()=>[20, rng.max,'3']);
  const s4={}; s4[K('logs')]=JSON.stringify({[id]:[sess(D(15),normal),sess(D(8),normal),sess(D(2),leve,{fase:'deload',plan:leve.length})]});
  const E=await load(app,s4,{}); await E._tick(150);
  const ref=E.refSession(id), sg=E.suggestNext(id, E.exDoLog(id));
  ok(ref.date===D(8),'referência pula a sessão de semana leve', ref.date);
  ok(sg && sg.kg===20,'e não manda subir carga por causa dela', sg);
  // 5. uma sessão com séries extras não cala o "travado"
  const quatro=Array.from({length:nb},()=>[30,rng.min+1]), oito=Array.from({length:nb*2},()=>[30,rng.min+1]);
  const s5={}; s5[K('logs')]=JSON.stringify({[id]:[sess(D(40),oito),sess(D(33),quatro),sess(D(26),quatro),sess(D(19),quatro),sess(D(12),quatro),sess(D(5),quatro)]});
  const F=await load(app,s5,{}); await F._tick(150);
  ok(F.progressState(id, F.exDoLog(id)).k!=='progredindo','séries extras no passado não escondem o travado', F.progressState(id, F.exDoLog(id)).k);
  // 6. na semana leve a Meta mantém a carga
  const s6={}; s6[K('logs')]=JSON.stringify({[id]:[sess(D(9),Array.from({length:nb},()=>[20,rng.max])),sess(D(2),Array.from({length:nb},()=>[20,rng.max]))]}); s6[K('meta')]=JSON.stringify({mesoDesde:D(22)});
  const G=await load(app,s6,{}); await G._tick(150);
  const sgG=G.suggestNext(id, G.exDoLog(id));
  ok(G.emDeload() && sgG && sgG.kg===20 && /semana leve/.test(sgG.why),'semana leve: mesma carga (antes dizia "sobe carga")', {fase:G.faseMeso().k, sg:sgG});
  // 7. antecipar a semana leve re-ancora o ciclo: depois dos 7 dias é semana 1
  const s7={}; s7[K('meta')]=JSON.stringify({mesoDesde:D(14)}); s7[K('logs')]=JSON.stringify({[id]:[sess(D(1),normal)]});
  const Hh=await load(app,s7,{}); await Hh._tick(150);
  Hh.anteciparDeload(); await Hh._tick(20);
  const m7=Hh._ls('meta');
  ok(Hh.mesoSemana()===4 && Hh.emDeload(),'antecipou: hoje é semana leve', Hh.mesoSemana());
  const dias=Math.round((new Date(D(0))-new Date(m7.mesoDesde))/86400000);
  ok(dias===21,'âncora em hoje-21: daqui a 7 dias começa a semana 1 (não a 4 de novo)', m7.mesoDesde);
  // 8. o card diz por que o número de séries mudou
  G.renderDay(G.diasProg().find(d=>G.dayEx(d).some(x=>x.id===id)));
  ok(/semana leve · normal/.test(G.document.getElementById('app').innerHTML),'card mostra "(semana leve · normal N)"');

  console.log('-- camadas');
  // 9. "Fazer agora" com "sempre" vai pro começo mesmo com exercícios já feitos hoje
  const dX=W0.diasProg().find(d=>W0.dayEx(d).filter(x=>x.t!=='cardio').length>=4);
  const L=W0.dayEx(dX);
  const s9={}; s9[K('logs')]=JSON.stringify({[L[0].id]:[sess(D(0),[[20,10]])], [L[1].id]:[sess(D(0),[[20,10]])]});
  const I=await load(app,s9,{}); await I._tick(150);
  I.planAbrir(dX,3); I.planSetEsc('sempre'); I.planFazerAgora();
  ok(I.dayEx(dX)[0].id===L[3].id,'"Fazer agora · sempre" põe no 1º lugar', I.dayEx(dX).map(x=>x.id));
  // 10. modo curto: o 1º do PROGRAMA continua protegido depois de reordenar
  const J=await load(app,{},{}); await J._tick(150);
  const ids=J.dayEx(dX).map(x=>x.id); const ultimoForca=J.dayEx(dX).map((x,i)=>x.t!=='cardio'?i:-1).filter(i=>i>=0).pop();
  const [mv]=ids.splice(ultimoForca,1); ids.unshift(mv); J.planGravarOrdem(dX, ids, 'hoje');
  const pl=J.shortPlan(dX,25), L2=J.dayEx(dX);
  ok(!pl.fora.has(L2.findIndex(x=>x.id===L[0].id)),'Essencial protege o 1º do programa, não o que foi adiantado', [...pl.fora].map(i=>L2[i].id));
  // 11. modo curto: o treino fecha com o que sobrou
  J.setShortDay(dX,25); await J._tick(10);
  const fora=J.foraHoje(dX);
  ok(fora.size>0 && !J.isWorkoutComplete(dX),'(controle) nada feito = incompleto');
  const logs={}; L2.forEach((x,i)=>{ if(!fora.has(i)) logs[J.exId(dX,i)]=[sess(D(0),Array.from({length:J.exSets(x)},()=>[20,10]))]; });
  const s11={}; s11[K('logs')]=JSON.stringify(logs); s11[K('meta')]=JSON.stringify({shortDays:{[D(0)]:{d:dX,min:25}}, plan:{hoje:{data:D(0), ord:{[dX]:ids}, tr:{}}}});
  const Kk=await load(app,s11,{}); await Kk._tick(150);
  ok(Kk.isWorkoutComplete(dX),'Essencial: feito tudo o que ficou = treino completo (antes nunca fechava)');
  if(app==='hers'){
    // 12. editor dela troca o exercício certo depois de reordenar
    const M=await load(app,{},{}); await M._tick(150);
    const dd=M.diasProg()[0]; const base=M.dayEx(dd).map(x=>x.id);
    const alvo=base[3]; M.planAbrir(dd,3); M.planSetEsc('hoje'); M.planFazerAgora();
    const iTela=M.dayEx(dd).findIndex(x=>x.id===alvo);
    M.openExEdit(alvo, dd, iTela); M.pickBank('Core', 0); await M._tick(20);
    const prog=M._ls('prog').academia[dd].map(x=>x.id);
    ok(prog[0]===base[0] && !prog.includes(alvo),'trocou o exercício do card (não o 1º do programa)', {antes:base, depois:prog});
    // 13. faixa que mudou no plano novo: sessões antigas não mandam descer a carga
    const s13={}; s13[K('logs')]=JSON.stringify({a_4:[sess(D(21),[[40,13],[40,13],[40,13],[40,13]]),sess(D(14),[[40,13],[40,13],[40,13],[40,13]]),sess(D(7),[[40,14],[40,14],[40,14],[40,14]])]});
    const N=await load(app,s13,{migrar:true}); await N._tick(150);
    const st=N.progressState('a_4', N.exDoLog('a_4'));
    ok(st.k!=='carga-alta' && st.sug && st.sug.kg===40,'abdutora 12-16 → 15-20: recomeça a contagem, carga de referência mantida', st);
  }
  console.log('-- ciclo comum (15/11/2026)');
  const sc={}; sc[K('meta')]=JSON.stringify({mesoDesde:D(17)}); sc[K('logs')]=JSON.stringify({[id]:[sess(D(1),normal)]});
  const P=await load(app,sc,{migrar:true}); await P._tick(150);
  const mp=P._ls('meta');
  const antesEsperado = app==='hers' ? D(0) : D(17);   // no dela a migração do plano já tinha recomeçado o ciclo hoje
  ok(mp.mesoDesde==='2026-11-16' && mp.mesoAntesComum===antesEsperado && mp.cicloComum==='2026-11-16','âncora comum na segunda 16/11 (anterior guardada)', mp);
  ok(P.mesoSemana()===(D(0)<'2026-11-16'?1:P.mesoSemana()) && P.mesoSemana()>=1,'antes da segunda já conta como semana 1', P.mesoSemana());
  const P2=await load(app,Object.fromEntries(P.localStorage._map),{migrar:true}); await P2._tick(150);
  ok(P2._ls('meta').mesoAntesComum===antesEsperado && P2._ls('meta').mesoDesde==='2026-11-16','ancora uma vez só (segunda abertura não mexe)');
  const s4w={}; s4w[K('meta')]=JSON.stringify({mesoDesde:D(22)}); s4w[K('logs')]=JSON.stringify({[id]:[sess(D(1),normal)]});
  const Q=await load(app,s4w,{}); await Q._tick(150);
  const e5=Q.exDoLog(id), b5=Q.setsBase(e5);
  ok(Q.mesoSemana()===4 && Q.exSets(e5)===Math.max(1,b5-1),'semana 4: 1 série a menos (regra dela, agora nos dois)', {base:b5, s:Q.exSets(e5)});
  const s3w={}; s3w[K('meta')]=JSON.stringify({mesoDesde:D(15)}); s3w[K('logs')]=JSON.stringify({[id]:[sess(D(1),normal)]});
  const R=await load(app,s3w,{}); await R._tick(150);
  ok(R.mesoSemana()===3 && R.exSets(R.exDoLog(id))===b5 && R.faseMeso().k==='base','semana 3: sem série extra', {sem:R.mesoSemana(), s:R.exSets(R.exDoLog(id)), f:R.faseMeso().k});
  for(const w of [A,B,C,E,F,G,Hh,I,J,Kk,P,Q,R]) if(w._errors.length){ ok(false,'erro global',w._errors[0]); break; }
}
(async()=>{ await cenario('his'); await cenario('hers'); console.log(`\n${n-fails}/${n} ok`+(fails?`, ${fails} FALHAS`:'')); process.exit(fails?1:0); })().catch(e=>{ console.error('FATAL',e); process.exit(1); });
