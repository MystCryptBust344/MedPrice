$(document).ready(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const id   = urlParams.get('id');
    const city = urlParams.get('city');

    if (!id) { showError('No procedure specified in URL.'); return; }

    loadProcedure(id);

    // Calculator input triggers
    $('#calc-total-cost, #calc-units, #calc-doses-per-day, #calc-days').on('input', calculateDosageCost);

    // City filter
    $('#hosp-city-filter').on('change', function () {
        const sel = $(this).val();
        if (sel === '') {
            $('#hospital-tbody tr').show();
        } else {
            $('#hospital-tbody tr').each(function () {
                $(this).toggle($(this).data('city') === sel);
            });
        }
    });

    // ── SVG Budget Gauge helpers ──────────────────────────────────────────
    // Semi-circular arc: r=54, cx=70, cy=70
    // Full arc circumference = π * r = ~170
    const GAUGE_R   = 54;
    const GAUGE_CX  = 70;
    const GAUGE_CY  = 70;
    const CIRC      = Math.PI * GAUGE_R; // ~169.6

    function buildGaugeSVG() {
        // start angle -180° (left), end angle 0° (right) → top semi-circle
        const startX = GAUGE_CX - GAUGE_R;
        const endX   = GAUGE_CX + GAUGE_R;
        const d = `M ${startX} ${GAUGE_CY} A ${GAUGE_R} ${GAUGE_R} 0 0 1 ${endX} ${GAUGE_CY}`;
        return `
          <svg class="budget-gauge-svg" width="140" height="80" viewBox="0 0 140 80">
            <path class="budget-gauge-track" d="${d}" stroke-width="10"/>
            <path class="budget-gauge-fill"  d="${d}" stroke-width="10"
                  stroke-dasharray="${CIRC}"
                  stroke-dashoffset="${CIRC}"
                  id="gauge-fill-path"/>
          </svg>
        `;
    }

    function updateGauge(totalCost, cghsRate) {
        if (!totalCost || totalCost <= 0) return;

        const ratio  = totalCost / cghsRate;
        // Map ratio 0→3+ to fill 0→100%
        const pct    = Math.min(ratio / 3, 1);
        const offset = CIRC - pct * CIRC;

        $('#gauge-fill-path').css('stroke-dashoffset', offset);
        $('#gauge-total-display').text('₹' + Math.round(totalCost).toLocaleString('en-IN'));

        let status, label;
        if (ratio <= 1) {
            status = 'within-cghs';  label = '✓ Within CGHS Rate';
        } else if (ratio <= 1.5) {
            status = 'market-avg';   label = '~ Market Average';
        } else {
            status = 'high-markup';  label = '⚠ Premium Markup';
        }

        $('#gauge-wrapper').attr('data-budget-status', status);
        $('#gauge-status-label').text(label);
    }

    // ── Main loader ───────────────────────────────────────────────────────
    async function loadProcedure(procId) {
        try {
            $('#loader').show();
            $('#detail-content').hide();

            const res  = await fetch(getApiUrl(`/api/procedures/${procId}`), { credentials: 'include' });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Failed to load details');

            const proc = data.procedure || data;

            $('#bc-current').text(proc.commonName);
            $('#detail-title').text(proc.commonName);
            $('#detail-official').text(`Official Name: ${proc.officialName}`);
            $('#detail-desc').text(proc.description || 'No description available.');

            $('#detail-badges').html(`
                <span class="pill pill-blue" style="margin-right:8px">${proc.category}</span>
                <span class="pill pill-gray">CGHS Rate: ₹${proc.cghsRate.toLocaleString()}</span>
            `);

            $('#detail-meta-grid').html(`
                <div class="meta-item"><span class="meta-val">${proc.duration || 'N/A'}</span><span class="meta-lbl">Duration</span></div>
                <div class="meta-item"><span class="meta-val">${proc.recovery || 'N/A'}</span><span class="meta-lbl">Recovery Time</span></div>
                <div class="meta-item"><span class="meta-val">₹${proc.cghsRate.toLocaleString()}</span><span class="meta-lbl">CGHS Benchmarked Price</span></div>
            `);

            // Build calculator section with SVG gauge
            $('#calc-card').html(`
                <div class="section-label">💊 Cost-per-Dosage Calculator</div>
                <p class="calc-hint">Estimate the total out-of-pocket cost for a full treatment course.</p>
                <div class="calc-form">
                  <div class="calc-row">
                    <label for="calc-total-cost">Total cost of package (₹)</label>
                    <input type="number" id="calc-total-cost" class="calc-input" placeholder="e.g. 2500" min="0"/>
                  </div>
                  <div class="calc-row">
                    <label for="calc-units">Units / tablets in package</label>
                    <input type="number" id="calc-units" class="calc-input" placeholder="e.g. 10" min="1"/>
                  </div>
                  <div class="calc-row">
                    <label for="calc-doses-per-day">Prescribed doses per day</label>
                    <input type="number" id="calc-doses-per-day" class="calc-input" placeholder="e.g. 2" min="1"/>
                  </div>
                  <div class="calc-row">
                    <label for="calc-days">Treatment duration (days)</label>
                    <input type="number" id="calc-days" class="calc-input" placeholder="e.g. 21" min="1"/>
                  </div>
                </div>

                <div id="gauge-wrapper" data-budget-status="within-cghs">
                  <div class="budget-gauge-wrap">
                    ${buildGaugeSVG()}
                    <div class="budget-gauge-total" id="gauge-total-display">—</div>
                    <div class="budget-gauge-label">Estimated Total</div>
                    <div class="budget-gauge-status" id="gauge-status-label">Enter values above</div>
                  </div>
                  <div class="calc-breakdown" id="calc-breakdown">
                    <div class="breakdown-row"><span>Cost per unit</span><strong id="bd-per-unit">—</strong></div>
                    <div class="breakdown-row"><span>Total doses needed</span><strong id="bd-doses">—</strong></div>
                    <div class="breakdown-row"><span>Markup vs CGHS</span><strong id="bd-markup">—</strong></div>
                    <div class="breakdown-total"><span>Estimated Total</span><span class="breakdown-total-value" id="bd-total">—</span></div>
                  </div>
                </div>
            `);

            // Re-bind calculator inputs after rebuild
            $('#calc-total-cost, #calc-units, #calc-doses-per-day, #calc-days').on('input', () => calculateDosageCost(proc.cghsRate));

            $('#calc-total-cost').val(Math.round(proc.cghsRate * 1.5));
            calculateDosageCost(proc.cghsRate);

            renderHospitalComparisonTable(proc.hospitals, proc.cghsRate);

            if (city) $('#hosp-city-filter').val(city).trigger('change');

            renderAIInsights(proc);
            loadSimilarAlternatives(proc.category, proc._id);

            $('#detail-content').fadeIn();

        } catch (err) {
            showError(err.message);
        } finally {
            $('#loader').hide();
        }
    }

    // ── Hospital table with price corridor bars ───────────────────────────
    function renderHospitalComparisonTable(hospitals, cghsRate) {
        const $tbody = $('#hospital-tbody');
        $tbody.empty();

        if (!hospitals || hospitals.length === 0) {
            $tbody.html('<tr><td colspan="9" style="text-align:center;color:var(--text-muted)">No hospital pricing seeded for this procedure.</td></tr>');
            return;
        }

        const sorted = [...hospitals].sort((a, b) => a.price - b.price);
        const prices = sorted.map(h => h.price);
        const minP   = Math.min(...prices);
        const maxP   = Math.max(...prices);

        sorted.forEach((h, index) => {
            const markup = (h.price / cghsRate).toFixed(1);
            const mFloat = parseFloat(markup);

            // Markup badge class
            let badgeCls = 'badge-markup-fair';
            if (mFloat > 3)    badgeCls = 'badge-markup-high';
            else if (mFloat > 1.5) badgeCls = 'badge-markup-mid';
            const badge = `<span class="${badgeCls}">${markup}x CGHS</span>`;

            const stars  = '★'.repeat(h.rating || 3) + '☆'.repeat(5 - (h.rating || 3));
            const coords = h.location?.coordinates || [];
            let mapsLink = '—';
            if (coords.length === 2) {
                const [lng, lat] = coords;
                mapsLink = `<a href="https://www.google.com/maps/search/?api=1&query=${lat},${lng}" target="_blank" class="pill pill-blue" style="text-decoration:none;padding:2px 8px;font-size:0.75rem">🗺️ Map</a>`;
            }

            // Price corridor bar widths
            const range   = maxP - minP || 1;
            const dotPct  = ((h.price - minP) / range * 100).toFixed(1);
            const fillPct = dotPct; // fill from min up to this price

            const corridorHTML = `
              <div class="price-corridor-wrap">
                <div class="price-corridor-track">
                  <div class="price-corridor-fill" style="width:${fillPct}%"></div>
                  <div class="price-corridor-dot"  style="left:${dotPct}%"></div>
                </div>
                <div class="price-corridor-labels">
                  <span>₹${toIndianNum(minP)}</span>
                  <span>₹${toIndianNum(maxP)}</span>
                </div>
              </div>
            `;

            const row = `
                <tr data-city="${h.city}" class="${index === 0 ? 'row-best' : ''}">
                    <td>${index + 1}</td>
                    <td>
                        <strong style="color:var(--text-primary)">${h.name}</strong>
                        <div style="font-size:0.75rem;color:var(--text-muted);margin-top:2px">📞 ${h.contact || 'N/A'}</div>
                    </td>
                    <td><span class="pill pill-${h.type === 'Government' ? 'green' : h.type === 'Trust' ? 'amber' : 'gray'}">${h.type}</span></td>
                    <td>🏙️ ${h.city}</td>
                    <td style="color:#f59e0b">${stars}</td>
                    <td>
                        <span style="font-weight:700;color:var(--text-primary)">₹${h.price.toLocaleString()}</span>
                        ${corridorHTML}
                    </td>
                    <td>${badge}</td>
                    <td style="text-align:center">${mapsLink}</td>
                </tr>
            `;
            $tbody.append(row);
        });
    }

    // ── AI Insights ───────────────────────────────────────────────────────
    function renderAIInsights(proc) {
        if (!proc.hospitals || proc.hospitals.length === 0) { $('#insight-box').hide(); return; }

        const prices = proc.hospitals.map(h => h.price);
        const min    = Math.min(...prices);
        const max    = Math.max(...prices);
        const avg    = Math.round(prices.reduce((s, p) => s + p, 0) / prices.length);
        const diff   = max - min;
        const saving = Math.round((diff / max) * 100);

        $('#insight-box').html(`
            <div style="font-weight:700;color:var(--text-primary);margin-bottom:8px;display:flex;align-items:center;gap:8px">💡 Smart Cost Analysis</div>
            <p style="margin:0;font-size:0.9rem;line-height:1.5;color:var(--text-muted)">
                Average market rate for <strong style="color:var(--text-primary)">${proc.commonName}</strong> is
                <strong style="color:var(--accent-mint)">₹${avg.toLocaleString()}</strong>
                (${(avg / proc.cghsRate).toFixed(1)}× CGHS baseline).
                Range: <strong>₹${min.toLocaleString()}</strong> → <strong>₹${max.toLocaleString()}</strong>.
                By choosing wisely, you could save up to
                <strong style="color:var(--accent-mint)">₹${diff.toLocaleString()} (${saving}%)</strong>.
            </p>
        `).show();
    }

    // ── Similar alternatives ──────────────────────────────────────────────
    async function loadSimilarAlternatives(category, currentId) {
        try {
            const res  = await fetch(getApiUrl(`/api/procedures?category=${category}&limit=5`), { credentials: 'include' });
            const data = await res.json();
            if (!res.ok) return;

            const filtered = data.procedures.filter(p => p._id !== currentId).slice(0, 3);
            if (filtered.length === 0) return;

            const $grid = $('#similar-grid');
            $grid.empty();
            filtered.forEach(p => {
                $grid.append(`
                    <a href="details?id=${p._id}" class="similar-card">
                        <h4 style="margin:0 0 6px;color:var(--text-primary);font-family:var(--font-display)">${p.commonName}</h4>
                        <span style="font-size:0.75rem;color:var(--text-muted)">CGHS Rate: </span>
                        <span style="font-weight:700;color:var(--accent-mint)">₹${p.cghsRate.toLocaleString()}</span>
                    </a>
                `);
            });
            $('#similar-section').show();
        } catch (_) {}
    }

    // ── Calculator with gauge + animated drawer ───────────────────────────
    function calculateDosageCost(cghsRate) {
        const totalCost    = parseFloat($('#calc-total-cost').val()) || 0;
        const units        = parseFloat($('#calc-units').val()) || 1;
        const dosesPerDay  = parseFloat($('#calc-doses-per-day').val()) || 1;
        const days         = parseFloat($('#calc-days').val()) || 1;

        if (totalCost <= 0) {
            $('#calc-breakdown').removeClass('open');
            return;
        }

        const costPerUnit   = totalCost / units;
        const totalDoses    = dosesPerDay * days;
        const grandTotal    = costPerUnit * totalDoses;
        const markupVsCghs  = cghsRate ? (grandTotal / cghsRate).toFixed(2) + '×' : '—';

        // Update gauge
        updateGauge(grandTotal, cghsRate || totalCost);

        // Update breakdown rows
        $('#bd-per-unit').text('₹' + costPerUnit.toFixed(2));
        $('#bd-doses').text(totalDoses);
        $('#bd-markup').text(markupVsCghs);
        $('#bd-total').text('₹' + Math.round(grandTotal).toLocaleString('en-IN'));

        // Animate drawer open
        $('#calc-breakdown').addClass('open');
    }

    function showError(msg) {
        $('#error-msg').text(msg).show();
        $('#loader').hide();
    }
});