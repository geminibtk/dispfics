const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const ts = require("typescript");
require.extensions[".ts"] = (mod, file) => mod._compile(ts.transpileModule(fs.readFileSync(file, "utf8"), {compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2019}}).outputText,file);
const {computeAutomaticLineup} = require("../lib/lineupAlgorithm.ts");
const normalize = x => String(x||"").toLocaleUpperCase("tr-TR").replace(/Ğ/g,"G").replace(/İ/g,"I").replace(/Ş/g,"S").replace(/Ü/g,"U").replace(/Ö/g,"O").replace(/Ç/g,"C");
test("Two club matchups normalize shared playing roles",()=>{
 const roles=["KL","STP","STP","SGB","SLB","MDO","MO","MOO","SGO","SLO","SNT"];
 const make=(prefix)=>roles.map((role,i)=>({id:prefix+i,rating:80,positions:[role==="SGB"?"SĞB":role==="SGO"?"SĞO":role]}));
 const a=computeAutomaticLineup(make("A"),roles,0,p=>p.positions.map(normalize));
 const b=computeAutomaticLineup(make("B"),roles,0,p=>p.positions.map(normalize));
 assert.equal(Object.keys(a.selected).length,11);
 assert.equal(Object.keys(b.selected).length,11);
 assert.ok(Object.keys(a.selected).some(s=>s.startsWith("SGB_")));
 assert.ok(Object.keys(b.selected).some(s=>s.startsWith("SGO_")));
 assert.equal(new Set(Object.values(a.selected)).size,11);
 assert.equal(new Set(Object.values(b.selected)).size,11);
});

test("Comparisons stop at the smaller count of shared positions",()=>{const left=["KL","STP","STP","MO"].map((role,i)=>({role,rating:80-i}));const right=["KL","STP","MO","MO"].map((role,i)=>({role,rating:77-i}));const shared=[...new Set(left.map(p=>p.role))].filter(r=>right.some(p=>p.role===r));const paired=shared.flatMap(role=>{const a=left.filter(p=>p.role===role).sort((x,y)=>y.rating-x.rating);const b=right.filter(p=>p.role===role).sort((x,y)=>y.rating-x.rating);return Array.from({length:Math.min(a.length,b.length)},(_,i)=>({role,a:a[i],b:b[i]}))});assert.deepEqual(paired.map(x=>x.role).sort(),["KL","MO","STP"]);assert.equal(paired.length,3)});
