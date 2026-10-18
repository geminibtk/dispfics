type TransferTable={from:(name:string)=>any};
export async function updateTransferStatus(db:TransferTable,clubId:string,targetId:string,status:string){
 if(!clubId||!targetId||targetId.startsWith("guest-"))throw new Error("Invalid club or target");
 const {error}=await db.from("transfer_targets").update({status}).eq("id",targetId).eq("club_id",clubId);
 if(error)throw error;
}
export async function deleteTransferTarget(db:TransferTable,clubId:string,targetId:string){
 if(!clubId||!targetId||targetId.startsWith("guest-"))throw new Error("Invalid club or target");
 const {error}=await db.from("transfer_targets").delete().eq("id",targetId).eq("club_id",clubId);
 if(error)throw error;
}
