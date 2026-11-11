export function normalizeLowifyPayment(payload) {
 if(!payload||typeof payload!=='object'||Array.isArray(payload))throw Error('Invalid payload');
 if(payload.event!=='sale.paid'||payload.status!=='paid')return null;
 const oid=payload.order_id,pid=payload.product?.id,email=payload.customer?.email,amount=payload.sale_amount;
 if(typeof oid!=='string'||!oid.trim()||oid.length>200||
  !(typeof pid==='string'&&pid.length>0&&pid.length<=100||typeof pid==='number'&&Number.isSafeInteger(pid)&&pid>0)||
  typeof email!=='string'||email.trim().length>254||!/^\S+@[^\s@]+\.[^\s@]+$/.test(email.trim())||
  typeof amount!=='number'||!Number.isFinite(amount)||amount<=0||amount>999999999999.99)throw Error('Invalid sale');
 let timestamp=payload.timestamp;
 if(typeof timestamp!=='string')throw Error('Missing timestamp');
 // Lowify's supplied example is a Brazilian local datetime, without UTC offset.
 if(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(timestamp))timestamp=timestamp.replace(' ','T')+'-03:00';
 else if(!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$/.test(timestamp))throw Error('Invalid timestamp');
 const paid=new Date(timestamp);
 if(!Number.isFinite(paid.getTime())||paid.getTime()>Date.now()+300000)throw Error('Invalid timestamp');
 return {event:'sale.paid',status:'paid',order_id:oid,product_id:String(pid),email:email.trim().toLowerCase(),amount,paid_at:paid.toISOString()};
}
