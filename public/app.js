const API = "/api";
const $ = (id) => document.getElementById(id);
let state = null, selectedPeg = null, selectedDisk = null, startedAt = null;
let elapsed = 0, timerHandle = null, solving = false, toastHandle = null;

async function request(path, options={}) {
  const response = await fetch(API + path, {headers:{"Content-Type":"application/json"}, ...options});
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "Something went wrong");
  return data;
}
function notify(message) {
  const el=$("toast"); el.textContent=message; el.classList.add("show");
  clearTimeout(toastHandle); toastHandle=setTimeout(()=>el.classList.remove("show"),2400);
}
function formatTime(seconds) { return `${String(Math.floor(seconds/60)).padStart(2,"0")}:${String(seconds%60).padStart(2,"0")}`; }
function startTimer() {
  if (timerHandle || startedAt !== null) return;
  startedAt=Date.now()-elapsed*1000;
  timerHandle=setInterval(()=>{elapsed=Math.floor((Date.now()-startedAt)/1000);$("timer").textContent=formatTime(elapsed)},1000);
}
function stopTimer(){clearInterval(timerHandle);timerHandle=null;startedAt=null}
function render() {
  if(!state)return;
  const colors=["#6bc6c0","#79a9e8","#a88be8","#e6a16e","#e47f9a","#8dc58b","#d4b66d","#8aa6bd"];
  for(const peg of ["a","b","c"]){
    const el=$(`peg-${peg}`);el.innerHTML="";
    const disks=state.pegs[peg];
    disks.forEach((disk)=>{
      const node=document.createElement("button");
      node.className="disk"+(disks[0]===disk?" top-disk":" disabled-disk")+(selectedPeg===peg&&selectedDisk===disk?" selected-disk":"");
      node.style.width=`${Math.max(25, 31 + disk*7)}%`;
      node.style.background=`linear-gradient(180deg,${colors[(disk-1)%colors.length]},${colors[(disk-1)%colors.length]}bb)`;
      node.setAttribute("aria-label",`Disk ${disk}`);
      node.disabled=solving || disks[0]!==disk;
      node.addEventListener("click",()=>pickDisk(peg,disk));
      el.appendChild(node);
    });
    const area=document.querySelector(`[data-peg="${peg}"]`);
    area.classList.toggle("targeted",selectedPeg!==null&&selectedPeg!==peg);
    area.querySelector(".peg-select").classList.toggle("available",selectedPeg!==null&&selectedPeg!==peg);
  }
  $("moves").textContent=state.moves;
  $("minimum").textContent=state.minimum;
  $("best").textContent=state.minimum;
  const pct=Math.min(100,Math.round(state.moves/state.minimum*100));
  $("progressBar").style.width=(state.won?100:pct)+"%";
  $("progressText").textContent=(state.won?100:pct)+"%";
  $("undoBtn").disabled=state.moves===0||solving;
  $("resetBtn").disabled=solving;
  document.querySelectorAll("[data-disks]").forEach(b=>{b.classList.toggle("selected",Number(b.dataset.disks)===state.disks);b.disabled=solving});
  $("solveBtn").disabled=solving||state.won;
  $("hint").innerHTML=selectedPeg?'<span class="hint-dot"></span> Now choose a different tower for your disk.':'<span class="hint-dot"></span> Select a disk, then choose its destination tower.';
  if(state.won) win();
}
function pickDisk(peg,disk){
  if(solving)return;
  if(selectedPeg===peg){selectedPeg=null;selectedDisk=null;render();return}
  selectedPeg=peg;selectedDisk=disk;startTimer();render();
}
async function choosePeg(peg){
  if(solving)return;
  if(!selectedPeg){notify("Pick up a disk first.");return}
  if(selectedPeg===peg){notify("Choose a different tower.");return}
  try{
    state=await request("/move",{method:"POST",body:JSON.stringify({from:selectedPeg,to:peg})});
    selectedPeg=null;selectedDisk=null;startTimer();render();
  }catch(e){notify(e.message)}
}
async function loadNew(n){
  try{
    stopTimer();elapsed=0;$("timer").textContent="00:00";selectedPeg=null;selectedDisk=null;
    state=await request("/new",{method:"POST",body:JSON.stringify({disks:n})});render();
  }catch(e){notify(e.message)}
}
async function undo(){
  try{state=await request("/undo",{method:"POST",body:"{}"});selectedPeg=null;selectedDisk=null;render();if(state.moves===0){stopTimer();elapsed=0;$("timer").textContent="00:00"}}
  catch(e){notify(e.message)}
}
async function reset(){await loadNew(state.disks)}
async function solve(){
  if(solving||state.won)return;
  try{
    const result=await request("/solve");solving=true;selectedPeg=null;selectedDisk=null;render();
    $("solveBtn").textContent="SOLVING…";
    for(const move of result.moves){
      state=await request("/move",{method:"POST",body:JSON.stringify(move)});
      startTimer();render();
      await new Promise(r=>setTimeout(r,Math.max(170,620-state.disks*45)));
    }
    solving=false;$("solveBtn").innerHTML="<span>✦</span> AUTO SOLVE";render();
  }catch(e){solving=false;$("solveBtn").innerHTML="<span>✦</span> AUTO SOLVE";notify(e.message);render()}
}
function win(){
  stopTimer();
  $("finalMoves").textContent=state.moves;
  $("finalTime").textContent=formatTime(elapsed);
  const optimal=state.moves===state.minimum;
  $("winMessage").textContent=optimal?"Perfect run — you solved it in the minimum number of moves.":`You solved the puzzle in ${state.moves} moves. The optimal solution is ${state.minimum}.`;
  $("modal").classList.add("open");
}
async function init(){
  try{
    state=await request("/state");$("connection").textContent="CONNECTED";$("connection").style.color="var(--accent)";render();
  }catch(e){$("connection").textContent="OFFLINE";$("connection").style.color="#ff9c8e";notify("Could not connect. Start the Prolog server first.")}
  document.querySelectorAll("[data-disks]").forEach(b=>b.addEventListener("click",()=>loadNew(Number(b.dataset.disks))));
  document.querySelectorAll("[data-target]").forEach(b=>b.addEventListener("click",()=>choosePeg(b.dataset.target)));
  $("undoBtn").addEventListener("click",undo);$("resetBtn").addEventListener("click",reset);$("solveBtn").addEventListener("click",solve);
  $("helpBtn").addEventListener("click",()=>$("helpModal").classList.add("open"));
  $("closeHelp").addEventListener("click",()=>$("helpModal").classList.remove("open"));
  $("gotIt").addEventListener("click",()=>$("helpModal").classList.remove("open"));
  $("closeModal").addEventListener("click",()=>$("modal").classList.remove("open"));
  $("playAgain").addEventListener("click",()=>{$("modal").classList.remove("open");loadNew(state.disks)});
}
init();
