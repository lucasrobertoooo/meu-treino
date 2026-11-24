/* Meta por série (24/11/2026): a Meta não pode pedir menos do que a série já fez, e a carga
   sobe sem exigir que a última série, cansada, feche o topo. Só o app dele. */
const {load, D, NS}=require('./harness');
let fails=0, n=0;
const ok=(c,m,x)=>{ n++; if(!c){ fails++; console.log('  ✗', m, x!==undefined?String(JSON.stringify(x)).slice(0,400):''); } else console.log('  ✓', m); };
const S=a=>a.map(([kg,reps,rir])=>({kg:String(kg),reps:String(reps),rir:rir==null?'':String(rir),done:true}));
// sessões há 9 e 2 dias: 7+ dias sem treino dispara a regra de pausa e reancora o ciclo
async function sug(id, day, idx, sets, extra){
  const s={meutreino_logs_v1:JSON.stringify({[id]:[{date:D(9),sets:S(sets)},{date:D(2),sets:S(sets)}]}), ...(extra||{})};
  const w=await load('his', s, {}); await w._tick(120);
  const e=w.dayEx(day)[idx];
  return {w, e, g:w.suggestNext(id, e)};
}
(async()=>{
  let r=await sug('b_5','B',4,[[12,12,1],[12,11,0],[12,10,0],[12,9,0],[12,8,0]]);
  ok(r.g.kg===12 && r.g.alvos.length===5,'rosca com queda de reps: mesma carga, 5 alvos', r.g);
  ok([12,11,10,9,8].every((x,k)=>r.g.alvos[k].reps>=x),'nenhum alvo abaixo do que a série já fez (antes: 9 pra todas)', r.g.alvos);
  ok(r.g.alvos[0].mais && r.g.alvos[1].reps===12,'1ª no topo vira "12+"; a 1ª abaixo do topo ganha +1', r.g.alvos);
  const cor=r.w.metaTxt(r.g,r.e,5);
  ok(cor==='12kg · 12+ / 12 / 10 / 9 / 8','texto do card', cor);

  r=await sug('a_1','A',0,[[26,10,2],[26,10,1],[26,9,0],[26,8,0]]);
  ok(r.g.kg>26 && r.g.reps===6 && !r.g.alvos,'10/10/9/8 na faixa 6-10: sobe a carga e volta pro piso', r.g);
  r=await sug('a_1','A',0,[[26,10,1],[26,9,0],[26,8,0],[26,7,0]]);
  ok(r.g.kg===26,'10/9/8/7: ainda não sobe', r.g);
  r=await sug('a_1','A',0,[[26,10,3],[26,8,1],[26,8,1],[26,8,1]]);
  ok(r.g.kg===26,'10/8/8/8: média baixa, não sobe', r.g);
  r=await sug('d_6','D',5,[[10,12,1],[10,11,1],[10,10,0],[10,10,0]]);
  ok(r.g.kg===10,'faixa curta 10-12: 12/11/10/10 não sobe', r.g);
  r=await sug('d_6','D',5,[[10,12,1],[10,12,1],[10,11,0],[10,11,0]]);
  ok(r.g.kg>10,'faixa curta 10-12: 12/12/11/11 sobe', r.g);

  r=await sug('a_1','A',0,[[26,7,4],[26,7,3],[26,7,2],[26,7,0]]);
  ok(JSON.stringify(r.g.alvos.map(x=>x.reps))==='[10,9,8,7]','sobra de RIR vira repetição a mais (RIR 4→+3, 3→+2, 2→+1, 0→igual)', r.g.alvos);
  r=await sug('a_1','A',0,[[26,8,null],[26,7,null],[26,7,null],[26,6,null]]);
  ok(JSON.stringify(r.g.alvos.map(x=>x.reps))==='[9,8,8,7]','sem RIR anotado: +1 em cada', r.g.alvos);
  r=await sug('a_1','A',0,[[26,5,0],[26,5,0],[26,4,0],[26,4,0]]);
  ok(r.g.kg===26 && r.g.alvos.every(x=>x.reps>=6),'abaixo da faixa: alvo é o piso', r.g);
  r=await sug('a_1','A',0,[[24,12,2],[26,10,1],[26,8,0],[26,7,0]]);
  ok(r.g.kg===26 && r.g.alvos[0].kg===24 && /24×/.test(r.w.metaTxt(r.g,r.e,4)),'carga diferente por série aparece no texto', r.w.metaTxt(r.g,r.e,4));
  ok(r.w.metaTxt(r.g,r.e,3).split('/').length===3 && r.w.metaTxt(r.g,r.e,5).split('/').length===5,'mostra o número de séries planejado');

  // semana leve: um alvo só e nenhuma cobrança de esforço
  r=await sug('a_1','A',0,[[26,9,1],[26,8,0],[26,8,0],[26,7,0]],{meutreino_meta_v1:JSON.stringify({mesoDesde:D(23),cicloComum:'2026-11-16',blocoDesde:D(60),bloco:'peito_bracos'})});
  ok(r.w.emDeload() && /semana leve/.test(r.g.why) && r.w.esforcoTxt(r.g,r.e)==='' && !/\+/.test(r.w.metaTxt(r.g,r.e,3)),'semana leve não cobra esforço', {g:r.g,t:r.w.metaTxt(r.g,r.e,3)});
  // volta de pausa idem
  const vs={meutreino_logs_v1:JSON.stringify({a_1:[{date:D(70),sets:S([[26,10,0],[26,9,0]])},{date:D(60),sets:S([[26,10,0],[26,9,0],[26,8,0],[26,8,0]])}]})};
  const V=await load('his',vs,{}); await V._tick(120); const ve=V.dayEx('A')[0], vg=V.suggestNext('a_1',ve);
  ok(vg.volta && vg.kg<26 && V.esforcoTxt(vg,ve)==='','volta de pausa não cobra esforço', vg);

  // posição: adiantar troca a lista por um alvo só
  const P=await load('his',{meutreino_logs_v1:JSON.stringify({a_4:[{date:D(14),sets:S([[10,13,1],[10,13,1]]),f:8,fv:2},{date:D(7),sets:S([[10,13,1],[10,13,1],[10,13,0],[10,13,0]]),f:8,fv:2}]})},{}); await P._tick(120);
  P.planAbrir('A',3); P.planSetEsc('hoje'); P.planFazerAgora();
  const pg=P.suggestNext('a_4',P.dayEx('A')[0]);
  ok(pg && (!/mais cedo/.test(pg.why) || !pg.alvos),'posição diferente não leva a lista da posição antiga', pg);

  // tela
  r=await sug('b_5','B',4,[[12,12,1],[12,11,0],[12,10,0],[12,9,0],[12,8,0]]);
  r.w.renderDay('B'); const h=r.w.document.getElementById('app').innerHTML;
  ok(h.includes('12kg · 12+ / 12 / 10 / 9 / 8') && h.includes('A Meta é o mínimo'),'o card mostra a Meta por série e o esforço');
  ok(r.w._errors.length===0,'sem erro global', r.w._errors[0]);
  console.log(`\n${n-fails}/${n} ok`+(fails?`, ${fails} FALHAS`:'')); process.exit(fails?1:0);
})().catch(e=>{ console.error('FATAL',e); process.exit(1); });
