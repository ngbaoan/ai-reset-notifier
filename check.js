const fs=require('fs');
(async()=>{
const now=new Date();
const res=await fetch(process.env.JSON_URL);
const data=await res.json();
let state={};
try{state=JSON.parse(fs.readFileSync('state.json','utf8'));}catch{}
let changed=false;
for(const a of data.accounts){
 const reset=new Date(a.resetAt);
 const diff=reset-now;
 if(diff>=0&&diff<=5*60*1000&&state[a.email]!==a.resetAt){
  const text=`🎉 Claude Reset\n\n${a.email}\n${a.note}\nReady now!`;
  await fetch(`https://api.telegram.org/bot${process.env.BOT_TOKEN}/sendMessage`,{
   method:'POST',
   headers:{'Content-Type':'application/json'},
   body:JSON.stringify({chat_id:process.env.CHAT_ID,text})
  });
  state[a.email]=a.resetAt; changed=true;
 }
}
if(changed) fs.writeFileSync('state.json',JSON.stringify(state,null,2));
})();