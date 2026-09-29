/* Invariante da dupla progressão: quando o peso sobe, as reps voltam pro PISO da faixa.
   Varre TODOS os exercícios dos dois apps, nas 3 fases do mesociclo, com e sem reordenação.
   Uma instância por combinação (semeia o programa inteiro de uma vez) — a versão ingênua,
   uma instância por exercício, estourava a memória do node. */
const {load, D, NS}=require('./harness');
let fails=0, n=0;
const ok=(c,m,x)=>{ n++; if(!c){ fails++; console.log('  ✗', m, x!==undefined?String(JSON.stringify(x)).slice(0,400):''); } else console.log('  ✓', m); };

async function cenario(app){
  console.log('\n=== '+app+' ===');
  const ns=NS[app];
  const w0=await load(app,{},{}); await w0._tick(150);
  const dias=w0.diasProg();

  let casos=0; const violacoes=[];
  for(const semana of [1,3,4]){                        // base, acúmulo, deload
    for(const alvoReps of ['piso','meio','topo']){
      // semeia o programa inteiro: 2 sessões por exercício, ambas na posição padrão
      const logs={};
      for(const d of dias) w0.dayEx(d).forEach((e,i)=>{
        const r=w0.parseRange(e.r); if(r.tempo||r.livre) return;
        const id=w0.exId(d,i), f=w0.fadigaPadrao(id);
        const reps = alvoReps==='piso'?r.min : alvoReps==='topo'?r.max : Math.floor((r.min+r.max)/2);
        logs[id]=[{date:D(14), sets:[{kg:'20',reps:String(r.min),rir:'2',done:true}], f, fv:2},
                  {date:D(7),  sets:[{kg:'20',reps:String(reps), rir:'2',done:true}], f, fv:2}];
      });
      for(const mover of [false,true]){
        const s={}; s[ns+'_meta_v1']=JSON.stringify({mesoDesde:D((semana-1)*7+2), blocoDesde:D(60), bloco:'peito_bracos'});
        s[ns+'_logs_v1']=JSON.stringify(logs);
        const w=await load(app, s, {}); await w._tick(120);
        for(const d of dias){
          if(mover){ const ids=w.dayEx(d).map(e=>e.id); ids.reverse(); w.planGravarOrdem(d, ids, 'hoje'); }
          w.dayEx(d).forEach((e,i)=>{
            const r=w.parseRange(e.r); if(r.tempo||r.livre) return;
            const id=w.exId(d,i);
            const sug=w.suggestNext(id, e);
            if(!sug) return;
            casos++;
            if(sug.de!=null && sug.kg>sug.de && sug.reps>r.min)
              violacoes.push(`${d}${i} ${String(e.n).slice(0,20)} sem${semana}/${alvoReps}${mover?'/invertido':''}: ${sug.de}->${sug.kg}kg x ${sug.reps} (piso ${r.min}) "${sug.why}"`);
          });
        }
        if(w._errors.length) violacoes.push('ERRO GLOBAL: '+w._errors[0].split('\n')[0]);
      }
    }
  }
  ok(violacoes.length===0, `${casos} metas varridas: nenhuma sobe peso E reps juntos`, violacoes.slice(0,5));

  // ---- a fase do mesociclo não pode, sozinha, mudar a fadiga da posição
  const dia=dias[0];
  let alvo=-1; w0.dayEx(dia).forEach((e,i)=>{ const r=w0.parseRange(e.r); if(alvo<0 && i>=3 && !r.tempo && !r.livre) alvo=i; });
  const fs={};
  for(const semana of [1,3,4]){
    const s={}; s[ns+'_meta_v1']=JSON.stringify({mesoDesde:D((semana-1)*7+2), blocoDesde:D(60), bloco:'peito_bracos'});
    const w=await load(app, s, {}); await w._tick(120);
    fs[semana]={sem:w.mesoSemana(), f:w.fadigaHoje(w.exId(dia,alvo))};
  }
  ok(fs[1].f===fs[3].f && fs[3].f===fs[4].f,'a fadiga da posição é a MESMA em base, acúmulo e deload', fs);
  ok(fs[1].sem===1 && fs[3].sem===3 && fs[4].sem===4,'(e as fases simuladas são mesmo 1/3/4)', fs);

  // ---- adiantar um exercício que já ia subir carga: mantém o piso, só explica
  const idk=w0.exId(dia,alvo), exk=w0.dayEx(dia)[alvo], rk=w0.parseRange(exk.r);
  const sk={}; sk[ns+'_meta_v1']=JSON.stringify({});
  sk[ns+'_logs_v1']=JSON.stringify({[idk]:[
    {date:D(14), sets:[{kg:'20',reps:String(rk.max),rir:'2',done:true}], f:w0.fadigaPadrao(idk), fv:2},
    {date:D(7),  sets:[{kg:'20',reps:String(rk.max),rir:'2',done:true}], f:w0.fadigaPadrao(idk), fv:2}]});
  const W=await load(app, sk, {}); await W._tick(150);
  const antes=W.suggestNext(idk, W.dayEx(dia)[alvo]);
  ok(antes && antes.kg>20 && antes.reps===rk.min,'antes de mover: sobe carga E volta pro piso', antes);
  W.planAbrir(dia,alvo); W.planSetEsc('hoje'); W.planFazerAgora();
  const dep=W.suggestNext(idk, W.dayEx(dia)[0]);
  ok(dep && dep.kg===antes.kg && dep.reps===rk.min,'depois de puxar pro 1º: MESMA prescrição, sem somar reps', dep);

  // ---- o ajuste de posição continua funcionando quando NÃO é subida de carga
  const sm={}; sm[ns+'_meta_v1']=JSON.stringify({});
  const meio=Math.min(rk.max-1, rk.min+1);
  sm[ns+'_logs_v1']=JSON.stringify({[idk]:[
    {date:D(14), sets:[{kg:'20',reps:String(meio),rir:'2',done:true}], f:w0.fadigaPadrao(idk), fv:2},
    {date:D(7),  sets:[{kg:'20',reps:String(meio),rir:'2',done:true}], f:w0.fadigaPadrao(idk), fv:2}]});
  const M=await load(app, sm, {}); await M._tick(150);
  const mAntes=M.suggestNext(idk, M.dayEx(dia)[alvo]);
  M.planAbrir(dia,alvo); M.planSetEsc('hoje'); M.planFazerAgora();
  const mDep=M.suggestNext(idk, M.dayEx(dia)[0]);
  ok(mAntes.reps===meio+1 && mDep.reps===rk.max && mDep.kg===mAntes.kg,'mid-faixa adiantado: mira o topo, MESMA carga', {mAntes, mDep});

  // ---- carimbo antigo (sem fv) é descartado
  ok(w0.fadigaDaSessao({date:D(3), f:99}, idk)===w0.fadigaPadrao(idk),'carimbo sem versão é descartado (fórmula velha)');
  ok(w0.fadigaDaSessao({date:D(3), f:7, fv:2}, idk)===7,'carimbo versionado é usado');
  ok(w0._errors.length===0,'sem erro global', w0._errors[0]);
}
(async()=>{ await cenario('his'); await cenario('hers'); console.log(`\n${n-fails}/${n} ok`+(fails?`, ${fails} FALHAS`:'')); process.exit(fails?1:0); })()
 .catch(e=>{ console.error('FATAL',e); process.exit(1); });
