import {NextResponse} from "next/server";import {createClient} from "@supabase/supabase-js";
export const maxDuration=60;
const BASE="https://www.transfermarkt.com.tr/spieler-statistik/wertvollstespieler/marktwertetop";
const norm=(s:string="")=>s.normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLocaleLowerCase("tr").replace(/[^a-z0-9ığüşöç]+/g," ").trim();
const value=(s:string)=>{const n=Number((s.match(/[\d.,]+/)?.[0]||"0").replace(".","").replace(",","."));return Math.round(/bin/i.test(s)?n*1e3:/mil/i.test(s)?n*1e6:/milyar/i.test(s)?n*1e9:n)};
export async function POST(req:Request){
 const auth=req.headers.get("authorization");if(!auth?.startsWith("Bearer "))return NextResponse.json({error:"Unauthorized"},{status:401});
 const url=process.env.SUPABASE_URL||process.env.NEXT_PUBLIC_SUPABASE_URL,key=process.env.SUPABASE_SERVICE_ROLE_KEY||process.env.SUPABASE_SECRET_KEY;if(!url||!key)return NextResponse.json({error:"Server env missing"},{status:500});
 const s=createClient(url,key,{auth:{persistSession:false}}),{data:{user}}=await s.auth.getUser(auth.slice(7));if(!user)return NextResponse.json({error:"Unauthorized"},{status:401});
 const body=await req.json().catch(()=>({})),page=Math.min(20,Math.max(1,Number(body.page)||1));
 const r=await fetch(page===1?BASE:`${BASE}?page=${page}`,{headers:{"User-Agent":"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/154 Safari/537.36","Accept-Language":"tr-TR,tr;q=0.9"},cache:"no-store"});
 if(r.status===429)return NextResponse.json({error:"Transfermarkt rate limit",retry:true,page},{status:429});if(!r.ok)return NextResponse.json({error:`Transfermarkt ${r.status}`,page},{status:502});
 const html=await r.text(),re=/href="([^"]+\/profil\/spieler\/(\d+))"[^>]*title="([^"]+)"[^>]*>[\s\S]{0,2200}?>(\d{1,2})<\/td>[\s\S]{0,1800}?title="([^"]+)"[\s\S]{0,1400}?>([\d.,]+ (?:bin|mil|milyar)\. €)</gi;
 let m:any,matched=0,seen=0;while((m=re.exec(html))){seen++;const [,path,id,name,age,club,mv]=m;const {data}=await s.from("scouting_players").select("id,name,club").ilike("name",name).limit(10);const hit=(data||[]).find((x:any)=>norm(x.name)===norm(name)&&(!x.club||norm(x.club)===norm(club)));if(!hit)continue;const {error}=await s.from("scouting_players").update({age:Number(age),market_value:value(mv),transfermarkt_id:id,transfermarkt_url:new URL(path,"https://www.transfermarkt.com.tr").href,transfermarkt_updated_at:new Date().toISOString()}).eq("id",hit.id);if(!error)matched++}
 const {count}=await s.from("scouting_players").select("*",{count:"exact",head:true}).not("transfermarkt_id","is",null);
 return NextResponse.json({ok:true,page,seen,matched,totalMatched:count,nextPage:page<20?page+1:null});
}