$(document).ready(function () {

  $('#nav-search-form').on('submit', function (e) {
    e.preventDefault()
    var q = $('#nav-q').val().trim()
    if (q) window.location = 'results?q=' + encodeURIComponent(q)
  })

  // Categorical colors matching our CSS data-cat gradient fills
  var categoryColors = {
    Surgery:      '#ff5252',
    Diagnostic:   '#00b8d4',
    Therapy:      '#ffb300',
    Consultation: '#00e676',
    Other:        '#a78bfa'
  }

  $('#loader').show()

  var statsLoaded = false
  var hospLoaded  = false
  var statsData   = null
  var hospData    = null

  function tryRender() {
    if (statsLoaded && hospLoaded) {
      $('#loader').hide()
      renderDashboard(statsData, hospData)
      $('#dash-content').show()
      initPostRenderEffects()
    }
  }

  apiGetStats(function (data) {
    statsData   = data
    statsLoaded = true
    tryRender()
  }, function (err) {
    $('#loader').hide()
    $('#error-msg').text('Could not load stats: ' + err).show()
  })

  apiGetHospitals({}, function (data) {
    hospData   = data
    hospLoaded = true
    tryRender()
  }, function () {
    hospData   = []
    hospLoaded = true
    tryRender()
  })


  function renderDashboard(stats, hospitals) {

    // ── Stat cards ──
    var statCardsHtml = `
      <div class="stat-card stat-card-green">
        <div class="stat-value">${stats.totalProcedures}</div>
        <div class="stat-label">Total Procedures</div>
      </div>
      <div class="stat-card stat-card-blue">
        <div class="stat-value">${stats.totalHospitals}</div>
        <div class="stat-label">Hospital Entries</div>
      </div>
      <div class="stat-card stat-card-red">
        <div class="stat-value">${stats.maxMarkup}</div>
        <div class="stat-label">Max Markup</div>
        <div class="stat-sub">${stats.maxMarkupProcedure}</div>
      </div>
      <div class="stat-card stat-card-amber">
        <div class="stat-value">${hospitals.length}</div>
        <div class="stat-label">Unique Hospitals</div>
      </div>
    `
    $('#stats-grid').html(statCardsHtml)

    // ── Category bars (starts at width:0, animated by IntersectionObserver) ──
    var totalProcedures = stats.totalProcedures
    var barsHtml = ''
    stats.byCategory.forEach(function (b) {
      var pct = Math.round((b.count / totalProcedures) * 100)
      barsHtml += `
        <div class="bar-row" onclick="window.location='results?category=${encodeURIComponent(b._id)}'">
          <div class="bar-label">
            <span class="bar-label-name">${b._id}</span>
            <span class="bar-label-count">${b.count}</span>
          </div>
          <div class="bar-track">
            <div class="bar-fill" data-cat="${b._id}" data-pct="${pct}" style="width:0%"></div>
          </div>
        </div>
      `
    })
    $('#category-bars').html(barsHtml)

    // ── Most expensive with gold/silver/bronze rank badges ──
    var medalClass = ['rank-gold', 'rank-silver', 'rank-bronze']
    var expHtml = ''
    stats.mostExpensive.forEach(function (p, i) {
      var cls = medalClass[i] || ''
      expHtml += `
        <div class="rank-row" onclick="window.location='details?id=${p._id}'">
          <span class="rank-num ${cls}">${i + 1}</span>
          <div class="rank-info">
            <div class="rank-name">${p.commonName}</div>
            <div class="rank-cat">${p.category}</div>
          </div>
          <div class="rank-price">₹${toIndianNum(p.cghsRate)}</div>
        </div>
      `
    })
    $('#most-expensive').html(expHtml)

    // ── Avg by category ──
    var avgHtml = ''
    stats.avgByCategory.forEach(function (b) {
      avgHtml += `
        <div class="avg-row">
          <span class="avg-cat">${b._id}</span>
          <span class="avg-val">₹${toIndianNum(Math.round(b.avgRate))}</span>
        </div>
      `
    })
    $('#avg-by-category').html(avgHtml)

    // ── Hospital list ──
    var hospHtml = ''
    hospitals.slice(0, 8).forEach(function (h, i) {
      hospHtml += `
        <div class="hosp-row">
          <span class="rank-num">${i + 1}</span>
          <div class="hosp-info">
            <div class="hosp-name">${h._id}</div>
            <div class="hosp-meta">${h.city} · ${h.type}</div>
          </div>
          <div class="hosp-stats">
            <div>${h.totalProcedures} procedures</div>
            <div class="hosp-avg">Avg ₹${toIndianNum(Math.round(h.avgPrice))}</div>
          </div>
        </div>
      `
    })
    $('#hospital-list').html(hospHtml)
  }


  function initPostRenderEffects() {

    // ── 1. IntersectionObserver: animate bar widths on scroll-into-view ──
    if ('IntersectionObserver' in window) {
      var barObserver = new IntersectionObserver(function (entries, obs) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            var $fill = $(entry.target)
            var pct   = $fill.data('pct') || 0
            // Small delay so the transition property is already active
            setTimeout(function () { $fill.css('width', pct + '%') }, 50)
            obs.unobserve(entry.target)
          }
        })
      }, { threshold: 0.1 })

      $('.bar-fill').each(function () { barObserver.observe(this) })
    } else {
      // Fallback for older browsers
      $('.bar-fill').each(function () {
        $(this).css('width', $(this).data('pct') + '%')
      })
    }

    // ── 2. Cursor-tracking radial glow on stat cards ──
    $('.stat-card').on('mousemove', function (e) {
      var rect = this.getBoundingClientRect()
      var x = ((e.clientX - rect.left) / rect.width  * 100).toFixed(1) + '%'
      var y = ((e.clientY - rect.top)  / rect.height * 100).toFixed(1) + '%'
      this.style.setProperty('--mouse-x', x)
      this.style.setProperty('--mouse-y', y)
    })
  }

})