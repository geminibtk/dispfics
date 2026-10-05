import {NextResponse} from "next/server";
import {createClient} from "@supabase/supabase-js";

export const maxDuration=300;
const EA="https://drop-api.ea.com/rating/ea-sports-fc";
const RATINGS="https://www.ea.com/tr/games/ea-sports-fc/ratings";
const H={"Accept":"application/json","Accept-Language":"tr-TR,tr;q=0.9,en;q=0.8","Referer":RATINGS,"User-Agent":"Mozilla/5.0"};

function nextData(html:string){
  const m=html.match(/<script id="__NEXT_DATA__" type="application\/json">([\s\S]*?)<\/script>/);
  if(!m) throw new Error("EA __NEXT_DATA__ bulunamadı");
  return JSON.parse(m[1]);
}
async function fc27Context(){
  const r=await fetch(RATINGS,{headers:H,cache:"no-store"});
  if(!r.ok) throw new Error(`EA ratings page ${r.status}`);
  const j=nextData(await r.text());
  const details=j?.props?.pageProps?.ratingDetails;
  const hash=String(j?.props?.featureFlagProps?.hash||"");
  const total=Number(details?.totalItems)||0;
  if(total!==19789) throw new Error(`Beklenen FC27 toplamı 19789, EA ${total} döndürdü`);
  if(!hash) throw new Error("EA FC27 feature hash bulunamadı");
  return {hash,total};
}
async function eaPage(offset:number,hash:string){
  let last=0;
  for(let attempt=0;attempt<4;attempt++){
    const r=await fetch(`${EA}?locale=tr&limit=100&offset=${offset}`,{
      headers:{...H,"x-feature":hash,"drop-referrer":RATINGS},cache:"no-store"
    });
    last=r.status;
    if(r.ok)return r;
    if(![429,500,502,503,504].includes(r.status))return r;
    await new Promise(x=>setTimeout(x,750*(attempt+1)));
  }
  throw new Error(`EA upstream failed after retries: ${last}`);
}
function d(v:string){const m=v?.match(/(\d+)\/(\d+)\/(\d+)/);return m?`${m[3]}-${m[1].padStart(2,"0")}-${m[2].padStart(2,"0")}`:null}

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

  let ctx:{hash:string,total:number};
  try{ctx=await fc27Context()}catch(e:any){return NextResponse.json({error:e?.message||"FC27 context error"},{status:502})}

  let synced=0;
  const fetchedIdCounts=new Map<string,number>();
  for(let offset=0;offset<ctx.total;offset+=100){
    let r:Response;
    try{r=await eaPage(offset,ctx.hash)}catch(e:any){return NextResponse.json({error:e?.message||"EA upstream error",synced,offset},{status:502})}
    if(!r.ok)return NextResponse.json({error:`EA ${r.status}`,synced,offset},{status:502});
    const j=await r.json();
    const items=Array.isArray(j)?j:(j.items||j.results||j.players||[]);
    if(offset===0&&Number(j?.totalItems)!==19789)
      return NextResponse.json({error:`FC27 doğrulaması başarısız: ${j?.totalItems}`,synced},{status:502});
    if(!items.length) return NextResponse.json({error:"EA boş sayfa döndürdü",synced,offset},{status:502});

    const ids=items.map((x:any)=>String(x.id));
    for(const id of ids)fetchedIdCounts.set(id,(fetchedIdCounts.get(id)||0)+1);
    const {data:existing}=await s.from("scouting_players").select("external_id,height,weight").in("external_id",ids);
    const physical=new Map((existing||[]).map((x:any)=>[String(x.external_id),{height:x.height,weight:x.weight}]));
    const now=new Date().toISOString();
    const rows=items.map((x:any)=>{
      const old=physical.get(String(x.id)) as any;
      return {
        external_id:String(x.id),rank:x.rank,
        name:x.commonName||[x.firstName,x.lastName].filter(Boolean).join(" "),
        first_name:x.firstName,last_name:x.lastName,common_name:x.commonName,
        club:x.team?.label||null,league:x.leagueName||null,nationality:x.nationality?.label||null,
        position:x.position?.shortLabel||x.position?.label||"—",overall:x.overallRating,
        pace:x.stats?.pac?.value,shooting:x.stats?.sho?.value,passing:x.stats?.pas?.value,
        dribbling:x.stats?.dri?.value,defending:x.stats?.def?.value,physical:x.stats?.phy?.value,
        birthdate:d(x.birthdate),
        height:Number(x.height ?? x.playerHeight ?? x.heightCm)||Number(old?.height)||null,
        weight:Number(x.weight ?? x.playerWeight ?? x.weightKg)||Number(old?.weight)||null,
        skill_moves:x.skillMoves,weak_foot:x.weakFootAbility,preferred_foot:x.preferredFoot,
        avatar_url:x.avatarUrl,shield_url:x.shieldUrl,gender:x.gender,team:x.team,
        nationality_data:x.nationality,position_data:x.position,alternate_positions:x.alternatePositions||[],
        player_abilities:x.playerAbilities||[],raw_stats:x.stats||{},source:"ea-fc27",source_url:RATINGS,last_synced_at:now,is_active:true,archived_at:null
      };
    });
    const {error}=await s.from("scouting_players").upsert(rows,{onConflict:"external_id"});
    if(error)return NextResponse.json({error:error.message,synced,offset},{status:500});
    synced+=rows.length;
    if(items.length<100)break;
  }
  if(synced!==19789)return NextResponse.json({error:`Eksik FC27 sync: ${synced}/19789`,synced},{status:502});
  const fc27UniqueIds=fetchedIdCounts.size;
  const fc27DuplicateRows=synced-fc27UniqueIds;
  const fc27DuplicateIds=Array.from(fetchedIdCounts.values()).filter(count=>count>1).length;
  const fc27IdHashInput=Array.from(fetchedIdCounts.keys()).sort().join(",");
  let fc27IdHash=2166136261;
  for(let i=0;i<fc27IdHashInput.length;i++){fc27IdHash^=fc27IdHashInput.charCodeAt(i);fc27IdHash=Math.imul(fc27IdHash,16777619);}
  const fc27IdSetHash=(fc27IdHash>>>0).toString(16).padStart(8,"0");
  console.log("[FC27_ROSTER_AUDIT]",JSON.stringify({synced,fc27UniqueIds,fc27DuplicateRows,fc27DuplicateIds,fc27IdSetHash,featureHash:ctx.hash}));
  const archivedAt=new Date().toISOString();
  const {error:archiveError}=await s.from("scouting_players").update({is_active:false,archived_at:archivedAt}).neq("source","ea-fc27").eq("is_active",true);
  if(archiveError)return NextResponse.json({error:archiveError.message,synced},{status:500});
  return NextResponse.json({ok:true,synced,total:ctx.total,release:"FC27",fc27UniqueIds,fc27DuplicateRows,fc27DuplicateIds,fc27IdSetHash,databaseRowsPreserved:true,physicalDataPreserved:true});
}