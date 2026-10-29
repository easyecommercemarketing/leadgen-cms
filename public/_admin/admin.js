// Confirm before destructive form posts
document.addEventListener('submit', function (e) {
  var m = e.target.getAttribute('data-confirm')
  if (m && !confirm(m)) e.preventDefault()
})
// Status dropdowns in the leads table save on change
document.addEventListener('change', function (e) {
  var f = e.target.form
  if (f && f.hasAttribute('data-autosubmit')) f.submit()
})
// Media picker: fills an input with /media/<file>
document.addEventListener('click', function (e) {
  var btn = e.target.closest('[data-pick-media]')
  if (!btn) return
  e.preventDefault()
  var input = document.querySelector('[name="' + btn.getAttribute('data-target') + '"]')
  var sid = btn.getAttribute('data-pick-media').split('/')[2]
  fetch(btn.getAttribute('data-pick-media')).then(function (r) { return r.json() }).then(function (files) {
    var wrap = document.createElement('div'); wrap.className = 'modal'
    var box = document.createElement('div'); wrap.appendChild(box)
    box.innerHTML = '<p><b>Choose an image</b> <input placeholder="Filter…" style="margin-left:10px;padding:5px 8px"></p><div class="media-grid"></div>'
    var grid = box.querySelector('.media-grid')
    function draw(q) {
      grid.innerHTML = ''
      files.filter(function (f) { return f.mime.indexOf('image/') === 0 && f.filename.indexOf(q) >= 0 }).slice(0, 200).forEach(function (f) {
        var fig = document.createElement('figure')
        fig.innerHTML = '<img loading="lazy" src="/preview/' + sid + '/media/' + f.filename + '"><figcaption>' + f.filename + '</figcaption>'
        fig.onclick = function () { input.value = '/media/' + f.filename; document.body.removeChild(wrap) }
        grid.appendChild(fig)
      })
    }
    box.querySelector('input').oninput = function (ev) { draw(ev.target.value) }
    wrap.onclick = function (ev) { if (ev.target === wrap) document.body.removeChild(wrap) }
    document.body.appendChild(wrap); draw('')
  })
})
// Location picker: filter and bulk select
document.addEventListener('input', function (e) {
  if (!e.target.classList.contains('loc-filter')) return
  var q = e.target.value.toLowerCase(), list = document.getElementById(e.target.getAttribute('data-target'))
  list.querySelectorAll('[data-name]').forEach(function (el) { el.style.display = el.getAttribute('data-name').indexOf(q) >= 0 ? '' : 'none' })
})
document.addEventListener('click', function (e) {
  var all = e.target.getAttribute && (e.target.getAttribute('data-check-all') || e.target.getAttribute('data-check-none'))
  if (!all) return
  var on = e.target.hasAttribute('data-check-all')
  document.getElementById(all).querySelectorAll('[data-name]').forEach(function (el) {
    if (el.style.display !== 'none') el.querySelector('input').checked = on
  })
})
