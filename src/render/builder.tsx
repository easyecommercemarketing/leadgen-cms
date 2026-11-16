import { raw } from 'hono/html'
import type { Block, FormField } from '../types'
import { addonPrice, money, type BuilderConfig } from '../lib/builder'
import { md } from '../lib/markdown'
import type { Ctx } from './blocks'

// "Build your store" configurator: customers pick their options, see a live price and a preview,
// and submit it as a lead. Prices live in the site's settings (forms.<key>.builder) so they can be
// changed in the CMS; the server recalculates the quote when the request comes in.

const CSS = `
.sb-grid{display:grid;grid-template-columns:minmax(0,1fr) 380px;gap:32px;align-items:start}
.sb-step{background:#fff;border:1px solid var(--c-border);border-radius:var(--radius);padding:24px;margin-bottom:18px}
.sb-step h3{display:flex;align-items:center;gap:10px;margin:0 0 4px;font-size:1.15rem}
.sb-step h3 span{display:inline-flex;width:28px;height:28px;border-radius:50%;background:var(--c-accent);color:#fff;align-items:center;justify-content:center;font-size:.85rem;flex:none}
.sb-step .hint{color:var(--c-muted);font-size:.9rem;margin:0 0 14px}.sb-step div.hint p{margin:0}
.sb-two{display:grid;grid-template-columns:1fr 1fr;gap:14px}
.sb label.lbl{display:block;font-size:.88rem;font-weight:600;margin-bottom:5px}
.sb input[type=text],.sb input[type=email],.sb input[type=tel],.sb input[type=url],.sb select,.sb textarea{width:100%;padding:12px 14px;border:1px solid #cfd3da;border-radius:6px;font:inherit;background:#fff}
.sb textarea{min-height:100px;resize:vertical}
.sb-opts{display:grid;gap:12px}
.sb-opts.tiers{grid-template-columns:repeat(auto-fit,minmax(170px,1fr))}
.sb-opts.addons{grid-template-columns:1fr 1fr}
.sb-opt{position:relative;display:block;border:2px solid var(--c-border);border-radius:var(--radius);padding:14px 16px;cursor:pointer;background:#fff;transition:border-color .15s,box-shadow .15s}
.sb-opt:hover{border-color:#c4c8d2}
.sb-opt input{position:absolute;opacity:0;pointer-events:none}
.sb-opt:has(input:checked){border-color:var(--c-accent);box-shadow:0 0 0 3px color-mix(in srgb,var(--c-accent) 15%,transparent)}
.sb-opt:has(input:focus-visible){outline:2px solid var(--c-accent);outline-offset:2px}
.sb-opt b{display:block;font-family:var(--f-heading)}
.sb-opt .price{color:var(--c-accent);font-weight:700;font-family:var(--f-heading);font-size:1.15rem}
.sb-opt .meta{display:block;color:var(--c-muted);font-size:.85rem;margin-top:2px}
.sb-opt .tick{position:absolute;top:10px;right:12px;width:20px;height:20px;border-radius:50%;border:2px solid #cfd3da;display:flex;align-items:center;justify-content:center;font-size:12px;color:#fff}
.sb-opt:has(input:checked) .tick{background:var(--c-accent);border-color:var(--c-accent)}
.sb-opt:has(input:checked) .tick::after{content:'✓'}
.sb-opts.addons .sb-opt{padding-right:40px}
.sb-pal{grid-template-columns:repeat(auto-fit,minmax(130px,1fr))}
.sw{display:flex;height:30px;border-radius:6px;overflow:hidden;margin-bottom:8px;border:1px solid rgba(0,0,0,.08)}
.sw i{flex:1}
.sb-custom{margin-top:12px;display:none}
.sb-custom.on{display:block}
.sb-summary{position:sticky;top:100px}
.sb-card{background:#fff;border:1px solid var(--c-border);border-radius:var(--radius);box-shadow:0 12px 30px rgba(0,0,0,.06);overflow:hidden}
.sb-card .in{padding:20px 22px}
.sb-lines{list-style:none;padding:0;margin:0 0 12px;font-size:.92rem}
.sb-lines li{display:flex;justify-content:space-between;gap:12px;padding:6px 0;border-bottom:1px dashed var(--c-border)}
.sb-total{display:flex;justify-content:space-between;align-items:baseline;margin:6px 0 4px}
.sb-total b{font-size:2rem;font-family:var(--f-heading);color:var(--c-text)}
.sb-note{font-size:.8rem;color:var(--c-muted);margin:0 0 14px}
.sb-badge{display:inline-flex;align-items:center;gap:6px;background:var(--c-cream);border-radius:99px;padding:5px 12px;font-size:.82rem;font-weight:600;margin-bottom:12px}
/* live preview */
.pv{border-bottom:1px solid var(--c-border);background:#f4f5f7;padding:12px}
.pv-win{border-radius:8px;overflow:hidden;box-shadow:0 4px 14px rgba(0,0,0,.12);background:var(--pv-bg,#fff)}
.pv-bar{display:flex;gap:5px;padding:7px 9px;background:#e7e9ee}.pv-bar i{width:8px;height:8px;border-radius:50%;background:#c3c7d0}
.pv-nav{display:flex;justify-content:space-between;align-items:center;padding:9px 12px;background:var(--pv-1,#222);color:#fff;font-size:.78rem;font-weight:700;font-family:var(--f-heading)}
.pv-nav span:last-child{opacity:.8;font-weight:500;font-size:.68rem;letter-spacing:.04em}
.pv-hero{padding:16px 12px 12px;text-align:center}
.pv-hero b{display:block;font-family:var(--f-heading);font-size:.95rem;color:var(--pv-1,#222);margin-bottom:6px}
.pv-hero em{display:inline-block;font-style:normal;background:var(--pv-2,#e33);color:#fff;font-size:.65rem;padding:4px 10px;border-radius:4px;font-weight:700}
.pv-prods{display:grid;grid-template-columns:repeat(3,1fr);gap:7px;padding:0 12px 12px}
.pv-prods i{display:block;aspect-ratio:1;border-radius:5px;background:color-mix(in srgb,var(--pv-1,#222) 12%,#fff)}
.sb-group{margin-top:22px}.sb-group h4{margin:0 0 2px;font-size:1rem}
.sb-opts.groupopts{grid-template-columns:repeat(auto-fit,minmax(96px,1fr))}.sb-opts.groupopts .sb-opt{padding-right:36px}
.sb-incl{list-style:none;padding:0;margin:0 0 12px;font-size:.88rem}
.sb-incl li{padding:3px 0 3px 24px;position:relative}.sb-incl li::before{content:'✓';position:absolute;left:2px;color:var(--c-accent);font-weight:700}
.sb-mobile-total{display:none}
@media (max-width:960px){
  .sb-grid{grid-template-columns:1fr}
  .sb-summary{position:static}
  .sb-mobile-total{display:flex;position:sticky;bottom:0;z-index:40;justify-content:space-between;align-items:center;background:var(--c-text);color:#fff;padding:12px 20px;margin:0 -20px;font-weight:600}
  .sb-mobile-total b{font-size:1.3rem;font-family:var(--f-heading)}
}
@media (max-width:600px){.sb-two,.sb-opts.addons{grid-template-columns:1fr}.sb-step{padding:18px}}
`

function ContactField({ f, formKey }: { f: FormField; formKey: string }) {
  const id = `sb-${formKey}-${f.name}`
  const full = f.width === 'full' || f.type === 'textarea'
  if (f.type === 'checkbox')
    return (
      <label class="chk" style="grid-column:1/-1;display:flex;gap:10px;font-size:.88rem;color:var(--c-muted)">
        <input type="checkbox" name={f.name} value="yes" required={f.required} /> {f.label}
      </label>
    )
  return (
    <div style={full ? 'grid-column:1/-1' : undefined}>
      <label class="lbl" for={id}>
        {f.label}
        {f.required ? <span class="req"> *</span> : null}
      </label>
      {f.type === 'textarea' ? (
        <textarea id={id} name={f.name} required={f.required} placeholder={f.placeholder}></textarea>
      ) : f.type === 'select' ? (
        <select id={id} name={f.name} required={f.required}>
          <option value="">Select…</option>
          {(f.options || []).map((o) => (
            <option>{o}</option>
          ))}
        </select>
      ) : (
        <input id={id} type={f.type} name={f.name} required={f.required} placeholder={f.placeholder} autocomplete={f.type === 'email' ? 'email' : f.type === 'tel' ? 'tel' : undefined} />
      )}
    </div>
  )
}

export function StoreBuilder(props: { ctx: Ctx; block: Block }) {
  const { ctx, block: b } = props
  const key = b.form || 'turnkey'
  const def = ctx.site.settings.forms?.[key]
  const cfg = def?.builder as BuilderConfig | undefined
  if (!def || !cfg?.tiers?.length) return <p>Store builder “{key}” is not set up.</p>
  const def0 = cfg.tiers[Math.min(1, cfg.tiers.length - 1)] // pre-select the middle-ish tier
  const ts = ctx.site.settings.turnstile_sitekey
  const js = `
(function(){
  var cfg=${JSON.stringify(cfg).replace(/</g, '\\u003c')};
  var f=document.getElementById('sb-${key}'); if(!f) return;
  var cur=cfg.currency||'£';
  function money(n){return cur+Math.round(n).toLocaleString('en-GB')}
  function money2(n){var w=Math.abs(n-Math.round(n))<0.005;return cur+n.toLocaleString('en-GB',{minimumFractionDigits:w?0:2,maximumFractionDigits:2})}
  function val(n){var e=f.querySelector('[name="'+n+'"]:checked');return e?e.value:''}
  function tier(){var k=val('tier');for(var i=0;i<cfg.tiers.length;i++)if(cfg.tiers[i].key===k)return cfg.tiers[i];return cfg.tiers[0]}
  function aprice(a,t){return a.per_product?a.per_product*t.products:(a.price||0)}
  function render(){
    var t=tier(), lines=[[t.label+' store',t.price]], total=t.price;
    cfg.addons.forEach(function(a){
      var p=aprice(a,t), el=f.querySelector('[data-addon-price="'+a.key+'"]'); if(el) el.textContent='+'+money(p);
      var box=f.querySelector('input[data-addon="'+a.key+'"]');
      if(box&&box.checked){var g=null;(cfg.groups||[]).forEach(function(x){if(x.key===a.group)g=x});lines.push([(g?g.label+': ':'')+a.label,p]);total+=p}
    });
    var v=cfg.vat, vat=0, vl=f.querySelector('.sb-vat');
    if(v&&v.rate&&v.included){vat=total-total/(1+v.rate/100);vl.textContent='Includes VAT ('+v.rate+'%) of '+money2(vat)}
    else if(v&&v.rate){vat=total*v.rate/100;lines.push(['VAT ('+v.rate+'%)',vat]);total+=vat;vl.textContent=''}
    f.querySelector('.sb-lines').innerHTML=lines.map(function(l){return '<li><span>'+l[0].replace(/[<&]/g,'')+'</span><span>'+money2(l[1])+'</span></li>'}).join('');
    f.querySelectorAll('[data-total]').forEach(function(e){e.textContent=money2(total)});
    f.querySelectorAll('[data-tier-products]').forEach(function(e){e.textContent=t.products});
    // preview
    var name=(f.querySelector('[name=store_name]').value||'Your Store').slice(0,28);
    var ind=f.querySelector('[name=industry]').value; if(ind==='Other') ind=f.querySelector('[name=industry_other]').value;
    var pal=null,pk=val('palette');cfg.palettes.forEach(function(p){if(p.key===pk)pal=p});
    var pv=f.querySelector('.pv-win');
    if(pal){pv.style.setProperty('--pv-1',pal.colors[0]);pv.style.setProperty('--pv-2',pal.colors[1]);pv.style.setProperty('--pv-bg',pal.colors[2]||'#fff')}
    else{var cs=(f.querySelector('[name=custom_colours]').value.match(/#[0-9a-fA-F]{3,6}/g)||[]);pv.style.setProperty('--pv-1',cs[0]||'#222');pv.style.setProperty('--pv-2',cs[1]||cs[0]||'#e33');pv.style.setProperty('--pv-bg',cs[2]||'#fff')}
    f.querySelector('.pv-name').textContent=name;
    f.querySelector('.pv-ind').textContent=ind?(ind+' made simple'):'Shop the collection';
    f.querySelector('.sb-custom').classList.toggle('on',pk==='custom');
    f.querySelector('.sb-ind-other').style.display=f.querySelector('[name=industry]').value==='Other'?'block':'none';
  }
  // keep the customer's choices if they come back from the payment page
  var SK='sb-'+f.id;
  var qs=new URLSearchParams(location.search), e=qs.get('error');
  if(e||qs.get('cancelled')){try{var saved=JSON.parse(sessionStorage.getItem(SK)||'[]');
    f.querySelectorAll('input,select,textarea').forEach(function(el){
      if(!el.name||el.name[0]==='_')return;
      var vals=saved.filter(function(kv){return kv[0]===el.name}).map(function(kv){return kv[1]});
      if(el.type==='radio'||el.type==='checkbox'){if(vals.length||el.type==='checkbox')el.checked=vals.indexOf(el.value)>=0}
      else if(vals.length)el.value=vals[0]})}catch(_){}}
  f.addEventListener('submit',function(){try{var a=[];new FormData(f).forEach(function(v,k){if(k[0]!=='_'&&typeof v==='string')a.push([k,v])});sessionStorage.setItem(SK,JSON.stringify(a))}catch(_){}});
  f.addEventListener('input',render); f.addEventListener('change',render); render();
  var msgs={spam:'Sorry, the spam check failed. Please try again.',payment:"Sorry, we couldn't open the secure payment page. We've saved your details and will be in touch, or you can try again.",missing:'Please fill in all the required fields.'};
  var m=e?(msgs[e]||msgs.missing):qs.get('cancelled')?'Payment cancelled. Your choices are saved below, so you can try again whenever you are ready.':'';
  if(m){var d=f.querySelector('.form-err');d.hidden=false;d.textContent=m;d.scrollIntoView({block:'center'})}
})();`

  return (
    <section class={`sec${b.bg ? ' ' + b.bg : ''}`} id={b.anchor || 'build'}>
      <style>{raw(CSS)}</style>
      <div class="wrap">
        {b.heading ? (
          <div class="center" style="margin-bottom:28px">
            <h2>{b.heading}</h2>
            {b.intro ? <div class="lead">{raw(md(b.intro))}</div> : null}
          </div>
        ) : null}
        <form class="sb" id={`sb-${key}`} method="post" action="/api/lead">
          <input type="hidden" name="_form" value={key} />
          <input type="hidden" name="_page" value={ctx.content?.path || '/'} />
          <div class="hp" aria-hidden="true" style="position:absolute;left:-9999px">
            <input type="text" name="_hp" tabindex={-1} autocomplete="off" />
          </div>
          <div class="form-err" hidden style="background:#fdecef;color:#9b1c31;padding:10px 14px;border-radius:6px;margin-bottom:14px"></div>
          <div class="sb-grid">
            <div>
              <div class="sb-step">
                <h3>
                  <span>1</span>Your store
                </h3>
                <p class="hint">Don't have a name yet? Write "Not sure" and we'll talk it through.</p>
                <div class="sb-two">
                  <div>
                    <label class="lbl" for="sb-name">
                      Store name <span class="req">*</span>
                    </label>
                    <input id="sb-name" type="text" name="store_name" required maxlength={60} placeholder="e.g. Willow & Thread" />
                  </div>
                  <div>
                    <label class="lbl" for="sb-ind">
                      Industry <span class="req">*</span>
                    </label>
                    <select id="sb-ind" name="industry" required>
                      <option value="">Select…</option>
                      {cfg.industries.map((i) => (
                        <option>{i}</option>
                      ))}
                      <option>Other</option>
                    </select>
                    <div class="sb-ind-other" style="display:none;margin-top:8px">
                      <input type="text" name="industry_other" placeholder="Tell us your industry" maxlength={80} />
                    </div>
                  </div>
                </div>
              </div>

              <div class="sb-step">
                <h3>
                  <span>2</span>How many products?
                </h3>
                <div class="hint">{raw(md(b.products_hint || "We'll add your products with their images, prices and descriptions, and set up your collections."))}</div>
                <div class="sb-opts tiers" role="radiogroup">
                  {cfg.tiers.map((t) => (
                    <label class="sb-opt">
                      <input type="radio" name="tier" value={t.key} checked={t.key === def0.key} required />
                      <span class="tick" aria-hidden="true"></span>
                      <b>{t.label}</b>
                      <span class="meta">
                        Up to {t.products} products{t.pages ? ` · ${t.pages} pages` : ''}
                      </span>
                      <span class="price">{money(cfg, t.price)}</span>
                      {t.note ? <span class="meta">{t.note}</span> : null}
                    </label>
                  ))}
                </div>
                {b.more_products ? <p class="hint" style="margin:12px 0 0">{raw(md(b.more_products))}</p> : null}
              </div>

              <div class="sb-step">
                <h3>
                  <span>3</span>Colour scheme
                </h3>
                <div class="hint">{raw(md(b.palette_hint || "Pick a starting palette. We'll fine-tune it to match your logo."))}</div>
                <div class="sb-opts sb-pal" role="radiogroup">
                  {cfg.palettes.map((p, i) => (
                    <label class="sb-opt">
                      <input type="radio" name="palette" value={p.key} checked={i === 0} />
                      <span class="sw" aria-hidden="true">
                        {p.colors.map((c) => (
                          <i style={`background:${c}`}></i>
                        ))}
                      </span>
                      <b style="font-size:.9rem">{p.label}</b>
                    </label>
                  ))}
                  <label class="sb-opt">
                    <input type="radio" name="palette" value="custom" />
                    <span class="sw" aria-hidden="true" style="background:conic-gradient(#e33,#fb0,#3c6,#39f,#a3f,#e33)"></span>
                    <b style="font-size:.9rem">My brand colours</b>
                  </label>
                </div>
                <div class="sb-custom">
                  <label class="lbl" for="sb-cc">Your brand colours</label>
                  <input id="sb-cc" type="text" name="custom_colours" placeholder="e.g. #1F3A5F, #F2A541, or 'navy and mustard'" maxlength={120} />
                </div>
              </div>

              <div class="sb-step">
                <h3>
                  <span>4</span>Extras
                </h3>
                <p class="hint">Optional. Add anything you'd like us to take care of.</p>
                <div class="sb-opts addons">
                  {cfg.addons.filter((a) => !a.group).map((a) => (
                    <label class="sb-opt">
                      <input type="checkbox" name="addons" value={a.key} data-addon={a.key} />
                      <span class="tick" aria-hidden="true"></span>
                      <b>{a.label}</b>
                      {a.desc ? <span class="meta">{a.desc}</span> : null}
                      <span class="price" data-addon-price={a.key}>
                        +{money(cfg, addonPrice(a, def0))}
                      </span>
                    </label>
                  ))}
                </div>
                {(cfg.groups || []).map((g) => (
                  <div class="sb-group">
                    <h4>{g.label}</h4>
                    {g.hint ? <p class="hint">{g.hint}</p> : null}
                    <div class="sb-opts groupopts" role="radiogroup">
                      <label class="sb-opt">
                        <input type="radio" name={`addon_${g.key}`} value="" checked />
                        <span class="tick" aria-hidden="true"></span>
                        <b>{g.none_label || 'No thanks'}</b>
                        <span class="price">Included</span>
                      </label>
                      {cfg.addons.filter((a) => a.group === g.key).map((a) => (
                        <label class="sb-opt">
                          <input type="radio" name={`addon_${g.key}`} value={a.key} data-addon={a.key} />
                          <span class="tick" aria-hidden="true"></span>
                          <b>{a.label}</b>
                          {a.desc ? <span class="meta">{a.desc}</span> : null}
                          <span class="price" data-addon-price={a.key}>
                            +{money(cfg, addonPrice(a, def0))}
                          </span>
                        </label>
                      ))}
                    </div>
                  </div>
                ))}
              </div>

              <div class="sb-step">
                <h3>
                  <span>5</span>Your details
                </h3>
                <div class="sb-two">
                  {def.fields.map((f) => (
                    <ContactField f={f} formKey={key} />
                  ))}
                  {def.consent ? (
                    <label class="chk" style="grid-column:1/-1;display:flex;gap:10px;font-size:.88rem;color:var(--c-muted)">
                      <input type="checkbox" name="_consent" value="yes" /> {def.consent}
                    </label>
                  ) : null}
                </div>
              </div>
            </div>

            <aside class="sb-summary">
              <div class="sb-card">
                <div class="pv" aria-hidden="true">
                  <div class="pv-win">
                    <div class="pv-bar">
                      <i></i>
                      <i></i>
                      <i></i>
                    </div>
                    <div class="pv-nav">
                      <span class="pv-name">Your Store</span>
                      <span>SHOP · ABOUT · CART</span>
                    </div>
                    <div class="pv-hero">
                      <b class="pv-ind">Shop the collection</b>
                      <em>Shop now</em>
                    </div>
                    <div class="pv-prods">
                      <i></i>
                      <i></i>
                      <i></i>
                    </div>
                  </div>
                </div>
                <div class="in">
                  {cfg.turnaround ? <div class="sb-badge">⏱ {cfg.turnaround}</div> : null}
                  {cfg.included?.length ? (
                    <ul class="sb-incl">
                      {cfg.included.map((i) => (
                        <li>{i}</li>
                      ))}
                    </ul>
                  ) : null}
                  <ul class="sb-lines"></ul>
                  <div class="sb-total">
                    <span>Total</span>
                    <b data-total>{money(cfg, def0.price)}</b>
                  </div>
                  <p class="sb-note sb-vat"></p>
                  {cfg.price_note ? <p class="sb-note">{cfg.price_note}</p> : null}
                  {ts ? (
                    <div style="margin-bottom:12px">
                      <div class="cf-turnstile" data-sitekey={ts}></div>
                      <script src="https://challenges.cloudflare.com/turnstile/v0/api.js" async defer></script>
                    </div>
                  ) : null}
                  <button class="btn lg block" type="submit">
                    {def.submit || 'Request My Store'}
                  </button>
                  {b.after_button ? <p class="sb-note" style="margin:12px 0 0">{raw(md(b.after_button))}</p> : null}
                </div>
              </div>
            </aside>
          </div>
          <div class="sb-mobile-total">
            <span>Your store</span>
            <b data-total>{money(cfg, def0.price)}</b>
          </div>
        </form>
      </div>
      <script>{raw(js)}</script>
    </section>
  )
}
