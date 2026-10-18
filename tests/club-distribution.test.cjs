const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const ts=require("typescript");
require.extensions[".ts"]=(m,f)=>m._compile(ts.transpileModule(fs.readFileSync(f,"utf8"),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2019}}).outputText,f);
const {computeAutomaticLineup}=require("../lib/lineupAlgorithm.ts");
const normalize=s=>String(s||"").toLocaleUpperCase("tr-TR").replace(/Ğ/g,"G").replace(/İ/g,"I").replace(/Ş/g,"S").replace(/Ü/g,"U").replace(/Ö/g,"O").replace(/Ç/g,"C");
const roles=["KL","STP","STP","SGB","SLB","MDO","MO","MOO","SGO","SLO","SNT"];
test("Realistic squad distributions yield consistent allocations",()=>{
 const teams=[
 {club:"Chelsea",ratings:[86,86,85,84,84,83,82,81,80,80,80,80,79,79,79,79,79,78,78,78,78],positions:["MDO","MO","MOO","MOO","SĞB","SNT","STP","SĞO","KL","SNT","SĞO","STP","SLB","STP","SĞB","MO","SNT","SNT","SĞB","MDO","KL"]},
 {club:"Spurs",ratings:[85,83,82,82,81,81,81,81,81,80,80,79,79,79,79,79,78,78,78,78,78,77],positions:["MDO","SĞB","MO","STP","STP","SĞO","STP","MO","MOO","MO","SLB","MO","SNT","MDO","SLB","STP","SLO","MO","MO","SNT","SLO","KL"]}
 ];
 for(const team of teams){
  const squad=team.ratings.map((rating,i)=>({id:team.club+i,rating,positions:[normalize(team.positions[i])]}));
  const result=computeAutomaticLineup(squad,roles,11,p=>p.positions);
  const ids=Object.values(result.selected);
  const remaining=result.reserves.map(p=>p.id);
  assert.equal(new Set(ids).size,ids.length);
  assert.equal(new Set(remaining).size,remaining.length);
  assert.equal(ids.length+remaining.length,squad.length);
  assert.ok(ids.every(id=>squad.some(p=>p.id===id)));
 }
});
