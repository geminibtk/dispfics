import {NextResponse} from "next/server";

const BASE="https://www.transfermarkt.com.tr/spieler-statistik/wertvollstespieler/marktwertetop";
const norm=(s:string="")=>s.normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLocaleLowerCase("tr").replace(/[^a-z0-9ığüşöç]+/g," ").trim();
const money=(s:string)=>{const n=Number((s.match(/[\d.,]+/)?.[0]||"0").replace(".","").replace(",","."));return /bin/i.test(s)?n*1e3:/mil/i.test(s)?n*1e6:/milyar/i.test(s)?n*1e9:n};

export async function POST(req:Request){
 try{
  const {players=[]}=await req.json();
  const wanted=players.slice(0,100);
  if(!wanted.length)return NextResponse.json({matches:{}});
  const pages=Array.from({length:20},(_,i)=>i+1);
  const htmls=await Promise.all(pages.map(async p=>{const r=await fetch(p===1?BASE:`${BASE}?page=${p}`,{headers:{"User-Agent":"Mozilla/5.0","Accept-Language":"tr-TR,tr;q=0.9"},next:{revalidate:21600}});return r.ok?await r.text():""}));
  const all=htmls.join("\n"), matches:Record<string,any>={};
  for(const x of wanted){
   const name=String(x.name||"").replace(/[.*+?^$()|[\]{}\\]/g,"\\$&");
   const re=new RegExp(`href="[^"]+/profil/spieler/\\d+"[^>]*title="${name}"[^>]*>[^<]*<\\/a>[\\s\\S]{0,1800}?>(\\d{1,2})<\\/td>[\\s\\S]{0,1600}?title="([^"]+)"[\\s\\S]{0,1200}?>([\\d.,]+ (?:bin|mil|milyar)\\. €)<`,"i");
   const m=all.match(re); if(!m)continue;
   const club=m[2]||"", targetClub=String(x.club||"");
   if(targetClub&&norm(club)!==norm(targetClub))continue;
   matches[x.id]={age:Number(m[1]),market_value:money(m[3]),market_value_label:m[3],club,source:"Transfermarkt"};
  }
  return NextResponse.json({matches,source:BASE},{headers:{"Cache-Control":"public, s-maxage=21600, stale-while-revalidate=86400"}});
 }catch{return NextResponse.json({error:"Transfermarkt verisi alınamadı"},{status:502})}
}