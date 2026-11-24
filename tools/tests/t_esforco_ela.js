/* Meta por série no app DELA (24/11/2026): mesmos princípios, regras do documento dela (1 a 3
   sobrando, carga sobe com o topo em TODAS as séries); e o graviton, em que o kg é ajuda. */
const {load, D}=require('./harness');
let fails=0, n=0;
const ok=(c,m,x)=>{ n++; if(!c){ fails++; console.log('  ✗', m, x!==undefined?String(JSON.stringify(x)).slice(0,400):''); } else console.log('  ✓', m); };
const S=a=>a.map(([kg,reps,rir])=>({kg:String(kg),reps:String(reps),rir:rir==null?'':String(rir),done:true}));
async function sug(id, day, sets, extra, sets0){
  const w=await load('hers', {treinoela_logs_v1:JSON.stringify({[id]:[{date:D(9),sets:S(sets0||sets)},{date:D(2),sets:S(sets)}]}), ...(extra||{})}, {}); await w._tick(120);
  const idx=w.dayEx(day).findIndex(e=>e.id===id), e=w.dayEx(day)[idx];
  return {w, e, g:w.suggestNext(id, e)};
}
const reps=g=>JSON.stringify((g.alvos||[]).map(x=>x.reps));
(async()=>{
  // glúteo e perna
  let r=await sug('b_1','C',[[40,10,2],[40,9,2],[40,8,1],[40,7,1]]);
  ok(r.g.kg===40 && reps(r.g)==='[10,10,8,7]','RDL 10/9/8/7: mesma carga, nenhuma série abaixo do que fez', r.g);
  r=await sug('b_1','C',[[40,10,2],[40,10,2],[40,10,1],[40,9,1]]);
  ok(r.g.kg===40,'RDL 10/10/10/9: NÃO sobe, o plano pede o topo em todas', r.g);
  r=await sug('b_1','C',[[40,10,2],[40,10,2],[40,10,1],[40,10,1]]);
  ok(r.g.kg>40 && r.g.reps===6,'RDL 10 em todas: sobe e volta pro piso', r.g);
  r=await sug('b_1','C',[[40,7,4],[40,7,3],[40,7,2],[40,7,2]]);
  ok(reps(r.g)==='[9,7,7,7]','RIR 4 está fora do plano e pede +2; 3 e 2 estão no plano e repetem', r.g.alvos);
  ok(/1 a 3/.test(r.w.esforcoTxt(r.g,r.e)),'texto: 1 a 3', r.w.esforcoTxt(r.g,r.e));
  r=await sug('b_1','C',[[40,8,0],[40,7,0],[40,7,0],[40,6,0]]);
  ok(reps(r.g)==='[8,7,7,6]','quem foi à falha não recebe pedido de mais reps', r.g.alvos);
  r=await sug('c_3','A',[[12,9,2],[12,9,2],[12,8,2],[12,8,1]]);
  ok(r.g.kg===12 && r.e.r==='8-10 por perna' && r.g.alvos.length===4,'búlgaro "por perna" lê a faixa certa', r.g);
  r=await sug('a_4','A',[[50,20,1],[50,19,1],[50,18,1],[50,18,0]]);
  ok(r.g.kg===50,'abdutora 20/19/18/18: não sobe', r.g);
  ok(/1 a 3/.test(r.w.esforcoTxt(r.g,r.e)),'isolador também: 1 a 3', r.w.esforcoTxt(r.g,r.e));
  r=await sug('d_abd','D',[[50,17,1],[50,16,1],[50,15,0],[30,10,0]]);
  ok(r.g.kg===50 && r.w.metaTxt(r.g,r.e,3)==='50kg · 18 / 16 / 15','série extra mais leve não entra na meta', r.w.metaTxt(r.g,r.e,3));
  r=await sug('d_2','D',[[14,11,3],[14,11,3],[14,10,3]]);
  ok(/1 a 3/.test(r.w.esforcoTxt(r.g,r.e)),'RDL leve: a mesma regra do plano', r.w.esforcoTxt(r.g,r.e));
  r=await sug('a_6','B',[[10,10,2],[10,9,2],[10,8,1]]);
  ok(/1 a 3/.test(r.w.esforcoTxt(r.g,r.e)),'superior: 1 a 3', r.w.esforcoTxt(r.g,r.e));
  // cardio
  r=await sug('a_7','A',[[0,20,null]]); ok(r.g===null,'bike não tem meta de carga');

  // graviton
  r=await sug('b2_grv','B',[[30,10,2],[30,10,2],[30,9,1]]);
  ok(r.g.kg===30,'graviton 10/10/9: ainda não tira ajuda', r.g);
  r=await sug('b2_grv','B',[[30,10,2],[30,10,2],[30,10,1]]);
  ok(r.g.kg<30 && r.g.kg>0 && r.g.reps===6 && /ajuda/.test(r.g.why),'graviton no topo: TIRA ajuda (antes somava)', r.g);
  ok(/kg de ajuda/.test(r.w.metaTxt(r.g,r.e,3)),'card diz que é ajuda', r.w.metaTxt(r.g,r.e,3));
  r=await sug('b2_grv','B',[[30,8,2],[30,7,1],[30,6,0]],null,[[35,10,1],[35,10,1],[35,10,0]]);
  ok(r.g.kg===30 && reps(r.g)==='[9,7,6]','tirou ajuda e caiu de reps: segue daqui', r.g);
  const st=r.w.progressState('b2_grv',r.e);
  ok(st.k==='progredindo','e não vira "carga menor que na anterior"', st.k);
  ok(r.w.detectPlateau('b2_grv')===false && r.w.historicalBestE1RM('b2_grv',false)===0 && r.w.curvaProgresso('b2_grv').length===0,'sem recorde, curva nem travado invertidos');
  r=await sug('b2_grv','B',[[5,10,2],[5,10,2],[5,10,1]]);
  ok(r.g.kg===5,'ajuda mínima não vira zero nem negativo', r.g);
  const V=await load('hers',{treinoela_logs_v1:JSON.stringify({b2_grv:[{date:D(70),sets:S([[30,8,1]])},{date:D(60),sets:S([[30,8,1],[30,8,1],[30,7,1]])}]})},{}); await V._tick(120);
  const ve=V.dayEx('B').find(e=>e.id==='b2_grv'), vg=V.suggestNext('b2_grv',ve);
  ok(vg && vg.volta && vg.kg>=30 && V.progressState('b2_grv',ve).k==='volta','volta de pausa não tira ajuda', vg);

  // semana leve
  r=await sug('b_1','C',[[40,9,2],[40,8,2],[40,8,1],[40,7,1]],{treinoela_meta_v1:JSON.stringify({mesoDesde:D(23),cicloComum:'2026-11-16',progVer:'2026-11-15'})});
  ok(r.w.emDeload() && r.w.esforcoTxt(r.g,r.e)==='' && !/\+/.test(r.w.metaTxt(r.g,r.e,3)),'semana leve não cobra esforço', {g:r.g,t:r.w.metaTxt(r.g,r.e,3)});

  // telas dos 5 dias com histórico em tudo
  const w0=await load('hers',{},{}); await w0._tick(120); const logs={};
  for(const d of w0.diasProg()) w0.dayEx(d).forEach(e=>{ const g=w0.parseRange(e.r); if(e.t==='cardio'||g.tempo) return; logs[e.id]=[{date:D(9),sets:S([[20,g.min+1,2],[20,g.min,1]])},{date:D(2),sets:S([[20,g.min+1,2],[20,g.min,1]])}]; });
  const W=await load('hers',{treinoela_logs_v1:JSON.stringify(logs)},{}); await W._tick(150);
  let metas=0; for(const d of W.diasProg()){ W.renderDay(d); const h=W.document.getElementById('app').innerHTML; metas+=(h.match(/Meta: /g)||[]).length; if(/undefined|NaN/.test(h.replace(/<script[\s\S]*?<\/script>/g,''))) ok(false,'sem undefined/NaN no dia '+d); }
  ok(metas>=15 && W._errors.length===0,`${metas} metas renderizadas nos 5 dias, sem erro`, W._errors[0]);
  console.log(`\n${n-fails}/${n} ok`+(fails?`, ${fails} FALHAS`:'')); process.exit(fails?1:0);
})().catch(e=>{ console.error('FATAL',e); process.exit(1); });
