import {NextResponse} from "next/server";
import {createClient} from "@supabase/supabase-js";
export const runtime="nodejs";
export const dynamic="force-dynamic";
const allowed:Record<string,{path:string;required:string[]}> = {
 countries:{path:"countries",required:[]},
 leagues:{path:"leagues",required:[]},
 teams:{path:"teams",required:["league","season"]},
 fixtures:{path:"fixtures",required:["league","season"]},
 standings:{path:"standings",required:["league","season"]},
};
export async function GET(req:Request){
 if(!process.env.CRON_SECRET||req.headers.get("authorization")!==`Bearer ${process.env.CRON_SECRET}`)return NextResponse.json({error:"Unauthorized"},{status:401});
 const url=new URL(req.url);
 const category=url.searchParams.get("category")||"";
 const spec=allowed[category];
 if(!spec)return NextResponse.json({error:"Supported: countries, leagues, teams, fixtures, standings"},{status:400});
 if(!process.env.API_FOOTBALL_KEY||!process.env.SUPABASE_URL||!process.env.SUPABASE_SERVICE_ROLE_KEY)return NextResponse.json({error:"Missing configuration"},{status:503});
 const params=new URLSearchParams();
 for(const name of spec.required){
  const value=url.searchParams.get(name);
  if(!value||!/^\\d{1,6}$/.test(value))return NextResponse.json({error:`Valid ${name} required`},{status:400});
  params.set(name,value);
 }
 const apiUrl=`https://v3.football.api-sports.io/${spec.path}${params.size?"?"+params:""}`;
 const response=await fetch(apiUrl,{headers:{"x-apisports-key":process.env.API_FOOTBALL_KEY},cache:"no-store",signal:AbortSignal.timeout(12000)});
 if(!response.ok)return NextResponse.json({error:"Upstream unavailable",status:response.status},{status:502});
 const body=await response.json();
 if(body.errors&&Object.keys(body.errors).length)return NextResponse.json({error:"Upstream API error",details:body.errors},{status:429});
 const rows=Array.isArray(body.response)?body.response:[];
 const db=createClient(process.env.SUPABASE_URL,process.env.SUPABASE_SERVICE_ROLE_KEY,{auth:{persistSession:false}});
 const saved=rows.map((payload:any,index:number)=>{
  const id=category==="countries"?payload.code||payload.name:category==="leagues"?payload.league?.id:category==="teams"?payload.team?.id:category==="fixtures"?payload.fixture?.id:payload.league?.id;
  const source_key=[...spec.required.map(k=>params.get(k)),String(id??index)].join(":");
  return {category,source:"api-football",source_key,payload,fetched_at:new Date().toISOString()};
 });
 for(let i=0;i<saved.length;i+=100){
  const {error}=await db.from("football_reference_data").upsert(saved.slice(i,i+100),{onConflict:"category,source,source_key"});
  if(error)return NextResponse.json({error:"Reference data save failed",detail:error.message},{status:500});
 }
 return NextResponse.json({category,received:rows.length,saved:saved.length,playerRecordsChanged:0});
}
