export function lineupMainCompare(a:any,b:any,getPositions:(p:any)=>string[]){
  const ar=Number(a.rating||0),br=Number(b.rating||0);
  if(ar!==br)return br-ar;
  const ap=getPositions(a),bp=getPositions(b);
  if(ap.length!==bp.length)return bp.length-ap.length;
  return (ap[0]||"").localeCompare(bp[0]||"","tr");
}

export function orderLineupReserves(
  squad:any[],selected:Record<string,string>,roles:readonly string[],
  getPositions:(p:any)=>string[]
){
  const byId=new Map(squad.map(p=>[String(p.id),p]));
  const occupied=new Set(Object.values(selected).filter(Boolean).map(String));
  const candidates=squad.filter(p=>!occupied.has(String(p.id)))
    .sort((a,b)=>lineupMainCompare(a,b,getPositions));
  const counts:Record<string,number>={};
  const slots=roles.map(role=>({slot:role+"_"+(counts[role]=(counts[role]||0)+1),role}));
  type Chain={slot:string;role:string;members:string[]};
  const chains:Chain[]=slots.map(s=>({...s,members:selected[s.slot]?[String(selected[s.slot])]:[""]}));
  const firstPos=(id:string)=>getPositions(byId.get(id)||{})[0]||"";
  const cmpLow=(a:string,b:string)=>{
    const x=byId.get(a),y=byId.get(b);
    return Number(x?.rating||0)-Number(y?.rating||0)
      ||getPositions(x||{}).length-getPositions(y||{}).length
      ||firstPos(b).localeCompare(firstPos(a),"tr");
  };
  const compatible=(id:string,chain:Chain)=>getPositions(byId.get(id)||{}).includes(chain.role);
  const slotOrder=(chain:Chain)=>slots.findIndex(s=>s.slot===chain.slot);
  const starter=(chain:Chain)=>chain.members[0]||"";
  const chainOrder=(a:Chain,b:Chain)=>cmpLow(starter(a),starter(b))||slotOrder(a)-slotOrder(b);

  // Every layer is filled before moving to the next. Moving an occupant
  // cannot return it to the same chain, and cannot leave gaps in a chain.
  function insert(id:string,depth:number,seen:Set<string>,blocked:Set<string>):boolean{
    const eligible=chains.filter(c=>!blocked.has(c.slot)&&compatible(id,c));
    const free=eligible.filter(c=>c.members.length===depth).sort(chainOrder);
    if(free.length){
      free[0].members.push(id);
      return true;
    }
    const targets=eligible.filter(c=>c.members.length>depth)
      .sort(chainOrder);
    for(const target of targets){
      const displaced=target.members[depth];
      if(!displaced||seen.has(displaced))continue;
      const snapshot=chains.map(c=>[...c.members]);
      target.members.splice(depth,1);
      const nextBlocked=new Set(Array.from(blocked).concat(target.slot));
      if(insert(displaced,depth,new Set(Array.from(seen).concat(displaced)),nextBlocked)){
        target.members.splice(depth,0,id);
        return true;
      }
      chains.forEach((c,i)=>c.members=snapshot[i]);
    }
    return false;
  }
  let pending=[...candidates];
  for(let depth=1;pending.length&&depth<=squad.length;depth++){
    const deferred:any[]=[];
    let placed=0;
    for(const p of pending){
      if(insert(String(p.id),depth,new Set([String(p.id)]),new Set()))placed++;
      else deferred.push(p);
    }
    pending=deferred;
    // Once a whole tier cannot accept anyone, no deeper tier can help.
    if(!placed)break;
  }
  // Display reserves in their established tier, then by original player
  // ranking. Chain movement may change tiers, so derive the final tier.
  const tier=new Map<string,number>();
  chains.forEach(c=>c.members.forEach((id,i)=>{if(i>0)tier.set(id,i)}));
  const rank=new Map(candidates.map((p,i)=>[String(p.id),i]));
  return candidates.filter(p=>tier.has(String(p.id)))
    .sort((a,b)=>(tier.get(String(a.id))||0)-(tier.get(String(b.id))||0)
      ||(rank.get(String(a.id))||0)-(rank.get(String(b.id))||0))
    .concat(candidates.filter(p=>!tier.has(String(p.id))));
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
        if(place(incumbent,target.role,new Set(Array.from(blocked).concat(target.slot)),new Set(Array.from(moving).concat(incumbent)))){
          selected[target.slot]=pid;
          return true;
        }
        selected=snapshot;
      }
    }
    return false;
  }

  for(const p of pool){
    const snapshot={...selected};
    if(!place(String(p.id),null,new Set(),new Set([String(p.id)])))selected=snapshot;
  }

  for(const role of Array.from(relocatedRoles)){
    const same=slots.filter(x=>x.role===role);
    if(same.length<2)continue;
    const ids=same.map(x=>selected[x.slot]).filter(Boolean)
      .sort((a,b)=>mainCmp(byId.get(a),byId.get(b)));
    same.forEach((x,i)=>{if(ids[i])selected[x.slot]=ids[i];else delete selected[x.slot]});
  }
  return {selected,reserves:orderLineupReserves(squad,selected,roles,getPositions)};
}
