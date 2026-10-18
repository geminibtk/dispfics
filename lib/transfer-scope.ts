export type TransferClub={id:string;name:string};
export function selectTransferClub(clubs:TransferClub[],teamName?:string,chosenClub?:string):string{
 if(teamName)return clubs.find(c=>c.name===teamName)?.id||"";
 if(chosenClub)return clubs.find(c=>c.id===chosenClub)?.id||"";
 return clubs.length===1?clubs[0].id:"";
}
export function uniqueScoutingMatch<T extends {name:string;club:string|null}>(target:{name:string;current_club:string|null},players:T[]):T|undefined{
 const candidates=players.filter(p=>p.name===target.name);
 if(target.current_club){
  const exact=candidates.filter(p=>p.club===target.current_club);
  return exact.length===1?exact[0]:undefined;
 }
 return candidates.length===1?candidates[0]:undefined;
}

export function selectSingleMembershipClub(members:{club_id:string}[]):string{
 const ids=Array.from(new Set(members.map(m=>String(m.club_id)).filter(Boolean)));
 return ids.length===1?ids[0]:"";
}
