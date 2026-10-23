import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const root = new URL('../',import.meta.url);
const load=(file)=>readFileSync(new URL(file,root),'utf8');
test('PWA válida, rutas relativas y caché exclusivamente público',()=>{
 const manifest=JSON.parse(load('public/manifest.webmanifest'));
 assert.equal(manifest.display,'standalone');assert.equal(manifest.start_url,'./');
 const html=load('public/index.html');
 assert.match(html,/href="\.\/manifest\.webmanifest"/);
 assert.match(html,/src="\.\/store\.js\?v=7"/);
 assert.match(html,/href="\.\/store\.css\?v=7"/);
 const sw=load('public/sw.js');assert.match(sw,/PUBLIC_ASSETS/);
 assert.match(sw,/rel\.startsWith\('admin'\)/);
 assert.match(sw,/url\.pathname\.includes\('\/api\/'\)/);
});
test('La demostración no registra compras y permite filtrar, buscar y elegir',()=>{
 const code=load('public/store.js');const elements=new Map();
 function el(id){if(!elements.has(id))elements.set(id,{hidden:false,textContent:'',innerHTML:'',value:'',style:{},addEventListener(){},setAttribute(k,v){this[k]=v},getAttribute(k){return this[k]||'true'},focus(){},scrollIntoView(){},classList:{toggle(){},add(){},remove(){}}});return elements.get(id)}
 const document={getElementById:el,addEventListener(){},querySelectorAll(){return[]},body:{style:{}},activeElement:el('focus')};
 const localStorage={getItem(){return null},setItem(){}};
 const location={hostname:'miqueas80.github.io',protocol:'https:'};
 const app=new Function('document','localStorage','location','setTimeout','clearTimeout',code+'\nreturn {state,addToCart,toggleFavorite,setFilter,matchScore};')(document,localStorage,location,()=>1,()=>{});
 assert.equal(app.state.products.length,8);assert.match(el('catalogNotice').innerHTML,/demostraci[oó]n|muestra/i);
 app.setFilter('Belleza');assert.equal((el('productGrid').innerHTML.match(/class="product-card"/g)||[]).length,2);
 assert.ok(app.matchScore(app.state.products.find(p=>p.name==='Auriculares Studio'),'auris')>0);
 app.addToCart('sample-01');app.toggleFavorite('sample-02');assert.equal(app.state.cart['sample-01'],1);assert.equal(app.state.favorites.has('sample-02'),true);
 assert.match(code,/if\(pagesDemo\)return copyDemoOrder\(\)/);
});
test('Headers y separación entre cliente y secretos',()=>{
 assert.match(load('public/_headers'),/Content-Security-Policy:/);
 assert.match(load('public/_headers'),/X-Content-Type-Options: nosniff/);
 assert.doesNotMatch(load('public/store.js'),/ADMIN_PASSWORD\s*=|MP_ACCESS_TOKEN\s*=/);
});


test('Motor de movimiento: entrada/salida reversible, motion reducido, API nativa y 120Hz sin bucle',()=>{
 const src=load('public/motion.js');
 assert.match(src,/prefers-reduced-motion:\s*reduce/);
 assert.match(src,/IntersectionObserver/);
 assert.match(src,/animation\.finished/);
 assert.match(src,/translate3d/);
 assert.match(src,/requestAnimationFrame/);
 assert.match(src,/motionDebug/);
 assert.doesNotMatch(src,/setInterval\s*\(/);
 const css=load('public/store.css');
 assert.match(css,/\.motion-reveal\.motion-visible/);
 assert.match(css,/@media\s*\(prefers-reduced-motion:reduce\)/);
 const sw=load('public/sw.js');
 assert.match(sw,/motion\.js\?v=5/);
 assert.match(sw,/rel\.startsWith\('admin'\)/);
 assert.match(load('public/index.html'),/motion\.js\?v=5/);
});


test('Motor WAAPI: reapertura cancela cierre anterior sin parpadeos y reduced-motion muestra contenido',async()=>{
 const engine=load('public/motion.js');
 const EmptyParams=class{get(){return null}};
 const doc=()=>({
   documentElement:{classList:{add(){}}},querySelectorAll(){return []},
   visibilityState:'visible'
 });
 const make=(reduced,dom)=>new Function('window','document','location','URLSearchParams',
   engine+';return window.MajumiMotion;')(
   {matchMedia:()=>({matches:reduced,addEventListener(){}})},
   dom,{search:''},EmptyParams);
 const motion=make(false,doc());
 const animations=[];
 const element={hidden:true,animate(keyframes,options){
   let resolve;
   const finished=new Promise(r=>resolve=r);
   const a={keyframes,options,finished,resolve,cancel(){this.cancelled=true}};
   animations.push(a);return a;
 }};
 motion.show(element,'search');
 assert.equal(element.hidden,false);
 motion.hide(element,'search');
 const obsoleteExit=animations.at(-1);
 motion.show(element,'search');
 obsoleteExit.resolve();
 await Promise.resolve();await Promise.resolve();
 assert.equal(obsoleteExit.cancelled,true);
 assert.equal(element.hidden,false);
 motion.hide(element,'search');
 animations.at(-1).resolve();
 await Promise.resolve();await Promise.resolve();
 assert.equal(element.hidden,true);
 assert.ok(animations.every(a=>a.keyframes.every(k=>Object.keys(k).every(v=>['transform','opacity'].includes(v)))));
 const calm=make(true,doc());
 const instant={hidden:true};
 calm.show(instant,'popover');assert.equal(instant.hidden,false);
 calm.hide(instant,'popover');assert.equal(instant.hidden,true);
});

test('Pre-lanzamiento visible, sin ventas en GitHub Pages',()=>{
 const html=load('public/index.html');
 assert.match(html,/Majumi está tomando forma/);
 assert.match(html,/Todavía no realizamos ventas, reservas ni cobramos productos/);
 assert.match(load('public/store.js'),/if\(pagesDemo\)return copyDemoOrder\(\)/);
 assert.equal(JSON.parse(load('wrangler.jsonc')).vars.COMMERCE_ENABLED,'false');
});
