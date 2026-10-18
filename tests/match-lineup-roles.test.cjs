const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const ts = require("typescript");
require.extensions[".ts"]=(mod,file)=>mod._compile(ts.transpileModule(fs.readFileSync(file,"utf8"),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2019}}).outputText,file);
const {matchLineupRoles}=require("../lib/match-lineup-roles.ts");
test("Shared positions compare only the strongest eligible players",()=>{
 const own={starters:[{role:"KL",player:{overall:77}},{role:"STP",player:{overall:80}},{role:"STP",player:{overall:90}},{role:"MO",player:{overall:85}}]};
 const other={starters:[{role:"KL",player:{overall:78}},{role:"STP",player:{overall:83}},{role:"SGK",player:{overall:91}}]};
 const rows=matchLineupRoles(own,other,(a,b)=>b.overall-a.overall);
 assert.equal(rows.length,2);
 assert.deepEqual(rows.map(r=>r.role),["KL","STP"]);
 assert.equal(rows.find(r=>r.role==="STP").a.overall,90);
});
