export const leagueLogoIds:Record<string,number>={"Premier League":39,"EFL Championship":40,"EFL League One":41,"EFL League Two":42,"Bundesliga":78,"Bundesliga 2":79,"LALIGA EA SPORTS":140,"LALIGA HYPERMOTION":141,"Serie A Enilive":135,"Serie BKT":136,"Ligue 1 McDonald's":61,"Ligue 2 BKT":62,"Eredivisie":88,"Liga Portugal":94,"Trendyol Süper Lig":203,"Scottish Premiership":179,"MLS":253,"ROSHN Saudi League":307,"Liga BBVA MX":262,"Allsvenskan":113,"Ekstraklasa":106,"Eliteserien":103,"Ö. Bundesliga":218,"K League 1":292,"CONMEBOL Libertadores":13,"CONMEBOL Sudamericana":11,"Liga do Brasil":71,"Isuzu UTE A League":188,"Liga Colombia":239,"LPF":128,"Liga Cyprus":318,"Ukrayina Liha":333,"Liga Hrvatska":210,"Liga Bulgaria":172,"Česká Liga":345,"Liga Azerbaijan":419,"SUPERLIGA":283,"1A Pro League":144,"3. Liga":80,"Brack Super League":207,"CSL":169,"Finnliiga":244,"Hellas Liga":197,"ISL":323,"Magyar Liga":271,"SSE Airtricity Men's Premier Division":357,"Thailand League":296,"United Emirates League":301};
export function leagueLogo(name:string):string|null{
 if(name==="Metropolitan Division")return "https://upload.wikimedia.org/wikipedia/commons/3/30/USL_League_Two_icon_logo.svg";
 const id=leagueLogoIds[name];
 return id?"https://media.api-sports.io/football/leagues/"+id+".png":null;
}
export function sortOverviewLeagues<T extends {name:string;rating?:number|null;averageAge?:number|null;averageValue?:number|null}>(items:T[]):T[]{
 return [...items].sort((a,b)=>{
  if(a.name==="Trendyol Süper Lig")return -1;
  if(b.name==="Trendyol Süper Lig")return 1;
  return Number(b.rating??-Infinity)-Number(a.rating??-Infinity)
   ||Number(b.averageAge??-Infinity)-Number(a.averageAge??-Infinity)
   ||Number(b.averageValue??-Infinity)-Number(a.averageValue??-Infinity)
   ||String(a.name).localeCompare(String(b.name),"tr");
 });
}
