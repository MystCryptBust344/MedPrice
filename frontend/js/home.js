$(document).ready(function () {

  // navbar search
  $('#nav-search-form').on('submit', function (e) {
    e.preventDefault()
    var q = $('#nav-q').val().trim()
    if (q) window.location = 'results.html?q=' + encodeURIComponent(q)
  })

  // hero search
  $('#hero-search-form').on('submit', function (e) {
    e.preventDefault()
    var q = $('#hero-q').val().trim()
    if (q) window.location = 'results.html?q=' + encodeURIComponent(q)
  })

  // chips
  $('.chip').on('click', function () {
    var q = $(this).data('q')
    window.location = 'results?q=' + encodeURIComponent(q)
  })

  // category cards
  $('.category-card').on('click', function () {
    var cat = $(this).data('cat')
    window.location = 'results?category=' + encodeURIComponent(cat)
  })

  // load stats
  apiGetStats(function (data) {
    $('#stat-procedures').text(data.totalProcedures)
    $('#stat-hospitals').text(data.totalHospitals)
    $('#stat-markup').text(data.maxMarkup)
    $('#stat-markup-proc').text(data.maxMarkupProcedure)
    $('#stats-grid').show()

    // fill category counts
    data.byCategory.forEach(function (b) {
      $('#cat-count-' + b._id).text(b.count + ' procedures')
    })
  })
})