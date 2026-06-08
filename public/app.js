$(document).ready(function () {

  // ── INITIALIZATION ────────────────────────────────────────

  // Load stats on page open
  loadStats()

  // ── SEARCH LOGIC ──────────────────────────────────────────

  // search on button click
  $('#search-btn').on('click', function () {
    runSearch()
  })

  // search on enter key too
  $('#search-input').on('keypress', function (e) {
    if (e.key === 'Enter') runSearch()
  })

  // chips fill the input and trigger search
  $('.chip').on('click', function () {
    $('#search-input').val($(this).data('query'))
    runSearch()
  })

  function runSearch() {
    const q = $('#search-input').val().trim()
    if (!q) return

    // show spinner, clear old stuff
    $('#results-section').hide()
    $('#error-msg').hide()
    $('#loader').show()

    $.ajax({
      url: '/search',
      method: 'GET',
      data: { q },
      success: function (data) {
        $('#loader').hide()

        if (data.error) {
          $('#error-msg').text(data.error).show()
          return
        }

        renderResults(data)
      },
      error: function () {
        $('#loader').hide()
        $('#error-msg').text('Could not reach server. Is node running?').show()
      }
    })
  }
  function renderResults(data) {
    $('#results-section').show()
    $('#result-name').text(data.procedure)
    $('#result-cghs').text('CGHS Rate: ₹' + toIndianNum(data.cghs_rate))
    $('#hospital-list').empty()

    // FIX: Ensure hospitals exists and is an array before sorting
    const hospitalArray = Array.isArray(data.hospitals) ? data.hospitals : [];
    
    if (hospitalArray.length === 0) {
      $('#hospital-list').append('<p style="padding:20px; color:#64748b;">No hospital pricing data available for this procedure.</p>');
      $('#insight-box').hide();
      return;
    }

    // sort cheapest first
    const sorted = [...hospitalArray].sort((a, b) => a.price - b.price)

    sorted.forEach(function (h, i) {
      const markup = parseFloat(h.markup) || 1.0 // Fallback to 1.0 if markup is missing
      const pillColor = markup <= 1.5 ? 'green' : markup <= 2.5 ? 'amber' : 'red'
      const pillText = markup === 1.0 ? 'At CGHS Rate' : markup + 'x CGHS'
      const borderColor = h.type === 'Government' ? '#1a7a4a' : markup >= 3 ? '#c0392b' : '#d97706'

      const card = `
        <div class="hospital-card" style="border-left-color: ${borderColor}; animation-delay: ${i * 70}ms">
          <div class="card-name">${h.name}</div>
          <div class="card-meta">${h.type} · ${h.city}</div>
          <div class="card-price">₹${toIndianNum(h.price)}</div> 
          <span class="pill pill-${pillColor}">${pillText}</span>
        </div>
      `
      $('#hospital-list').append(card)
    })

    // Insight logic
    const cheapest = sorted[0]
    const priciest = sorted[sorted.length - 1]
    const saved = toIndianNum(priciest.price - cheapest.price)

    const insight = `
      <b>${data.procedure}</b> (official name: <i>${data.officialName}</i>)<br><br>
      Cheapest option is <b>${cheapest.name}</b> at ₹${toIndianNum(cheapest.price)}.
      Most expensive is <b>${priciest.name}</b> at ₹${toIndianNum(priciest.price)}
      — that's <b>${priciest.markup}× the CGHS rate</b> of ₹${toIndianNum(data.cghs_rate)}.
      You could save roughly <b>₹${saved}</b> by choosing wisely.
    `
    $('#insight-text').html(insight)
    $('#insight-box').show()
  }
  // Clicking the upload area triggers the hidden file input
  $('#upload-area').on('click', function () {
    $('#pdf-input').click()
  })

  // When a file is selected, show filename and enable button
  $('#pdf-input').on('change', function () {
    const file = this.files[0]
    if (!file) return

    $('#upload-placeholder').hide()
    $('#upload-filename').text('Selected: ' + file.name).show()
    $('#upload-area').addClass('has-file')
    $('#upload-btn').prop('disabled', false)
    $('#upload-result').hide()
  })

  $('#upload-btn').on('click', function () {
      const fileInput = $('#pdf-input')[0];
      const file = fileInput.files[0];
      
      if (!file) return;

      // The key 'pdf' MUST match upload.single('pdf') in server.js
      const formData = new FormData();
      formData.append('pdf', file);

      $('#upload-btn').prop('disabled', true).text('Processing...');
      $('#upload-status').html('Gemini is reading the PDF...').show();
      $('#upload-result').hide();

      $.ajax({
        url: '/upload-cghs',
        method: 'POST',
        data: formData,
        contentType: false,   // REQUIRED: Tells jQuery not to set content-type
        processData: false,   // REQUIRED: Tells jQuery not to convert the object
        success: function (data) {
          $('#upload-status').hide();
          $('#upload-btn').text('Upload & Extract').prop('disabled', false);

          $('#upload-result')
            .removeClass('error')
            .html(`
              <b>Success!</b><br>
              Procedures extracted: <b>${data.extracted}</b><br>
              Total in database: <b>${data.totalInDB}</b>
            `)
            .show();

          // Immediately refresh the stats at the top
          loadStats(); 
          
          // Optional: Reset input so you can upload another
          $('#pdf-input').val('');
          $('#upload-filename').hide();
          $('#upload-placeholder').show();
          $('#upload-area').removeClass('has-file');
        },
        error: function (xhr) {
          $('#upload-status').hide();
          $('#upload-btn').text('Upload & Extract').prop('disabled', false);
          const errMsg = xhr.responseJSON ? xhr.responseJSON.error : 'Check Terminal for details';
          $('#upload-result').addClass('error').text('Error: ' + errMsg).show();
        }
      });
  });

  // ── SHARED UTILITIES
  function loadStats() {
    $.get('/stats', function (data) {
      $('#stat-procedures').text(data.totalProcedures)
      $('#stat-hospitals').text(data.totalHospitals)
      $('#stat-markup').text(data.maxMarkup)
    })
  }

  function toIndianNum(n) {
    return Number(n).toLocaleString('en-IN')
  }

})