export function matchLineupRoles<P>(
 own:{starters:{role:string;player:P}[]},
 other:{starters:{role:string;player:P}[]},
 compare:(a:P,b:P)=>number
):{role:string;a:P;b:P}[]{
 // The selected team's ranking determines the duel order.
 // Every opposing starter may be picked at most once.
 const ordered=[...own.starters].sort((a,b)=>compare(a.player,b.player));
 const used=new Set<number>();
 const rows:{role:string;a:P;b:P}[]=[];
 for(const starter of ordered){
  const candidates=other.starters
   .map((x,i)=>({...x,i}))
   .filter(x=>x.role===starter.role&&!used.has(x.i))
   .sort((a,b)=>compare(a.player,b.player));
  if(!candidates.length)continue;
  const chosen=candidates[0];
  used.add(chosen.i);
  rows.push({role:starter.role,a:starter.player,b:chosen.player});
 }
 return rows;
}
