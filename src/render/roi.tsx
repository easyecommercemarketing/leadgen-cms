import { raw } from 'hono/html'
import type { Block } from '../types'
import type { Ctx } from './blocks'

// Recreates the EEM ROI calculator. Everything runs in the browser; nothing is submitted.
// Formulas match the live page:
//   Total cost = ad spend + COGS + agency fees
//   ROAS = revenue / ad spend            True ROI % = (revenue - total cost) / total cost * 100
//   Net profit = revenue - total cost    Margin % = net profit / revenue * 100
//   Break-even ROAS = total cost / ad spend          CPA = total cost / conversions

const CSS = `
.roi{display:grid;grid-template-columns:1fr 1fr;gap:28px;align-items:start}
.roi .panel{background:#fff;border:1px solid var(--c-border);border-radius:var(--radius);padding:26px}
.roi .row{margin-bottom:14px}.roi label{display:block;font-weight:600;font-size:.88rem;margin-bottom:5px}
.roi input,.roi select{width:100%;padding:11px 13px;border:1px solid #cfd3da;border-radius:6px;font:inherit}
.roi .two{display:grid;grid-template-columns:1fr 1fr;gap:12px}
.roi .seg{display:flex;gap:6px;flex-wrap:wrap}.roi .seg label{font-weight:500;border:1px solid #cfd3da;border-radius:99px;padding:6px 14px;cursor:pointer;margin:0}
.roi .seg input{display:none}.roi .seg input:checked+span{color:var(--c-accent);font-weight:700}
.roi .out{display:grid;grid-template-columns:1fr 1fr;gap:12px}
.roi .stat{background:var(--c-cream);border-radius:8px;padding:14px}
.roi .stat b{display:block;font-size:1.45rem;font-family:var(--f-heading)}.roi .stat span{font-size:.8rem;color:var(--c-muted)}
.roi .verdict{margin-top:14px;padding:14px;border-radius:8px;background:var(--c-dark);color:#fff;font-size:.95rem}
.roi .reset{background:none;border:0;color:var(--c-link);cursor:pointer;padding:0;font:inherit;font-size:.88rem}
@media (max-width:860px){.roi{grid-template-columns:1fr}}
`

const JS = `
(function(){
  var f=document.getElementById('roi');if(!f)return;
  var $=function(n){return f.querySelector('[name="'+n+'"]')};
  var num=function(n){var v=parseFloat(($(n)||{}).value);return isFinite(v)?v:0};
  function feeMode(){var r=f.querySelector('input[name=fee]:checked');return r?r.value:'none'}
  function money(v,c){return (v<0?'-':'')+c+Math.abs(v).toLocaleString('en-GB',{minimumFractionDigits:2,maximumFractionDigits:2})}
  function set(id,v){document.getElementById(id).textContent=v}
  function calc(){
    var c={GBP:'£',USD:'$',EUR:'€'}[$('currency').value]||'£';
    var mode=feeMode();
    f.querySelector('.flat').style.display=(mode==='flat'||mode==='both')?'':'none';
    f.querySelector('.pct').style.display=(mode==='pct'||mode==='both')?'':'none';
    var spend=num('spend'),rev=num('revenue'),cogs=num('cogs'),conv=num('conversions');
    var fees=0;if(mode==='flat'||mode==='both')fees+=num('flat');if(mode==='pct'||mode==='both')fees+=spend*num('pct')/100;
    if(!spend||!rev){['roas','roi','net','margin','be','total','cpa'].forEach(function(k){set('o-'+k,'—')});set('o-verdict','Awaiting inputs: enter your ad spend and revenue.');return}
    var total=spend+cogs+fees,net=rev-total,roas=rev/spend,roi=total?net/total*100:0,margin=rev?net/rev*100:0,be=total/spend;
    set('o-roas',roas.toFixed(2)+'x');set('o-roi',roi.toFixed(1)+'%');set('o-net',money(net,c));set('o-margin',margin.toFixed(1)+'%');
    set('o-be',be.toFixed(2)+'x');set('o-total',money(total,c));set('o-cpa',conv?money(total/conv,c):'Add conversions');
    var v;if(net<0)v='Your campaigns are losing money: ROAS of '+roas.toFixed(2)+'x is below your break-even of '+be.toFixed(2)+'x.';
    else if(roi<20)v='You are profitable, but only just. Small gains in conversion rate or cost per click will move the needle.';
    else if(roi<100)v='Healthy return. There is likely room to scale spend while holding efficiency.';
    else v='Excellent return. You are earning more than double your total costs, so this is worth scaling.';
    set('o-verdict',v);
  }
  f.addEventListener('input',calc);f.addEventListener('change',calc);
  f.querySelector('.reset').addEventListener('click',function(e){e.preventDefault();f.reset();calc()});
  calc();
})();
`

export function RoiCalculator(props: { ctx: Ctx; block: Block }) {
  return (
    <section class="sec">
      <style>{raw(CSS)}</style>
      <div class="wrap">
        <form id="roi" class="roi" onsubmit="return false">
          <div class="panel">
            <div class="row two">
              <div>
                <label for="r-cur">Currency</label>
                <select id="r-cur" name="currency">
                  <option value="GBP">GBP (£)</option>
                  <option value="USD">USD ($)</option>
                  <option value="EUR">EUR (€)</option>
                </select>
              </div>
              <div>
                <label for="r-conv">Number of conversions</label>
                <input id="r-conv" name="conversions" type="number" min="0" step="1" placeholder="Optional" />
              </div>
            </div>
            <div class="row two">
              <div>
                <label for="r-spend">Ad spend *</label>
                <input id="r-spend" name="spend" type="number" min="0" step="0.01" inputmode="decimal" />
              </div>
              <div>
                <label for="r-rev">Revenue generated *</label>
                <input id="r-rev" name="revenue" type="number" min="0" step="0.01" inputmode="decimal" />
              </div>
            </div>
            <div class="row">
              <label for="r-cogs">Cost of goods / fulfilment</label>
              <input id="r-cogs" name="cogs" type="number" min="0" step="0.01" placeholder="Optional" />
            </div>
            <div class="row">
              <label>Include agency / management fees</label>
              <div class="seg">
                <label><input type="radio" name="fee" value="none" checked /><span>None</span></label>
                <label><input type="radio" name="fee" value="flat" /><span>Flat fee</span></label>
                <label><input type="radio" name="fee" value="pct" /><span>% of spend</span></label>
                <label><input type="radio" name="fee" value="both" /><span>Both</span></label>
              </div>
            </div>
            <div class="row two">
              <div class="flat" style="display:none">
                <label for="r-flat">Agency fee (flat, per period)</label>
                <input id="r-flat" name="flat" type="number" min="0" step="0.01" />
              </div>
              <div class="pct" style="display:none">
                <label for="r-pct">Agency fee (% of spend)</label>
                <input id="r-pct" name="pct" type="number" min="0" step="0.1" placeholder="e.g. 15" />
              </div>
            </div>
            <button class="reset">Reset all fields</button>
          </div>
          <div class="panel" aria-live="polite">
            <div class="out">
              <div class="stat"><b id="o-roas">—</b><span>ROAS</span></div>
              <div class="stat"><b id="o-roi">—</b><span>True ROI</span></div>
              <div class="stat"><b id="o-net">—</b><span>Net profit</span></div>
              <div class="stat"><b id="o-margin">—</b><span>Profit margin</span></div>
              <div class="stat"><b id="o-be">—</b><span>Break-even ROAS</span></div>
              <div class="stat"><b id="o-total">—</b><span>Total cost</span></div>
              <div class="stat" style="grid-column:1/-1"><b id="o-cpa">—</b><span>Cost per acquisition</span></div>
            </div>
            <div class="verdict" id="o-verdict">Awaiting inputs.</div>
          </div>
        </form>
      </div>
      <script>{raw(JS)}</script>
    </section>
  )
}
