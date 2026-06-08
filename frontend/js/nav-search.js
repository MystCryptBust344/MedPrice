$(document).ready(function () {

  // ── Navbar form submit still works as before (go to results?q=...)
  $('#nav-search-form').on('submit', function (e) {
    e.preventDefault()
    var q = $('#nav-q').val().trim()
    if (q) window.location = 'results?q=' + encodeURIComponent(q)
  })

  //  (prevents burst calls)
  var debounceTimer

  $('#nav-q').on('keyup', function (e) {
    if (e.key === 'Enter') return

    clearTimeout(debounceTimer)
    var query = $(this).val().trim()

    // Hide dropdown if query is too short
    if (query.length < 2) {
      $('#nav-autocomplete-dropdown').hide()
      return
    }

    debounceTimer = setTimeout(function () {
      apiAutocomplete(query, function (results) {
        renderDropdown(results)
      })
    }, 300)
  })

  // ── Render dropdown below the nav input
  function renderDropdown(results) {
    var $drop = $('#nav-autocomplete-dropdown')

    if (!results || results.length === 0) {
      $drop.hide()
      return
    }

    var html = results.map(function (p) {
      return (
        '<div class="ac-item" data-id="' + p._id + '">' +
          '<span class="ac-name">' + p.commonName + '</span>' +
          '<span class="ac-meta">' +
            '<span class="ac-cat">' + p.category + '</span>' +
            '<span class="ac-price">₹' + toIndianNum(p.cghsRate) + '</span>' +
          '</span>' +
        '</div>'
      )
    }).join('')

    $drop.html(html).show()
  }
  // ── Click a suggestion → go to details page
  $(document).on('click', '.ac-item', function () {
    var id = $(this).data('id')
    var city = $('#city-select').val() || '';
    var url = 'details?id=' + id;
    if (city) {
      url += '&city=' + encodeURIComponent(city);
    }
    window.location = url;
  })

  // ── Hide dropdown when clicking anywhere outside the nav search
  $(document).on('click', function (e) {
    if (!$(e.target).closest('.nav-search').length) {
      $('#nav-autocomplete-dropdown').hide()
    }
  })

  // ── Hide dropdown when input is cleared
  $('#nav-q').on('input', function () {
    if ($(this).val().trim().length === 0) {
      $('#nav-autocomplete-dropdown').hide()
    }
  })

})
