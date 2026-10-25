import {NextResponse} from "next/server";
import {createClient} from "@supabase/supabase-js";
export const dynamic="force-dynamic";
export const maxDuration=60;
const norm=(s:string)=>s.normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/ı/g,"i").toLowerCase().replace(/[^a-z0-9]/g,"");

const EXPECTED_COUNTRIES:Record<string,string>={
 "Barcelona SC Guayaquil":"Ecuador","Independiente Santa Fe":"Colombia","Junior de Barranquilla":"Colombia","LDU Quito":"Ecuador",
 "Universidad Central de Venezuela":"Venezuela","Universitario de Deportes":"Peru",
 "Academia Puerto Cabello":"Venezuela","Alianza Atlético de Sullana":"Peru","Audax Italiano":"Chile",
 "Juventud de Las Piedras":"Uruguay","Montevideo City Torque":"Uruguay","O'Higgins":"Chile",
 "Olimpia Asunción":"Paraguay","Recoleta FC":"Paraguay","Ludogorets Razgrad":"Bulgaria",
 "CFR Cluj":"Romania","FK Csíkszereda Miercurea Ciuc":"Romania","SC Oțelul Galați":"Romania"
};

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
 for(const [index,item] of selected.entries()) {
  try{
   const search=item.name.normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/[^a-zA-Z0-9 ]/g," ").replace(/\b(FC|FK|SC|TC)\b/gi,"").replace(/\s+/g," ").trim();
   // API-Football search is often substring-based: full EA names may not exist verbatim.
   // Use distinctive club tokens for candidate discovery only; never auto-link fuzzy results.
   const terms:Record<string,string>={
    "Barcelona SC Guayaquil":"Barcelona", "Independiente Santa Fe":"Santa Fe",
    "Junior de Barranquilla":"Junior", "LDU Quito":"LDU",
    "Universidad Central de Venezuela":"UCV", "Universitario de Deportes":"Universitario",
    "Academia Puerto Cabello":"Puerto Cabello", "Alianza Atlético de Sullana":"Alianza Atletico",
    "Audax Italiano":"Audax", "Juventud de Las Piedras":"Juventud",
    "Montevideo City Torque":"Torque", "O\u0027Higgins":"Higgins",
    "Olimpia Asunción":"Olimpia", "Recoleta FC":"Recoleta",
    "Ludogorets Razgrad":"Ludogorets", "CFR Cluj":"Cluj",
    "FK Csíkszereda Miercurea Ciuc":"Csikszereda", "SC Oțelul Galați":"Otelul"
   };
   const lookup=terms[item.name]||search;
   if(search.length<3)return {...item,status:"manual_review",candidates:[]};
   if(index)await new Promise(resolve=>setTimeout(resolve,index*1200));
   const response=await fetch("https://v3.football.api-sports.io/teams?search="+encodeURIComponent(lookup),{headers:{"x-apisports-key":key},cache:"no-store",signal:AbortSignal.timeout(15000)});
   if(!response.ok)throw new Error("API HTTP "+response.status);
   const json=await response.json();
   if(json.errors&&Object.keys(json.errors).length)throw new Error("API error: "+JSON.stringify(json.errors));
   const candidates=(json.response||[]).map((x:any)=>({apiId:Number(x.team?.id),apiName:String(x.team?.name||""),country:String(x.team?.country||""),founded:x.team?.founded||null})).filter((x:any)=>Number.isSafeInteger(x.apiId));
   const exact=candidates.filter((x:any)=>norm(x.apiName)===norm(item.name));
   const alreadyLinked=new Set((matches||[]).filter(x=>x.status==="matched").map(x=>Number(x.api_team_id)));
   const expectedCountry=EXPECTED_COUNTRIES[item.name];
   const safe=exact.length===1&&!!expectedCountry&&norm(exact[0].country)===norm(expectedCountry)&&!alreadyLinked.has(exact[0].apiId);
   return {...item,status:safe?"exact_candidate":"manual_review",expectedCountry:expectedCountry||null,candidates:candidates.filter((x:any)=>!expectedCountry||norm(x.country)===norm(expectedCountry)).slice(0,30),exactCandidate:safe?exact[0]:null};
  }catch(e){return {...item,status:"error",error:e instanceof Error?e.message:"Unknown error",candidates:[]}}
 }
 return NextResponse.json({total:remaining.length,batch,batches:Math.ceil(remaining.length/4),reports,notice:"Read-only candidate discovery. No mapping is saved. Verify team identity and country before linking."},{headers:{"Cache-Control":"no-store"}});
}

export async function POST(req:Request){
 const token=req.headers.get("authorization")?.replace(/^Bearer /,"");
 if(!token)return NextResponse.json({error:"Unauthorized"},{status:401});
 const url=process.env.SUPABASE_URL||process.env.NEXT_PUBLIC_SUPABASE_URL;
 const secret=process.env.SUPABASE_SERVICE_ROLE_KEY||process.env.SUPABASE_SECRET_KEY;
 const key=process.env.API_FOOTBALL_KEY;
 if(!url||!secret||!key)return NextResponse.json({error:"Missing configuration"},{status:503});
 const db=createClient(url,secret,{auth:{persistSession:false}});
 const {data:{user},error:authError}=await db.auth.getUser(token);
 if(authError||user?.email?.toLowerCase()!=="gemini.btk@gmail.com")return NextResponse.json({error:"Forbidden"},{status:403});
 let body:any;
 try{body=await req.json()}catch{return NextResponse.json({error:"Invalid JSON"},{status:400})}
 const name=String(body?.name||"");
 const league=String(body?.league||"");
 const apiId=Number(body?.apiId);
 const expectedCountry=EXPECTED_COUNTRIES[name];
 if(!expectedCountry||!Number.isSafeInteger(apiId)||apiId<=0)return NextResponse.json({error:"Invalid team or API ID"},{status:400});
 const {data:catalog,error:catalogError}=await db.from("team_catalog_summary").select("name,league").eq("name",name).eq("league",league);
 if(catalogError||catalog?.length!==1)return NextResponse.json({error:"Catalog entry not unique"},{status:409});
 const response=await fetch("https://v3.football.api-sports.io/teams?id="+apiId,{headers:{"x-apisports-key":key},cache:"no-store",signal:AbortSignal.timeout(15000)});
 if(!response.ok)return NextResponse.json({error:"API HTTP "+response.status},{status:502});
 const payload=await response.json();
 if(payload.errors&&Object.keys(payload.errors).length)return NextResponse.json({error:"API error",details:payload.errors},{status:502});
 const team=payload.response?.[0]?.team;
 if(!team||Number(team.id)!==apiId||norm(String(team.country||""))!==norm(expectedCountry))return NextResponse.json({error:"API team identity/country mismatch"},{status:409});
 if(/(?:\bU\s?\d{2}\b|\bWomen\b|\bLadies\b|\bReserves\b|\bB\b|\bW\b)/i.test(String(team.name||"")))return NextResponse.json({error:"Youth, reserve or women team requires manual review"},{status:409});
 const {data:existing,error:existingError}=await db.from("api_football_team_matches").select("api_team_id,local_team_name,local_league_name,status").or("api_team_id.eq."+apiId+",local_team_name.eq."+JSON.stringify(name));
 if(existingError)return NextResponse.json({error:existingError.message},{status:502});
 const conflict=(existing||[]).some((x:any)=>x.status==="matched"&&(Number(x.api_team_id)!==apiId||x.local_team_name!==name||x.local_league_name!==league));
 if(conflict)return NextResponse.json({error:"Conflicting existing mapping; nothing saved"},{status:409});
 const {data:allLocal,error:localError}=await db.from("api_football_team_matches").select("api_team_id,local_team_name,local_league_name,status").eq("local_team_name",name).eq("local_league_name",league).eq("status","matched");
 if(localError||allLocal?.some((x:any)=>Number(x.api_team_id)!==apiId))return NextResponse.json({error:"Local team already mapped"},{status:409});
 const {data:oldTeam,error:teamLookupError}=await db.from("api_football_teams").select("api_team_id").eq("api_team_id",apiId);
 if(teamLookupError)return NextResponse.json({error:teamLookupError.message},{status:502});
 if(!oldTeam?.length){
  const {error:teamError}=await db.from("api_football_teams").insert({api_team_id:apiId,name:team.name,country:team.country,logo:team.logo||null,season:2026,raw:team});
  if(teamError)return NextResponse.json({error:teamError.message},{status:502});
 }
 const {error:writeError}=await db.from("api_football_team_matches").upsert({api_team_id:apiId,local_team_name:name,local_league_name:league,status:"matched",candidates:[{name,league}],checked_at:new Date().toISOString()},{onConflict:"api_team_id"});
 if(writeError)return NextResponse.json({error:writeError.message},{status:502});
 const {data:verified,error:verifyError}=await db.from("api_football_team_matches").select("api_team_id,local_team_name,local_league_name,status").eq("api_team_id",apiId).single();
 if(verifyError||verified?.status!=="matched"||verified.local_team_name!==name||verified.local_league_name!==league)return NextResponse.json({error:"Verification failed"},{status:502});
 return NextResponse.json({saved:true,apiId,name,league,apiName:team.name,country:team.country});
}
