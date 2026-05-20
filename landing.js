let products = [];
let settings = {};
let shippingRates = [];
let coupons = [];
const CACHE_TTL = 300000; // 5 minutes in ms

// State
let appliedCoupon = null;
let currentProductPrice = 0; // Stored globally so updateLandingTotal works without args
let currentProduct = null;
let landingVariantRows = [];

function generateStarRating(rating) {
    let stars = '';
    for (let i = 1; i <= 5; i++) {
        if (i <= Math.floor(rating)) {
            stars += '<i class="fa-solid fa-star"></i>';
        } else if (i - 0.5 <= rating) {
            stars += '<i class="fa-solid fa-star-half-stroke"></i>';
        } else {
            stars += '<i class="fa-regular fa-star"></i>';
        }
    }
    return stars;
}

document.addEventListener('DOMContentLoaded', async () => {
    await initData();
    applySettings();
    loadProduct();
});

async function fetchWithCache(key, fetchFn, onCacheHit) {
    const cached = localStorage.getItem(`perex_cache_${key}`);
    if (cached) {
        const { data, timestamp } = JSON.parse(cached);
        if (onCacheHit) onCacheHit(data); // Immediate UI update from cache
        if (Date.now() - timestamp < CACHE_TTL) {
            return data;
        }
    }
    const data = await fetchFn();
    localStorage.setItem(`perex_cache_${key}`, JSON.stringify({ data, timestamp: Date.now() }));
    return data;
}

async function initData() {
    const progress = document.getElementById('loader-progress');
    const updateProgress = (p) => { if (progress) progress.style.width = p + '%'; };
    
    // 1. Try to load from cache immediately
    const cachedData = ['settings', 'products', 'shipping', 'coupons'].reduce((acc, key) => {
        const cached = localStorage.getItem(`perex_cache_${key}`);
        if (cached) acc[key] = JSON.parse(cached).data;
        return acc;
    }, {});

    if (cachedData.settings) {
        settings = cachedData.settings;
        applySettings();
    }
    if (cachedData.products) {
        products = cachedData.products;
        loadProduct();
    }
    if (cachedData.shipping) {
        shippingRates = cachedData.shipping;
    }
    if (cachedData.coupons) {
        coupons = cachedData.coupons;
    }

    // 2. Fetch fresh data in parallel
    try {
        updateProgress(30);
        const startTime = Date.now();
        
        const fetchResults = await Promise.allSettled([
            SupabaseService.getSettings(),
            SupabaseService.getProducts(),
            SupabaseService.getShippingRates(),
            SupabaseService.getCoupons()
        ]);

        const [s, p, ship, coup] = fetchResults.map(r => r.status === 'fulfilled' ? r.value : null);

        if (s) settings = s;
        if (p) products = p;
        if (ship) shippingRates = ship;
        if (coup) coupons = coup;

        // Save to cache
        const freshData = { settings: s, products: p, shipping: ship, coupons: coup };
        Object.entries(freshData).forEach(([key, val]) => {
            if (val) localStorage.setItem(`perex_cache_${key}`, JSON.stringify({ data: val, timestamp: Date.now() }));
        });

        updateProgress(100);
        
        applySettings();
        loadProduct();
        
        const elapsed = Date.now() - startTime;
        setTimeout(hidePreloader, Math.max(0, 300 - elapsed));
        
    } catch (e) {
        console.error('Landing Init Error:', e);
        hidePreloader();
    }
}

function hidePreloader() {
    const preloader = document.getElementById('preloader');
    if (preloader) preloader.classList.add('fade-out');
}

function applySettings() {
    // Safety defaults — prevent crashes if Supabase returns partial data
    if (!settings.store)  settings.store  = {};
    if (!settings.banner) settings.banner = {};
    if (!settings.badge)  settings.badge  = {};
    const THEMES = {
        dark: { 
            primary: "#38bdf8", secondary: "#818cf8", bg: "#020617", card: "#0f172a", 
            text: "#f8fafc", muted: "#94a3b8", border: "rgba(255,255,255,0.05)" 
        },
        light: { 
            primary: "#2563eb", secondary: "#4f46e5", bg: "#ffffff", card: "#ffffff", 
            text: "#0f172a", muted: "#64748b", border: "#f1f5f9" 
        },
        light_premium: { 
            primary: "#0d9488", secondary: "#14b8a6", bg: "#fafafa", card: "#ffffff", 
            text: "#0f172a", muted: "#64748b", border: "#e2e8f0" 
        },
        warm_beige: { 
            primary: "#c5a880", secondary: "#b89c72", bg: "#faf8f5", card: "#ffffff", 
            text: "#2e2518", muted: "#8a7f71", border: "#f1ede4" 
        },
        festive: { 
            primary: "#fbbf24", secondary: "#f59e0b", bg: "#450a0a", card: "#7f1d1d", 
            text: "#fffbeb", muted: "#fcd34d", border: "rgba(251,191,36,0.15)" 
        },
        ramadan: { 
            primary: "#fbbf24", secondary: "#f59e0b", bg: "#1e1b4b", card: "#312e81", 
            text: "#fffbeb", muted: "#fde68a", border: "rgba(251,191,36,0.15)" 
        }
    };    const currentTheme = settings.theme || 'dark';
    const colors = THEMES[currentTheme] || THEMES.dark;
    const isLight = currentTheme === 'light' || currentTheme === 'light_premium' || currentTheme === 'warm_beige';
    const gradient = `linear-gradient(135deg, ${colors.primary} 0%, ${colors.secondary} 100%)`;

    const style = document.getElementById('dynamic-colors');
    style.innerHTML = `
        :root {
            --primary-color: ${colors.primary};
            --secondary-color: ${colors.secondary};
            --primary-gradient: ${gradient};
            --dark-bg: ${colors.bg};
            --card-bg: ${colors.card};
            --text-color: ${colors.text};
            --muted-color: ${colors.muted};
            --text-muted: ${colors.muted};
            --border-color: ${colors.border};
            --glass-border: ${colors.border};
            --preloader-bg: ${colors.bg};
            --loader-bar-bg: ${isLight ? 'rgba(0,0,0,0.1)' : 'rgba(255,255,255,0.1)'};
        }
        .header, .landing-nav {
            background-color: ${isLight ? '#ffffff' : 'rgba(0,0,0,0.5)'} !important;
            color: ${isLight ? '#0f172a' : colors.text} !important;
            border-bottom: 1px solid ${isLight ? '#f1f5f9' : 'transparent'} !important;
        }
        .header a, .header span, .header i, .header .btn-secondary {
            color: ${isLight ? '#0f172a' : colors.text} !important;
            border-color: ${isLight ? '#0f172a' : colors.primary} !important;
        }
        .product-section, .main-section {
            background-color: ${colors.bg} !important;
        }
        .product-details h1, .product-details h2, .product-details h3 {
            color: ${colors.text} !important;
        }
        .product-details p, .desc-text {
            color: ${colors.muted} !important;
        }
        .price-tag .new { color: ${colors.primary} !important; }
        .price-tag .old { color: ${colors.muted} !important; }
        .order-form, .order-box, .checkout-box {
            background-color: ${colors.card} !important;
            border-color: ${colors.border} !important;
        }
        .form-input, .form-select, input, select, textarea, .review-input {
            background-color: ${isLight ? '#ffffff' : 'rgba(0,0,0,0.3)'} !important;
            color: ${colors.text} !important;
            border: 1px solid ${isLight ? '#cbd5e1' : colors.border} !important;
        }
        .landing-footer {
            background-color: ${colors.bg} !important;
            color: ${colors.muted} !important;
        }
        /* ===== Dynamic Variants UI ===== */
        .variant-row-container {
            background-color: ${isLight ? 'rgba(0,0,0,0.02)' : 'rgba(255,255,255,0.02)'} !important;
            border: 1px dashed ${isLight ? '#cbd5e1' : 'rgba(255,255,255,0.1)'} !important;
            border-radius: 16px !important;
            padding: 20px !important;
            margin-bottom: 20px !important;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.02) !important;
        }
        .variant-row-header {
            border-bottom: 1px solid ${isLight ? '#cbd5e1' : 'rgba(255,255,255,0.08)'} !important;
            padding-bottom: 12px !important;
            margin-bottom: 15px !important;
        }
        .variant-label {
            color: ${colors.text} !important;
            font-size: 0.95rem !important;
            font-weight: 700 !important;
            margin-bottom: 10px !important;
            display: flex !important;
            justify-content: space-between !important;
            align-items: center !important;
        }
        .variant-label .selected-val {
            background-color: ${isLight ? 'rgba(0,0,0,0.05)' : 'rgba(255,255,255,0.08)'} !important;
            color: ${colors.primary} !important;
            padding: 2px 10px !important;
            border-radius: 20px !important;
            font-size: 0.8rem !important;
            font-weight: 600 !important;
        }
        .variant-btn {
            background-color: ${isLight ? '#ffffff' : 'rgba(255,255,255,0.05)'} !important;
            color: ${colors.text} !important;
            border: 1px solid ${isLight ? '#cbd5e1' : 'rgba(255,255,255,0.1)'} !important;
            padding: 10px 18px !important;
            border-radius: 10px !important;
            font-weight: 600 !important;
            font-size: 0.9rem !important;
            transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1) !important;
            box-shadow: 0 2px 4px rgba(0, 0, 0, 0.02) !important;
        }
        .variant-btn:hover {
            border-color: ${colors.primary} !important;
            color: ${colors.primary} !important;
            background-color: ${isLight ? '#f8fafc' : 'rgba(255,255,255,0.08)'} !important;
            transform: translateY(-2px) !important;
            box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1) !important;
        }
        .variant-btn.active {
            background: ${gradient} !important;
            color: #ffffff !important;
            border-color: transparent !important;
            font-weight: 700 !important;
            transform: translateY(-2px) scale(1.03) !important;
            box-shadow: 0 6px 15px rgba(0, 0, 0, 0.15) !important;
        }
        .landing-qty-controls {
            background-color: ${isLight ? '#f1f5f9' : 'rgba(0,0,0,0.2)'} !important;
            border: 1px solid ${isLight ? '#cbd5e1' : 'rgba(255,255,255,0.05)'} !important;
            border-radius: 12px !important;
            padding: 6px 15px !important;
            box-shadow: inset 0 2px 4px rgba(0,0,0,0.05) !important;
        }
        .landing-qty-controls button {
            color: ${colors.primary} !important;
            transition: transform 0.2s ease !important;
        }
        .landing-qty-controls button:hover {
            transform: scale(1.2) !important;
        }
        .landing-qty-controls span {
            color: ${colors.text} !important;
        }
    `;

    // Set directly on root for immediate effect
    const root = document.documentElement;
    root.style.setProperty('--primary-color', colors.primary);
    root.style.setProperty('--secondary-color', colors.secondary);
    root.style.setProperty('--primary-gradient', gradient);
    root.style.setProperty('--dark-bg', colors.bg);
    root.style.setProperty('--card-bg', colors.card);
    root.style.setProperty('--text-color', colors.text);
    root.style.setProperty('--muted-color', colors.muted);
    root.style.setProperty('--text-muted', colors.muted);
    root.style.setProperty('--border-color', colors.border);
    root.style.setProperty('--glass-border', colors.border);
    root.style.setProperty('--preloader-bg', colors.bg);
    root.style.setProperty('--loader-bar-bg', isLight ? 'rgba(0,0,0,0.1)' : 'rgba(255,255,255,0.1)');
    document.body.style.backgroundColor = colors.bg;
    document.body.style.color = colors.text;

    // Pixel Initialization — fire as early as possible from settings
    if (settings.store && settings.store.pixel) {
        initPixel(settings.store.pixel);
    }

    // Store Identity
    if (settings.store.name) {
        document.querySelectorAll('.logo span').forEach(s => s.innerText = settings.store.name);
        document.title = `${settings.store.name} - صفحة المنتج`;
    }
    if (settings.store.logo) {
        document.querySelectorAll('.logo img, .loader-logo').forEach(img => img.src = settings.store.logo);
        document.querySelectorAll("link[rel*='icon']").forEach(link => link.href = settings.store.logo);
    }
}

function loadProduct() {
    const urlParams = new URLSearchParams(window.location.search);
    const id = parseInt(urlParams.get('id'));
    const p = products.find(prod => prod.id === id);
    if (p) currentProductPrice = p.price; // Store for use by updateLandingTotal

    if (!p) {
        document.getElementById('landing-content').innerHTML = '<div style="grid-column: 1/-1; text-align: center;"><h2>المنتج غير موجود</h2><a href="index.html" class="btn btn-primary">العودة للمتجر</a></div>';
        return;
    }

    // Pixel ViewContent
    const pixelId = (settings.store && settings.store.pixel) || p.pixel_id;
    if (pixelId) {
        initPixel(pixelId);
        if (window.fbq) fbq('track', 'ViewContent', { content_ids: [p.id], content_name: p.name, value: p.price, currency: 'EGP' });
    }

    currentProduct = p;
    document.title = `${p.name} - ${(settings.store && settings.store.name) || 'Perex Store'}`;
    landingVariantRows = [{ id: Date.now(), color: '', size: '', qty: 1 }];

    const container = document.getElementById('landing-content');
    container.innerHTML = `
        <div class="product-gallery">
            <div class="main-img-wrap">
                <img src="${p.images[0]}" id="main-img" style="width:100%" decoding="async">
            </div>
            ${p.images.length > 1 ? `
                <div style="display:flex;gap:10px;margin-top:15px;overflow-x:auto;padding-bottom:10px;">
                    ${p.images.map(img => `<img src="${img}" style="width:80px;height:80px;border-radius:10px;cursor:pointer;border:2px solid transparent" onclick="document.getElementById('main-img').src='${img}'" decoding="async">`).join('')}
                </div>
            ` : ''}
        </div>
        <div class="product-details">
            <h1 style="font-size:2.5rem;font-weight:800;margin-bottom:5px;">${p.name}</h1>
            <div style="color: #fbbf24; font-size: 1.2rem; margin-bottom: 15px;">
                ${generateStarRating(p.rating || 5)}
            </div>
            <div class="price-tag">
                <span class="new">${p.price} ج.م</span>
                ${p.old_price ? `<span class="old">${p.old_price} ج.م</span>` : ''}
            </div>
            <p style="color:#94a3b8;font-size:1.1rem;line-height:1.8">${p.description || 'لا يوجد وصف متاح حالياً.'}</p>
            
            <ul class="features-list">
                <li><i class="fa-solid fa-circle-check"></i> شحن سريع لباب المنزل</li>
                <li><i class="fa-solid fa-circle-check"></i> الدفع عند الاستلام</li>
                <li><i class="fa-solid fa-circle-check"></i> ضمان جودة PereX</li>
            </ul>

            <div class="landing-checkout">
                <h3 style="margin-bottom:20px;">اطلب الآن وسيتصل بك فريقنا</h3>
                <div id="variants-container" style="margin-bottom: 20px;"></div>
                <form id="landing-form" onsubmit="submitLandingOrder(event, ${p.id})">
                    <div class="form-group"><input type="text" id="l-name" placeholder="الاسم بالكامل" required class="review-input" style="margin-bottom:10px;"></div>
                    <div class="form-group"><input type="tel" id="l-phone" placeholder="رقم الهاتف" required class="review-input" style="margin-bottom:10px;" pattern="01[0-2,5]{1}[0-9]{8}"></div>
                    
                    <div class="form-group" style="margin-bottom:10px;">
                        <div style="display:flex; gap:8px;">
                            <input type="text" id="l-coupon" placeholder="كود الخصم (اختياري)" class="review-input">
                            <button type="button" class="btn btn-primary" onclick="applyLandingCoupon(${p.price})" style="padding:10px; border-radius:12px;">تطبيق</button>
                        </div>
                        <div id="l-coupon-msg" style="font-size:0.8rem; margin-top:5px;"></div>
                    </div>

                    <div class="form-group">
                        <select id="l-gov" required class="review-input" style="margin-bottom:10px;" onchange="updateLandingTotal()">
                            <option value="" disabled selected>المحافظة...</option>
                            ${shippingRates.map(r => `<option value="${r.price}" data-name="${r.name}">${r.name} (${r.price} ج.م)</option>`).join('')}
                        </select>
                    </div>
                    <div class="form-group"><input type="text" id="l-district" placeholder="المنطقة / الحي" required class="review-input" style="margin-bottom:10px;"></div>
                    <div class="form-group"><textarea id="l-address" placeholder="العنوان بالتفصيل (الشارع، رقم العمارة، إلخ)" required class="review-input" style="margin-bottom:15px;"></textarea></div>
                    
                    <div class="checkout-summary" style="padding:15px;border-radius:10px;margin-bottom:15px;">
                        <div style="display:flex;justify-content:space-between;margin-bottom:5px;"><span>سعر المنتج:</span> <span>${p.price} ج.م <span id="l-qty-display"></span></span></div>
                        <div id="l-discount-row" style="display:none;justify-content:space-between;margin-bottom:5px;color:#ef4444;"><span>الخصم:</span> <span id="l-discount-val">0 ج.م</span></div>
                        <div style="display:flex;justify-content:space-between;margin-bottom:5px;"><span>الشحن:</span> <span id="l-ship-val">0 ج.م</span></div>
                        <div style="display:flex;justify-content:space-between;border-top:1px solid rgba(255,255,255,0.1);padding-top:10px;font-weight:bold;font-size:1.2rem;">
                            <span>الإجمالي:</span>
                            <span id="l-total-val" style="color:var(--primary-color)">${p.price} ج.م</span>
                        </div>
                    </div>
                    
                    <button type="submit" class="btn btn-primary" style="width:100%;padding:15px;font-size:1.2rem;">تأكيد الطلب الآن <i class="fa-solid fa-truck"></i></button>
                </form>
            </div>
        </div>
    `;

    if (p.has_colors || p.has_sizes) {
        renderLandingVariants();
    } else {
        // Just one quantity selector if no variants? 
        // For simplicity, let's just use the existing logic (qty=1) if no variants, 
        // or we can add a basic qty selector. Let's just use total logic.
        updateLandingTotal();
    }
}

function renderLandingVariants() {
    const container = document.getElementById('variants-container');
    if (!container || !currentProduct) return;
    
    const p = currentProduct;
    let html = '';
    
    landingVariantRows.forEach((row, index) => {
        html += `
            <div class="variant-row-container">
                <div class="variant-row-header">
                    <span style="font-weight:bold; color:var(--primary-color);">صنف ${index + 1}</span>
        `;
        if (landingVariantRows.length > 1) {
            html += `
                    <button type="button" onclick="removeVariantRow(${row.id})" style="background:none; border:none; color:#ef4444; cursor:pointer;"><i class="fa-solid fa-trash"></i> إزالة</button>
            `;
        }
        html += `</div>`;
        
        if (p.has_colors && p.colors && p.colors.length > 0) {
            html += `
                <div class="variant-group">
                    <label class="variant-label">اللون: <span class="selected-val">${row.color || 'اختر اللون'}</span></label>
                    <div class="variant-options">
                        ${p.colors.map(c => `
                            <button type="button" class="variant-btn ${row.color === c ? 'active' : ''}" onclick="updateVariantRow(${row.id}, 'color', '${c}')">
                                <span class="color-dot" style="background-color: ${getColorHex(c)};"></span>
                                <span>${c}</span>
                            </button>
                        `).join('')}
                    </div>
                </div>
            `;
        }
        
        if (p.has_sizes && p.sizes && p.sizes.length > 0) {
            html += `
                <div class="variant-group">
                    <label class="variant-label">المقاس: <span class="selected-val">${row.size || 'اختر المقاس'}</span></label>
                    <div class="variant-options">
                        ${p.sizes.map(s => `<button type="button" class="variant-btn ${row.size === s ? 'active' : ''}" onclick="updateVariantRow(${row.id}, 'size', '${s}')">${s}</button>`).join('')}
                    </div>
                </div>
            `;
        }
        
        html += `
                <div style="display:flex; justify-content:space-between; align-items:center; margin-top:5px;">
                    <span style="font-weight:bold;">الكمية:</span>
                    <div class="landing-qty-controls" style="display:flex; align-items:center; gap:15px; border-radius:10px; padding:8px 15px;">
                        <button type="button" onclick="updateVariantRow(${row.id}, 'qty', ${row.qty + 1})" style="background:none;border:none;color:var(--primary-color);cursor:pointer;font-size:1.1rem;"><i class="fa-solid fa-plus"></i></button>
                        <span style="min-width:30px;text-align:center;font-weight:bold;font-size:1.1rem;">${row.qty}</span>
                        <button type="button" onclick="updateVariantRow(${row.id}, 'qty', ${row.qty - 1})" style="background:none;border:none;color:var(--primary-color);cursor:pointer;font-size:1.1rem;"><i class="fa-solid fa-minus"></i></button>
                    </div>
                </div>
            </div>
        `;
    });
    
    html += `
        <div style="display:flex; justify-content:center; margin-bottom:20px; width:100%;">
            <button type="button" class="add-row-btn" onclick="addVariantRow()">
                <i class="fa-solid fa-circle-plus"></i> إضافة صنف آخر (لون/مقاس مختلف)
            </button>
        </div>
    `;
    
    container.innerHTML = html;
    updateLandingTotal();
}

function updateVariantRow(id, field, value) {
    const row = landingVariantRows.find(r => r.id === id);
    if (!row) return;
    
    if (field === 'qty') {
        if (value < 1) return;
        row.qty = value;
    } else {
        row[field] = value;
    }
    
    renderLandingVariants();
}

function addVariantRow() {
    landingVariantRows.push({ id: Date.now(), color: '', size: '', qty: 1 });
    renderLandingVariants();
}

function removeVariantRow(id) {
    if (landingVariantRows.length <= 1) return;
    landingVariantRows = landingVariantRows.filter(r => r.id !== id);
    renderLandingVariants();
}

function applyLandingCoupon(basePrice) {
    const code = document.getElementById('l-coupon').value.toUpperCase().trim();
    const msg = document.getElementById('l-coupon-msg');
    if (!code) return;

    const coupon = coupons.find(c => c.code === code);
    if (!coupon) {
        msg.innerText = 'كود غير موجود';
        msg.style.color = '#ef4444';
        return;
    }

    if (!coupon.is_active) {
        msg.innerText = 'هذا الكود معطل حالياً';
        msg.style.color = '#ef4444';
        return;
    }

    if (coupon.expiry_date && new Date(coupon.expiry_date) < new Date()) {
        msg.innerText = 'هذا الكود منتهي الصلاحية';
        msg.style.color = '#ef4444';
        return;
    }

    if (coupon.current_uses >= coupon.max_uses) {
        msg.innerText = 'تم الوصول للحد الأقصى لاستخدام الكود';
        msg.style.color = '#ef4444';
        return;
    }

    // Check eligibility for the current product
    const urlParams = new URLSearchParams(window.location.search);
    const productId = parseInt(urlParams.get('id'));
    const p = products.find(prod => prod.id === productId);

    let isEligible = false;
    if (coupon.apply_type === 'all' || !coupon.apply_type) {
        isEligible = true;
    } else if (coupon.apply_type === 'categories') {
        isEligible = p && coupon.target_ids.includes(p.category);
    } else if (coupon.apply_type === 'products') {
        isEligible = p && coupon.target_ids.includes(p.id.toString());
    }

    if (!isEligible) {
        msg.innerText = 'هذا الكوبون لا ينطبق على هذا المنتج';
        msg.style.color = '#ef4444';
        return;
    }

    if (coupon.min_order && basePrice < coupon.min_order) {
        msg.innerText = `الحد الأدنى لاستخدام الكوبون هو ${coupon.min_order} ج.م`;
        msg.style.color = '#ef4444';
        return;
    }

    appliedCoupon = coupon;
    const discountVal = coupon.type === 'fixed' ? `${coupon.discount} ج.م` : `${coupon.discount}%`;
    
    if (coupon.discount > 0 && coupon.free_shipping) {
        msg.innerText = `تم تطبيق خصم ${discountVal} + شحن مجاني!`;
    } else if (coupon.discount > 0) {
        msg.innerText = `تم تطبيق خصم بقيمة ${discountVal}`;
    } else if (coupon.free_shipping) {
        msg.innerText = `تم تطبيق عرض الشحن المجاني!`;
    }
    
    msg.style.color = '#22c55e';
    updateLandingTotal(basePrice || currentProductPrice);
}

function updateLandingTotal(basePrice) {
    // Use passed price, or fall back to the globally stored product price
    const price = basePrice || currentProductPrice;
    if (!price) return;
    
    // Calculate total qty
    let totalQty = 1;
    if (currentProduct && (currentProduct.has_colors || currentProduct.has_sizes)) {
        totalQty = landingVariantRows.reduce((sum, r) => sum + r.qty, 0);
    }
    
    const subtotal = price * totalQty;
    
    const qtyDisplay = document.getElementById('l-qty-display');
    if (qtyDisplay) {
        qtyDisplay.innerText = totalQty > 1 ? `(الكمية: ${totalQty})` : '';
    }

    const govEl = document.getElementById('l-gov');
    const originalShip = govEl ? (parseFloat(govEl.value) || 0) : 0;

    // Discount calculation (apply to subtotal)
    const discount = appliedCoupon
        ? (appliedCoupon.type === 'fixed'
            ? Math.min(appliedCoupon.discount, subtotal)
            : Math.round(subtotal * (appliedCoupon.discount / 100)))
        : 0;

    // Free shipping check
    const freeShipping = appliedCoupon && appliedCoupon.free_shipping;
    const ship = freeShipping ? 0 : originalShip;

    const total = subtotal - discount + ship;

    // Update shipping display
    const shipEl = document.getElementById('l-ship-val');
    if (shipEl) {
        if (freeShipping) {
            shipEl.innerHTML = `<del style="color:#999; font-size:0.8rem;">${originalShip} ج.م</del> <span style="color:#22c55e;">مجاني</span>`;
        } else {
            shipEl.innerText = ship + ' ج.م';
        }
    }

    // Update discount display
    const discountRow = document.getElementById('l-discount-row');
    const discountVal = document.getElementById('l-discount-val');
    if (discountRow && discountVal) {
        if (discount > 0) {
            discountRow.style.display = 'flex';
            discountVal.innerText = `-${discount} ج.م`;
        } else {
            discountRow.style.display = 'none';
        }
    }

    // Update total
    const totalEl = document.getElementById('l-total-val');
    if (totalEl) totalEl.innerText = total + ' ج.م';
}

async function submitLandingOrder(e, productId) {
    e.preventDefault();
    const btn = e.submitter;
    if (btn) btn.disabled = true;

    // Pixel InitiateCheckout
    if (window.fbq) fbq('track', 'InitiateCheckout');

    const p = products.find(prod => prod.id === productId);
    const govSelect = document.getElementById('l-gov');
    
    const originalShip = parseFloat(govSelect.value) || 0;
    
    let totalQty = 1;
    let orderItems = [];
    
    if (p.has_colors || p.has_sizes) {
        let missingSelection = false;
        for (let i = 0; i < landingVariantRows.length; i++) {
            const r = landingVariantRows[i];
            if (p.has_colors && p.colors && p.colors.length > 0 && !r.color) missingSelection = true;
            if (p.has_sizes && p.sizes && p.sizes.length > 0 && !r.size) missingSelection = true;
        }
        if (missingSelection) {
            alert('الرجاء اختيار اللون والمقاس لجميع الأصناف المطلوبة.');
            if (btn) btn.disabled = false;
            return;
        }

        totalQty = landingVariantRows.reduce((sum, r) => sum + r.qty, 0);
        
        orderItems = landingVariantRows.map(r => {
            let variantSuffix = [];
            if (p.has_colors && r.color) variantSuffix.push(r.color);
            if (p.has_sizes && r.size) variantSuffix.push(r.size);
            
            const variantText = variantSuffix.length > 0 ? ` (${variantSuffix.join(' - ')})` : '';
            return {
                id: p.id,
                name: p.name + variantText,
                price: p.price,
                qty: r.qty
            };
        });
    } else {
        orderItems = [{ id: p.id, name: p.name, price: p.price, qty: 1 }];
    }
    
    const subtotal = p.price * totalQty;
    
    const discount = appliedCoupon ? (appliedCoupon.type === 'fixed' ? appliedCoupon.discount : Math.round(subtotal * (appliedCoupon.discount / 100))) : 0;
    
    // Free shipping check
    const freeShipping = appliedCoupon && appliedCoupon.free_shipping;
    const ship = freeShipping ? 0 : originalShip;
    
    const total = subtotal - discount + ship;

    const orderData = {
        customer_name: document.getElementById('l-name').value,
        customer_phone: document.getElementById('l-phone').value,
        governorate: govSelect.options[govSelect.selectedIndex].dataset.name,
        district: document.getElementById('l-district').value,
        address: document.getElementById('l-address').value,
        
        items: orderItems,
        subtotal: subtotal,
        shipping: ship,
        discount: discount,
        coupon: appliedCoupon ? appliedCoupon.code : null,
        total: total,
        status: 'new'
    };

    try {
        const savedOrder = await SupabaseService.saveOrder(orderData);
        
        // Pixel Purchase
        if (window.fbq) {
            fbq('track', 'Purchase', { 
                value: total, 
                currency: 'EGP', 
                content_ids: [p.id],
                content_type: 'product'
            });
        }
        
        // Update coupon uses in Supabase (non-blocking)
        if (appliedCoupon) {
            SupabaseService.saveCoupon({ 
                id: appliedCoupon.id, 
                current_uses: (appliedCoupon.current_uses || 0) + 1 
            }).catch(err => console.warn('Coupon usage update failed:', err));
        }

        // WhatsApp Detailed Receipt Breakdown
        let msg = `*${settings.store.waMsg}*\n\n`;
        msg += `👤 *العميل:* ${orderData.customer_name}\n`;
        msg += `📞 *الهاتف:* ${orderData.customer_phone}\n`;
        msg += `📍 *العنوان:* ${orderData.governorate} - ${orderData.district}\n`;
        msg += `🏠 *التفاصيل:* ${orderData.address}\n\n`;
        msg += `📦 *المنتجات المطلوبة:*\n`;
        
        orderItems.forEach((item, idx) => {
            msg += `${idx + 1}. ${item.name} - (عدد: ${item.qty}) (${item.price * item.qty} ج.م)\n`;
        });
        
        msg += `\n💰 *الحساب:*\n`;
        msg += `قيمة المنتجات: ${subtotal} ج.م\n`;
        if (discount > 0) msg += `خصم الكوبون: -${discount} ج.م\n`;
        msg += `مصاريف الشحن: ${ship === 0 ? 'مجاني' : ship + ' ج.م'}\n`;
        msg += `*الإجمالي المطلوب:* ${total} ج.م\n`;
        
        window.open(`https://wa.me/${settings.store.whatsapp}?text=${encodeURIComponent(msg)}`, '_blank');

        // Show Success Modal
        document.getElementById('success-overlay').classList.add('active');
        document.getElementById('success-modal').classList.add('active');
    } catch (e) {
        console.error('Landing Order Error:', e);
        alert('حدث خطأ أثناء إرسال الطلب: ' + e.message);
        if (btn) btn.disabled = false;
    }
}

function initPixel(id) {
    if (!id) return;
    if (window.fbq) {
        // Pixel already loaded — just re-init with new ID if needed
        fbq('init', id);
        return;
    }
    !function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?
    n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;
    n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;
    t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,
    document,'script','https://connect.facebook.net/en_US/fbevents.js');
    fbq('init', id);
    fbq('track', 'PageView');
}

function closeSuccessModal() {
    document.getElementById('success-overlay').classList.remove('active');
    document.getElementById('success-modal').classList.remove('active');
}

function getColorHex(colorName) {
    if (!colorName) return '#94a3b8';
    
    // Normalize string
    const normalized = colorName.trim().toLowerCase();
    
    // Check if it's already a valid hex code
    const hexMatch = normalized.match(/#([0-9A-Fa-f]{3,8})/);
    if (hexMatch) return '#' + hexMatch[1];
    
    // Arabic & English color mapping
    const map = {
        // Arabic
        'أسود': '#000000',
        'اسود': '#000000',
        'أبيض': '#ffffff',
        'ابيض': '#ffffff',
        'أحمر': '#ef4444',
        'احمر': '#ef4444',
        'أزرق': '#2563eb',
        'ازرق': '#2563eb',
        'أخضر': '#10b981',
        'اخضر': '#10b981',
        'أصفر': '#eab308',
        'اصفر': '#eab308',
        'رمادي': '#6b7280',
        'بني': '#78350f',
        'وردي': '#ec4899',
        'بنفسجي': '#8b5cf6',
        'برتقالي': '#f97316',
        'كحلي': '#1e3a8a',
        'ذهبي': '#d4af37',
        'فضي': '#cbd5e1',
        'بيج': '#f5f5dc',
        'سماوي': '#38bdf8',
        'زيتي': '#3f6212',
        
        // English
        'black': '#000000',
        'white': '#ffffff',
        'red': '#ef4444',
        'blue': '#2563eb',
        'green': '#10b981',
        'yellow': '#eab308',
        'gray': '#6b7280',
        'grey': '#6b7280',
        'brown': '#78350f',
        'pink': '#ec4899',
        'purple': '#8b5cf6',
        'orange': '#f97316',
        'navy': '#1e3a8a',
        'gold': '#d4af37',
        'silver': '#cbd5e1',
        'beige': '#f5f5dc',
        'cyan': '#38bdf8'
    };
    
    // Look up in map
    for (const [key, val] of Object.entries(map)) {
        if (normalized.includes(key)) {
            return val;
        }
    }
    
    // Fallback: Check if it's a valid HTML color name
    return colorName;
}
