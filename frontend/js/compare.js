$(document).ready(function () {

  var procedures = []   // loaded procedure objects
  var searchTimer = null

  $('#nav-search-form').on('submit', function (e) {
    e.preventDefault()
    var q = $('#nav-q').val().trim()
    if (q) window.location = 'results?q=' + encodeURIComponent(q)
  })

  // load from URL ids if coming from results page
  var idsParam = getParam('ids')

  // Fallback: if no URL ids, try reading the persisted cart from localStorage
  if (!idsParam) {
    var savedCart = JSON.parse(localStorage.getItem('compareCart')) || []
    var parsedIds = savedCart.map(function(item) {
      return typeof item === 'object' && item !== null ? item.id : item;
    }).filter(Boolean);
    if (parsedIds.length >= 2) {
      idsParam = parsedIds.join(',')
    }
  }

  if (idsParam) {
    var ids = idsParam.split(',').filter(Boolean)
    if (ids.length >= 2) {
      $('#loader').show()
      apiCompareProcedures(ids, function (data) {
        $('#loader').hide()
        procedures = data
        renderTable()
      }, function (err) {
        $('#loader').hide()
        $('#error-msg').text('Could not load comparison: ' + err).show()
      })
    }
  } else {
    $('#compare-empty').show()
  }


  // search to add procedures
  $('#compare-search').on('input', function () {
    var val = $(this).val().trim()
    clearTimeout(searchTimer)

    if (val.length < 2) {
      $('#search-dropdown').hide()
      return
    }

    searchTimer = setTimeout(function () {
      apiSearchProcedures({ q: val, limit: 5 }, function (data) {
        var results = data.procedures || []
        if (results.length === 0) { $('#search-dropdown').hide(); return }

        var html = results.map(function (p) {
          return `
            <div class="dropdown-item" data-id="${p._id}">
              <strong>${p.commonName}</strong>
              <span>₹${toIndianNum(p.cghsRate)}</span>
            </div>
          `
        }).join('')

        $('#search-dropdown').html(html).show()
      })
    }, 300)
  })

  $('#search-dropdown').on('click', '.dropdown-item', function () {
    var id = $(this).data('id')
    if (procedures.some(function (p) { return p._id === id })) {
      $('#search-dropdown').hide()
      return
    }
    if (procedures.length >= 3) {
      alert('Maximum 3 procedures')
      return
    }

    apiGetProcedure(id, function (data) {
      procedures.push(data)
      renderTable()
      $('#compare-search').val('')
      $('#search-dropdown').hide()
      $('#compare-search').prop('disabled', procedures.length >= 3)
    })
  })

  // hide dropdown when clicking outside
  $(document).on('click', function (e) {
    if (!$(e.target).closest('.compare-search-wrap').length) {
      $('#search-dropdown').hide()
    }
  })


  function renderTable() {
    if (procedures.length === 0) {
      $('#compare-insights').hide()
      $('#compare-table-wrap').hide()
      $('#compare-empty').show()
      return
    }

    $('#compare-empty').hide()
    $('#compare-search').prop('disabled', procedures.length >= 3)

    // Render dynamic comparative cost charts
    var insightsHtml = '<div class="proc-insights-grid">'
    procedures.forEach(function (p) {
      var prices = p.hospitals.map(function (h) { return h.price }).filter(Boolean)
      var minPrice = prices.length > 0 ? Math.min.apply(null, prices) : p.cghsRate
      var maxPrice = prices.length > 0 ? Math.max.apply(null, prices) : p.cghsRate * 4
      var avgPrice = prices.length > 0 ? (prices.reduce(function(a,b){return a+b}, 0) / prices.length) : p.cghsRate * 2
      var premiumFactor = (avgPrice / p.cghsRate).toFixed(1)

      var badgeClass = 'badge-green'
      if (parseFloat(premiumFactor) > 3.0) {
        badgeClass = 'badge-red'
      } else if (parseFloat(premiumFactor) > 1.5) {
        badgeClass = 'badge-amber'
      }

      var maxLimit = Math.max(maxPrice, p.cghsRate * 2) * 1.1
      var minPct = ((minPrice / maxLimit) * 100).toFixed(1)
      var maxPct = ((maxPrice / maxLimit) * 100).toFixed(1)
      var cghsPct = ((p.cghsRate / maxLimit) * 100).toFixed(1)
      var fillWidth = (maxPct - minPct).toFixed(1)

      insightsHtml += `
        <div class="proc-insight-card fade-up">
          <h3>${p.commonName}</h3>
          <div class="insight-stat-row">
            <div class="insight-metric-wrap">
              <span class="insight-metric-label">Average Private Price</span>
              <span class="insight-metric">₹${toIndianNum(Math.round(avgPrice))}</span>
            </div>
            <span class="insight-premium-badge ${badgeClass}">${premiumFactor}x CGHS</span>
          </div>
          
          <div class="range-bar-wrapper">
            <div class="range-bar-track">
              <div class="range-bar-fill" style="left: ${minPct}%; width: ${fillWidth}%;"></div>
              <div class="cghs-benchmark-tick" style="left: ${cghsPct}%;">
                <span class="cghs-tick-label">CGHS</span>
              </div>
            </div>
            <div class="range-labels">
              <span>Min: ₹${toIndianNum(minPrice)}</span>
              <span>Max: ₹${toIndianNum(maxPrice)}</span>
            </div>
          </div>
        </div>
      `
    })
    insightsHtml += '</div>'
    $('#compare-insights').html(insightsHtml).show()

    // collect all unique hospital names
    var allHospitals = []
    procedures.forEach(function (p) {
      p.hospitals.forEach(function (h) {
        if (!allHospitals.includes(h.name)) allHospitals.push(h.name)
      })
    })

    // Detect best-value: procedure whose avg price is closest to CGHS rate (lowest markup)
    var bestIdx = 0
    var bestRatio = Infinity
    procedures.forEach(function (p, i) {
      var prices  = p.hospitals.map(function (h) { return h.price }).filter(Boolean)
      var avgP    = prices.length > 0 ? prices.reduce(function (a, b) { return a + b }, 0) / prices.length : p.cghsRate
      var ratio   = avgP / p.cghsRate
      if (ratio < bestRatio) { bestRatio = ratio; bestIdx = i }
    })

    // build header row
    var headerCells = '<td class="cg-label"></td>'
    procedures.forEach(function (p, i) {
      var isBest   = (i === bestIdx)
      var bestCls  = isBest ? ' best-value-col' : ''
      var bestBadge = isBest ? '<div class="best-value-badge">★ BEST COMPLIANCE</div>' : ''
      headerCells += `
        <td class="cg-header${bestCls}">
          ${bestBadge}
          <button class="remove-btn" data-id="${p._id}">✕</button>
          <div class="cg-proc-name">${p.commonName}</div>
          <div class="cg-proc-official">${p.officialName}</div>
        </td>
      `
    })

    // static rows
    var rows = ''

    rows += buildRow('CGHS Rate', procedures.map(function (p) {
      return '<span class="cg-green">₹' + toIndianNum(p.cghsRate) + '</span>'
    }))

    rows += buildRow('Category', procedures.map(function (p) {
      return '<span class="pill ' + categoryPillClass(p.category) + '">' + p.category + '</span>'
    }))

    rows += buildRow('Duration', procedures.map(function (p) {
      return p.duration || '—'
    }))

    rows += buildRow('Recovery', procedures.map(function (p) {
      return p.recovery || '—'
    }))

    // section divider
    rows += buildRow('Hospital Prices', [], true)


    // hospital price rows
    allHospitals.forEach(function (hospName) {
      var cells = procedures.map(function (p) {
        var hosp = p.hospitals.find(function (h) { return h.name === hospName })
        if (!hosp) return '<span class="cg-muted">—</span>'
        var markup     = (hosp.price / p.cghsRate).toFixed(1)
        var colorClass = parseFloat(markup) <= 1.5 ? 'cg-green' : parseFloat(markup) >= 3 ? 'cg-red' : 'cg-amber'
        return (
          '<span class="' + colorClass + '">₹' + toIndianNum(hosp.price) + '</span>' +
          '<span class="markup-small">' + markup + 'x</span>' +
          '<br>' + fairValueBadge(parseFloat(markup))
        )
      })
      rows += buildRow(hospName, cells)
    })


    var tableHtml = `
      <div class="compare-grid">
        <div style="text-align: right; margin-bottom: 10px;">
          <button id="clear-compare-btn" class="btn-outline" style="font-size: 0.8rem; padding: 4px 10px;">Clear All</button>
        </div>
        <table class="cg-table">
          <thead><tr>${headerCells}</tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    `

    $('#compare-table-wrap').html(tableHtml).show()

    // remove button
    $('#compare-table-wrap').off('click', '.remove-btn').on('click', '.remove-btn', function () {
      var id = $(this).data('id')
      procedures = procedures.filter(function (p) { return p._id !== id })
      
      // Update localStorage with object cart
      var currentCartObj = procedures.map(function(p) { return { id: p._id, name: p.commonName }; })
      localStorage.setItem('compareCart', JSON.stringify(currentCartObj))
      
      // Update URL without reloading
      var currentCartIds = procedures.map(function(p) { return p._id; })
      if (history.pushState) {
        var newUrl = window.location.protocol + "//" + window.location.host + window.location.pathname
        if (currentCartIds.length > 0) newUrl += '?ids=' + currentCartIds.join(',')
        window.history.pushState({path:newUrl}, '', newUrl)
      }
      
      renderTable()
    })

    // clear all button
    $('#compare-table-wrap').off('click', '#clear-compare-btn').on('click', '#clear-compare-btn', function () {
      procedures = []
      localStorage.removeItem('compareCart')
      if (history.pushState) {
        var newUrl = window.location.protocol + "//" + window.location.host + window.location.pathname
        window.history.pushState({path:newUrl}, '', newUrl)
      }
      renderTable()
    })
  }


  function buildRow(label, cells, isSectionDivider) {
    if (isSectionDivider) {
      return '<tr><td class="cg-section" colspan="' + (procedures.length + 1) + '">' + label + '</td></tr>'
    }
    var tds = cells.map(function (c) { return '<td>' + c + '</td>' }).join('')
    return '<tr><td class="cg-label">' + label + '</td>' + tds + '</tr>'
  }

})