import {NextResponse} from "next/server";
import {createClient} from "@supabase/supabase-js";

export const maxDuration=300;
const EA="https://drop-api.ea.com/rating/ea-sports-fc";
const H={"Accept":"application/json","Accept-Language":"tr-TR,tr;q=0.9,en;q=0.8","User-Agent":"Mozilla/5.0"};

function date(v:string){const m=v?.match(/(\d+)\/(\d+)\/(\d+)/);return m?`${m[3]}-${m[1].padStart(2,"0")}-${m[2].padStart(2,"0")}`:null}
function norm(v:string){
 return String(v||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase()
  .replace(/[^a-z0-9]+/g," ").trim().replace(/\s+/g," ");
}
function names(x:any){return Array.from(new Set([x.commonName,[x.firstName,x.lastName].filter(Boolean).join(" "),x.name].map(norm).filter(Boolean)))}
async function page(offset:number){
 for(let attempt=0;attempt<4;attempt++){
  const r=await fetch(`${EA}?locale=tr&limit=100&offset=${offset}`,{headers:H,cache:"no-store"});
  if(r.ok)return r;
  if(![429,500,502,503,504].includes(r.status))return r;
  await new Promise(x=>setTimeout(x,750*(attempt+1)));
 }
 throw new Error("Legacy EA upstream failed");
}
export async function POST(req:Request){
 const a=req.headers.get("authorization");
 if(!a?.startsWith("Bearer "))return NextResponse.json({error:"Unauthorized"},{status:401});
 const url=process.env.SUPABASE_URL||process.env.NEXT_PUBLIC_SUPABASE_URL;
 const key=process.env.SUPABASE_SERVICE_ROLE_KEY||process.env.SUPABASE_SECRET_KEY;
 if(!url||!key)return NextResponse.json({error:"Server env missing"},{status:500});
 const s=createClient(url,key,{auth:{persistSession:false}});
 const {data:{user}}=await s.auth.getUser(a.slice(7));
 if(!user)return NextResponse.json({error:"Unauthorized"},{status:401});
 const {data:membership}=await s.from("club_members").select("role").eq("user_id",user.id).limit(1).maybeSingle();
 if(!membership||!["owner","admin"].includes(String(membership.role||"").toLowerCase()))
  return NextResponse.json({error:"Bu işlem yalnızca kulüp sahibi veya yönetici tarafından çalıştırılabilir."},{status:403});

 const legacy:any[]=[];
 let total=0;
 for(let offset=0;;offset+=100){
  const r=await page(offset);
  if(!r.ok)return NextResponse.json({error:`Legacy EA ${r.status}`,offset},{status:502});
  const j=await r.json(); const items=j.items||[];
  if(offset===0){total=Number(j.totalItems)||0;if(total!==17873)return NextResponse.json({error:`Beklenen legacy toplamı 17873, EA ${total} döndürdü`},{status:502});}
  legacy.push(...items);
  if(legacy.length>=total||items.length<100)break;
 }
 const byKey=new Map<string,any[]>();
 for(const x of legacy){
  const bd=date(x.birthdate); const h=Number(x.height)||0,w=Number(x.weight)||0;
  if(!bd||!h||!w)continue;
  for(const n of names(x)){const k=`${bd}|${n}`;const arr=byKey.get(k)||[];arr.push(x);byKey.set(k,arr);}
 }
 let missing:any[]=[]; let from=0;
 while(true){
  const {data,error}=await s.from("scouting_players").select("id,external_id,name,first_name,last_name,common_name,birthdate,club").eq("is_active",true).is("height",null).is("weight",null).range(from,from+999);
  if(error)return NextResponse.json({error:error.message},{status:500});
  missing.push(...(data||[])); if(!data||data.length<1000)break; from+=1000;
 }
 let matched=0,ambiguous=0,unmatched=0,updated=0;
 for(const p of missing){
  const keys=names(p).map(n=>`${p.birthdate}|${n}`);
  const candidates=Array.from(new Map(keys.reduce((all:any[],k)=>all.concat(byKey.get(k)||[]),[]).map((x:any)=>[String(x.id),x])).values());
  if(candidates.length!==1){candidates.length>1?ambiguous++:unmatched++;continue;}
  const x:any=candidates[0];
  const {error}=await s.from("scouting_players").update({height:Number(x.height),weight:Number(x.weight)}).eq("id",p.id).is("height",null).is("weight",null);
  if(error)return NextResponse.json({error:error.message,matched,updated},{status:500});
  matched++;updated++;
 }
 return NextResponse.json({ok:true,legacyTotal:legacy.length,missingBefore:missing.length,matched,updated,ambiguous,unmatched,matching:"normalized name + exact birthdate; unique legacy candidate only"});
}
