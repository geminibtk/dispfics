const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const ts=require("typescript");
require.extensions[".ts"]=(m,f)=>m._compile(ts.transpileModule(fs.readFileSync(f,"utf8"),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2019}}).outputText,f);
const {updateTransferStatus,deleteTransferTarget}=require("../lib/transfer-target-actions.ts");
function fakeDb(error=null){const calls=[];const builder={update(x){calls.push(["update",x]);return this},delete(){calls.push(["delete"]);return this},eq(k,v){calls.push(["eq",k,v]);return this},then(done){return Promise.resolve({error}).then(done)}};return {calls,db:{from(table){calls.push(["from",table]);return builder}}}}
test("Authenticated update always targets the chosen club",async()=>{
 const f=fakeDb();await updateTransferStatus(f.db,"club-1","target-1","contact");
 assert.deepEqual(f.calls,[["from","transfer_targets"],["update",{status:"contact"}],["eq","id","target-1"],["eq","club_id","club-1"]]);
});
test("Authenticated deletion is scoped to club and target",async()=>{
 const f=fakeDb();await deleteTransferTarget(f.db,"club-2","target-2");
 assert.deepEqual(f.calls,[["from","transfer_targets"],["delete"],["eq","id","target-2"],["eq","club_id","club-2"]]);
});
test("Unaffiliated requests and database errors never report success",async()=>{
 const f=fakeDb();await assert.rejects(deleteTransferTarget(f.db,"","target-2"));assert.equal(f.calls.length,0);
 const failed=fakeDb(new Error("Denied"));await assert.rejects(updateTransferStatus(failed.db,"club-1","target-1","offer"),/Denied/);
});
