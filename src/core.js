export const STATUSES = ['pending','approved','preparing','ready','completed','rejected','cancelled'];
export const NEXT = {approve:['pending','approved'],reject:['pending','rejected'],cancel:['pending,approved,preparing,ready','cancelled'],preparing:['approved','preparing'],ready:['preparing','ready'],complete:['ready','completed']};
export const json=(data,status=200,headers={})=>new Response(JSON.stringify(data),{status,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store','x-content-type-options':'nosniff',...headers}});
export const fail=(message,status=400)=>json({error:message},status);
export const uuid=()=>crypto.randomUUID();
export const clean=(value,max=120)=>String(value??'').trim().slice(0,max);
export const iso=()=>new Date().toISOString();
export const sha=async s=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(s)))).map(x=>x.toString(16).padStart(2,'0')).join('');
export const same=(a,b)=>{if(a.length!==b.length)return false;let mismatch=0;for(let i=0;i<a.length;i++)mismatch|=a.charCodeAt(i)^b.charCodeAt(i);return mismatch===0;};
export async function verifyMP(headers, url, secret, now=Date.now()){
 const raw=headers.get('x-signature')||'',reqid=headers.get('x-request-id')||'', id=url.searchParams.get('data.id')||'';
 const parts=Object.fromEntries(raw.split(',').map(p=>p.trim().split('=')));
 if(!secret || !/^\d+$/.test(id) || !reqid || !/^\d{10,13}$/.test(parts.ts||'') || !/^[a-f0-9]{64}$/i.test(parts.v1||''))return false;
 const ts=Number(parts.ts); if(Math.abs(now-ts*1000)>10*60*1000)return false;
 const manifest=`id:${id.toLowerCase()};request-id:${reqid};ts:${parts.ts};`;
 const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(secret),{name:'HMAC',hash:'SHA-256'},false,['sign']);
 const signed=await crypto.subtle.sign('HMAC',key,new TextEncoder().encode(manifest));
 const expected=Array.from(new Uint8Array(signed)).map(x=>x.toString(16).padStart(2,'0')).join('');
 return same(expected,parts.v1.toLowerCase());
}
export function parseOrder(input){
 const name=clean(input?.customer_name,100),phone=clean(input?.customer_phone,35),email=clean(input?.customer_email,150),delivery=clean(input?.delivery_method,20),address=clean(input?.delivery_address,220),notes=clean(input?.notes,500),pay=clean(input?.payment_method,20);
 if(name.length<2||!/^\+?[\d\s().-]{6,35}$/.test(phone))throw Error('Completá nombre y teléfono válidos');
 if(email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))throw Error('Correo electrónico inválido');
 if(!['pickup','delivery'].includes(delivery)||delivery==='delivery'&&address.length<7)throw Error('Completá los datos de entrega');
 if(!['manual','mercadopago'].includes(pay))throw Error('Seleccioná una forma de pago');
 if(pay==='mercadopago' && delivery==='delivery')throw Error('El pago online con envío requiere configurar primero el precio del transporte; seleccioná pago coordinado o retiro');
 if(!Array.isArray(input?.items)||input.items.length===0||input.items.length>30)throw Error('Seleccioná entre 1 y 30 productos');
 const merged=new Map();for(const item of input.items){const id=clean(item?.product_id,80),qty=Number(item?.quantity);if(!id||!Number.isInteger(qty)||qty<1||qty>20)throw Error('Cantidad de producto inválida');merged.set(id,(merged.get(id)||0)+qty);}
 if([...merged.values()].some(v=>v>20))throw Error('Cantidad máxima: 20 unidades por producto');
 return {customer_name:name,customer_phone:phone,customer_email:email,delivery_method:delivery,delivery_address:address,notes,payment_method:pay,items:[...merged].map(([product_id,quantity])=>({product_id,quantity}))};
}
export function normalizeProduct(input){const sku=clean(input.sku,50),name=clean(input.name,180),description=clean(input.description,500),category=clean(input.category,80)||'General',price_cents=Number(input.price_cents),stock=Number(input.stock),supplier_id=clean(input.supplier_id,80)||null,active=input.active===false||input.active===0?0:1;if(!sku||name.length<2||!Number.isInteger(price_cents)||price_cents<1||price_cents>=1e9||!Number.isInteger(stock)||stock<0||stock>1e7)throw Error('Revisá SKU, nombre, precio en centavos y stock');return {sku,name,description,category,price_cents,stock,supplier_id,active};}
