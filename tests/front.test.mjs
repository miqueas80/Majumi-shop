import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const root = new URL('../',import.meta.url);
const load=(file)=>readFileSync(new URL(file,root),'utf8');
test('PWA válida, rutas relativas y caché exclusivamente público',()=>{
 const manifest=JSON.parse(load('public/manifest.webmanifest'));
 assert.equal(manifest.display,'standalone');assert.equal(manifest.start_url,'./');
 const html=load('public/index.html');
 assert.match(html,/href="\\.\\/manifest\\.webmanifest"/);
 assert.match(html,/src="\\.\\/store\\.js\\?v=3"/);
 assert.match(html,/href="\\.\\/store\\.css\\?v=3"/);
 const sw=load('public/sw.js');assert.match(sw,/PUBLIC_ASSETS/);
 assert.match(sw,/rel\\.startsWith\\('admin'\\)/);
 assert.match(sw,/url\\.pathname\\.includes\\('\\/api\\/'\\)/);
});
test('La demostración no registra compras y permite filtrar, buscar y elegir',()=>{
 const code=load('public/store.js');const elements=new Map();
 function el(id){if(!elements.has(id))elements.set(id,{hidden:false,textContent:'',innerHTML:'',value:'',style:{},addEventListener(){},setAttribute(k,v){this[k]=v},getAttribute(k){return this[k]||'true'},focus(){},scrollIntoView(){},classList:{toggle(){},add(){},remove(){}}});return elements.get(id)}
 const document={getElementById:el,addEventListener(){},querySelectorAll(){return[]},body:{style:{}},activeElement:el('focus')};
 const localStorage={getItem(){return null},setItem(){}};
 const location={hostname:'miqueas80.github.io',protocol:'https:'};
 const app=new Function('document','localStorage','location','setTimeout','clearTimeout',code+'\\nreturn {state,addToCart,toggleFavorite,setFilter,matchScore};')(document,localStorage,location,()=>1,()=>{});
 assert.equal(app.state.products.length,8);assert.match(el('catalogNotice').innerHTML,/demostraci[oó]n|muestra/i);
 app.setFilter('Belleza');assert.equal((el('productGrid').innerHTML.match(/class="product-card"/g)||[]).length,2);
 assert.ok(app.matchScore(app.state.products.find(p=>p.name==='Auriculares Studio'),'auris')>0);
 app.addToCart('sample-01');app.toggleFavorite('sample-02');assert.equal(app.state.cart['sample-01'],1);assert.equal(app.state.favorites.has('sample-02'),true);
 assert.match(code,/if\\(pagesDemo\\)return copyDemoOrder\\(\\)/);
});
test('Headers y separación entre cliente y secretos',()=>{
 assert.match(load('public/_headers'),/Content-Security-Policy:/);
 assert.match(load('public/_headers'),/X-Content-Type-Options: nosniff/);
 assert.doesNotMatch(load('public/store.js'),/ADMIN_PASSWORD\\s*=|MP_ACCESS_TOKEN\\s*=/);
});
