const {createClient}=require('@supabase/supabase-js'),bcrypt=require('bcryptjs'),jwt=require('jsonwebtoken'),crypto=require('crypto');
const db=createClient(process.env.SUPABASE_URL,process.env.SUPABASE_SERVICE_KEY,{auth:{persistSession:false}});
const S=process.env.JWT_SECRET,H={'content-type':'application/json'};
const ok=d=>({statusCode:200,headers:H,body:JSON.stringify(d)}),err=(m,c=400)=>({statusCode:c,headers:H,body:JSON.stringify({error:m})});
const eq=(a,b)=>{const x=Buffer.from(a),y=Buffer.from(b);return x.length===y.length&&crypto.timingSafeEqual(x,y)};
const must=r=>{if(r.error)throw new Error(r.error.message);return r.data};
const iso=d=>d.toISOString().slice(0,10);
async function bundle(id){
  const [c,o,w,cl,v,l]=await Promise.all([
    db.from('customers').select('id,member_id,name,stamps,joined_at').eq('id',id).single(),
    db.from('orders').select('*').eq('customer_id',id).order('created_at',{ascending:false}),
    db.from('warranties').select('*').eq('customer_id',id).order('end_date',{ascending:false}),
    db.from('claims').select('*').eq('customer_id',id).order('created_at',{ascending:false}),
    db.from('vouchers').select('*').eq('customer_id',id).order('created_at',{ascending:false}),
    db.from('stamp_logs').select('*').eq('customer_id',id).order('created_at',{ascending:false}).limit(50)]);
  return {customer:must(c),orders:must(o),warranties:must(w),claims:must(cl),vouchers:must(v),logs:must(l)};
}
exports.handler=async ev=>{
  if(ev.httpMethod!=='POST')return err('POST only',405);
  try{
    const b=JSON.parse(ev.body||'{}'),a=b.action;
    if(a==='login'){
      const c=must(await db.from('customers').select('id,code_hash').eq('member_id',String(b.member_id||'').trim().toLowerCase()).maybeSingle());
      if(!c||!(await bcrypt.compare(String(b.code||'').trim().toUpperCase(),c.code_hash)))return err('ID atau kode salah',401);
      return ok({token:jwt.sign({role:'c',sub:c.id},S,{expiresIn:'7d'})});
    }
    if(a==='admin_login'){
      if(!process.env.ADMIN_PASSWORD||!eq(String(b.password||''),process.env.ADMIN_PASSWORD))return err('Password salah',401);
      return ok({token:jwt.sign({role:'a'},S,{expiresIn:'12h'})});
    }
    let t;try{t=jwt.verify((ev.headers.authorization||'').replace('Bearer ',''),S)}catch{return err('Sesi habis, login lagi',401)}
    if(t.role==='c'){ // customer hanya bisa akses datanya sendiri (id dari token)
      if(a==='me')return ok(await bundle(t.sub));
      if(a==='claim'){
        const w=must(await db.from('warranties').select('id,end_date').eq('id',b.warranty_id).eq('customer_id',t.sub).maybeSingle());
        if(!w)return err('Garansi tidak ditemukan',404);
        if(w.end_date<iso(new Date()))return err('Garansi sudah berakhir');
        const m=String(b.message||'').trim().slice(0,500);if(m.length<5)return err('Jelaskan masalahnya (min 5 huruf)');
        must(await db.from('claims').insert({warranty_id:w.id,customer_id:t.sub,message:m}));return ok({});
      }
      return err('Aksi tidak dikenal');
    }
    if(t.role!=='a')return err('Dilarang',403);
    if(a==='customers'){
      let q=db.from('customers').select('id,member_id,name,stamps,joined_at').order('created_at',{ascending:false}).limit(100);
      const s=String(b.q||'').trim().replace(/[%,()]/g,'');if(s)q=q.or(`name.ilike.%${s}%,member_id.ilike.%${s}%`);
      return ok({list:must(await q)});
    }
    if(a==='customer')return ok(await bundle(b.id));
    if(a==='customer_save'){
      const row={name:String(b.name||'').trim(),member_id:String(b.member_id||'').trim().toLowerCase()};
      if(!row.name||!row.member_id)return err('Nama & member ID wajib');
      if(b.code){if(String(b.code).length<6)return err('Kode min 6 karakter');row.code_hash=await bcrypt.hash(String(b.code).trim().toUpperCase(),10)}
      if(b.id)must(await db.from('customers').update(row).eq('id',b.id));
      else{if(!row.code_hash)return err('Kode akses wajib');must(await db.from('customers').insert(row))}
      return ok({});
    }
    if(a==='order_save'){
      const o=must(await db.from('orders').insert({customer_id:b.customer_id,product:b.product,plan:b.plan||null,qty:+b.qty||1,price:+b.price||0}).select().single());
      if(+b.days>0){const s=new Date(),e=new Date(Date.now()+b.days*864e5);
        must(await db.from('warranties').insert({customer_id:b.customer_id,order_id:o.id,product:b.product,plan:b.plan||null,start_date:iso(s),end_date:iso(e)}))}
      return ok({});
    }
    if(a==='order_status'){
      if(b.status==='selesai')must(await db.rpc('complete_order',{p_order:b.id}));
      else{const o=must(await db.from('orders').select('stamped').eq('id',b.id).single());
        if(o.stamped)return err('Nota yang sudah diberi stamp tidak bisa diubah');
        must(await db.from('orders').update({status:b.status}).eq('id',b.id))}
      return ok({});
    }
    if(a==='stamp_adjust'){
      const c=must(await db.from('customers').select('stamps').eq('id',b.customer_id).single());
      const n=Math.max(0,Math.min(9,c.stamps+(+b.delta)));if(n===c.stamps)return err('Stamp manual hanya 0–9 (voucher terbit lewat nota selesai)');
      must(await db.from('customers').update({stamps:n}).eq('id',b.customer_id));
      must(await db.from('stamp_logs').insert({customer_id:b.customer_id,delta:n-c.stamps,reason:'Manual admin: '+String(b.reason||'-').slice(0,100)}));
      return ok({});
    }
    if(a==='claim_status'){must(await db.from('claims').update({status:b.status}).eq('id',b.id));return ok({})}
    if(a==='voucher_use'){must(await db.from('vouchers').update({used_at:new Date().toISOString()}).eq('id',b.id).is('used_at',null));return ok({})}
    return err('Aksi tidak dikenal');
  }catch(e){return err(e.message,500)}
};
