import {createClient} from "@supabase/supabase-js";
export function footballDb(){
 const url=process.env.SUPABASE_URL||process.env.NEXT_PUBLIC_SUPABASE_URL;
 const key=process.env.SUPABASE_SERVICE_ROLE_KEY||process.env.SUPABASE_SECRET_KEY;
 if(!url||!key)throw new Error("Football data unavailable");
 return createClient(url,key,{auth:{persistSession:false}});
}
export const leagueNames:Record<number,string>={203:"Süper Lig",39:"Premier League",140:"La Liga",78:"Bundesliga",135:"Serie A",88:"Eredivisie",61:"Ligue 1",94:"Primeira Liga",40:"Championship",79:"2. Bundesliga",136:"Serie B",253:"MLS",307:"Saudi Pro League",179:"Scottish Premiership",144:"Belgian Pro League"};
export function leagueName(id:number){return leagueNames[id]||"Lig #"+id}
export function dateLabel(v:string){return new Intl.DateTimeFormat("tr-TR",{day:"numeric",month:"short",hour:"2-digit",minute:"2-digit",timeZone:"Europe/Istanbul"}).format(new Date(v))}
