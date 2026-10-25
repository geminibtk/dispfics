import {NextResponse} from "next/server";
import {createClient} from "@supabase/supabase-js";
export const dynamic="force-dynamic";
export const maxDuration=60;
const norm=(s:string)=>s.normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().replace(/[^a-z0-9]/g,"");
export async function GET(req:Request){
 const token=req.headers.get("authorization")?.replace(/^Bearer /,"");
 if(!token)return NextResponse.json({error:"Unauthorized"},{status:401});
 const url=process.env.SUPABASE_URL||process.env.NEXT_PUBLIC_SUPABASE_URL;
 const secret=process.env.SUPABASE_SERVICE_ROLE_KEY||process.env.SUPABASE_SECRET_KEY;
 const key=process.env.API_FOOTBALL_KEY;
 if(!url||!secret||!key)return NextResponse.json({error:"Missing configuration"},{status:503});
 const db=createClient(url,secret,{auth:{persistSession:false}});
 const {data:{user},error}=await db.auth.getUser(token);
 if(error||user?.email?.toLowerCase()!=="gemini.btk@gmail.com")return NextResponse.json({error:"Forbidden"},{status:403});
 const {data:catalog,error:catalogError}=await db.from("team_catalog_summary").select("name,league").limit(1000);
 const {data:matches,error:matchError}=await db.from("api_football_team_matches").select("api_team_id,local_team_name,local_league_name,status").limit(1000);
 if(catalogError||matchError)return NextResponse.json({error:catalogError?.message||matchError?.message},{status:502});
 const linked=new Set((matches||[]).filter(x=>x.status==="matched").map(x=>x.local_league_name+"\u0000"+x.local_team_name));
 const remaining=(catalog||[]).filter(x=>!linked.has(x.league+"\u0000"+x.name)).sort((a,b)=>a.league.localeCompare(b.league)||a.name.localeCompare(b.name));
 const batch=Number(new URL(req.url).searchParams.get("batch")||"0");
 if(!Number.isInteger(batch)||batch<0||batch>=Math.ceil(remaining.length/4))return NextResponse.json({error:"Invalid batch"},{status:400});
 const selected=remaining.slice(batch*4,batch*4+4);
 const reports=[];
 for(const item of selected){
  try{
   const search=item.name.normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/[^a-zA-Z0-9 ]/g," ").replace(/\b(FC|FK|SC|TC)\b/gi,"").replace(/\s+/g," ").trim();
   if(search.length<3)return {...item,status:"manual_review",candidates:[]};
   if(reports.length)await new Promise(resolve=>setTimeout(resolve,1200));
   const response=await fetch("https://v3.football.api-sports.io/teams?search="+encodeURIComponent(search),{headers:{"x-apisports-key":key},cache:"no-store",signal:AbortSignal.timeout(15000)});
   if(!response.ok)throw new Error("API HTTP "+response.status);
   const json=await response.json();
   if(json.errors&&Object.keys(json.errors).length)throw new Error("API error: "+JSON.stringify(json.errors));
   const candidates=(json.response||[]).map((x:any)=>({apiId:Number(x.team?.id),apiName:String(x.team?.name||""),country:String(x.team?.country||""),founded:x.team?.founded||null})).filter((x:any)=>Number.isSafeInteger(x.apiId));
   const exact=candidates.filter((x:any)=>norm(x.apiName)===norm(item.name));
   const alreadyLinked=new Set((matches||[]).filter(x=>x.status==="matched").map(x=>Number(x.api_team_id)));
   const safe=exact.length===1&&!alreadyLinked.has(exact[0].apiId);
   return {...item,status:safe?"exact_candidate":"manual_review",candidates:candidates.slice(0,20),exactCandidate:safe?exact[0]:null};
  }catch(e){return {...item,status:"error",error:e instanceof Error?e.message:"Unknown error",candidates:[]}}
 }
 return NextResponse.json({total:remaining.length,batch,batches:Math.ceil(remaining.length/4),reports,notice:"Read-only candidate discovery. No mapping is saved. Verify team identity and country before linking."},{headers:{"Cache-Control":"no-store"}});
}
