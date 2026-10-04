import {NextRequest,NextResponse} from "next/server";

const EA_URL="https://drop-api.ea.com/rating/ea-sports-fc";
export const dynamic="force-dynamic";
const headers={
 "Accept":"*/*",
 "Accept-Language":"tr-TR,tr;q=0.9,en-US;q=0.8,en;q=0.7",
 "Cache-Control":"no-cache","Pragma":"no-cache",
 "Drop-Referrer":"https://www.ea.com/tr/games/ea-sports-fc/ratings",
 "Origin":"https://www.ea.com","Referer":"https://www.ea.com/",
 "User-Agent":"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/154.0.0.0 Safari/537.36"
};
async function page(offset:number){
 const r=await fetch(`${EA_URL}?locale=tr&limit=100&offset=${offset}`,{headers,cache:"no-store"});
 if(!r.ok)throw new Error(String(r.status));
 return r.json();
}
export async function GET(req:NextRequest){
 const offset=Math.max(0,Number(req.nextUrl.searchParams.get("offset")||0));
 const search=(req.nextUrl.searchParams.get("search")||"").trim().toLocaleLowerCase("tr");
 try{
  if(!search){
   const data=await page(offset);
   return NextResponse.json(data,{headers:{"Cache-Control":"no-store, max-age=0"}});
  }
  const total=19789, concurrency=10, found:any[]=[];
  for(let base=0;base<total;base+=100*concurrency){
   const batches=await Promise.all(Array.from({length:concurrency},(_,i)=>page(base+i*100)));
   for(const data of batches){
    const items=Array.isArray(data)?data:(data.items||data.results||data.players||[]);
    for(const x of items){
     const hay=[x.commonName,x.firstName,x.lastName,x.team?.label,x.leagueName,x.nationality?.label].filter(Boolean).join(" ").toLocaleLowerCase("tr");
     if(hay.includes(search))found.push(x);
    }
   }
   if(found.length>=100)break;
  }
  return NextResponse.json({items:found.slice(0,100),totalDataset:total,search},{headers:{"Cache-Control":"no-store, max-age=0"}});
 }catch{return NextResponse.json({error:"EA Ratings bağlantısı kurulamadı"},{status:502})}
}
