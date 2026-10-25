import {NextResponse} from "next/server";
import {createClient} from "@supabase/supabase-js";
export const runtime="nodejs";
export const dynamic="force-dynamic";

// This endpoint NEVER queries or modifies scouting_players or football_player_links.
type Spec={path:string;required:string[];optional?:string[]};
const specs:Record<string,Spec>={
 countries:{path:"countries",required:[]},
 seasons:{path:"leagues/seasons",required:[]},
 leagues:{path:"leagues",required:[],optional:["country","season","id"]},
 standings:{path:"standings",required:["league","season"]},
 teams:{path:"teams",required:["league","season"]},
 livescore:{path:"fixtures",required:[],optional:["live"]},
 fixtures:{path:"fixtures",required:["league","season"],optional:["date","from","to"]},
 head_to_head:{path:"fixtures/headtohead",required:["h2h"]},
 events:{path:"fixtures/events",required:["fixture"]},
 lineups:{path:"fixtures/lineups",required:["fixture"]},
 top_scorers:{path:"players/topscorers",required:["league","season"]},
 players_coaches:{path:"coachs",required:["team"]},
 transfers:{path:"transfers",required:["team"]},
 trophies:{path:"trophies",required:["player"]},
 sidelined:{path:"sidelined",required:["player"]},
 injuries:{path:"injuries",required:["league","season"]},
 inplay_odds:{path:"odds/live",required:[]},
 prematch_odds:{path:"odds",required:["fixture"]},
 statistics:{path:"fixtures/statistics",required:["fixture"]},
 predictions:{path:"predictions",required:["fixture"]}
};
const numeric=new Set(["league","season","id","fixture","team","player"]);
export async function GET(req:Request){
 if(!process.env.CRON_SECRET||req.headers.get("authorization")!==`Bearer ${process.env.CRON_SECRET}`)return NextResponse.json({error:"Unauthorized"},{status:401});
 const url=new URL(req.url),category=url.searchParams.get("category")||"";
 const spec=specs[category];
 if(!spec)return NextResponse.json({error:"Unsupported category",supported:Object.keys(specs)},{status:400});
 if(!process.env.API_FOOTBALL_KEY||!process.env.SUPABASE_URL||!process.env.SUPABASE_SERVICE_ROLE_KEY)return NextResponse.json({error:"Missing configuration"},{status:503});
 const params=new URLSearchParams();
 for(const name of [...spec.required,...(spec.optional||[])]){
  const value=url.searchParams.get(name);
  if(!value){if(spec.required.includes(name))return NextResponse.json({error:`Missing ${name}`},{status:400});continue}
  if(numeric.has(name)&&!/^\d{1,6}$/.test(value))return NextResponse.json({error:`Invalid ${name}`},{status:400});
  if(value.length>80||!/^[a-zA-Z0-9 ,:_-]+$/.test(value))return NextResponse.json({error:`Invalid ${name}`},{status:400});
  params.set(name,value);
 }
 if(category==="livescore"&&!params.has("live"))params.set("live","all");
 const page=url.searchParams.get("page");
 if(page){if(!/^\d{1,3}$/.test(page)||Number(page)>3||Number(page)<1)return NextResponse.json({error:"Invalid page (1-3)"},{status:400});params.set("page",page)}
 const apiUrl=`https://v3.football.api-sports.io/${spec.path}${params.size?"?"+params:""}`;
 let response:Response;
 try{response=await fetch(apiUrl,{headers:{"x-apisports-key":process.env.API_FOOTBALL_KEY},cache:"no-store",signal:AbortSignal.timeout(12000)})}
 catch{return NextResponse.json({error:"Upstream timeout or network error"},{status:502})}
 if(!response.ok)return NextResponse.json({error:"Upstream unavailable",status:response.status},{status:502});
 const body=await response.json();
 if(body.errors&&Object.keys(body.errors).length)return NextResponse.json({error:"Upstream API error",details:body.errors},{status:429});
 const rows=Array.isArray(body.response)?body.response:[];
 const db=createClient(process.env.SUPABASE_URL,process.env.SUPABASE_SERVICE_ROLE_KEY,{auth:{persistSession:false}});
 const scope=Array.from(params.entries()).filter(([k])=>k!=="page").sort(([a],[b])=>a.localeCompare(b)).map(([k,v])=>`${k}=${v}`).join("&");
 const saved=rows.map((payload:any,index:number)=>{
  const stableId=category==="countries"?(payload.code||payload.name):category==="leagues"?payload.league?.id:category==="teams"?payload.team?.id:category==="fixtures"||category==="livescore"||category==="head_to_head"?payload.fixture?.id:category==="standings"?payload.league?.id:category==="seasons"?payload:payload.fixture?.id??payload.player?.id??payload.team?.id??payload.id??index;
  return {category,source:"api-football",source_key:`${scope}|${String(stableId)}`,payload,fetched_at:new Date().toISOString()};
 });
 for(let i=0;i<saved.length;i+=100){
  const {error}=await db.from("football_reference_data").upsert(saved.slice(i,i+100),{onConflict:"category,source,source_key"});
  if(error)return NextResponse.json({error:"Reference data save failed",detail:error.message},{status:500});
 }
 return NextResponse.json({category,received:rows.length,saved:saved.length,paging:body.paging||null,playerRecordsChanged:0});
}
