$(document).ready(async () => {
    const urlParams = new URLSearchParams(window.location.search);
    const ids = urlParams.get('ids');

    if (!ids) {
        showError('Select at least 2 hospitals to view comparison matrices.');
        return;
    }

    try {
        $('#loader').show();
        $('#compare-matrix-wrapper').hide();

        const res = await fetch(getApiUrl(`/api/hospitals/compare?ids=${encodeURIComponent(ids)}`), {
          credentials: 'include'
        });
        const data = await res.json();

        if (!res.ok) throw new Error(data.error || 'Failed to aggregate comparison data');

        if (data.length < 1) {
            throw new Error('No data found for the selected hospitals.');
        }

        renderComparisonMatrix(data);

    } catch (err) {
        showError(err.message);
    } finally {
        $('#loader').hide();
    }

    function renderComparisonMatrix(hospitals) {
        const $grid = $('#comp-matrix');
        $grid.empty();

        const numHospitals = hospitals.length;
        
        // Dynamically style grid template columns
        $grid.css('grid-template-columns', `200px repeat(${numHospitals}, 1fr)`);

        // Row 1: Hospital Name / Header Card
        $grid.append('<div class="comp-cell header-cell" style="background:#f1f5f9; font-weight:700;">Hospital Info</div>');
        hospitals.forEach(h => {
            const stars = '★'.repeat(h.rating || 3) + '☆'.repeat(5 - (h.rating || 3));
            $grid.append(`
                <div class="comp-cell hosp-header">
                    <span class="hosp-header-title">${h._id}</span>
                    <span class="comp-rating">${stars}</span>
                </div>
            `);
        });

        // Row 2: Location
        $grid.append('<div class="comp-cell header-cell">City Location</div>');
        hospitals.forEach(h => {
            $grid.append(`<div class="comp-cell">🏙️ ${h.city}</div>`);
        });

        // Row 3: Operator Type
        $grid.append('<div class="comp-cell header-cell">Provider Type</div>');
        hospitals.forEach(h => {
            const typeBadge = h.type === 'Government' ? 'pill-green' : h.type === 'Trust' ? 'amber' : 'gray';
            $grid.append(`
                <div class="comp-cell">
                    <span class="pill pill-${h.type === 'Government' ? 'green' : h.type === 'Trust' ? 'amber' : 'gray'}">${h.type}</span>
                </div>
            `);
        });

        // Row 4: Service Scope (Number of items offered)
        $grid.append('<div class="comp-cell header-cell">Seeded Procedures</div>');
        hospitals.forEach(h => {
            $grid.append(`<div class="comp-cell"><strong style="color:#0f172a;">${h.totalProcedures}</strong> items listed</div>`);
        });

        // Row 5: Average price
        $grid.append('<div class="comp-cell header-cell">Average Price</div>');
        hospitals.forEach(h => {
            $grid.append(`<div class="comp-cell comp-highlight">₹${Math.round(h.avgPrice).toLocaleString()}</div>`);
        });

        // Row 6: Minimum Price
        $grid.append('<div class="comp-cell header-cell">Cheapest Item</div>');
        hospitals.forEach(h => {
            $grid.append(`<div class="comp-cell" style="color:#16a34a; font-weight:500;">₹${h.minPrice.toLocaleString()}</div>`);
        });

        // Row 7: Peak Price
        $grid.append('<div class="comp-cell header-cell">Most Expensive Item</div>');
        hospitals.forEach(h => {
            $grid.append(`<div class="comp-cell" style="color:#dc2626; font-weight:500;">₹${h.maxPrice.toLocaleString()}</div>`);
        });

        // Row 8: Action link
        $grid.append('<div class="comp-cell header-cell" style="background:#f8fafc;">Action</div>');
        hospitals.forEach(h => {
            $grid.append(`
                <div class="comp-cell" style="background:#f8fafc;">
                    <a href="results?hospital=${encodeURIComponent(h._id)}" class="btn" style="padding: 6px 12px; font-size: 0.85rem; text-decoration: none;">View Listings →</a>
                </div>
            `);
        });

        $('#compare-matrix-wrapper').fadeIn();
    }

    function showError(msg) {
        $('#error-msg').text(msg).show();
        $('#loader').hide();
    }
});
