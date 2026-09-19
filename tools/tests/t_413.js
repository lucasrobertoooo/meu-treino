const {load, D, fakeWorker, NS}=require('./harness');
let fails=0,n=0; const ok=(c,m,x)=>{ n++; if(!c){fails++; console.log('  ✗',m,x!==undefined?JSON.stringify(x).slice(0,200):'');} else console.log('  ✓',m); };
(async()=>{
  for(const app of ['his','hers']){
    const ns=NS[app]; const worker=fakeWorker();
    // Worker ANTIGO: recusa acima de 4MB
    const antigo=async(url,opts)=>{ if(opts&&opts.method==='PUT'&&Buffer.byteLength(String(opts.body))>4*1024*1024) return {ok:false,status:413,json:async()=>({}),text:async()=>'Too large'}; return worker(url,opts); };
    const idb=new Map([['p1','data:image/jpeg;base64,'+'A'.repeat(3*1024*1024)],['p2','data:image/jpeg;base64,'+'B'.repeat(3*1024*1024)],['p3','data:image/jpeg;base64,PEQ']]);
    const seed={[ns+'_meta_v1']:JSON.stringify({workerUrl:'https://w.test',workerToken:'tok'}), [ns+'_photometa_v1']:JSON.stringify([{id:'p1',date:D(1),angle:'frente'},{id:'p2',date:D(2),angle:'frente'},{id:'p3',date:D(3),angle:'frente'}]), [ns+'_logs_v1']:JSON.stringify({a_1:[{date:D(1),sets:[{kg:1,r:1,rir:1,done:true}]}]})};
    const A=await load(app, seed, {fetch:antigo, idb}); await A._tick(120);
    A.saveK('logs'); await A.sincronizarNuvem('volta'); await A._tick(100);
    const f=worker.latest(ns+'_fotos');
    ok(f && f.fotos.length===2 && f.fotos.map(x=>x.id).join()==='p1,p3','Worker antigo: caiu pro teto de 3.5MB e subiu o que coube (mais recente primeiro)', f&&f.fotos.map(x=>x.id));
    ok(A._ls('meta').nuvemFotosTeto===3.5*1024*1024,'lembrou o teto menor');
    ok(worker.latest(ns) && worker.latest(ns).logs,'dados subiram mesmo com foto estourando');
    // Worker NOVO: aceita tudo
    const B=await load(app, Object.fromEntries(A.localStorage._map), {fetch:worker, idb}); await B._tick(120);
    B.localStorage.setItem(ns+'_meta_v1', JSON.stringify(Object.assign(B._ls('meta'),{nuvemFotosTeto:undefined})));
    ok(B._errors.length===0 && A._errors.length===0,'sem erro global', A._errors[0]||B._errors[0]);
  }
  console.log(`\n${n-fails}/${n} ok`+(fails?`, ${fails} FALHAS`:'')); process.exit(fails?1:0);
})().catch(e=>{console.error('FATAL',e);process.exit(1);});
