const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const vm=require("node:vm");
const ts=require("typescript");
const source=fs.readFileSync("lib/playerPositionOrder.ts","utf8");
const js=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText;
const exports={};vm.runInNewContext(js,{exports});
const {normalizePlayerPosition,playerPlayablePositions}=exports;
test("Turkish position codes are normalized",()=>{
 assert.equal(normalizePlayerPosition(" SĞO "),"SGO");
 assert.equal(normalizePlayerPosition("SĞB"),"SGB");
 assert.equal(normalizePlayerPosition("SĞK"),"SGK");
});
test("alternate positions are deduplicated after normalization",()=>{
 const values=playerPlayablePositions("SĞO",[{shortLabel:"SGO"},{shortLabel:"MOO"},{shortLabel:"SNT"}]);
 assert.deepEqual(Array.from(values),["SGO","MOO","SNT"]);
});
test("Trabzonspor rating ties prioritize versatility, first role, then name",()=>{
 const players=[
  {name:"Stefan Savić",rating:76,position:"STP",alternate_positions:[]},
  {name:"Arseniy Batagov",rating:76,position:"STP",alternate_positions:[]},
  {name:"Aral Şimşir",rating:76,position:"SLK",alternate_positions:[{shortLabel:"SLO"},{shortLabel:"SNT"},{shortLabel:"MOO"}]},
  {name:"Ruslan Malinovskyi",rating:75,position:"MO",alternate_positions:[{shortLabel:"MOO"}]},
  {name:"Batista Mendy",rating:75,position:"MDO",alternate_positions:[{shortLabel:"MO"}]},
  {name:"Ernest Muçi",rating:75,position:"MOO",alternate_positions:[{shortLabel:"SLO"},{shortLabel:"SĞO"},{shortLabel:"SLK"}]}
 ];
 const pos=p=>playerPlayablePositions(p.position,p.alternate_positions);
 players.sort((a,b)=>b.rating-a.rating||pos(b).length-pos(a).length||pos(a)[0].localeCompare(pos(b)[0],"tr")||a.name.localeCompare(b.name,"tr"));
 assert.deepEqual(players.map(p=>p.name),["Aral Şimşir","Arseniy Batagov","Stefan Savić","Ernest Muçi","Batista Mendy","Ruslan Malinovskyi"]);
});
