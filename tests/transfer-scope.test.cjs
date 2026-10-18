const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const ts=require("typescript");
require.extensions[".ts"]=(mod,file)=>mod._compile(ts.transpileModule(fs.readFileSync(file,"utf8"),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2019}}).outputText,file);
const {selectTransferClub,uniqueScoutingMatch}=require("../lib/transfer-scope.ts");
const clubs=[{id:"club-a",name:"Team A"},{id:"club-b",name:"Team B"}];
test("Team context only resolves a membership club",()=>{
 assert.equal(selectTransferClub(clubs,"Team B"),"club-b");
 assert.equal(selectTransferClub(clubs,"Unknown"),"");
 assert.equal(selectTransferClub(clubs,undefined,"club-x"),"");
});
test("Multiple clubs require explicit selection",()=>{
 assert.equal(selectTransferClub(clubs),"");
 assert.equal(selectTransferClub(clubs,undefined,"club-a"),"club-a");
 assert.equal(selectTransferClub([clubs[0]]),"club-a");
});
test("Scouting lookup never selects an ambiguous same-name player",()=>{
 const players=[{id:"one",name:"Player",club:"Team A"},{id:"two",name:"Player",club:"Team B"}];
 assert.equal(uniqueScoutingMatch({name:"Player",current_club:"Team B"},players).id,"two");
 assert.equal(uniqueScoutingMatch({name:"Player",current_club:null},players),undefined);
 assert.equal(uniqueScoutingMatch({name:"Player",current_club:"Unknown"},players),undefined);
});
