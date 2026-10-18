const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const ts = require("typescript");
require.extensions[".ts"] = (mod, filename) => {
  const js = ts.transpileModule(fs.readFileSync(filename, "utf8"), {compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2019}}).outputText;
  mod._compile(js, filename);
};
const {getGuestTransfers,saveGuestTransfers,addGuestTransfer,GUEST_TRANSFERS_KEY}=require("../lib/guestTransfers.ts");
function mockStorage(){
 const data=new Map();
 global.localStorage={getItem:key=>data.get(key)||null,setItem:(key,value)=>data.set(key,String(value))};
}
test("Guest transfers add once, persist and delete",()=>{
 mockStorage();
 const player={id:"test123",name:"Fixture Player",club:"Fixture Club",position:"SNT",age:23,overall:78,estimated_value_eur:1000000};
 addGuestTransfer(player);
 assert.equal(getGuestTransfers().length,1);
 addGuestTransfer(player);
 assert.equal(getGuestTransfers().length,1);
 assert.equal(getGuestTransfers()[0].rating,7.8);
 saveGuestTransfers([]);
 assert.deepEqual(getGuestTransfers(),[]);
});
test("Malformed guest transfers do not crash",()=>{
 mockStorage();
 localStorage.setItem(GUEST_TRANSFERS_KEY,"malformed");
 assert.deepEqual(getGuestTransfers(),[]);
});
