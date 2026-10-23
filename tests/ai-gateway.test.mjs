import test from 'node:test';
import assert from 'node:assert/strict';
import gateway from '../workers/majumi-ai.js';

function database(){
  const counters=new Map();
  return {
    counters,
    prepare(sql){
      if(/^SELECT name,category/.test(sql)){
        return {async all(){throw new Error('Commerce table not yet installed');}};
      }
      if(!sql.startsWith('INSERT INTO majumi_ai_usage'))throw new Error('Unexpected SQL query');
      return {
        bind(bucket,updated_at,maximum){
          return {
            async first(){
              const hits=counters.get(bucket)||0;
              if(hits>=maximum)return null;
              counters.set(bucket,hits+1);
              return {hits:hits+1};
            }
          };
        }
      };
    }
  };
}
function makeEnv(){
  const DB=database();
  const calls=[];
  return {DB,calls,AI:{async run(model,options){
    calls.push({model,options});
    return {response:'Podés mirar la Cartera Mini Aura. Los productos y precios son demostrativos.'};
  }}};
}
const root='https://majumi-ai-gateway.proyectomj11.workers.dev';
const site='https://miqueas80.github.io';
function request(path,method='GET',body=null,origin=site){
  return new Request(root+path,{method,headers:{Origin:origin,'content-type':'application/json','CF-Connecting-IP':'192.0.2.1'},body:body?JSON.stringify(body):undefined});
}
test('health y CORS sin exponer secretos',async()=>{
  const env=makeEnv();
  const res=await gateway.fetch(request('/health'),env);
  assert.equal(res.status,200);
  assert.equal(res.headers.get('access-control-allow-origin'),site);
  const data=await res.json();
  assert.equal(data.ok,true);
  assert.equal(data.provider,'cloudflare-ai');
  assert.ok(!JSON.stringify(data).includes('XKIRO_API_KEY'));
});
test('rechaza páginas no autorizadas',async()=>{
  const env=makeEnv();
  const res=await gateway.fetch(request('/api/assistant','POST',{message:'Busco un regalo'},'https://evil.example'),env);
  assert.equal(res.status,403);
  assert.equal(env.calls.length,0);
});
test('IA real usa sólo catálogo demo y responde a la tienda',async()=>{
  const env=makeEnv();
  const res=await gateway.fetch(request('/api/assistant','POST',{message:'Busco una cartera'}),env);
  const data=await res.json();
  assert.equal(res.status,200);
  assert.equal(data.provider,'cloudflare-ai');
  assert.equal(data.catalog,'demo');
  assert.ok(data.answer.includes('Cartera Mini Aura'));
  assert.equal(env.calls.length,1);
  assert.ok(JSON.stringify(env.calls[0].options.messages).includes('CATÁLOGO DE DEMOSTRACIÓN'));
});
test('control diario por IP y control global',async()=>{
  const env=makeEnv();
  for(let i=0;i<8;i++){
    const res=await gateway.fetch(request('/api/assistant','POST',{message:'Busco un perfume'}),env);
    assert.equal(res.status,200);
  }
  const denied=await gateway.fetch(request('/api/assistant','POST',{message:'Busco un perfume'}),env);
  assert.equal(denied.status,429);
  assert.equal(env.calls.length,8);
});
test('la preconsulta CORS no gasta tokens',async()=>{
  const env=makeEnv();
  const res=await gateway.fetch(request('/api/assistant','OPTIONS'),env);
  assert.equal(res.status,204);
  assert.equal(env.calls.length,0);
  assert.equal(env.DB.counters.size,0);
});
