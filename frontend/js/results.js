$(document).ready(() => {
    // View state management
    let currentPage = 1;
    let currentCategory = '';
    let currentSort = '';
    let currentCity = '';

    // Load compare carts with backward-compatible migration to object array
    let rawCompareCart = JSON.parse(localStorage.getItem('compareCart')) || [];
    let selectedForCompare = rawCompareCart.map(item => {
        if (typeof item === 'string') {
            return { id: item, name: 'Procedure' };
        }
        return item;
    });
    let selectedHospitalsForCompare = [];

    // Check URL params
    const urlParams = new URLSearchParams(window.location.search);
    const initialQuery = urlParams.get('q') || '';
    const initialCategory = urlParams.get('category') || '';
    const initialHospital = urlParams.get('hospital') || '';
    const initialCity = urlParams.get('city') || '';

    if (initialQuery)    $('#search-input').val(initialQuery);
    if (initialCategory) {
        currentCategory = initialCategory;
        $(`.filter-chip[data-cat="${initialCategory}"]`).addClass('active')
            .siblings().removeClass('active');
    }
    if (initialCity) {
        currentCity = initialCity;
        $('#city-select').val(initialCity);
    }

    // Fill breadcrumb
    updateBreadcrumb(initialQuery, initialCategory, initialHospital);

    // Trigger initial fetch
    fetchProcedures();
    updateCompareBar();

    // Event listeners

    // City Dropdown Selector change event
    $('#city-select').on('change', function() {
        currentCity = $(this).val();
        currentPage = 1;

        // Reset Geolocation state (State Sync!)
        resetGPSState();

        // If we are currently in nearby hospital section, go back to procedures grid
        if ($('#hospital-nearby-section').is(':visible')) {
            $('#hospital-nearby-section').hide();
        }

        fetchProcedures();
    });

    // Refine search input
    $('#search-input').on('input', debounce(() => {
        currentPage = 1;
        fetchProcedures();
    }, 500));

    // Category chips
    $('.filter-chip').on('click', function() {
        $('.filter-chip').removeClass('active');
        $(this).addClass('active');
        currentCategory = $(this).data('cat');
        currentPage = 1;
        fetchProcedures();
    });

    // Sort dropdown
    $('#sort-select').on('change', function() {
        currentSort = $(this).val();
        currentPage = 1;
        fetchProcedures();
    });

    // Next page
    $('#next-btn').on('click', () => {
        currentPage++;
        fetchProcedures();
        window.scrollTo(0, 0);
    });

    // Prev page
    $('#prev-btn').on('click', () => {
        if (currentPage > 1) {
            currentPage--;
            fetchProcedures();
            window.scrollTo(0, 0);
        }
    });

    function resetGPSState() {
        $('#near-me-btn').text('📍 Near Me').prop('disabled', false).removeClass('btn-active');
        $('#geo-status').text('').hide();
    }

    // Near Me click with graceful degradation
    $('#near-me-btn').on('click', function () {
        var $btn    = $(this);
        var $status = $('#geo-status');

        if (!navigator.geolocation) {
            $status.text('Geolocation not supported by your browser').show();
            return;
        }

        $btn.text('📍 Locating…').prop('disabled', true).addClass('btn-active');
        $status.text('Getting your location…').show();

        navigator.geolocation.getCurrentPosition(
            function (pos) {
                var lat = pos.coords.latitude;
                var lng = pos.coords.longitude;
                $status.text('Searching hospitals within 50 km…');

                $.ajax({
                    url:    getApiUrl('/api/hospitals/nearby'),
                    method: 'GET',
                    data:   { lat: lat, lng: lng, radius: 50 },
                    xhrFields: { withCredentials: true },
                    success: function (res) {
                        $btn.text('📍 Near Me').prop('disabled', false);

                        // Check if fallback response (degraded / no hospitals within 50km)
                        if (res.fallback) {
                            $status.html('⚠️ No hospitals found near you. Showing results for <strong>' + res.detectedCity + '</strong>.');
                            
                            // Synchronize UI dropdown state (State Sync!)
                            currentCity = res.detectedCity;
                            $('#city-select').val(res.detectedCity);
                            
                            // Load standard cards for that city
                            currentPage = 1;
                            $('#hospital-nearby-section').hide();
                            fetchProcedures();
                            return;
                        }

                        if (!res || res.length === 0) {
                            $status.text('No hospitals found near you.');
                            return;
                        }

                        $status.text(res.length + ' hospitals found near you');

                        // Show hospital section
                        $('#proc-grid, #pagination, #empty-msg, #loader').hide();
                        $('#hospital-nearby-grid').html(renderHospitalCards(res));
                        $('#nearby-subtitle').text(res.length + ' hospitals within 50 km — sorted by distance');
                        $('#hospital-nearby-section').show();
                        
                        attachHospitalCompareListeners();
                        updateHospitalCompareBar();
                        window.scrollTo(0, 0);
                    },
                    error: function () {
                        $btn.text('📍 Near Me').prop('disabled', false);
                        $status.text('Could not load nearby hospitals.');
                    }
                });
            },
            function () {
                $btn.text('📍 Near Me').prop('disabled', false);
                $status.text('Location access denied. Please allow in browser settings.');
            },
            { timeout: 8000 }
        );
    });

    // Back button click
    $(document).on('click', '#nearby-back-btn', function () {
        $('#hospital-nearby-section').hide();
        resetGPSState();
        fetchProcedures();
    });

    // Render hospital cards with comparison checkboxes
    function renderHospitalCards(hospitals) {
        var typeBadge = { Government: 'pill-green', Private: 'pill-blue', Trust: 'pill-amber' };

        return hospitals.map(function (h) {
            var stars = '★'.repeat(h.rating || 3) + '☆'.repeat(5 - (h.rating || 3));
            var distLabel = h.distanceKm < 1
                ? (h.distanceKm * 1000).toFixed(0) + ' m away'
                : h.distanceKm + ' km away';

            var isChecked = selectedHospitalsForCompare.includes(h._id) ? 'checked' : '';

            return (
                '<div class="hosp-nearby-card" style="border-left: 4px solid ' + (h.type === 'Government' ? '#22c55e' : h.type === 'Trust' ? '#f59e0b' : '#3b82f6') + '">' +
                  '<div class="hnc-top">' +
                    '<div class="hnc-name">' + h._id + '</div>' +
                    '<div style="display: flex; gap: 8px; align-items: center;">' +
                      '<span class="pill ' + (typeBadge[h.type] || 'pill-gray') + '">' + h.type + '</span>' +
                      '<input type="checkbox" class="hosp-compare-check" data-name="' + h._id + '" ' + isChecked + ' title="Select for comparison">' +
                    '</div>' +
                  '</div>' +
                  '<div class="hnc-meta">' +
                    '<span class="hnc-dist">📍 ' + distLabel + '</span>' +
                    '<span class="hnc-stars">' + stars + '</span>' +
                    '<span class="hnc-city">🏙 ' + h.city + '</span>' +
                  '</div>' +
                  '<div class="hnc-stats">' +
                    '<div class="hnc-stat"><span class="hnc-stat-val">' + h.totalProcedures + '</span><span class="hnc-stat-label">Procedures</span></div>' +
                    '<div class="hnc-stat"><span class="hnc-stat-val">₹' + toIndianNum(h.minPrice) + '</span><span class="hnc-stat-label">From</span></div>' +
                    '<div class="hnc-stat"><span class="hnc-stat-val">₹' + toIndianNum(h.maxPrice) + '</span><span class="hnc-stat-label">Up to</span></div>' +
                  '</div>' +
                  '<a href="results?hospital=' + encodeURIComponent(h._id) + '" class="hnc-view-btn">View All Procedures →</a>' +
                '</div>'
            );
        }).join('');
    }

    async function fetchProcedures() {
        const query = $('#search-input').val();
        
        // Show loader
        $('#loader').show();
        $('#proc-grid, #empty-msg, #error-msg, #pagination').hide();

        try {
            const params = new URLSearchParams({
                q: query,
                category: currentCategory,
                sort: currentSort,
                city: currentCity,
                page: currentPage,
                limit: 12
            });
            if (initialHospital) {
                params.append('hospital', initialHospital);
            }

            const response = await fetch(getApiUrl(`/api/procedures?${params.toString()}`), { credentials: 'include' });
            const data = await response.json();

            if (!response.ok) throw new Error(data.error || 'Failed to fetch data');

            renderCards(data.procedures);
            updatePagination(data.total, data.page);
            $('#results-meta').text(`Found ${data.total} procedures`);

        } catch (err) {
            $('#error-msg').text(err.message).show();
        } finally {
            $('#loader').hide();
        }
    }

    function renderCards(procedures) {
        const $grid = $('#proc-grid');
        $grid.empty();

        if (procedures.length === 0) {
            $('#empty-msg').show();
            return;
        }

        procedures.forEach(proc => {
            const isChecked = selectedForCompare.some(item => item.id === proc._id) ? 'checked' : '';
            
            let priceSection = '';
            if (proc.hospitalPrice) {
                const badge = fairValueBadge(proc.markup);
                priceSection = `
                    <div class="price-row" style="margin-bottom: 4px;">
                        <span class="price-label">Hospital Price</span>
                        <span class="price-value" style="font-size: 1.15rem; color: #0f172a;">₹${proc.hospitalPrice.toLocaleString()}</span>
                    </div>
                    <div style="display: flex; justify-content: space-between; font-size: 0.8rem; color: #64748b; margin-bottom: 12px;">
                        <span>CGHS Baseline: ₹${proc.cghsRate.toLocaleString()}</span>
                        <span>${badge}</span>
                    </div>
                `;
            } else {
                priceSection = `
                    <div class="price-row">
                        <span class="price-label">CGHS Rate</span>
                        <span class="price-value">₹${proc.cghsRate.toLocaleString()}</span>
                    </div>
                `;
            }

            const cityParam = currentCity ? `&city=${encodeURIComponent(currentCity)}` : '';
            
            const card = `
                <div class="proc-card">
                    <div class="proc-card-header">
                        <span class="category-badge">${proc.category}</span>
                        <input type="checkbox" class="compare-check" data-id="${proc._id}" data-name="${proc.commonName}" ${isChecked}>
                    </div>
                    <h3>${proc.commonName}</h3>
                    <p class="official-name">${proc.officialName}</p>
                    ${priceSection}
                    <a href="details?id=${proc._id}${cityParam}" class="view-link">Compare Hospital Prices →</a>
                </div>
            `;
            $grid.append(card);
        });

        $grid.show();
        attachCompareListeners();
    }

    function updatePagination(total, page) {
        const totalPages = Math.ceil(total / 12);
        if (totalPages <= 1) {
            $('#pagination').hide();
            return;
        }

        $('#page-info').text(`Page ${page} of ${totalPages}`);
        $('#prev-btn').prop('disabled', page === 1);
        $('#next-btn').prop('disabled', page === totalPages);
        $('#pagination').css('display', 'flex');
    }

    // Compare Procedures Utilities

    function attachCompareListeners() {
        $('.compare-check').off('change').on('change', function() {
            const id = $(this).data('id');
            const name = $(this).data('name') || 'Procedure';

            if (this.checked) {
                if (selectedForCompare.length < 4) {
                    if (!selectedForCompare.some(item => item.id === id)) {
                        selectedForCompare.push({ id: id, name: name });
                    }
                } else {
                    alert('Max 4 items for comparison');
                    this.checked = false;
                }
            } else {
                selectedForCompare = selectedForCompare.filter(item => item.id !== id);
            }

            localStorage.setItem('compareCart', JSON.stringify(selectedForCompare));
            updateCompareBar();
        });
    }

    function updateCompareBar() {
        if (selectedForCompare.length > 0) {
            $('#compare-bar').fadeIn();
            $('#compare-count').text(`${selectedForCompare.length} selected`);
            
            // Build chips in the compare names container
            const chipsHtml = selectedForCompare.map(item => {
                return `
                    <span class="compare-name" style="cursor: pointer; display: inline-flex; align-items: center;" data-id="${item.id}">
                        ${item.name} 
                        <span class="compare-remove-chip" style="margin-left: 6px; font-weight: bold; opacity: 0.8; font-size: 0.85rem;">✕</span>
                    </span>
                `;
            }).join('');
            $('#compare-names').html(chipsHtml);
        } else {
            $('#compare-bar').fadeOut();
            $('#compare-names').empty();
        }
    }

    // Handle clicking the "✕" close button on individual compare bar chips
    $(document).on('click', '.compare-name', function(e) {
        e.stopPropagation();
        const id = $(this).data('id');
        selectedForCompare = selectedForCompare.filter(item => item.id !== id);
        localStorage.setItem('compareCart', JSON.stringify(selectedForCompare));
        
        // Update any matching checkbox currently visible in the grid
        $(`.compare-check[data-id="${id}"]`).prop('checked', false);
        
        updateCompareBar();
    });

    $('#compare-btn').on('click', () => {
        const ids = selectedForCompare.map(item => item.id).join(',');
        window.location.href = `compare?ids=${ids}`;
    });

    $('#compare-clear').on('click', () => {
        selectedForCompare = [];
        localStorage.removeItem('compareCart');
        $('.compare-check').prop('checked', false);
        updateCompareBar();
    });

    // Hospital Comparison Handlers

    function attachHospitalCompareListeners() {
        $('.hosp-compare-check').on('change', function() {
            const name = $(this).data('name');

            if (this.checked) {
                if (selectedHospitalsForCompare.length < 4) {
                    if (!selectedHospitalsForCompare.includes(name)) {
                        selectedHospitalsForCompare.push(name);
                    }
                } else {
                    alert('Max 4 hospitals for comparison');
                    this.checked = false;
                }
            } else {
                selectedHospitalsForCompare = selectedHospitalsForCompare.filter(item => item !== name);
            }

            updateHospitalCompareBar();
        });
    }

    function updateHospitalCompareBar() {
        if (selectedHospitalsForCompare.length > 0) {
            $('#hosp-compare-bar').fadeIn();
            $('#hosp-compare-count').text(`${selectedHospitalsForCompare.length} selected`);
        } else {
            $('#hosp-compare-bar').fadeOut();
        }
    }

    $('#hosp-compare-btn').on('click', () => {
        window.location.href = `compare-hospitals?ids=${selectedHospitalsForCompare.join(',')}`;
    });

    // Update breadcrumb text
    function updateBreadcrumb(query, category, hospital) {
        var label = 'All Procedures';
        if (query)    label = '"' + query + '"';
        if (category) label = category + ' Procedures';
        if (hospital) label = label + ' at ' + hospital;
        $('#bc-current').text(label);
    }

    // Breadcrumb updates
    $('#search-input').on('input', debounce(function() {
        updateBreadcrumb($(this).val(), currentCategory, initialHospital);
    }, 500));

    $('.filter-chip').on('click', function() {
        updateBreadcrumb($('#search-input').val(), $(this).data('cat'), initialHospital);
    });

    // Debounce function
    function debounce(func, timeout = 300) {
        let timer;
        return (...args) => {
            clearTimeout(timer);
            timer = setTimeout(() => { func.apply(this, args); }, timeout);
        };
    }
});