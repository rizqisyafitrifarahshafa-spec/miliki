const $=s=>document.querySelector(s),rp=n=>'Rp'+Number(n||0).toLocaleString('id-ID');
const D=s=>new Date(s).toLocaleDateString('id-ID',{day:'numeric',month:'short',year:'numeric'});
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
async function api(action,body={},key='tk'){
  const r=await fetch('/.netlify/functions/api',{method:'POST',headers:{'content-type':'application/json',authorization:'Bearer '+(sessionStorage.getItem(key)||'')},body:JSON.stringify({action,...body})});
  const j=await r.json().catch(()=>({error:'Server error'}));if(!r.ok)throw Object.assign(new Error(j.error||'Gagal'),{status:r.status});return j}
const cat=c=>`<svg viewBox="0 0 48 48"><path d="M8 20 10 4l11 8h6l11-8 2 16z" fill="${c}" stroke="#7a5c6e" stroke-width="2" stroke-linejoin="round"/><ellipse cx="24" cy="29" rx="17" ry="14" fill="${c}" stroke="#7a5c6e" stroke-width="2"/><circle cx="18" cy="27" r="2" fill="#5b4458"/><circle cx="30" cy="27" r="2" fill="#5b4458"/><path d="M22 32q2 2 4 0" fill="none" stroke="#5b4458" stroke-width="1.6"/><circle cx="12" cy="33" r="3" fill="#ff9db8" opacity=".5"/><circle cx="36" cy="33" r="3" fill="#ff9db8" opacity=".5"/></svg>`;
const bf=c=>`<svg viewBox="0 0 48 48"><path d="M24 24C14 4 3 10 8 24c3 8 12 5 16 0zM24 24c10-20 21-14 16 0-3 8-12 5-16 0z" fill="${c}" stroke="#7a5c6e" stroke-width="2"/><path d="M24 14v22" stroke="#5b4458" stroke-width="2.5" stroke-linecap="round"/></svg>`;
const stampArt=i=>i%2?bf(i%4>1?'#ffd6e0':'#e4d9ff'):cat(i%4>1?'#fff1b8':'#ffd6e0');
const days=e=>Math.ceil((new Date(e+'T23:59:59')-Date.now())/864e5);
