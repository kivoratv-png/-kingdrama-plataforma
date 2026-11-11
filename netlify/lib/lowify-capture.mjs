// Discovery captures structure only, without identity, token or payment proof.
const known=new Set(['g18z8v','P3QfUF','ZPO7Gw','LD4imo','sale.paid','principal','paid','approved','pending','refunded','canceled','cancelled','chargeback','completed','purchase_approved','payment_approved','sale_approved','order.paid','payment.paid']);
export function payloadShape(value,depth=0,budget={left:1000}) {
  if(--budget.left<0||depth>12)return '<truncated>';
  if(value===null)return null;
  if(Array.isArray(value))return value.slice(0,5).map(v=>payloadShape(v,depth+1,budget));
  if(typeof value==='object')return Object.fromEntries(Object.entries(value).slice(0,80).map(([key,v])=>[key.slice(0,80),payloadShape(v,depth+1,budget)]));
  if(typeof value==='string')return known.has(value)?value:'<string>';
  return `<${typeof value}>`;
}
export async function readLimited(request,max=32768) {
  if(Number(request.headers.get('content-length'))>max)throw Object.assign(Error('Too large'),{status:413});
  const reader=request.body?.getReader();if(!reader)return '';
  let size=0;const chunks=[];
  try {for(;;){const {value,done}=await reader.read();if(done)break;size+=value.byteLength;if(size>max){await reader.cancel();throw Object.assign(Error('Too large'),{status:413});}chunks.push(Buffer.from(value));}}
  finally {reader.releaseLock();}
  return Buffer.concat(chunks).toString('utf8');
}
