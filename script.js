let products = [];
let categories = [];
let coupons = [];
let orders = [];
let settings = {};
let shippingRates = [];
const CACHE_TTL = 300000; // 5 minutes in ms

// Safety check for settings properties
if (!settings.theme) settings.theme = "dark";
if (!settings.colors) settings.colors = { primary: "#0ea5e9", secondary: "#38bdf8", bg: "#0f172a" };

let cartItems = JSON.parse(localStorage.getItem('perex_cart')) || [];
let appliedCoupon = null;
// Fetched from Supabase

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

let currentPage = 1;
const productsPerPage = 8;
let currentCategory = 'all';

// ===== INITIALIZATION =====
document.addEventListener('DOMContentLoaded', async () => {
    await initData();
    applySettings();
    renderCategories();
    renderProducts('all');
    initUI();
    loadShippingSelects();
    updateCartUI();
    initScrollReveal();
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
    
    // 1. Try to load from cache immediately for instant UI
    const cachedData = ['settings', 'products', 'categories', 'shipping', 'coupons'].reduce((acc, key) => {
        const cached = localStorage.getItem(`perex_cache_${key}`);
        if (cached) acc[key] = JSON.parse(cached).data;
        return acc;
    }, {});

    if (cachedData.settings) {
        settings = cachedData.settings;
        applySettings();
    }
    if (cachedData.categories) {
        categories = cachedData.categories;
        renderCategories();
    }
    if (cachedData.products) {
        products = cachedData.products;
        renderProducts('all');
    }
    if (cachedData.shipping) {
        shippingRates = cachedData.shipping;
        loadShippingSelects();
    }
    if (cachedData.coupons) {
        coupons = cachedData.coupons;
    }

    // 2. Fetch all fresh data in parallel
    try {
        updateProgress(30);
        const startTime = Date.now();
        
        const fetchResults = await Promise.allSettled([
            SupabaseService.getSettings(),
            SupabaseService.getProducts(),
            SupabaseService.getCategories(),
            SupabaseService.getShippingRates(),
            SupabaseService.getCoupons()
        ]);

        const [s, p, c, ship, coup] = fetchResults.map(r => r.status === 'fulfilled' ? r.value : null);

        if (s) settings = s;
        if (p) products = p;
        if (c) categories = c;
        if (ship) shippingRates = ship;
        if (coup) coupons = coup;

        // Save to cache
        const freshData = { settings: s, products: p, categories: c, shipping: ship, coupons: coup };
        Object.entries(freshData).forEach(([key, val]) => {
            if (val) localStorage.setItem(`perex_cache_${key}`, JSON.stringify({ data: val, timestamp: Date.now() }));
        });

        updateProgress(100);
        
        // 3. Update UI if data changed or first load
        applySettings();
        renderCategories();
        renderProducts('all');
        loadShippingSelects();
        
        const elapsed = Date.now() - startTime;
        setTimeout(() => {
            hidePreloader();
            initSmartOffers();
        }, Math.max(0, 300 - elapsed));
        
    } catch (e) {
        console.error('Store Init Error:', e);
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
    // Themes Definition (Keep in sync with admin.js)
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
    };

    const currentTheme = settings.theme || 'dark';
    const colors = THEMES[currentTheme] || THEMES.dark;

    // Dynamic Colors - comprehensive coverage
    const style = document.getElementById('dynamic-colors');
    const isLight = currentTheme === 'light' || currentTheme === 'light_premium' || currentTheme === 'warm_beige';
    const gradient = `linear-gradient(135deg, ${colors.primary} 0%, ${colors.secondary} 100%)`;
    
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
        .header.scrolled { background: ${isLight ? '#ffffff' : 'rgba(0,0,0,0.6)'} !important; }
        .glass-card, .glass-card span, .glass-card i { color: #ffffff !important; }
        .product-badge { color: #ffffff !important; }
        .reviews-content h2, .reviews-content p { color: #ffffff !important; }
        .review-card { background: ${isLight ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.04)'} !important; border: 1px solid ${isLight ? 'rgba(255,255,255,0.1)' : 'transparent'} !important; }
        .review-card p, .review-card strong, .review-card small { color: #ffffff !important; }
        .review-card div[style*="background"] p, .review-card div[style*="background"] strong { color: #ffffff !important; }
        .review-input { background: ${isLight ? '#ffffff' : 'rgba(0,0,0,0.3)'} !important; color: ${colors.text} !important; border: 1px solid ${isLight ? '#cbd5e1' : colors.border} !important; }
    `;

    // Also set directly on root for immediate effect (before CSS parses)
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

    // Hero Content
    const heroTitle = document.querySelector('.hero-content h1');
    const heroDesc = document.querySelector('.hero-content p');
    const heroBtn = document.querySelector('.hero-buttons .btn-primary');
    const heroImg = document.querySelector('.hero-image img');

    if (heroTitle) {
        const title = settings.banner.title || "ارتقِ بتجربة هاتفك مع";
        const storeName = settings.store.name || "Perex Store";
        // Remove duplicate store name if present in title to keep it clean
        const cleanTitle = title.replace(storeName, '').trim();
        heroTitle.innerHTML = `${cleanTitle} <span class="highlight">${storeName}</span>`;
    }
    if (heroDesc) heroDesc.innerText = settings.banner.desc || "نقدم لك تشكيلة واسعة من أحدث وأجود إكسسوارات الهواتف الذكية.";
    if (heroBtn) heroBtn.innerHTML = `${settings.banner.cta || 'تسوق الآن'} <i class="fa-solid fa-arrow-left"></i>`;
    if (settings.banner.img && heroImg) heroImg.src = settings.banner.img;

    // Badge
    const badgeText = document.querySelector('.glass-card span');
    const badgeIcon = document.querySelector('.glass-card i');
    if (badgeText && settings.badge) badgeText.innerText = settings.badge.text || "حماية فائقة";
    if (badgeIcon && settings.badge) {
        badgeIcon.className = `fa-solid ${settings.badge.icon || 'fa-shield-halved'}`;
    }

    // Store Identity (Name & Logo)
    if (settings.store.name) {
        document.querySelectorAll('.logo span').forEach(s => s.innerText = settings.store.name);
        document.title = `${settings.store.name} - كل ما تحتاجه في مكان واحد`;
        
        const footerCopyright = document.querySelector('.footer-bottom p');
        if (footerCopyright) {
            footerCopyright.innerHTML = `&copy; ${new Date().getFullYear()} ${settings.store.name}. جميع الحقوق محفوظة.`;
        }
    }
    if (settings.store.logo) {
        document.querySelectorAll('.logo img, .menu-branding img, .loader-logo').forEach(img => img.src = settings.store.logo);
        document.querySelectorAll("link[rel*='icon']").forEach(link => link.href = settings.store.logo);
    }

    renderFeatures();
    renderSocial();
    renderMainSliders();

    // Pixel Initialization
    if (settings.store.pixel) {
        initPixel(settings.store.pixel);
    }
}

function initPixel(id) {
    if (!id) return;
    if (window.fbq) {
        // Pixel already loaded — just re-init with new ID if needed
        fbq('init', id);
        fbq('track', 'PageView');
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

function trackPixel(event, data = {}) {
    if (window.fbq) fbq('track', event, data);
}

function loadShippingSelects() {
    const selects = [document.getElementById('customer-gov'), document.getElementById('cart-gov')];
    selects.forEach(s => {
        if (!s) return;
        const current = s.value;
        s.innerHTML = `<option value="" disabled selected>${s.id === 'cart-gov' ? 'اختر محافظتك...' : 'المحافظة...'}</option>`;
        shippingRates.forEach(r => {
            const opt = document.createElement('option');
            opt.value = r.price;
            opt.dataset.name = r.name;
            opt.innerText = `${r.name} (${r.price} ج.م)`;
            s.appendChild(opt);
        });
        if (current) s.value = current;
    });
}

// ===== RENDERERS =====
function renderFeatures() {
    const container = document.getElementById('features-container');
    if (!container || !settings.features) return;
    
    container.innerHTML = settings.features.map(f => `
        <div class="feature-card">
            <div class="icon-box"><i class="fa-solid ${f.icon}"></i></div>
            <h3>${f.title}</h3>
            <p>${f.desc}</p>
        </div>
    `).join('');
}

function renderSocial() {
    const containers = document.querySelectorAll('.social-links');
    if (!settings.social) return;
    
    const html = settings.social.map(s => `
        <a href="${s.url}" target="_blank"><i class="fa-brands ${s.icon}"></i></a>
    `).join('');
    
    containers.forEach(c => c.innerHTML = html);

    // Update Contact Info in Footer
    const footerContact = document.querySelector('.contact-info ul');
    if (footerContact && settings.store) {
        footerContact.innerHTML = `
            <li><i class="fa-solid fa-location-dot"></i> ${settings.store.address || 'القاهرة، مصر'}</li>
            <li><i class="fa-solid fa-phone"></i> +${settings.store.whatsapp || '201222711455'}</li>
            <li><i class="fa-solid fa-envelope"></i> ${settings.store.email || 'info@perexstore.com'}</li>
        `;
    }

    // Update Floating Buttons
    const floatWrap = document.getElementById('floating-buttons-container');
    if (floatWrap && settings.floatingBtns) {
        floatWrap.innerHTML = settings.floatingBtns.map(btn => `
            <a href="${btn.url}" class="float-btn" target="_blank" style="background:${btn.color};" onclick="trackPixel('Contact')">
                <i class="fa-brands ${btn.icon}"></i>
            </a>
        `).join('');
    }
}

function renderCategories() {
    const filterContainer = document.querySelector('.product-filters');
    if (!filterContainer) return;
    
    filterContainer.innerHTML = '';
    const allBtn = document.createElement('button');
    allBtn.className = 'filter-btn active';
    allBtn.dataset.filter = 'all';
    allBtn.innerText = 'الكل';
    allBtn.onclick = () => {
        document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
        allBtn.classList.add('active');
        renderProducts('all');
    };
    filterContainer.appendChild(allBtn);

    categories.sort((a,b) => a.order - b.order).forEach(c => {
        if (c.is_visible === false) return;
        const btn = document.createElement('button');
        btn.className = 'filter-btn';
        btn.dataset.filter = c.id;
        btn.innerText = c.name;
        btn.onclick = () => {
            document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            renderProducts(c.id);
        };
        filterContainer.appendChild(btn);
    });
}

function renderProducts(catId, reset = true) {
    const container = document.getElementById('products-container');
    if (!container) return;
    
    if (reset) {
        container.innerHTML = '';
        currentPage = 1;
        currentCategory = catId;
    }

    const filtered = products.filter(p => (currentCategory === 'all' || p.category === currentCategory) && p.is_visible !== false);
    
    const start = (currentPage - 1) * productsPerPage;
    const end = start + productsPerPage;
    const paginated = filtered.slice(0, end);

    const productHTML = paginated.map(p => {
        const discount = p.old_price ? Math.round(((p.old_price - p.price) / p.old_price) * 100) : 0;
        return `
            <div class="product-card" style="cursor: pointer;" onclick="window.location.href = 'landing.html?id=${p.id}'">
                ${p.badge || (discount > 0 ? `خصم ${discount}%` : '') ? `<span class="product-badge">${p.badge || `خصم ${discount}%`}</span>` : ''}
                <div class="product-image">
                    <img src="${p.images[0] || 'prerx logo.jpeg'}" alt="${p.name}" loading="lazy" decoding="async">
                    ${p.images.length > 1 ? `
                        <button class="slider-btn prev-btn" onclick="event.stopPropagation(); slideImg(this, -1, ${p.id})"><i class="fa-solid fa-chevron-right"></i></button>
                        <button class="slider-btn next-btn" onclick="event.stopPropagation(); slideImg(this, 1, ${p.id})"><i class="fa-solid fa-chevron-left"></i></button>
                        <div class="img-counter">1 / ${p.images.length}</div>
                    ` : ''}
                    <div class="product-overlay">
                        <div class="view-btn"><i class="fa-solid fa-eye"></i></div>
                    </div>
                </div>
                <div class="product-info">
                    <p class="product-category">${categories.find(c => c.id === p.category)?.name || ''}</p>
                    <h3 class="product-title">${p.name}</h3>
                    <div style="color:#fbbf24; font-size:0.8rem; margin-bottom:10px;">
                        ${generateStarRating(p.rating || 5)}
                    </div>
                    <div class="product-price-row" style="margin-bottom:10px;">
                        <div style="display:flex;flex-direction:column;">
                            <span class="product-price">${p.price} ج.م</span>
                            ${p.old_price ? `<del class="product-old-price" style="font-size:0.8rem;color:#999">${p.old_price} ج.م</del>` : ''}
                        </div>
                    </div>
                    <button class="btn btn-primary" onclick="event.stopPropagation(); addToCart(${p.id})" style="width:100%; padding:10px; font-weight:bold; font-size:1rem;">أضف للسلة <i class="fa-solid fa-cart-plus"></i></button>
                </div>
            </div>
        `;
    }).join('');

    container.innerHTML = productHTML;

    // Load More Button
    let loadMoreBtn = document.getElementById('load-more-btn');
    if (end < filtered.length) {
        if (!loadMoreBtn) {
            loadMoreBtn = document.createElement('button');
            loadMoreBtn.id = 'load-more-btn';
            loadMoreBtn.className = 'btn btn-secondary';
            loadMoreBtn.style.margin = '40px auto';
            loadMoreBtn.style.display = 'block';
            loadMoreBtn.innerText = 'تحميل المزيد من المنتجات';
            loadMoreBtn.onclick = () => {
                currentPage++;
                renderProducts(currentCategory, false);
            };
            container.after(loadMoreBtn);
        }
    } else if (loadMoreBtn) {
        loadMoreBtn.remove();
    }
}

// ===== CART LOGIC =====
function addToCart(id) {
    const p = products.find(prod => prod.id === id);
    if (!p) return;
    
    if (p.has_colors || p.has_sizes) {
        // Show notification instead of hard redirect
        showVariantNotification(p);
        return;
    }
    
    const existing = cartItems.find(item => item.id === id);
    if (existing) {
        existing.qty++;
    } else {
        cartItems.push({ ...p, qty: 1 });
    }
    
    updateCartUI();
    showAddToCartNotification(p);
    
    // Pixel
    trackPixel('AddToCart', { content_ids: [p.id], content_name: p.name, value: p.price, currency: 'EGP' });
}

function removeFromCart(id) {
    cartItems = cartItems.filter(item => item.id !== id);
    updateCartUI();
}

function changeQty(id, delta) {
    const item = cartItems.find(i => i.id === id);
    if (!item) return;
    item.qty += delta;
    if (item.qty < 1) return removeFromCart(id);
    updateCartUI();
}

function updateCartUI() {
    const count = document.querySelector('.cart-count');
    const container = document.getElementById('cart-items');
    
    // Save to localStorage
    localStorage.setItem('perex_cart', JSON.stringify(cartItems));

    count.innerText = cartItems.reduce((s, i) => s + i.qty, 0);
    container.innerHTML = '';

    if (cartItems.length === 0) {
        container.innerHTML = '<p class="empty-cart-msg">السلة فارغة حالياً</p>';
        appliedCoupon = null;
        updateTotals();
        return;
    }

    cartItems.forEach((item) => {
        container.innerHTML += `
            <div class="cart-item">
                <img src="${item.images[0] || 'prerx logo.jpeg'}" onclick="window.location.href='landing.html?id=${item.id}'">
                <div class="cart-item-info">
                    <h4 class="cart-item-title" onclick="window.location.href='landing.html?id=${item.id}'">${item.name}</h4>
                    <div style="display:flex; justify-content:space-between; align-items:center; margin-top:5px;">
                        <span class="cart-item-price">${item.price} ج.م</span>
                        <div class="qty-controls" style="display:flex; align-items:center; gap:10px; background:rgba(255,255,255,0.05); padding:5px 10px; border-radius:8px;">
                            <button onclick="changeQty(${item.id}, -1)" style="background:none; border:none; color:var(--primary-color); cursor:pointer;"><i class="fa-solid fa-minus"></i></button>
                            <span>${item.qty}</span>
                            <button onclick="changeQty(${item.id}, 1)" style="background:none; border:none; color:var(--primary-color); cursor:pointer;"><i class="fa-solid fa-plus"></i></button>
                        </div>
                    </div>
                    <span class="remove-item" onclick="removeFromCart(${item.id})" style="margin-top:10px; display:inline-block; font-size:0.8rem; color:#ef4444; cursor:pointer;"><i class="fa-solid fa-trash"></i> إزالة</span>
                </div>
            </div>
        `;
    });
    updateTotals();
}

function updateTotals() {
    let subtotal = cartItems.reduce((s, i) => s + (i.price * i.qty), 0);
    let discount = 0;

    if (appliedCoupon) {
        if (appliedCoupon.apply_type === 'all' || !appliedCoupon.apply_type) {
            discount = appliedCoupon.type === 'fixed' ? appliedCoupon.discount : Math.round(subtotal * (appliedCoupon.discount / 100));
        } else if (appliedCoupon.apply_type === 'categories') {
            const eligibleTotal = cartItems.reduce((sum, item) => {
                const p = products.find(prod => prod.id === item.id);
                if (p && appliedCoupon.target_ids.includes(p.category)) {
                    return sum + (item.price * item.qty);
                }
                return sum;
            }, 0);
            discount = appliedCoupon.type === 'fixed' ? appliedCoupon.discount : Math.round(eligibleTotal * (appliedCoupon.discount / 100));
        } else if (appliedCoupon.apply_type === 'products') {
            const eligibleTotal = cartItems.reduce((sum, item) => {
                if (appliedCoupon.target_ids.includes(item.id.toString())) {
                    return sum + (item.price * item.qty);
                }
                return sum;
            }, 0);
            discount = appliedCoupon.type === 'fixed' ? appliedCoupon.discount : Math.round(eligibleTotal * (appliedCoupon.discount / 100));
        }
        if (discount > subtotal) discount = subtotal;
        if (appliedCoupon.type === 'percentage' && appliedCoupon.max_discount && appliedCoupon.max_discount > 0) {
            if (discount > appliedCoupon.max_discount) discount = appliedCoupon.max_discount;
        }
        
        document.getElementById('cart-discount-row').style.display = 'flex';
        document.getElementById('cart-discount-price').innerText = `-${discount} ج.م`;
    } else {
        document.getElementById('cart-discount-row').style.display = 'none';
    }

    // Read shipping from whichever governorate select has a value (cart or checkout)
    const cartGovEl = document.getElementById('cart-gov');
    const customerGovEl = document.getElementById('customer-gov');
    const govValue = (customerGovEl && customerGovEl.value) ? customerGovEl.value
                   : (cartGovEl ? cartGovEl.value : '');
    const originalShipPrice = parseFloat(govValue) || 0;
    
    // Check if cart has eligible items for the coupon
    let hasEligibleItems = false;
    if (appliedCoupon) {
        if (appliedCoupon.apply_type === 'all' || !appliedCoupon.apply_type) {
            hasEligibleItems = cartItems.length > 0;
        } else if (appliedCoupon.apply_type === 'categories') {
            hasEligibleItems = cartItems.some(item => {
                const p = products.find(prod => prod.id === item.id);
                return p && appliedCoupon.target_ids.includes(p.category);
            });
        } else if (appliedCoupon.apply_type === 'products') {
            hasEligibleItems = cartItems.some(item => appliedCoupon.target_ids.includes(item.id.toString()));
        }
    }

    const shipPrice = (appliedCoupon && appliedCoupon.free_shipping && hasEligibleItems) ? 0 : originalShipPrice;
    const total = subtotal - discount + shipPrice;

    document.getElementById('cart-subtotal-price').innerText = `${subtotal} ج.م`;
    
    const shippingEl = document.getElementById('cart-shipping-price');
    if (appliedCoupon && appliedCoupon.free_shipping && hasEligibleItems) {
        shippingEl.innerHTML = `<del style="color:#999; font-size:0.8rem;">${originalShipPrice} ج.م</del> <span style="color:#22c55e;">مجاني</span>`;
    } else {
        shippingEl.innerText = `${shipPrice} ج.م`;
    }
    
    document.getElementById('cart-total-price').innerText = `${total} ج.م`;

    // Checkout Summary
    if (document.getElementById('summary-subtotal')) {
        document.getElementById('summary-subtotal').innerText = `${subtotal} ج.م`;
        document.getElementById('summary-shipping').innerText = `${shipPrice} ج.م`;
        document.getElementById('summary-total').innerText = `${total} ج.م`;
        
        if (appliedCoupon) {
            document.getElementById('summary-discount-row').style.display = 'flex';
            document.getElementById('summary-discount').innerText = discount > 0 ? `-${discount} ج.م` : 'شحن مجاني';
        } else {
            document.getElementById('summary-discount-row').style.display = 'none';
        }
    }
}

function calculateCartTotal() {
    // Sync cart-gov → customer-gov so checkout modal stays in sync
    const cartGov = document.getElementById('cart-gov');
    const customerGov = document.getElementById('customer-gov');
    if (cartGov && customerGov && cartGov.value) {
        customerGov.value = cartGov.value;
    }
    updateTotals();
}

function calculateShipping() {
    // Sync customer-gov → cart-gov so updateTotals reads the right value
    const customerGov = document.getElementById('customer-gov');
    const cartGov = document.getElementById('cart-gov');
    if (customerGov && cartGov && customerGov.value) {
        cartGov.value = customerGov.value;
    }
    updateTotals();
}

// ===== COUPON LOGIC =====
function applyCoupon() {
    const code = document.getElementById('coupon-input').value.toUpperCase().trim();
    const msgEl = document.getElementById('coupon-msg');
    
    if (!code) return;

    const coupon = coupons.find(c => c.code === code);
    if (!coupon) {
        msgEl.innerText = 'كود الخصم غير موجود';
        msgEl.style.color = '#ef4444';
        return;
    }

    if (!coupon.is_active) {
        msgEl.innerText = 'هذا الكود معطل حالياً';
        msgEl.style.color = '#ef4444';
        return;
    }

    if (coupon.expiry_date && new Date(coupon.expiry_date) < new Date()) {
        msgEl.innerText = 'هذا الكود منتهي الصلاحية';
        msgEl.style.color = '#ef4444';
        return;
    }

    if (coupon.current_uses >= coupon.max_uses) {
        msgEl.innerText = 'تم الوصول للحد الأقصى لاستخدام الكود';
        msgEl.style.color = '#ef4444';
        return;
    }

    // Check eligibility
    let hasEligibleItems = false;
    if (coupon.apply_type === 'all' || !coupon.apply_type) {
        hasEligibleItems = cartItems.length > 0;
    } else if (coupon.apply_type === 'categories') {
        hasEligibleItems = cartItems.some(item => {
            const p = products.find(prod => prod.id === item.id);
            return p && coupon.target_ids.includes(p.category);
        });
    } else if (coupon.apply_type === 'products') {
        hasEligibleItems = cartItems.some(item => coupon.target_ids.includes(item.id.toString()));
    }

    if (!hasEligibleItems) {
        msgEl.innerText = 'هذا الكوبون لا ينطبق على المنتجات الموجودة في السلة';
        msgEl.style.color = '#ef4444';
        return;
    }

    let subtotal = cartItems.reduce((s, i) => s + (i.price * i.qty), 0);
    if (coupon.min_order && subtotal < coupon.min_order) {
        msgEl.innerText = `الحد الأدنى لاستخدام الكوبون هو ${coupon.min_order} ج.م`;
        msgEl.style.color = '#ef4444';
        return;
    }

    appliedCoupon = coupon;
    const discountVal = coupon.type === 'fixed' ? `${coupon.discount} ج.م` : `${coupon.discount}%`;
    if (coupon.discount > 0 && coupon.free_shipping) {
        msgEl.innerText = `تم تطبيق خصم ${discountVal} + شحن مجاني!`;
    } else if (coupon.discount > 0) {
        msgEl.innerText = `تم تطبيق خصم بقيمة ${discountVal}`;
    } else if (coupon.free_shipping) {
        msgEl.innerText = `تم تطبيق عرض الشحن المجاني!`;
    }
    
    msgEl.style.color = "#22c55e";
    updateTotals();
}

// ===== CHECKOUT LOGIC =====
function checkout() {
    if (cartItems.length === 0) return alert('السلة فارغة!');
    
    const cartGov = document.getElementById('cart-gov').value;
    if (cartGov) document.getElementById('customer-gov').value = cartGov;

    updateTotals();
    
    // Pixel InitiateCheckout
    const subtotal = cartItems.reduce((s, i) => s + (i.price * i.qty), 0);
    trackPixel('InitiateCheckout', { 
        value: subtotal, 
        currency: 'EGP', 
        content_ids: cartItems.map(i => i.id),
        content_type: 'product'
    });

    document.getElementById('checkout-overlay').classList.add('active');
    document.getElementById('checkout-modal').classList.add('active');
}

function closeCheckout() {
    document.getElementById('checkout-overlay').classList.remove('active');
    document.getElementById('checkout-modal').classList.remove('active');
}

async function submitOrder(e) {
    e.preventDefault();
    const btn = e.submitter;
    if (btn) btn.disabled = true;
    
    const govSelect = document.getElementById('customer-gov');
    const subtotal = cartItems.reduce((s, i) => s + (i.price * i.qty), 0);
    
    // Calculate discount
    let discount = 0;
    const uiDiscountEl = document.getElementById('cart-discount-price');
    if (uiDiscountEl && appliedCoupon) {
        discount = parseInt(uiDiscountEl.innerText.replace(/[^\d]/g, '')) || 0;
    }

    // Calculate shipping
    let originalShipping = parseFloat(govSelect.value) || 0;
    
    // Check if free shipping applies
    let hasEligibleItems = false;
    if (appliedCoupon) {
        if (appliedCoupon.apply_type === 'all' || !appliedCoupon.apply_type) {
            hasEligibleItems = cartItems.length > 0;
        } else if (appliedCoupon.apply_type === 'categories') {
            hasEligibleItems = cartItems.some(item => {
                const p = products.find(prod => prod.id === item.id);
                return p && appliedCoupon.target_ids.includes(p.category);
            });
        } else if (appliedCoupon.apply_type === 'products') {
            hasEligibleItems = cartItems.some(item => appliedCoupon.target_ids.includes(item.id.toString()));
        }
    }
    
    const shipping = (appliedCoupon && appliedCoupon.free_shipping && hasEligibleItems) ? 0 : originalShipping;
    const total = subtotal - discount + shipping;

    const orderData = {
        // Flattened properties for DB columns
        customer_name: document.getElementById('customer-name').value,
        customer_phone: document.getElementById('customer-phone').value.replace(/[٠-٩]/g, d => '٠١٢٣٤٥٦٧٨٩'.indexOf(d)),
        governorate: govSelect.options[govSelect.selectedIndex].dataset.name,
        district: document.getElementById('customer-district').value,
        address: document.getElementById('customer-address').value,
        notes: document.getElementById('customer-notes').value,
        
        items: cartItems.map(i => ({ id: i.id, name: i.name, price: i.price, qty: i.qty })),
        subtotal: subtotal,
        shipping: shipping,
        discount: discount,
        coupon: appliedCoupon ? appliedCoupon.code : null,
        total: total,
        status: 'new'
    };
    
    try {
        const savedOrder = await SupabaseService.saveOrder(orderData);
        
        // Update coupon uses in Supabase (non-blocking)
        if (appliedCoupon) {
            SupabaseService.saveCoupon({ 
                id: appliedCoupon.id, 
                current_uses: (appliedCoupon.current_uses || 0) + 1 
            }).catch(err => console.warn('Coupon usage update failed:', err));
        }

        // WhatsApp Message
        sendWhatsApp({ ...orderData, id: savedOrder.id, date: new Date().toLocaleDateString('ar-EG') });

        // Clear Cart
        cartItems = [];
        localStorage.removeItem('perex_cart');
        appliedCoupon = null;
        updateCartUI();
        closeCheckout();
        document.getElementById('checkout-form').reset();
        // Show Success Modal
        document.getElementById('success-overlay').classList.add('active');
        document.getElementById('success-modal').classList.add('active');
        
        // Pixel
        trackPixel('Purchase', { value: total, currency: 'EGP', content_ids: orderData.items.map(i => i.id) });
    } catch (e) {
        console.error('Order Submit Error:', e);
        alert('حدث خطأ أثناء إرسال الطلب: ' + e.message);
        if (btn) btn.disabled = false;
    }
}

function sendWhatsApp(o) {
    let msg = `*${settings.store.waMsg}*\n\n`;
    msg += `👤 *العميل:* ${o.customer_name}\n`;
    msg += `📞 *الهاتف:* ${o.customer_phone}\n`;
    msg += `📍 *العنوان:* ${o.governorate} - ${o.district || ''}\n`;
    msg += `🏠 *التفاصيل:* ${o.address}\n`;
    if (o.notes) msg += `📝 *ملاحظات:* ${o.notes}\n`;
    msg += `\n📦 *المنتجات:*\n`;
    o.items.forEach((i, idx) => msg += `${idx+1}. ${i.name} (عدد: ${i.qty}) (${i.price * i.qty} ج.م)\n`);
    msg += `\n💰 *الحساب:*\n`;
    msg += `قيمة المنتجات: ${o.subtotal} ج.م\n`;
    if (o.discount) msg += `خصم الكوبون: -${o.discount} ج.م\n`;
    msg += `مصاريف الشحن: ${o.shipping} ج.م\n`;
    msg += `*الإجمالي المطلوب:* ${o.total} ج.م\n`;
    
    const url = `https://wa.me/${settings.store.whatsapp}?text=${encodeURIComponent(msg)}`;
    window.open(url, '_blank');
}

// ===== UI HELPERS =====
function initUI() {
    document.getElementById('cart-icon').addEventListener('click', openCart);
    document.getElementById('close-cart').addEventListener('click', closeCart);
    document.getElementById('cart-overlay').addEventListener('click', closeCart);
    document.getElementById('close-checkout').addEventListener('click', closeCheckout);
    document.getElementById('checkout-overlay').addEventListener('click', closeCheckout);

    // Mobile Menu
    const toggle = document.getElementById('menu-toggle');
    const nav = document.querySelector('.nav-links');
    const menuOverlay = document.getElementById('menu-overlay');

    if (toggle && nav && menuOverlay) {
        const toggleMenu = (e) => {
            if (e) e.stopPropagation();
            nav.classList.toggle('active');
            menuOverlay.classList.toggle('active');
            document.body.style.overflow = nav.classList.contains('active') ? 'hidden' : '';
            const icon = toggle.querySelector('i');
            if (icon) {
                icon.classList.toggle('fa-bars');
                icon.classList.toggle('fa-xmark');
            }
        };

        toggle.addEventListener('click', toggleMenu);
        menuOverlay.addEventListener('click', toggleMenu);
        
        // Close menu when clicking a link
        nav.querySelectorAll('a').forEach(link => {
            link.addEventListener('click', () => {
                if (nav.classList.contains('active')) toggleMenu();
            });
        });
    }

    // Header Scroll
    window.addEventListener('scroll', () => {
        const header = document.getElementById('header');
        if (window.scrollY > 50) header.classList.add('scrolled');
        else header.classList.remove('scrolled');
    }, { passive: true });

    renderReviews();
}

async function submitReview(e) {
    e.preventDefault();
    const user = document.getElementById('reviewer-name').value || 'عميل مجهول';
    const text = document.getElementById('reviewer-comment').value;
    
    try {
        await SupabaseService.saveReview({ 
            user_name: user, 
            comment: text, 
            rating: 5 
        });
        
        document.getElementById('review-form').reset();
        await renderReviews();
        alert('شكراً لتقييمك!');
    } catch (e) {
        alert('حدث خطأ أثناء إرسال التقييم.');
    }
}

async function renderReviews() {
    const container = document.getElementById('reviews-list');
    if (!container) return;
    
    try {
        const reviews = await SupabaseService.getReviews();
        
        container.innerHTML = reviews.slice().reverse().map(r => `
            <div class="review-card" style="background: rgba(255,255,255,0.05); padding: 15px; border-radius: 15px; margin-bottom: 10px; border: 1px solid rgba(255,255,255,0.1);">
                <div style="display: flex; justify-content: space-between; margin-bottom: 5px;">
                    <strong style="color: var(--primary-color);">${r.user_name || r.user}</strong>
                    <small style="opacity: 0.6;">${r.date}</small>
                </div>
                <p style="font-size: 0.9rem; line-height: 1.5;">${r.comment || r.text}</p>
                ${r.reply ? `
                    <div style="margin-top:12px; padding:10px; background:rgba(14,165,233,0.1); border-right:3px solid var(--primary-color); border-radius:8px;">
                        <strong style="color:var(--primary-color); display:block; font-size:0.85rem; margin-bottom:4px;">رد المتجر:</strong>
                        <p style="font-size:0.85rem; color:#000000;">${r.reply}</p>
                    </div>
                ` : ''}
            </div>
        `).join('');
    } catch (e) {
        console.error('Reviews render error:', e);
    }
}

function openCart() {
    document.getElementById('cart-overlay').classList.add('active');
    document.getElementById('cart-sidebar').classList.add('active');
}
function closeCart() {
    document.getElementById('cart-overlay').classList.remove('active');
    document.getElementById('cart-sidebar').classList.remove('active');
}

function slideImg(btn, dir, id) {
    const p = products.find(prod => prod.id === id);
    const img = btn.parentElement.querySelector('img');
    const counter = btn.parentElement.querySelector('.img-counter');
    let currentIdx = p.images.indexOf(img.src);
    if (currentIdx === -1) currentIdx = 0;
    
    let nextIdx = currentIdx + dir;
    if (nextIdx < 0) nextIdx = p.images.length - 1;
    if (nextIdx >= p.images.length) nextIdx = 0;
    
    img.src = p.images[nextIdx];
    counter.innerText = `${nextIdx + 1} / ${p.images.length}`;
}

let sliderInterval;
let currentSlide = 0;

function renderMainSliders() {
    const container = document.getElementById('slider-container');
    const wrapper = document.getElementById('dynamic-sliders');
    const heroSection = document.getElementById('home');
    const overlayText = document.getElementById('slider-overlay-text');
    const titleEl = document.getElementById('slider-title');
    const descEl = document.getElementById('slider-desc');
    const dotsContainer = document.getElementById('slider-dots');
    
    // Check if main banner is active
    const isMainActive = settings.banner && settings.banner.isActive !== false;
    if (isMainActive) {
        if (wrapper) wrapper.style.display = 'none';
        if (heroSection) heroSection.style.display = 'flex';
        return;
    }

    if (!container || !settings.sliders || settings.sliders.length === 0) {
        if (wrapper) wrapper.style.display = 'none';
        if (heroSection) heroSection.style.display = 'flex'; // fallback to hero
        return;
    }

    if (heroSection) heroSection.style.display = 'none';
    if (wrapper) wrapper.style.display = 'block';
    
    if (settings.banner && (settings.banner.title || settings.banner.desc)) {
        if (overlayText) overlayText.style.display = 'flex';
        if (titleEl) titleEl.innerText = settings.banner.title || '';
        if (descEl) descEl.innerText = settings.banner.desc || '';
    } else {
        if (overlayText) overlayText.style.display = 'none';
    }

    container.innerHTML = settings.sliders.map(s => `
        <div style="flex: 0 0 100%; height: 100%; will-change: transform;">
            <img src="${s.img}" style="width: 100%; height: 100%; object-fit: cover; object-position: center;" loading="lazy" decoding="async">
        </div>
    `).join('');
    
    if (dotsContainer) {
        dotsContainer.innerHTML = settings.sliders.map((_, i) => `
            <div class="slider-dot ${i === 0 ? 'active' : ''}" onclick="goToSlide(${i})"></div>
        `).join('');
    }

    currentSlide = 0;
    updateSliderPosition();
    resetSliderInterval();
}

function updateSliderPosition() {
    const container = document.getElementById('slider-container');
    if (!container) return;
    
    const isRtl = document.documentElement.getAttribute('dir') === 'rtl' || document.body.getAttribute('dir') === 'rtl';
    const directionMultiplier = isRtl ? 1 : -1;
    
    container.style.transform = `translateX(${currentSlide * 100 * directionMultiplier}%)`;
    
    // Update dots
    const dots = document.querySelectorAll('.slider-dot');
    dots.forEach((dot, index) => {
        if (index === currentSlide) {
            dot.classList.add('active');
        } else {
            dot.classList.remove('active');
        }
    });
}

function moveMainSlider(dir) {
    if (!settings.sliders) return;
    const total = settings.sliders.length;
    if (total === 0) return;
    
    currentSlide = (currentSlide + dir + total) % total;
    updateSliderPosition();
    resetSliderInterval();
}

function goToSlide(index) {
    if (!settings.sliders || index < 0 || index >= settings.sliders.length) return;
    currentSlide = index;
    updateSliderPosition();
    resetSliderInterval();
}

function resetSliderInterval() {
    if (sliderInterval) clearInterval(sliderInterval);
    sliderInterval = setInterval(() => {
        moveMainSlider(1); // Auto slide to next
    }, 4000);
}

function initScrollReveal() {
    const revealElements = document.querySelectorAll('.feature-card, .section-title, .product-card, .reviews-content');
    revealElements.forEach(el => el.classList.add('reveal'));

    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('active');
            }
        });
    }, { threshold: 0.05, rootMargin: '50px' });

    revealElements.forEach(el => observer.observe(el));
}

function closeSuccessModal() {
    document.getElementById('success-overlay').classList.remove('active');
    document.getElementById('success-modal').classList.remove('active');
}

// ===== SMART OFFER SYSTEM =====
let smartOfferActive = false;
let cartIdleTimer = null;

function initSmartOffers() {
    if (!settings.offers) return;
    const offers = settings.offers;

    // 1. Welcome Popup
    if (offers.welcome && offers.welcome.enabled) {
        const w = offers.welcome;
        if (w.oncePerSession && sessionStorage.getItem('perex_offer_welcome_shown')) return initExitIntent();
        setTimeout(() => {
            if (!smartOfferActive) showSmartOffer(w, 'welcome');
        }, (w.delay || 5) * 1000);
    }

    // 2. Exit Intent
    initExitIntent();

    // 3. Cart Abandonment
    initCartAbandonment();
}

function initExitIntent() {
    const offers = settings.offers;
    if (!offers || !offers.exitIntent || !offers.exitIntent.enabled) return;
    const e = offers.exitIntent;
    if (e.oncePerSession && sessionStorage.getItem('perex_offer_exit_shown')) return;

    // Desktop: mouseleave at top
    let exitTriggered = false;
    document.addEventListener('mouseleave', (ev) => {
        if (ev.clientY <= 5 && !exitTriggered && !smartOfferActive) {
            exitTriggered = true;
            showSmartOffer(e, 'exit');
        }
    });

    // Mobile: detect quick scroll-up (intent to leave)
    let lastScrollY = 0;
    let scrollUpDistance = 0;
    window.addEventListener('scroll', () => {
        const currentY = window.scrollY;
        if (currentY < lastScrollY) {
            scrollUpDistance += (lastScrollY - currentY);
            if (scrollUpDistance > 300 && currentY < 100 && !exitTriggered && !smartOfferActive) {
                exitTriggered = true;
                showSmartOffer(e, 'exit');
            }
        } else {
            scrollUpDistance = 0;
        }
        lastScrollY = currentY;
    }, { passive: true });
}

function initCartAbandonment() {
    const offers = settings.offers;
    if (!offers || !offers.cartAbandonment || !offers.cartAbandonment.enabled) return;
    const c = offers.cartAbandonment;
    if (c.oncePerSession && sessionStorage.getItem('perex_offer_cart_shown')) return;

    const resetIdleTimer = () => {
        if (cartIdleTimer) clearTimeout(cartIdleTimer);
        const cart = JSON.parse(localStorage.getItem('perex_cart')) || [];
        if (cart.length === 0) return;

        cartIdleTimer = setTimeout(() => {
            if (!smartOfferActive) {
                showSmartOffer(c, 'cart');
            }
        }, (c.delay || 30) * 1000);
    };

    // Start timer and reset on user interactions
    ['scroll', 'click', 'keypress', 'mousemove', 'touchstart'].forEach(evt => {
        document.addEventListener(evt, resetIdleTimer, { passive: true, once: false });
    });

    // Initial start with a slight delay
    setTimeout(resetIdleTimer, 3000);
}

function buildOfferHTML(offer, type) {
    const pos = offer.position || 'center';
    const isBar = pos === 'top' || pos === 'bottom';

    const couponHTML = offer.coupon ? `
        <div class="smart-offer-coupon" onclick="copyOfferCoupon(this, '${offer.coupon}')" title="اضغط للنسخ">
            ${offer.coupon} <i class="fa-regular fa-copy"></i>
        </div>
    ` : '';

    const btnHTML = offer.btnText ? `
        <a href="${offer.btnLink || '#products'}" class="smart-offer-btn" onclick="closeSmartOffer()">${offer.btnText}</a>
    ` : '';

    if (isBar) {
        return `
            <div class="smart-offer-icon"><i class="fa-solid ${offer.icon || 'fa-gift'}"></i></div>
            <div class="smart-offer-body">
                <h3>${offer.title || ''}</h3>
                <p>${offer.desc || ''}</p>
            </div>
            <div class="smart-offer-actions">
                ${couponHTML}
                ${btnHTML}
            </div>
            <button class="smart-offer-close" onclick="closeSmartOffer()"><i class="fa-solid fa-xmark"></i></button>
        `;
    }

    // Center popup
    return `
        <button class="smart-offer-close" onclick="closeSmartOffer()"><i class="fa-solid fa-xmark"></i></button>
        <div class="smart-offer-icon"><i class="fa-solid ${offer.icon || 'fa-gift'}"></i></div>
        <h3>${offer.title || ''}</h3>
        <p>${offer.desc || ''}</p>
        ${couponHTML}
        <div>${btnHTML}</div>
    `;
}

function showSmartOffer(offer, type) {
    if (smartOfferActive) return;
    smartOfferActive = true;

    const container = document.getElementById('smart-offer-container');
    if (!container) return;

    const pos = offer.position || 'center';
    const needsOverlay = pos === 'center';

    container.innerHTML = `
        ${needsOverlay ? '<div class="smart-offer-overlay" id="smart-offer-overlay"></div>' : ''}
        <div class="smart-offer-popup position-${pos}" id="smart-offer-popup"
             style="background: ${offer.bgColor || '#0ea5e9'}; color: ${offer.textColor || '#ffffff'};">
            ${buildOfferHTML(offer, type)}
        </div>
    `;

    // Trigger animation after a frame
    requestAnimationFrame(() => {
        requestAnimationFrame(() => {
            const overlay = document.getElementById('smart-offer-overlay');
            const popup = document.getElementById('smart-offer-popup');
            if (overlay) overlay.classList.add('active');
            if (popup) popup.classList.add('active');
        });
    });

    // Click overlay to close (center only)
    const overlay = document.getElementById('smart-offer-overlay');
    if (overlay) overlay.addEventListener('click', closeSmartOffer);

    // Mark as shown
    sessionStorage.setItem(`perex_offer_${type}_shown`, '1');
}

function closeSmartOffer() {
    const overlay = document.getElementById('smart-offer-overlay');
    const popup = document.getElementById('smart-offer-popup');

    if (overlay) overlay.classList.remove('active');
    if (popup) popup.classList.remove('active');

    setTimeout(() => {
        const container = document.getElementById('smart-offer-container');
        if (container) container.innerHTML = '';
        smartOfferActive = false;
    }, 500);
}

function copyOfferCoupon(el, code) {
    navigator.clipboard.writeText(code).then(() => {
        el.classList.add('copied');
        const originalHTML = el.innerHTML;
        el.innerHTML = `${code} <i class="fa-solid fa-check"></i>`;
        setTimeout(() => {
            el.classList.remove('copied');
            el.innerHTML = originalHTML;
        }, 2000);
    });
}

// ===== Cart Add Notification Functions =====
let cartNotificationTimeout = null;

function showAddToCartNotification(product) {
    let container = document.getElementById('cart-notification');
    if (!container) {
        container = document.createElement('div');
        container.id = 'cart-notification';
        container.className = 'cart-notification';
        document.body.appendChild(container);
    }
    
    container.innerHTML = `
        <div class="cart-notification-progress"></div>
        <div class="cart-notification-header">
            <div class="cart-notification-title">
                <span class="success-icon"><i class="fa-solid fa-circle-check"></i></span>
                <span>تمت الإضافة إلى سلة التسوق</span>
            </div>
            <button class="cart-notification-close" onclick="closeCartNotification()"><i class="fa-solid fa-xmark"></i></button>
        </div>
        <div class="cart-notification-body">
            <div class="product-details-wrap">
                <span class="product-name">${product.name}</span>
                <span class="product-price">${product.price} ج.م</span>
            </div>
            <img class="product-img" src="${product.images[0] || 'prerx logo.jpeg'}" alt="${product.name}">
        </div>
        <div class="cart-notification-footer">
            <button class="btn btn-primary" onclick="checkoutFromNotification()">إتمام الطلب <i class="fa-solid fa-receipt"></i></button>
            <button class="btn btn-secondary" onclick="viewCartFromNotification()">عرض السلة <i class="fa-solid fa-cart-shopping"></i></button>
        </div>
    `;
    
    if (cartNotificationTimeout) {
        clearTimeout(cartNotificationTimeout);
    }
    
    container.classList.remove('active');
    void container.offsetWidth; // Force reflow
    container.classList.add('active');
    
    cartNotificationTimeout = setTimeout(() => {
        closeCartNotification();
    }, 6000);
}

function closeCartNotification() {
    const container = document.getElementById('cart-notification');
    if (container) {
        container.classList.remove('active');
    }
    if (cartNotificationTimeout) {
        clearTimeout(cartNotificationTimeout);
        cartNotificationTimeout = null;
    }
}

function checkoutFromNotification() {
    closeCartNotification();
    checkout();
}

// Function to safely open the cart sidebar
function viewCartFromNotification() {
    closeCartNotification();
    openCart();
}

function showVariantNotification(product) {
    let container = document.getElementById('cart-notification');
    if (!container) {
        container = document.createElement('div');
        container.id = 'cart-notification';
        container.className = 'cart-notification';
        document.body.appendChild(container);
    }
    
    container.innerHTML = `
        <div class="cart-notification-progress" style="background: var(--primary-color);"></div>
        <div class="cart-notification-header">
            <div class="cart-notification-title">
                <span class="success-icon" style="color: var(--primary-color);"><i class="fa-solid fa-sliders"></i></span>
                <span>اختر المواصفات أولاً</span>
            </div>
            <button class="cart-notification-close" onclick="closeCartNotification()"><i class="fa-solid fa-xmark"></i></button>
        </div>
        <div class="cart-notification-body">
            <div class="product-details-wrap">
                <span class="product-name">${product.name}</span>
                <span style="font-size:0.85rem; color: var(--muted-color);">يحتوي هذا المنتج على ${product.has_colors && product.has_sizes ? 'ألوان ومقاسات' : product.has_colors ? 'ألوان' : 'مقاسات'} متعددة</span>
            </div>
            <img class="product-img" src="${product.images[0] || 'prerx logo.jpeg'}" alt="${product.name}">
        </div>
        <div class="cart-notification-footer">
            <button class="btn btn-primary" onclick="closeCartNotification(); window.location.href='landing.html?id=${product.id}'">اختر المواصفات <i class="fa-solid fa-arrow-left"></i></button>
            <button class="btn btn-secondary" onclick="closeCartNotification()">إلغاء</button>
        </div>
    `;
    
    if (cartNotificationTimeout) clearTimeout(cartNotificationTimeout);
    container.classList.remove('active');
    void container.offsetWidth;
    container.classList.add('active');
    
    cartNotificationTimeout = setTimeout(() => closeCartNotification(), 6000);
}

// Expose functions globally for dynamic elements
window.showAddToCartNotification = showAddToCartNotification;
window.showVariantNotification = showVariantNotification;
window.closeCartNotification = closeCartNotification;
window.checkoutFromNotification = checkoutFromNotification;
window.viewCartFromNotification = viewCartFromNotification;

