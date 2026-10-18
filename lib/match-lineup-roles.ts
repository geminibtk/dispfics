export function matchLineupRoles<P>(
 own:{starters:{role:string;player:P}[]},
 other:{starters:{role:string;player:P}[]},
 compare:(a:P,b:P)=>number
):{role:string;a:P;b:P}[]{
 const roles=Array.from(new Set(own.starters.map(x=>x.role).filter(role=>other.starters.some(y=>y.role===role)))).sort((a,b)=>a.localeCompare(b,"tr"));
 return roles.flatMap(role=>{
  const left=own.starters.filter(x=>x.role===role).map(x=>x.player).sort(compare);
  const right=other.starters.filter(x=>x.role===role).map(x=>x.player).sort(compare);
  return Array.from({length:Math.min(left.length,right.length)},(_,i)=>({role,a:left[i],b:right[i]}));
 });
}
