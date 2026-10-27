import {createClient} from "@supabase/supabase-js";
export function footballDb(){
 const url=process.env.SUPABASE_URL||process.env.NEXT_PUBLIC_SUPABASE_URL;
 const key=process.env.SUPABASE_SERVICE_ROLE_KEY||process.env.SUPABASE_SECRET_KEY;
 if(!url||!key)throw new Error("Football data unavailable");
 return createClient(url,key,{auth:{persistSession:false}});
}
export const leagueNames:Record<number,string>={2:"UEFA Şampiyonlar Ligi",3:"UEFA Avrupa Ligi",848:"UEFA Konferans Ligi",203:"Trendyol Süper Lig",39:"Premier League",140:"LALIGA EA SPORTS",78:"Bundesliga",135:"Serie A Enilive",88:"Eredivisie",61:"Ligue 1 McDonald’s",94:"Primeira Liga",40:"Championship",79:"2. Bundesliga",136:"Serie B",253:"MLS",307:"Saudi Pro League",179:"Scottish Premiership",144:"Belgian Pro League"};
export function leagueName(id:number){return leagueNames[id]||"Lig #"+id}
export function dateLabel(v:string){return new Intl.DateTimeFormat("tr-TR",{day:"numeric",month:"short",hour:"2-digit",minute:"2-digit",timeZone:"Europe/Istanbul"}).format(new Date(v))}

export const catalogLeagueIds:Record<string,number>={
"UEFA Şampiyonlar Ligi":2,"UEFA Avrupa Ligi":3,"UEFA Konferans Ligi":848,"Trendyol Süper Lig":203,"Premier League":39,"LALIGA EA SPORTS":140,"Serie A Enilive":135,"Bundesliga":78,"Ligue 1 McDonald's":61,"EFL Championship":40,"Bundesliga 2":79,"Eredivisie":88,"Liga Portugal":94,"Serie BKT":136,"MLS":253,"ROSHN Saudi League":307,"Scottish Premiership":179,"1A Pro League":144
};
export const preferredLeagueNames=["Trendyol Süper Lig","UEFA Şampiyonlar Ligi","UEFA Avrupa Ligi","UEFA Konferans Ligi"];
