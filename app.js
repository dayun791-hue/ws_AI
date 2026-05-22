const base={rev:29.61,cost:23.63,ful:96.2,fre:5,dem:12,risk:.55};
let scoreMode=localStorage.getItem("score_mode")||"profit";
const fmt=(n,p=2)=>Number(n).toFixed(p);
function getStoredParams(){return JSON.parse(localStorage.getItem("agent_params")||JSON.stringify(base));}
function metric(label,value,sub=""){return `<div class="metric"><span>${label}</span><b>${value}</b><em>${sub}</em></div>`;}
function gen(p){
  const weights={profit:[.62,.20,.18],service:[.35,.45,.20],risk:[.36,.20,.44]}[scoreMode]||[.62,.20,.18];
  const plans=[
    {n:"A",name:"稳态降本方案",pm:1.00,cm:1.00,fm:1.00,rm:.21,stock:10,path:"海运+常规海外仓"},
    {n:"B",name:"鲁棒履约方案",pm:1.03,cm:.99,fm:1.005,rm:.27,stock:14,path:"中欧班列+安全库存"},
    {n:"C",name:"服务优先方案",pm:.98,cm:1.01,fm:1.002,rm:.33,stock:18,path:"空运兜底+前置仓"}
  ];
  const arr=plans.map(s=>{
    const rev=p.rev*(1-p.dem/100*.15)*s.pm;
    const cost=p.cost*(1+p.fre/100*.2)*s.cm;
    const ful=Math.min(99.9,p.ful-(p.dem*.02)+(2-s.rm)*.4)*s.fm;
    const prof=rev-cost,cr=cost/rev*100,risk=s.rm+(p.fre+p.dem)/500+(1-p.risk)*.08;
    const ok=cr<85&&ful>96;
    const score=prof*weights[0]+(ful-95)*weights[1]+(1-risk)*weights[2]*4+(100-cr)*.025;
    const conf=Math.max(.56,Math.min(.96,.92-Math.abs(p.fre-5)*.005-Math.abs(p.dem-12)*.004-risk*.1));
    return {...s,rev,cost,prof,cr,ful,risk,ok,score,conf};
  });
  arr.sort((a,b)=>(b.ok-a.ok)||(b.score-a.score));
  return arr;
}
function hitRules(p,best){
  const out=[];
  if(p.fre>=8)out.push("运价上行：优先启用鲁棒路径池，降低单一运输方式暴露。");
  if(p.dem>=15)out.push("需求波动放大：上调A/B类SKU安全库存并缩短补货复核周期。");
  if(best.risk>.4)out.push("风险指数偏高：触发风控复核并启用备选承运商。");
  if(out.length===0)out.push("常规稳态：保留备选路径，按周复核库存与履约偏差。");
  return out;
}
function getP(){
  const g=id=>Number(document.getElementById(id).value);
  return {rev:g("rev"),cost:g("cost"),ful:g("ful"),fre:g("fre"),dem:g("dem"),risk:g("risk")};
}
function applyProfile(){
  const regionValue=region.value,categoryValue=category.value,goalValue=goal.value;
  const regionMap={eu:{fre:7,dem:12,risk:.52},na:{fre:5,dem:10,risk:.58},sea:{fre:4,dem:18,risk:.62}};
  const catMap={fast:{ful:96.5,dem:14},season:{ful:96.1,dem:24},longtail:{ful:95.8,dem:9}};
  const goalMap={balanced:.55,profit:.45,service:.70,risk:.25};
  const r=regionMap[regionValue],c=catMap[categoryValue];
  fre.value=r.fre;dem.value=Math.round((r.dem+c.dem)/2);ful.value=c.ful;risk.value=goalMap[goalValue];
  runEval();
}
function resetProfile(){
  rev.value=base.rev;cost.value=base.cost;ful.value=base.ful;fre.value=base.fre;dem.value=base.dem;risk.value=base.risk;
  if(typeof region!=="undefined")region.value="eu";
  if(typeof category!=="undefined")category.value="fast";
  if(typeof goal!=="undefined")goal.value="balanced";
  runEval();
}
function applyScenario(type){
  const map={
    base:{fre:5,dem:12,risk:.55},
    freight:{fre:18,dem:12,risk:.48},
    demand:{fre:7,dem:28,risk:.58},
    risk:{fre:12,dem:22,risk:.25}
  }[type];
  if(!map)return;
  fre.value=map.fre;dem.value=map.dem;risk.value=map.risk;
  runEval();
}
function focusMetric(type){
  document.querySelectorAll(".ops-card").forEach(x=>x.classList.remove("active"));
  const text={
    score:"综合运营评分由履约、成本、库存、风险四类指标加权形成，用于判断当前供应链整体健康程度。",
    ful:"履约健康度反映订单按期交付能力。低于96%时，系统建议提升安全库存或切换更稳定运输路径。",
    cost:"成本控制率对应成本收入比。超过85%会触发降本规则，优先检查加急运输、仓储占用与低效路径。",
    sku:"高风险SKU主要来自缺货概率高、波动大或毛利贡献高的商品，应优先纳入补货复核。",
    wh:"海外仓负载用于识别仓网拥堵。高于85%时，出库效率和尾程时效容易受到影响。"
  }[type];
  if(typeof metricInsight!=="undefined")metricInsight.textContent=text;
  const idx={score:0,ful:1,cost:2,sku:3,wh:4}[type];
  const cards=document.querySelectorAll(".ops-card"); if(cards[idx])cards[idx].classList.add("active");
}
function runEval(){
  const p=getP(),arr=gen(p),best=arr[0];
  localStorage.setItem("agent_params",JSON.stringify(p));
  localStorage.setItem("agent_arr",JSON.stringify(arr));
  if(typeof homeKpi!=="undefined")homeKpi.innerHTML=metric("基线收入",fmt(p.rev)+"亿","报告关键指标")+metric("基线成本",fmt(p.cost)+"亿","成本约束")+metric("履约率",fmt(p.ful)+"%","服务水平")+metric("推荐方案",best.n,best.name);
  if(typeof homeRec!=="undefined")homeRec.innerHTML=`<b>${best.name}</b><p>预计利润 ${fmt(best.prof)} 亿元，成本收入比 ${fmt(best.cr)}%，履约率 ${fmt(best.ful)}%，风险指数 ${fmt(best.risk)}。</p><p>下一步建议：${best.path}，安全库存建议 ${best.stock} 天。</p>`;
  if(typeof opScore!=="undefined"){
    opScore.textContent=fmt(82+best.score*1.8,1);
    opFul.textContent=fmt(best.ful)+"%";
    opCost.textContent=fmt(best.cr)+"%";
    opSku.textContent=Math.max(6,Math.round(8+p.dem*.7+best.risk*8));
    opWh.textContent=(p.dem>20?"92%":"89%");
  }
  if(typeof kpi!=="undefined")kpi.innerHTML=metric("推荐方案",best.n,best.name)+metric("预测利润",fmt(best.prof)+"亿元","较基线自动测算")+metric("成本收入比",fmt(best.cr)+"%","阈值 < 85%")+metric("履约率",fmt(best.ful)+"%","阈值 > 96%")+metric("置信度",fmt(best.conf*100)+"%","场景稳定性");
  if(typeof tbl!=="undefined")tbl.innerHTML="<tr><th>方案</th><th>策略</th><th>利润</th><th>成本收入比</th><th>履约率</th><th>风险</th><th>约束</th><th>综合分</th></tr>"+arr.map(r=>`<tr><td><b>${r.n}</b></td><td>${r.name}</td><td>${fmt(r.prof)}</td><td>${fmt(r.cr)}%</td><td>${fmt(r.ful)}%</td><td>${fmt(r.risk)}</td><td>${r.ok?'<span class="tag ok">达标</span>':'<span class="tag bad">未达标</span>'}</td><td>${fmt(r.score)}</td></tr>`).join("");
  if(typeof rules!=="undefined")rules.innerHTML=hitRules(p,best).map(x=>`<p>• ${x}</p>`).join("");
  if(typeof exp!=="undefined")exp.textContent=`当前推荐${best.n}方案。原因是该方案在成本收入比、履约率和风险指数之间取得更优平衡，可回答“为什么选它”与“如果扰动发生会怎样”。`;
  if(typeof todo!=="undefined")todo.innerHTML=[`T+0：下发${best.name}并锁定${best.path}`,`T+1：复核履约率与缺货率`, `T+3：核对利润、成本收入比和风险偏差`].map(x=>`<li>${x}</li>`).join("");
  saveLog(best);
}
function saveLog(best){
  const logs=JSON.parse(localStorage.getItem("agent_logs")||"[]");
  logs.unshift({time:new Date().toLocaleString(),rec:best.n,prof:fmt(best.prof),cr:fmt(best.cr),ful:fmt(best.ful),risk:fmt(best.risk),note:`执行${best.name}`});
  localStorage.setItem("agent_logs",JSON.stringify(logs.slice(0,12)));
}
function runDiagnose(){
  const g=id=>Number(document.getElementById(id).value);
  const d={oos:g("oos"),slow:g("slow"),delay:g("delay"),wh:g("whuse"),over:g("over")};
  const items=[
    {k:"运输时效",v:d.delay*.38+d.over*.18,why:"平均延迟推高履约波动，并放大加急运输成本。",act:"建立中欧班列/空运兜底路径池"},
    {k:"库存结构",v:d.slow*.22+d.oos*.32,why:"滞销与缺货并存，说明SKU分层与补货节奏不匹配。",act:"A类SKU提高安全库存，C类SKU降采清理"},
    {k:"海外仓负载",v:Math.max(0,d.wh-82)*.22+d.delay*.12,why:"仓库利用率过高会造成出库排队和尾程延迟。",act:"拆分高频SKU至第二仓或前置仓"}
  ].sort((a,b)=>b.v-a.v);
  const top=items[0];
  diagKpi.innerHTML=metric("首要瓶颈",top.k,top.act)+metric("缺货率",fmt(d.oos)+"%","影响履约")+metric("滞销占比",fmt(d.slow)+"%","占用资金")+metric("成本超支",fmt(d.over)+"%","影响利润");
  diagTbl.innerHTML="<tr><th>环节</th><th>影响评分</th><th>根因</th><th>动作</th></tr>"+items.map(x=>`<tr><td>${x.k}</td><td>${fmt(x.v)}</td><td>${x.why}</td><td>${x.act}</td></tr>`).join("");
  problemTree.innerHTML=`<div>履约波动</div><div>├─ ${items[0].k}：${items[0].why}</div><div>├─ ${items[1].k}：${items[1].why}</div><div>└─ ${items[2].k}：${items[2].why}</div>`;
  diagExp.textContent=`诊断结论：当前最需要优先处理${top.k}。该环节对成本和履约的双重影响最大，建议先执行“${top.act}”，再联动库存结构优化。`;
}
function setMode(m){scoreMode=m;localStorage.setItem("score_mode",m);renderCompare();}
function renderCompare(){
  const p=getStoredParams(),arr=gen(p),best=arr[0];
  const map={profit:"利润优先",service:"履约优先",risk:"风险优先"};
  if(typeof modeText!=="undefined")modeText.textContent=`当前：${map[scoreMode]}`;
  cmp.innerHTML="<table><tr><th>方案</th><th>策略说明</th><th>利润</th><th>履约率</th><th>风险</th><th>运输/库存组合</th><th>综合分</th></tr>"+arr.map(r=>`<tr><td><b>${r.n}</b></td><td>${r.name}</td><td>${fmt(r.prof)}</td><td>${fmt(r.ful)}%</td><td>${fmt(r.risk)}</td><td>${r.path} / ${r.stock}天</td><td>${fmt(r.score)}</td></tr>`).join("")+"</table>";
  brief.innerHTML=`<p><b>推荐结论：</b>${best.n}方案（${best.name}）。</p><p><b>执行逻辑：</b>先满足成本收入比与履约率硬约束，再根据${map[scoreMode]}进行排序。</p>`;
  const basePlan=arr.find(x=>x.n==="A")||arr[0];
  counterFact.innerHTML=metric("若不优化利润差",fmt(best.prof-basePlan.prof)+"亿","相对A方案")+metric("履约提升",fmt(best.ful-basePlan.ful)+"pct","相对A方案")+metric("风险变化",fmt(best.risk-basePlan.risk),"相对A方案");
}
function runInventorySim(){
  const safe=Number(safeDays.value),dem=Number(sdem.value),delay=Number(shipDelay.value),fre=Number(sfre.value);
  safeDaysV.textContent=safe;sdemv.textContent=dem;shipDelayV.textContent=delay;sfrev.textContent=fre;
  const service=Math.min(99.5,92+safe*.32-delay*.45-dem*.04);
  const stockCost=.18*safe+.03*dem;
  const shortage=Math.max(.5,12-safe*.35+dem*.08+delay*.45);
  const turnover=Math.max(20,52-safe*.9-dem*.12);
  invKpi.innerHTML=metric("预测履约率",fmt(service)+"%","库存保障")+metric("缺货风险",fmt(shortage)+"%","越低越好")+metric("库存周转",fmt(turnover)+"次/年","资金效率")+metric("库存成本",fmt(stockCost)+"亿元","仿真估计");
  invTbl.innerHTML="<tr><th>策略</th><th>安全库存</th><th>适用条件</th><th>预期效果</th></tr><tr><td>保守补货</td><td>"+(safe+4)+"天</td><td>需求大幅波动</td><td>履约更稳，库存成本上升</td></tr><tr><td>均衡补货</td><td>"+safe+"天</td><td>当前推荐</td><td>成本与服务平衡</td></tr><tr><td>轻库存</td><td>"+Math.max(3,safe-4)+"天</td><td>需求稳定</td><td>周转提升，缺货风险上升</td></tr>";
  simWarn.textContent=service<96?"预警：履约率低于目标，建议增加安全库存或启用更快运输方式。":"当前库存策略满足履约目标，可进入方案对比页核对成本收益。";
}
function askJudge(type){
  const p=getStoredParams(),best=gen(p)[0];
  const ans={
    why:`推荐${best.n}方案，因为它同时满足成本收入比<85%和履约率>96%的硬约束，并在当前权重下综合分最高。答辩时可用利润、履约、风险三项指标支撑。`,
    risk:`若运价继续上涨，系统会触发鲁棒路径规则：减少单一路径依赖，优先切换中欧班列/备选承运商，并提高高频SKU安全库存。`,
    stock:`库存策略通过安全库存天数、需求波动和运输延迟联动计算。若履约率低于96%，系统建议提高A类SKU安全库存并缩短T+1补货复核周期。`,
    closed:`闭环由“诊断-对比-仿真-执行-复盘”构成。每次评估都会记录推荐、指标和动作，执行后用偏差数据反向修正下一轮策略。`
  };
  qaBox.innerHTML=`<p>${ans[type]}</p><p><b>可验证证据：</b>当前推荐${best.n}，利润${fmt(best.prof)}亿元，履约率${fmt(best.ful)}%，风险指数${fmt(best.risk)}。</p>`;
}
function renderReview(){
  const logs=JSON.parse(localStorage.getItem("agent_logs")||"[]");
  const arr=logs.length?logs:[{time:"暂无记录",rec:"-",prof:"-",cr:"-",ful:"-",risk:"-",note:"请先在总览工作台运行一次评估"}];
  rvTbl.innerHTML="<tr><th>时间</th><th>方案</th><th>利润</th><th>成本收入比</th><th>履约率</th><th>风险</th><th>动作</th></tr>"+arr.map(r=>`<tr><td>${r.time}</td><td>${r.rec}</td><td>${r.prof}</td><td>${r.cr}%</td><td>${r.ful}%</td><td>${r.risk}</td><td>${r.note}</td></tr>`).join("");
  rvExp.innerHTML="<p><b>复盘机制：</b>T+1检查履约偏差，T+3检查成本偏差，若任一指标越界则回到库存仿真和方案对比重新求解。</p>";
}
function renderExecute(){
  if(typeof execTbl==="undefined")return;
  const p=getStoredParams(),best=gen(p)[0];
  const rows=[
    ["路径切换",`启用${best.path}`,"物流负责人","T+0","履约率、运输延迟"],
    ["库存调整",`A/B类SKU安全库存调整至${best.stock}天`,"计划负责人","T+1","缺货率、周转率"],
    ["成本复核","检查加急运输与海外仓费用","财务/供应链","T+3","成本收入比"],
    ["风险会签","若风险指数>0.40，启动备选承运商","风控负责人","触发式","风险指数"]
  ];
  execTbl.innerHTML="<tr><th>动作</th><th>执行内容</th><th>责任角色</th><th>时间点</th><th>复核指标</th></tr>"+rows.map(r=>`<tr>${r.map(x=>`<td>${x}</td>`).join("")}</tr>`).join("");
}
if(document.getElementById("rev")){runEval();focusMetric("score");}
