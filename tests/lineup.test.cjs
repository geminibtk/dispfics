const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const ts = require("typescript");
const Module = require("node:module");
const original = require.extensions[".ts"];
require.extensions[".ts"] = (mod, filename) => {
  const source = fs.readFileSync(filename, "utf8");
  const js = ts.transpileModule(source, {compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2019}}).outputText;
  mod._compile(js, filename);
};
const {computeAutomaticLineup,orderLineupReserves} = require("../lib/lineupAlgorithm.ts");
const recommendation = fs.readFileSync(path.join(__dirname, "../lib/ai-lineup-recommendation.ts"), "utf8");
const matchup = fs.readFileSync(path.join(__dirname, "../app/teams/[team]/PlayerMatchup.tsx"), "utf8");
const parseFormations = source => {
  const segment = source.split("const FORMATIONS=[")[1].split("] as const;")[0];
  return [...segment.matchAll(/\["([0-9-]+)",\[([^\]]+)\]\]/g)].map(m=>({
    name:m[1], roles:[...m[2].matchAll(/"([A-Z]+)"/g)].map(x=>x[1])
  }));
};
const getPositions = p => p.positions;
const ai = parseFormations(recommendation);
const opponent = parseFormations(matchup);
test("Both AI formation catalogs match all 29 variants",()=>{
  assert.equal(ai.length,29);
  assert.deepEqual(opponent,ai);
  for(const formation of ai){
    assert.equal(formation.roles.length,11,formation.name);
    assert.equal(formation.roles.filter(x=>x==="KL").length,1,formation.name);
  }
});
for(const [index,formation] of ai.entries()){
  test("Valid first eleven and reserves for formation "+index+" "+formation.name,()=>{
    const distinct=[...new Set(formation.roles)];
    const players=distinct.flatMap((role,ri)=>Array.from({length:formation.roles.filter(x=>x===role).length+2},(_,j)=>({
      id:role+"-"+j, name:role+" "+j, rating:90-ri-j, positions:[role]
    })));
    const result=computeAutomaticLineup(players,formation.roles,index,getPositions);
    const selected=Object.entries(result.selected);
    assert.equal(selected.length,11,"eleven slots should be occupied");
    assert.equal(new Set(selected.map(([,id])=>id)).size,11,"no duplicated starters");
    const count={};
    for(const [slot,id] of selected){
      const role=slot.split("_")[0];
      assert.ok(players.find(p=>p.id===id)?.positions.includes(role),"starter must support selected role");
      count[role]=(count[role]||0)+1;
    }
    for(const role of distinct)assert.equal(count[role],formation.roles.filter(x=>x===role).length);
    const reserveIds=result.reserves.map(p=>p.id);
    assert.equal(new Set(reserveIds).size,reserveIds.length,"no duplicated reserves");
    assert.ok(reserveIds.every(id=>!selected.some(([,selectedId])=>selectedId===id)),"reserves cannot start");
    assert.equal(selected.length+reserveIds.length,players.length,"all players accounted for");
  });
}
test("Empty squad should not produce selected players or reserves",()=>{
  const result=computeAutomaticLineup([],ai[0].roles,0,getPositions);
  assert.deepEqual(result.selected,{});
  assert.deepEqual(result.reserves,[]);
});
