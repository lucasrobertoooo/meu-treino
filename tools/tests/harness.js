/* Harness de teste: carrega o app inteiro num jsdom com localStorage/IndexedDB falsos e
   fetch mockado. Cada load() devolve o window (sandbox) do app.
   Limitações: const/let de módulo (ST, WK) NÃO são acessíveis de fora — verifique por
   localStorage e pelo innerHTML renderizado; chame funções de render direto. */
const fs=require('fs'), path=require('path');
const {JSDOM}=require('/Users/zana/Developer/bussola/node_modules/jsdom');
const APPS={ his:'/Users/zana/Documents/MeuTreino/index.html', hers:'/Users/zana/Documents/Treino-Ela/index.html' };
const NS={ his:'meutreino', hers:'treinoela' };

function fakeStorage(seed){
  const m=new Map(Object.entries(seed||{}));
  return { getItem:k=>m.has(k)?m.get(k):null, setItem:(k,v)=>m.set(k,String(v)), removeItem:k=>m.delete(k), clear:()=>m.clear(), key:i=>[...m.keys()][i]||null, get length(){return m.size;}, _map:m };
}
/* IndexedDB mínimo: só o que os apps usam (open→objectStore get/put/delete/getAll/clear/getAllKeys). */
function fakeIDB(store){
  store=store||new Map();
  const req=(fn)=>{ const r={result:undefined,error:null,onsuccess:null,onerror:null}; setTimeout(()=>{ try{ r.result=fn(); r.onsuccess&&r.onsuccess({target:r}); }catch(e){ r.error=e; r.onerror&&r.onerror({target:r}); } },0); return r; };
  const os={ get:(k)=>req(()=>store.get(k)), put:(v,k)=>req(()=>{store.set(k,v);return k;}), delete:(k)=>req(()=>{store.delete(k);}), clear:()=>req(()=>store.clear()), getAll:()=>req(()=>[...store.values()]), getAllKeys:()=>req(()=>[...store.keys()]), openCursor:()=>req(()=>null), count:()=>req(()=>store.size) };
  const db={ objectStoreNames:{contains:()=>true}, createObjectStore:()=>os, transaction:()=>{ const tx={objectStore:()=>os, oncomplete:null, onerror:null, onabort:null, error:null}; setTimeout(()=>tx.oncomplete&&tx.oncomplete(),2); return tx; }, close(){} };
  return { open:()=>{ const r={result:db,onsuccess:null,onerror:null,onupgradeneeded:null}; setTimeout(()=>{ r.onupgradeneeded&&r.onupgradeneeded({target:r}); r.onsuccess&&r.onsuccess({target:r}); },0); return r; }, deleteDatabase:()=>req(()=>{}), _store:store };
}
/* Worker falso em memória: PUT/GET /backup?app=ns[&id=] com a mesma semântica do real. */
function fakeWorker(){
  const kv={}; const idx={};
  const handler=async (url, opts)=>{
    const u=new URL(url, 'https://w.test'); opts=opts||{};
    if(u.pathname==='/backup'){
      const ns=u.searchParams.get('app')||'default';
      if((opts.method||'GET')==='PUT'){
        const body=String(opts.body||''); let parsed; try{ parsed=JSON.parse(body); }catch(e){ return resp(400,'bad json'); }
        if(!parsed||typeof parsed!=='object'||Array.isArray(parsed)) return resp(400,'obj');
        if(Buffer.byteLength(body)>20*1024*1024) return resp(413,'Too large');
        const id=`${Date.now()}-${Math.random().toString(36).slice(2,8)}`;
        kv[ns+':'+id]=body; idx[ns]=[{id,at:Date.now(),bytes:body.length}].concat(idx[ns]||[]).slice(0,5);
        handler.puts.push({ns,id,bytes:body.length});
        return resp(200, JSON.stringify({ok:true,id,app:ns,guardados:idx[ns].length}));
      }
      const id=u.searchParams.get('id');
      handler.gets.push({ns,id});
      if(!id) return resp(200, JSON.stringify({app:ns, snapshots:idx[ns]||[]}));
      const b=kv[ns+':'+id]; if(!b) return resp(404,'nf'); return resp(200,b);
    }
    return resp(404,'nf');
  };
  handler.puts=[]; handler.gets=[]; handler.kv=kv; handler.idx=idx;
  handler.latest=(ns)=>{ const i=(idx[ns]||[])[0]; return i?JSON.parse(kv[ns+':'+i.id]):null; };
  return handler;
}
function resp(status, body){ return { ok:status>=200&&status<300, status, json:async()=>JSON.parse(body), text:async()=>body }; }

async function load(app, seed, opts){
  opts=opts||{};
  const html=fs.readFileSync(APPS[app],'utf8');
  const errors=[];
  const dom=new JSDOM(html, { runScripts:'dangerously', pretendToBeVisual:true, url:'https://lucasrobertoooo.github.io/'+(app==='his'?'meu-treino':'meu-treino-ela')+'/', beforeParse(w){
    Object.defineProperty(w,'localStorage',{value:fakeStorage(seed), configurable:true});
    Object.defineProperty(w,'sessionStorage',{value:fakeStorage({}), configurable:true});
    w.indexedDB=fakeIDB(opts.idb);
    w.fetch=opts.fetch||(async()=>resp(404,'no fetch'));
    Object.defineProperty(w.navigator,'serviceWorker',{value:{register:()=>Promise.resolve({}), addEventListener(){}, getRegistrations:async()=>[], ready:Promise.resolve({pushManager:{getSubscription:async()=>null}})}, configurable:true});
    w.matchMedia=w.matchMedia||(()=>({matches:false,addListener(){},removeListener(){},addEventListener(){},removeEventListener(){}}));
    w.scrollTo=()=>{}; w.alert=(m)=>{ w._alerts=(w._alerts||[]).concat([String(m)]); }; w.confirm=()=>true; w.prompt=()=>opts.prompt||'1';
    w.Notification=undefined;
    w.caches={ keys:async()=>[], delete:async()=>true, open:async()=>({match:async()=>undefined, put:async()=>{}, add:async()=>{}, keys:async()=>[]}) };
    w.HTMLCanvasElement.prototype.getContext=()=>({drawImage(){},fillRect(){},clearRect(){},getImageData:()=>({data:[]}),putImageData(){},createImageData:()=>[],setTransform(){},drawImage(){},save(){},restore(){},beginPath(){},moveTo(){},lineTo(){},closePath(){},stroke(){},fill(){},arc(){},fillText(){},measureText:()=>({width:0})});
    w.HTMLCanvasElement.prototype.toDataURL=()=>'data:image/jpeg;base64,AAAA';
    w.addEventListener('error', e=>errors.push(e.error?String(e.error.stack||e.error):String(e.message)));
  }});
  const w=dom.window;
  w._errors=errors;
  // dispara DOMContentLoaded/load e espera timers de boot
  await new Promise(r=>setTimeout(r,50));
  w._ns=NS[app];
  w._ls=(k)=>{ const v=w.localStorage.getItem(NS[app]+'_'+k+'_v1'); return v?JSON.parse(v):null; };
  w._tick=(ms)=>new Promise(r=>setTimeout(r,ms||30));
  return w;
}
const D=(n)=>{ const d=new Date(); d.setDate(d.getDate()-n); return d.toISOString().slice(0,10); };
module.exports={load, D, fakeWorker, fakeIDB, NS, APPS};
