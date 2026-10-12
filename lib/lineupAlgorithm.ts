export function lineupMainCompare(a:any,b:any,getPositions:(p:any)=>string[]){
  const ar=Number(a.rating||0),br=Number(b.rating||0);
  if(ar!==br)return br-ar;
  const ap=getPositions(a),bp=getPositions(b);
  if(ap.length!==bp.length)return bp.length-ap.length;
  return (ap[0]||"").localeCompare(bp[0]||"","tr");
}

export function computeAutomaticLineup(
  squad:any[],
  roles:readonly string[],
  formationIndex:number,
  getPositions:(p:any)=>string[]
){
  const counts:Record<string,number>={};
  const slots=roles.map(role=>{counts[role]=(counts[role]||0)+1;return {slot:role+"_"+counts[role],role}});
  const sorted=[...squad].sort((a,b)=>Number(b.rating||0)-Number(a.rating||0));
  if(!sorted.length)return {selected:{} as Record<string,string>,reserves:[] as any[]};
  const cutoff=Number(sorted[Math.min(10,sorted.length-1)]?.rating||0);
  const mainCmp=(a:any,b:any)=>lineupMainCompare(a,b,getPositions);
  const dispCmp=(a:any,b:any)=>{
    const ar=Number(a.rating||0),br=Number(b.rating||0);
    if(ar!==br)return ar-br;
    const ap=getPositions(a),bp=getPositions(b);
    if(ap.length!==bp.length)return ap.length-bp.length;
    return (bp[0]||"").localeCompare(ap[0]||"","tr");
  };
  const pool=sorted.filter(p=>Number(p.rating||0)>=cutoff).sort(mainCmp);
  const byId=new Map(pool.map(p=>[String(p.id),p]));
  let selected:Record<string,string>={};
  const relocatedRoles=new Set<string>();
  const oldRule=formationIndex>=0&&formationIndex<16;

  function place(pid:string,currentRole:string|null,blocked:Set<string>,moving:Set<string>):boolean{
    const p=byId.get(pid);if(!p)return false;
    let positions=getPositions(p);
    if(oldRule&&currentRole){
      const at=positions.indexOf(currentRole);
      positions=at>=0?positions.slice(at+1):positions;
    }
    for(const role of positions){
      const targets=slots.filter(x=>x.role===role&&!blocked.has(x.slot));
      const free=targets.find(x=>!selected[x.slot]);
      if(free){
        selected[free.slot]=pid;
        if(currentRole)relocatedRoles.add(role);
        return true;
      }
      const occupied=targets
        .filter(x=>selected[x.slot]&&!moving.has(selected[x.slot]))
        .sort((a,b)=>dispCmp(byId.get(selected[a.slot]),byId.get(selected[b.slot])));
      for(const target of occupied){
        const incumbent=selected[target.slot];
        const snapshot={...selected};
        delete selected[target.slot];
        if(place(incumbent,target.role,new Set([...blocked,target.slot]),new Set([...moving,incumbent]))){
          selected[target.slot]=pid;
          return true;
        }
        selected=snapshot;
      }
    }
    return false;
  }

  const reserves:any[]=[];
  for(const p of pool){
    const snapshot={...selected};
    if(!place(String(p.id),null,new Set(),new Set([String(p.id)]))){
      selected=snapshot;
      reserves.push(p);
    }
  }

  for(const role of relocatedRoles){
    const same=slots.filter(x=>x.role===role);
    if(same.length<2)continue;
    const ids=same.map(x=>selected[x.slot]).filter(Boolean)
      .sort((a,b)=>mainCmp(byId.get(a),byId.get(b)));
    same.forEach((x,i)=>{if(ids[i])selected[x.slot]=ids[i];else delete selected[x.slot]});
  }
  return {selected,reserves};
}
