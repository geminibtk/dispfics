import {catalogLeagueIds} from "./football-center";
const aliases:Record<string,[string,string]>={
"3. Liga":["3. Liga","Germany"],"Allsvenskan":["Allsvenskan","Sweden"],"Brack Super League":["Super League","Switzerland"],"Česká Liga":["Czech Liga","Czech-Republic"],"CONMEBOL Libertadores":["CONMEBOL Libertadores","World"],"CONMEBOL Sudamericana":["CONMEBOL Sudamericana","World"],"CSL":["Super League","China"],"EFL League One":["League One","England"],"EFL League Two":["League Two","England"],"Ekstraklasa":["Ekstraklasa","Poland"],"Eliteserien":["Eliteserien","Norway"],"Finnliiga":["Veikkausliiga","Finland"],"Hellas Liga":["Super League 1","Greece"],"ISL":["Indian Super League","India"],"Isuzu UTE A League":["A-League","Australia"],"K League 1":["K League 1","South-Korea"],"LALIGA HYPERMOTION":["Segunda División","Spain"],"Liga Azerbaijan":["Premyer Liqa","Azerbaijan"],"Liga BBVA MX":["Liga MX","Mexico"],"Liga Bulgaria":["First League","Bulgaria"],"Liga Colombia":["Primera A","Colombia"],"Liga Cyprus":["1. Division","Cyprus"],"Liga do Brasil":["Serie A","Brazil"],"Liga Hrvatska":["HNL","Croatia"],"Ligue 2 BKT":["Ligue 2","France"],"LPF":["Liga Profesional Argentina","Argentina"],"Magyar Liga":["NB I","Hungary"],"Metropolitan Division":["Metropolitan Division",""],"Ö. Bundesliga":["Bundesliga","Austria"],"SSE Airtricity Men's Premier Division":["Premier Division","Ireland"],"SUPERLIGA":["Superliga","Denmark"],"Thailand League":["Thai League 1","Thailand"],"Ukrayina Liha":["Premier League","Ukraine"],"United Emirates League":["Pro League","United-Arab-Emirates"]
};
const normalize=(s:string)=>s.toLocaleLowerCase("en").normalize("NFD").replace(/[^a-z0-9]/g,"");
export async function resolveFootballLeague(name:string,key:string):Promise<{id:number;season:number}|null>{
 const known=catalogLeagueIds[name];
 if(known)return {id:known,season:2026};
 if(!key)return null;
 const [search,country]=aliases[name]||[name,""];
 try{
  const url="https://v3.football.api-sports.io/leagues?search="+encodeURIComponent(search);
  const res=await fetch(url,{headers:{"x-apisports-key":key},next:{revalidate:86400},signal:AbortSignal.timeout(9000)});
  const json=await res.json();
  if(!res.ok||Object.keys(json.errors||{}).length)return null;
  const rows:any[]=json.response||[];
  const candidates=rows.filter(row=>!country||normalize(row.country?.name||"")===normalize(country));
  const exact=candidates.filter(row=>normalize(row.league?.name||"")===normalize(search));
  const matched=(exact.length?exact:candidates).filter(row=>row.league?.type==="League"||country==="World");
  if(matched.length!==1)return null; // Never silently map an ambiguous catalog name to another competition.
  const seasons=(matched[0].seasons||[]).map((x:any)=>Number(x.year)).filter((y:number)=>y<=2026).sort((a:number,b:number)=>b-a);
  return seasons.length?{id:matched[0].league.id,season:seasons[0]}:null;
 }catch{return null}
}
