// Visual editor for blog posts (TinyMCE, self-hosted open-source edition).
// The textarea carries data-site (site id) and data-key (used for draft recovery).
;(function () {
  var ta = document.getElementById('rich-body')
  if (!ta || !window.tinymce) return
  var sid = ta.getAttribute('data-site')
  var form = ta.form

  function pickFromLibrary(callback) {
    fetch('/sites/' + sid + '/media.json')
      .then(function (r) { return r.json() })
      .then(function (files) {
        var wrap = document.createElement('div')
        wrap.className = 'modal'
        wrap.style.zIndex = 2000
        var box = document.createElement('div')
        wrap.appendChild(box)
        box.innerHTML =
          '<p style="display:flex;gap:10px;align-items:center"><b>Media library</b>' +
          '<input placeholder="Filter…" style="padding:5px 8px;flex:1">' +
          '<button type="button" class="btn ghost small">Close</button></p><div class="media-grid"></div>'
        var grid = box.querySelector('.media-grid')
        function close() { if (wrap.parentNode) document.body.removeChild(wrap) }
        function draw(q) {
          grid.innerHTML = ''
          files
            .filter(function (f) { return f.mime.indexOf('image/') === 0 && f.filename.toLowerCase().indexOf(q) >= 0 })
            .slice(0, 240)
            .forEach(function (f) {
              var fig = document.createElement('figure')
              var src = '/preview/' + sid + '/media/' + f.filename
              fig.innerHTML = '<img loading="lazy" src="' + src + '"><figcaption>' + f.filename + '</figcaption>'
              fig.onclick = function () { callback(src, { alt: '' }); close() }
              grid.appendChild(fig)
            })
        }
        box.querySelector('input').oninput = function (e) { draw(e.target.value.toLowerCase()) }
        box.querySelector('button').onclick = close
        wrap.onclick = function (e) { if (e.target === wrap) close() }
        document.body.appendChild(wrap)
        draw('')
      })
  }

  tinymce.init({
    target: ta,
    license_key: 'gpl',
    base_url: '/_admin/tinymce',
    suffix: '.min',
    promotion: false,
    branding: false,
    menubar: 'edit insert format table',
    plugins:
      'advlist anchor autolink autosave charmap code fullscreen image link lists media quickbars searchreplace table visualblocks wordcount',
    toolbar:
      'undo redo | blocks | bold italic underline | bullist numlist | link image media table | blockquote alignleft aligncenter | removeformat | searchreplace visualblocks code fullscreen | restoredraft',
    toolbar_mode: 'sliding',
    toolbar_sticky: true,
    // No H1: the post title is the page's only H1
    block_formats: 'Paragraph=p; Heading 2=h2; Heading 3=h3; Heading 4=h4; Preformatted=pre',
    min_height: 640,
    height: 760,
    resize: true,
    statusbar: true,
    elementpath: false,
    quickbars_selection_toolbar: 'bold italic | quicklink h2 h3 blockquote',
    quickbars_insert_toolbar: false,
    contextmenu: 'link image table',
    // keep pasted content clean (Google Docs / Word): no inline fonts, colours or sizes
    valid_styles: { '*': 'text-align', img: 'text-align' },
    paste_webkit_styles: 'none',
    paste_remove_styles_if_webkit: true,
    invalid_elements: 'script,style,font',
    // links and images keep site-relative paths
    relative_urls: false,
    remove_script_host: true,
    convert_urls: true,
    link_default_protocol: 'https',
    link_assume_external_targets: 'https',
    link_target_list: false,
    // images: upload from your computer, paste, drag in, or pick from the media library
    image_caption: true,
    image_title: false,
    image_description: true,
    image_dimensions: false,
    automatic_uploads: true,
    paste_data_images: true,
    images_file_types: 'jpeg,jpg,png,gif,webp,avif,svg',
    images_upload_handler: function (blobInfo, progress) {
      return new Promise(function (resolve, reject) {
        var fd = new FormData()
        fd.append('file', blobInfo.blob(), blobInfo.filename())
        var xhr = new XMLHttpRequest()
        xhr.open('POST', '/sites/' + sid + '/media.upload')
        xhr.upload.onprogress = function (e) { progress((e.loaded / e.total) * 100) }
        xhr.onload = function () {
          try {
            var j = JSON.parse(xhr.responseText)
            if (xhr.status === 200 && j.location) resolve(j.location)
            else reject({ message: j.error || 'Upload failed (' + xhr.status + ')', remove: true })
          } catch (e) {
            reject({ message: 'Upload failed: your login may have expired. Refresh the page.', remove: true })
          }
        }
        xhr.onerror = function () { reject({ message: 'Upload failed: network error', remove: true }) }
        xhr.send(fd)
      })
    },
    file_picker_types: 'image',
    file_picker_callback: function (callback) { pickFromLibrary(callback) },
    media_live_embeds: true,
    media_alt_source: false,
    media_poster: false,
    table_default_attributes: {},
    table_default_styles: {},
    table_sizing_mode: 'responsive',
    table_resize_bars: false,
    // recover unsaved work after a crash or closed tab
    autosave_prefix: 'leadgen-' + ta.getAttribute('data-key') + '-',
    autosave_ask_before_unload: true,
    autosave_interval: '20s',
    autosave_retention: '1440m',
    content_style:
      'body{font-family:system-ui,-apple-system,"Segoe UI",sans-serif;font-size:17px;line-height:1.75;color:#1f2330;max-width:780px;margin:24px auto;padding:0 24px}' +
      'h2{font-size:1.6em;margin:1.6em 0 .5em;line-height:1.25}h3{font-size:1.3em;margin:1.4em 0 .4em}h4{font-size:1.1em}' +
      'img{max-width:100%;height:auto;border-radius:6px}figure.image{margin:1.4em 0;display:table}figure.image figcaption{font-size:.9em;color:#6b7280;text-align:center;padding-top:6px}' +
      'blockquote{border-left:4px solid #c7d2fe;margin:1.4em 0;padding:.4em 1.2em;background:#f5f7ff}' +
      'table{border-collapse:collapse;width:100%}td,th{border:1px solid #d1d5db;padding:8px 10px;vertical-align:top}th{background:#f3f4f6}' +
      'iframe{max-width:100%}a{color:#2563eb}',
    setup: function (ed) {
      // Ctrl/Cmd+S saves the post
      ed.addShortcut('meta+s', 'Save', function () {
        ed.save()
        if (form.requestSubmit) form.requestSubmit()
        else form.submit()
      })
    },
  })

  document.addEventListener('keydown', function (e) {
    if ((e.ctrlKey || e.metaKey) && e.key === 's') {
      e.preventDefault()
      if (window.tinymce && tinymce.activeEditor) tinymce.activeEditor.save()
      if (form.requestSubmit) form.requestSubmit()
      else form.submit()
    }
  })
  // the editor's content is already saved; don't warn when the form itself is submitted
  form.addEventListener('submit', function () {
    if (window.tinymce && tinymce.activeEditor) tinymce.activeEditor.setDirty(false)
  })
})()
