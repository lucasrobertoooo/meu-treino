/* Plano "Recomposição e glúteo" da Priscila (09/11/2026) + tempo do treino (Normal · 45 min ·
   Essencial). Só o app dela. */
const {load, D, NS, fakeWorker}=require('./harness');
let fails=0, n=0;
const ok=(c,m,x)=>{ n++; if(!c){ fails++; console.log('  ✗', m, x!==undefined?String(JSON.stringify(x)).slice(0,300):''); } else console.log('  ✓', m); };
const ns=NS.hers, K=k=>ns+'_'+k+'_v1';
const ESPERADO={A:['c_3','a_3','a_2','a_4','b_8','a_7'], B:['b2_grv','a_6','d_6','c_5','c_8'],
  C:['b_1','b_3','c3_bul','c3_hip','c_2','c3_abd','b_10'], D:['d4_lp','d4_sum','d_2','d_5s','d_abd','d4_abd','d_10'], E:['e_1']};

(async()=>{
  console.log('\n=== programa novo ===');
  const F=await load('hers', {}, {}); await F._tick(150);
  ok(JSON.stringify(F.diasProg())==='["A","B","C","D","E"]','5 dias (o 5º só de bike)', F.diasProg());
  for(const d of ['A','B','C','D','E']) ok(JSON.stringify(F.dayEx(d).map(e=>e.id))===JSON.stringify(ESPERADO[d]), `treino ${d}: exercícios do plano, na ordem`, F.dayEx(d).map(e=>e.id));
  const series=['A','B','C','D'].map(d=>F.dayEx(d).filter(e=>e.t!=='cardio').reduce((a,e)=>a+(+e.s),0));
  ok(JSON.stringify(series)==='[17,12,20,17]','séries por treino (17/12/20/17)', series);
  const bikes=['A','B','C','D','E'].map(d=>F.cardioMinutes(F.dayEx(d).find(e=>e.t==='cardio')));
  ok(JSON.stringify(bikes)==='[20,35,20,20,40]','bike: 35 no superior (pelo menos 30), 40 no dia 5', bikes);
  ok(F._ls('meta').progVer==='2026-11-15' && !F._ls('meta').progArquivo,'aparelho novo: marca a versão e não arquiva nada');
  const dur=['A','B','C','D'].map(d=>Math.round(F.dayMinutes(d)));
  ok(dur.every(m=>m>=55 && m<=80),'duração estimada na faixa do plano (~1h-1h15)', dur);
  ok(F.suggestedNextDay()==='A','rotação começa no treino 1');
  console.log('    duração (min):', dur.join(' / '));

  console.log('\n=== semana leve do plano: 1 série a menos ===');
  const s3={}; s3[K('meta')]=JSON.stringify({mesoDesde:D(14)});
  const W3=await load('hers', s3, {}); await W3._tick(150);
  ok(W3.mesoSemana()===3 && W3.exSets(W3.dayEx('A')[0])===4,'semana 3: séries do programa, sem +1', {sem:W3.mesoSemana(), s:W3.exSets(W3.dayEx('A')[0])});
  const s4={}; s4[K('meta')]=JSON.stringify({mesoDesde:D(21)});
  const W4=await load('hers', s4, {}); await W4._tick(150);
  ok(W4.mesoSemana()===4,'semana 4 detectada', W4.mesoSemana());
  ok(W4.exSets(W4.dayEx('A')[0])===3 && W4.exSets(W4.dayEx('B')[4])===1,'semana 4: 4→3 e 2→1 (piso de 1)', [W4.exSets(W4.dayEx('A')[0]), W4.exSets(W4.dayEx('B')[4])]);
  ok(W4.exSets(W4.dayEx('A').find(e=>e.t==='cardio'))===1,'bike não perde série (é tempo)');

  console.log('\n=== migração de um aparelho com o programa antigo ===');
  const velhoA=[{id:'a_1h',n:'Leg press HORIZONTAL (sentada)',s:4,r:'6-10',t:'comp',mg:{quadriceps:1}},{id:'a_4',n:'Cadeira abdutora',s:4,r:'12-16',t:'iso',mg:{gluteo_med:1}},{id:'u3_1',n:'Exercício que ela adicionou',s:3,r:'10-12',t:'iso',mg:{gluteo:1}}];
  const casaA=[{id:'a_1c',n:'Agachamento goblet (halter) ou livre',s:3,r:'10-15',t:'comp',mg:{quadriceps:1}}];
  const seed={};
  seed[K('prog')]=JSON.stringify({academia:{A:velhoA}, casa:{A:casaA}});
  seed[K('meta')]=JSON.stringify({mesoDesde:D(17), progM:500, plan:{ord:{academia:{A:['a_4','a_1h']}}, tr:{academia:{a_2:{n:'Leg press 45°'}}}}});
  seed[K('exmeta')]=JSON.stringify({a_4:{swap:{n:'Abdução na polia'}, note:'nota dela'}});
  seed[K('logs')]=JSON.stringify({a_4:[{date:D(3), sets:[{kg:'40',reps:'14',rir:'2',done:true}]}], a_1h:[{date:D(3), sets:[{kg:'80',reps:'8',rir:'2',done:true}]}]});
  seed[K('session')]=JSON.stringify({active:null, history:[{date:D(3), workoutId:'A', activeMs:95*60000, endAt:Date.now()-3*86400000}]});
  const M=await load('hers', seed, {migrar:true}); await M._tick(150);
  ok(JSON.stringify(M.dayEx('A').map(e=>e.id))===JSON.stringify(ESPERADO.A),'treino A editado no aparelho dá lugar ao plano novo', M.dayEx('A').map(e=>e.id));
  const meta=M._ls('meta'), arq=(meta.progArquivo||{})['2026-11-09']||{};
  ok(meta.progVer==='2026-11-15' && meta.progArquivo['2026-11-15'],'aparelho antigo passa pelos dois degraus da migração', meta.progVer);
  ok(arq.prog && arq.prog.A && arq.prog.A.length===3,'programa antigo arquivado (inclusive o exercício que ela adicionou)', arq.prog);
  ok(arq.ord && arq.ord.A && arq.tr && arq.tr.a_2,'ordem e troca "sempre" da academia arquivadas', {ord:arq.ord, tr:arq.tr});
  ok(arq.swaps && arq.swaps.a_4 && arq.swaps.a_4.n==='Abdução na polia','swap de id reaproveitado arquivado', arq.swaps);
  const ex=M._ls('exmeta');
  ok(ex.a_4 && !ex.a_4.swap && ex.a_4.note==='nota dela','swap saiu, nota dela ficou', ex.a_4);
  ok(M._ls('logs').a_4.length===1 && M._ls('logs').a_1h.length===1,'logs intactos (o da abdutora continua valendo)');
  const prog=M._ls('prog');
  ok(!prog.academia && prog.casa && prog.casa.A.length===1,'programa de casa não foi tocado', Object.keys(prog));
  ok(Object.keys(prog).length>0,'prog nunca fica vazio (a sync puxaria o antigo de volta)');
  ok(meta.mesoDesde===D(0) && arq.mesoDesde===D(17),'mesociclo recomeça junto com o plano (o antigo fica no arquivo)', {agora:meta.mesoDesde, antes:arq.mesoDesde});
  ok(meta.progM===502,'carimbo do programa: +1 por degrau sobre o compartilhado (igual nos dois aparelhos)', meta.progM);
  ok(M.paceFactor('A')===1,'sessão do programa antigo não calibra a duração do novo', M.paceFactor('A'));
  ok(M.dayOfExId('a_4')==='A' && M.dayOfExId('c3_bul')==='C' && M.dayOfExId('e_1')==='E','dayOfExId atravessa o marcador sem erro');
  ok(M._errors.length===0,'sem erro global', M._errors[0]);
  // idempotente
  const M2=await load('hers', Object.fromEntries(M.localStorage._map), {migrar:true}); await M2._tick(150);
  ok(JSON.stringify(M2._ls('meta').progArquivo)===JSON.stringify(meta.progArquivo) && M2._ls('meta').progM===502,'segunda abertura não migra de novo');
  // renderiza o dia
  let err=null; try{ for(const d of ['A','B','C','D','E']) M2.renderDay(d); M2.renderTreinos && M2.renderTreinos(); }catch(e){ err=String(e); }
  ok(!err && M2._errors.length===0,'os 5 dias renderizam', err||M2._errors[0]);
  M2.renderDay('E'); const hE=M2.document.getElementById('app').innerHTML;
  ok(!/Tempo hoje/.test(hE) && !/Quero mais cardio/.test(hE),'dia 5 (só bike) sem seletor de tempo nem "mais cardio"');

  console.log('\n=== degrau 15/11: aparelho que já estava no plano de 09/11 ===');
  const s9={};
  s9[K('prog')]=JSON.stringify({_plano20261109:{}, academia:{B:[{id:'b2_pux',n:'Puxada frontal na polia',s:3,r:'8-12',t:'comp',mg:{costas:1}}], A:[{id:'c_3',n:'Búlgaro editado',s:4,r:'8-10 por perna',t:'comp',mg:{quadriceps:1}}]}});
  s9[K('meta')]=JSON.stringify({progVer:'2026-11-09', progDesde:D(6), mesoDesde:D(6), progM:900, plan:{tr:{academia:{b2_tri:{n:'Tríceps francês'}, a_2:{n:'Leg press 45°'}}}}});
  s9[K('session')]=JSON.stringify({active:null, history:[{date:D(2), workoutId:'B', activeMs:110*60000, endAt:Date.now()-2*86400000},{date:D(5), workoutId:'B', activeMs:100*60000, endAt:Date.now()-5*86400000}]});
  const N9=await load('hers', s9, {migrar:true}); await N9._tick(150);
  const m9=N9._ls('meta'), a9=m9.progArquivo['2026-11-15'];
  ok(m9.progVer==='2026-11-15' && m9.progM===901,'degrau único: versão nova, carimbo +1', {v:m9.progVer, m:m9.progM});
  ok(JSON.stringify(N9.dayEx('B').map(e=>e.id))===JSON.stringify(ESPERADO.B) && a9.prog.B,'treino 2 editado dá lugar ao enxuto (o editado vai pro arquivo)');
  ok(N9.dayEx('A')[0].n==='Búlgaro editado','edição dela no treino 1 continua (dia que não mudou)');
  ok(a9.tr.b2_tri && !a9.tr.a_2 && N9._ls('meta').plan.tr.academia.a_2,'troca de exercício que saiu vai pro arquivo; a de exercício que ficou continua', a9.tr);
  ok(m9.mesoDesde===D(6),'mesociclo NÃO recomeça no degrau 2', m9.mesoDesde);
  ok(N9.paceFactor('B')===1,'duração do treino 2 não calibra com as sessões do treino 2 antigo', N9.paceFactor('B'));
  ok(N9._errors.length===0,'sem erro global', N9._errors[0]);

  console.log('\n=== sincronização: o programa antigo do outro aparelho não volta ===');
  const worker=fakeWorker();
  const base={}; base[K('prog')]=JSON.stringify({academia:{A:velhoA}});
  base[K('logs')]=seed[K('logs')]; base[K('session')]=seed[K('session')];
  base[K('meta')]=JSON.stringify({workerUrl:'https://w.test', workerToken:'tok', progM:500, mesoDesde:D(17)});
  const O=await load('hers', base, {fetch:worker, idb:new Map()}); await O._tick(150);   // aparelho ainda no programa antigo
  O.saveK('prog'); await O.sincronizarNuvem('volta'); await O._tick(80);
  const N=await load('hers', base, {fetch:worker, idb:new Map(), migrar:true}); await N._tick(150);
  await N.sincronizarNuvem('volta'); await N._tick(80);
  ok(!N._ls('prog').academia && JSON.stringify(N.dayEx('A').map(e=>e.id))===JSON.stringify(ESPERADO.A),'aparelho migrado continua no plano novo depois de puxar o antigo', N._ls('prog'));
  await O.sincronizarNuvem('volta'); await O._tick(80);
  ok(!O._ls('prog').academia,'e o aparelho antigo recebe o programa novo', O._ls('prog'));

  console.log('\n=== tempo do treino ===');
  const T=await load('hers', {}, {}); await T._tick(150);
  const totA=Math.round(T.dayMinutes('A'));
  const p45=T.shortPlan('A',45);
  ok(p45.cardioMin===10,'45 min: a bike encolhe primeiro, até 10', p45.cardioMin);
  ok(p45.estMin<=45 || !p45.coube,'45 min: cabe, ou diz que não coube', p45);
  const exA=T.dayEx('A');
  ok(!p45.fora.has(0),'o 1º exercício (búlgaro) nunca sai');
  ok(![...p45.fora].some(i=>exA[i].id==='a_4'),'a abdutora (glúteo médio, foco) fica');
  ok([...p45.fora].every(i=>exA[i].t!=='cardio'),'a bike não é "exercício pra pular"');
  const pE=T.shortPlan('A',25);
  const forcaFica=exA.filter((e,i)=>e.t!=='cardio' && !pE.fora.has(i)).length;
  ok(forcaFica>=3,'Essencial: piso de 3 exercícios de força', forcaFica);
  ok(!pE.coube ? pE.estMin>25 : true,'Essencial que não cabe diz o número real', pE.estMin);
  const pB=T.shortPlan('B',25), exB=T.dayEx('B');
  const ficaB=exB.filter((e,i)=>e.t!=='cardio' && !pB.fora.has(i)).map(e=>e.id);
  ok(pB.lista && JSON.stringify(ficaB)==='["b2_grv","d_6","c_5"]','Essencial do treino 2 = "com pouco tempo" do plano', ficaB);
  const p0=T.shortPlan('A',0);
  ok(p0.fora.size===0 && p0.cardioMin===20 && p0.total===totA,'Normal não corta nada', p0);
  // modo na tela e exclusão mútua com o "mais cardio"
  T.setShortDay('A',45); await T._tick(20);
  ok(T.shortDayMin('A')===45,'escolha do tempo gravada pra hoje');
  T.renderDay('A');
  const html=T.document.getElementById('app').innerHTML;
  ok(/Tempo hoje/.test(html) && /class="tc-opt on"[^>]*>45 min/.test(html),'cartão de tempo com 45 min marcado');
  ok(/pode pular hoje · falta de tempo/.test(html) || p45.fora.size===0,'exercício cortado aparece apagado');
  ok(/era 20 min/.test(html),'bike mostra que encolheu');
  T.toggleCardioDay('A'); await T._tick(20);
  ok(T.cardioDayOn('A') && T.shortDayMin('A')===0,'ligar "mais cardio" desliga o tempo curto');
  T.setShortDay('A',25); await T._tick(20);
  ok(!T.cardioDayOn('A') && T.shortDayMin('A')===25,'escolher um tempo desliga o "mais cardio"');
  ok(T._errors.length===0,'sem erro global', T._errors[0]);

  console.log(`\n${n-fails}/${n} ok`);
  process.exit(fails?1:0);
})();
