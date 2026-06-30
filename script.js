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

    // Check URL parameters for cart action
    const urlParams = new URLSearchParams(window.location.search);
    const couponParam = urlParams.get('coupon');
    if (couponParam) {
        const couponInput = document.getElementById('coupon-input');
        if (couponInput) {
            couponInput.value = couponParam;
            applyCoupon();
        }
    }
    if (urlParams.get('openCart') === 'true') {
        openCart();
    } else if (urlParams.get('checkout') === 'true') {
        checkout();
    }
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

    if (heroTitle) {
        const title = settings.banner.title || "ارتقِ بتجربة هاتفك مع";
        const storeName = settings.store.name || "Perex Store";
        // Remove duplicate store name if present in title to keep it clean
        const cleanTitle = title.replace(storeName, '').trim();
        heroTitle.innerHTML = `${cleanTitle} <span class="highlight">${storeName}</span>`;
    }
    if (heroDesc) heroDesc.innerText = settings.banner.desc || "نقدم لك تشكيلة واسعة من أحدث وأجود إكسسوارات الهواتف الذكية.";
    if (heroBtn) heroBtn.innerHTML = `${settings.banner.cta || 'تسوق الآن'} <i class="fa-solid fa-arrow-left"></i>`;

    // Render Hero Image or Video dynamically
    const heroImageContainer = document.querySelector('.hero-image');
    if (heroImageContainer) {
        const isVideo = settings.banner && settings.banner.mediaType === 'video';
        const glassCard = heroImageContainer.querySelector('.glass-card');
        
        // Remove existing img or video
        const existingImg = heroImageContainer.querySelector('img');
        const existingVideo = heroImageContainer.querySelector('video');
        if (existingImg) existingImg.remove();
        if (existingVideo) existingVideo.remove();
        
        if (isVideo && settings.banner.video) {
            const videoEl = document.createElement('video');
            videoEl.preload = 'none'; // Save bandwidth
            videoEl.autoplay = true;
            videoEl.loop = true;
            videoEl.muted = true;
            videoEl.setAttribute('playsinline', '');
            videoEl.style.width = '100%';
            videoEl.style.borderRadius = '20px';
            videoEl.style.boxShadow = 'var(--shadow)';
            videoEl.style.animation = 'float 6s ease-in-out infinite';
            videoEl.style.willChange = 'transform';
            
            const loadVideoSrc = () => {
                if (!videoEl.src) {
                    videoEl.src = settings.banner.video;
                    videoEl.load();
                }
            };

            // Defer starting lazy load observer until after page load to prioritize CSS/fonts
            const initVideoObserver = () => {
                if ('IntersectionObserver' in window) {
                    const observer = new IntersectionObserver((entries, obs) => {
                        entries.forEach(entry => {
                            if (entry.isIntersecting) {
                                loadVideoSrc();
                                obs.unobserve(entry.target);
                            }
                        });
                    }, { rootMargin: '200px' });
                    observer.observe(videoEl);
                } else {
                    loadVideoSrc();
                }
            };

            if (document.readyState === 'complete') {
                setTimeout(initVideoObserver, 400);
            } else {
                window.addEventListener('load', () => setTimeout(initVideoObserver, 400));
            }
            
            if (glassCard) {
                heroImageContainer.insertBefore(videoEl, glassCard);
            } else {
                heroImageContainer.appendChild(videoEl);
            }
        } else {
            const imgEl = document.createElement('img');
            imgEl.src = (settings.banner && settings.banner.img) || 'https://images.unsplash.com/photo-1601593346740-925612772716?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80';
            imgEl.alt = 'إكسسوارات هواتف';
            imgEl.width = 600;
            imgEl.height = 600;
            imgEl.loading = 'eager';
            imgEl.setAttribute('fetchpriority', 'high');
            
            if (glassCard) {
                heroImageContainer.insertBefore(imgEl, glassCard);
            } else {
                heroImageContainer.appendChild(imgEl);
            }
        }
    }

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
        
        const footerCopyright = document.querySelector('.footer-bottom .copyright') || document.querySelector('.footer-bottom p');
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
    // TikTok Pixel Initialization
    if (settings.store.tiktokPixel) {
        initTikTokPixel(settings.store.tiktokPixel);
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
    trackTikTokPixel(event, data);
}

// ===== TIKTOK PIXEL =====
function initTikTokPixel(id) {
    if (!id) return;
    if (window.ttq && window.ttq._i && window.ttq._i[id]) {
        // Already initialized
        window.ttq.page();
        return;
    }
    !function (w, d, t) {
        w.TiktokAnalyticsObject = t;
        var ttq = w[t] = w[t] || [];
        ttq.methods = ['page','track','identify','instances','debug','on','off','once','ready','alias','group','enableCookie','disableCookie'];
        ttq.setAndDefer = function(t, e) { t[e] = function() { t.push([e].concat(Array.prototype.slice.call(arguments, 0))); }; };
        for (var i = 0; i < ttq.methods.length; i++) ttq.setAndDefer(ttq, ttq.methods[i]);
        ttq.instance = function(t) { for (var e = ttq._i[t] || [], n = 0; n < ttq.methods.length; n++) ttq.setAndDefer(e, ttq.methods[n]); return e; };
        ttq.load = function(e, n) {
            var i = 'https://analytics.tiktok.com/i18n/pixel/events.js';
            ttq._i = ttq._i || {}; ttq._i[e] = []; ttq._i[e]._u = i; ttq._t = ttq._t || {}; ttq._t[e] = +new Date; ttq._o = ttq._o || {}; ttq._o[e] = n || {};
            n = document.createElement('script'); n.type = 'text/javascript'; n.async = !0; n.src = i + '?sdkid=' + e + '&lib=' + t;
            var a = document.getElementsByTagName('script')[0]; a.parentNode.insertBefore(n, a);
        };
        ttq.load(id);
        ttq.page();
    }(window, document, 'ttq');
}

function trackTikTokPixel(event, data = {}) {
    if (!window.ttq) return;
    // Map Facebook events to TikTok standard events
    const ttMap = {
        'PageView':     () => window.ttq.page(),
        'ViewContent':  () => window.ttq.track('ViewContent',  { content_id: (data.content_ids || [])[0], content_name: data.content_name, value: data.value, currency: data.currency || 'EGP' }),
        'AddToCart':    () => window.ttq.track('AddToCart',    { content_id: (data.content_ids || [])[0], content_name: data.content_name, value: data.value, currency: data.currency || 'EGP' }),
        'InitiateCheckout': () => window.ttq.track('InitiateCheckout', { value: data.value, currency: data.currency || 'EGP' }),
        'Purchase':     () => window.ttq.track('CompletePayment', { content_id: (data.content_ids || [])[0], content_name: data.content_name, value: data.value, currency: data.currency || 'EGP' }),
        'Contact':      () => window.ttq.track('Contact')
    };
    if (ttMap[event]) ttMap[event]();
    else {
        try { window.ttq.track(event, data); } catch(e) {}
    }
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
            <div class="product-card" style="cursor: pointer;" onclick="window.location.href = 'product.html?id=${p.id}'">
                ${p.badge || (discount > 0 ? `خصم ${discount}%` : '') ? `<span class="product-badge">${p.badge || `خصم ${discount}%`}</span>` : ''}
                <div class="product-image">
                    <img src="${typeof p.images[0] === 'string' ? p.images[0] : (p.images[0]?.url || 'prerx logo.jpeg')}" alt="${p.name}" loading="lazy" decoding="async">
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

function changeQty(cartId, delta) {
    const item = cartItems.find(i => 
        i.cartId === cartId || 
        i.cartId === String(cartId) || 
        (String(i.id) === String(cartId) && !i.color && !i.size)
    );
    if (!item) return;
    item.qty += delta;
    if (item.qty < 1) return removeFromCart(cartId);
    updateCartUI();
}

function removeFromCart(cartId) {
    cartItems = cartItems.filter(item => 
        item.cartId !== cartId && 
        item.cartId !== String(cartId) && 
        !(String(item.id) === String(cartId) && !item.color && !item.size)
    );
    updateCartUI();
}

function updateCartUI() {
    const count = document.querySelector('.cart-count');
    const container = document.getElementById('cart-items');
    
    localStorage.setItem('perex_cart', JSON.stringify(cartItems));
    if (count) count.innerText = cartItems.reduce((s, i) => s + i.qty, 0);
    
    if (!container) return;
    container.innerHTML = '';

    if (cartItems.length === 0) {
        container.innerHTML = '<p class="empty-cart-msg">السلة فارغة حالياً</p>';
        appliedCoupon = null;
        calculateCartTotal();
        return;
    }

    cartItems.forEach((item) => {
        const variantText = (item.color || item.size) ? ` (${[item.color, item.size].filter(x => x).join(' - ')})` : '';
        const itemKey = item.cartId || item.id;
        
        let itemImg = 'prerx logo.jpeg';
        if (item.images && item.images.length > 0) {
            const matchedImg = item.images.find(img => 
                typeof img !== 'string' && 
                img.color && 
                img.color.trim().toLowerCase() === (item.color || '').trim().toLowerCase()
            );
            if (matchedImg && matchedImg.url) {
                itemImg = matchedImg.url;
            } else {
                const firstImg = item.images[0];
                itemImg = typeof firstImg === 'string' ? firstImg : (firstImg?.url || 'prerx logo.jpeg');
            }
        }

        container.innerHTML += `
            <div class="cart-item">
                <img src="${itemImg}" onclick="window.location.href='product.html?id=${item.id}'" style="cursor: pointer;">
                <div class="cart-item-info">
                    <h4 class="cart-item-title" onclick="window.location.href='product.html?id=${item.id}'" style="cursor: pointer;">${item.name}${variantText}</h4>
                    <div style="display:flex; justify-content:space-between; align-items:center; margin-top:5px;">
                        <span class="cart-item-price">${item.price} ج.م</span>
                        <div class="qty-controls" style="display:flex; align-items:center; gap:10px; background:rgba(255,255,255,0.05); padding:5px 10px; border-radius:8px;">
                            <button onclick="changeQty('${itemKey}', -1)" style="background:none; border:none; color:var(--primary-color); cursor:pointer;"><i class="fa-solid fa-minus"></i></button>
                            <span>${item.qty}</span>
                            <button onclick="changeQty('${itemKey}', 1)" style="background:none; border:none; color:var(--primary-color); cursor:pointer;"><i class="fa-solid fa-plus"></i></button>
                        </div>
                    </div>
                    <span class="remove-item" onclick="removeFromCart('${itemKey}')" style="margin-top:10px; display:inline-block; font-size:0.8rem; color:#ef4444; cursor:pointer;"><i class="fa-solid fa-trash"></i> إزالة</span>
                </div>
            </div>
        `;
    });
    
    calculateCartTotal();
}

function applyCoupon() {
    const input = document.getElementById('coupon-input');
    const msg = document.getElementById('coupon-msg');
    const code = input.value.toUpperCase().trim();
    
    if (!code) {
        appliedCoupon = null;
        if (msg) {
            msg.innerText = 'تم إزالة كود الخصم';
            msg.style.color = '#ef4444';
        }
        calculateCartTotal();
        calculateShipping();
        return;
    }
    
    const coupon = coupons.find(c => c.code === code && c.is_active !== false);
    if (!coupon) {
        msg.innerText = 'كود الخصم غير صالح أو منتهي الصلاحية';
        msg.style.color = '#ef4444';
        appliedCoupon = null;
        calculateCartTotal();
        return;
    }
    
    // Check expiry
    if (coupon.expiry_date && new Date(coupon.expiry_date) < new Date()) {
        msg.innerText = 'كود الخصم منتهي الصلاحية';
        msg.style.color = '#ef4444';
        appliedCoupon = null;
        calculateCartTotal();
        return;
    }

    let subtotal = cartItems.reduce((s, i) => s + (i.price * i.qty), 0);
    if (coupon.min_order && subtotal < coupon.min_order) {
        msg.innerText = `الحد الأدنى لتطبيق الكود هو ${coupon.min_order} ج.م`;
        msg.style.color = '#ef4444';
        appliedCoupon = null;
        calculateCartTotal();
        return;
    }

    appliedCoupon = coupon;
    msg.innerText = 'تم تطبيق الكود بنجاح!';
    msg.style.color = '#22c55e';
    calculateCartTotal();
}

function calculateCartTotal() {
    let subtotal = cartItems.reduce((s, i) => s + (i.price * i.qty), 0);
    let discount = 0;

    if (appliedCoupon) {
        if (appliedCoupon.apply_type === 'all' || !appliedCoupon.apply_type) {
            discount = appliedCoupon.type === 'fixed' ? appliedCoupon.discount : Math.round(subtotal * (appliedCoupon.discount / 100));
        } else if (appliedCoupon.apply_type === 'categories') {
            const applicableItems = cartItems.filter(item => appliedCoupon.target_ids.includes(item.category));
            let applicableSubtotal = applicableItems.reduce((s, i) => s + (i.price * i.qty), 0);
            discount = appliedCoupon.type === 'fixed' ? appliedCoupon.discount : Math.round(applicableSubtotal * (appliedCoupon.discount / 100));
        } else {
            const applicableItems = cartItems.filter(item => appliedCoupon.target_ids.includes(item.id.toString()) || appliedCoupon.target_ids.includes(item.id));
            let applicableSubtotal = applicableItems.reduce((s, i) => s + (i.price * i.qty), 0);
            discount = appliedCoupon.type === 'fixed' ? appliedCoupon.discount : Math.round(applicableSubtotal * (appliedCoupon.discount / 100));
        }

        if (appliedCoupon.max_discount && discount > appliedCoupon.max_discount) {
            discount = appliedCoupon.max_discount;
        }
    }

    const selectGov = document.getElementById('cart-gov');
    let shipping = 0;
    if (selectGov && selectGov.value) {
        shipping = parseFloat(selectGov.value) || 0;
    }

    if (appliedCoupon && appliedCoupon.free_shipping) {
        shipping = 0;
    }

    let total = subtotal - discount + shipping;
    if (total < 0) total = 0;

    document.getElementById('cart-subtotal-price').innerText = `${subtotal} ج.م`;
    document.getElementById('cart-shipping-price').innerText = `${shipping} ج.م`;
    document.getElementById('cart-total-price').innerText = `${total} ج.م`;

    const discountRow = document.getElementById('cart-discount-row');
    if (discount > 0) {
        discountRow.style.display = 'flex';
        document.getElementById('cart-discount-price').innerText = `-${discount} ج.م`;
    } else {
        discountRow.style.display = 'none';
    }
}



// ===== CHECKOUT & ORDER SUBMISSION =====
function checkout() {
    if (cartItems.length === 0) return;
    calculateShipping();
    closeCart();
    document.getElementById('checkout-modal').classList.add('active');
    document.getElementById('checkout-overlay').classList.add('active');
}

function closeCheckout() {
    document.getElementById('checkout-modal').classList.remove('active');
    document.getElementById('checkout-overlay').classList.remove('active');
}

function calculateShipping() {
    let subtotal = cartItems.reduce((s, i) => s + (i.price * i.qty), 0);
    let discount = 0;

    if (appliedCoupon) {
        if (appliedCoupon.apply_type === 'all' || !appliedCoupon.apply_type) {
            discount = appliedCoupon.type === 'fixed' ? appliedCoupon.discount : Math.round(subtotal * (appliedCoupon.discount / 100));
        } else if (appliedCoupon.apply_type === 'categories') {
            const applicableItems = cartItems.filter(item => appliedCoupon.target_ids.includes(item.category));
            let applicableSubtotal = applicableItems.reduce((s, i) => s + (i.price * i.qty), 0);
            discount = appliedCoupon.type === 'fixed' ? appliedCoupon.discount : Math.round(applicableSubtotal * (appliedCoupon.discount / 100));
        } else {
            const applicableItems = cartItems.filter(item => appliedCoupon.target_ids.includes(item.id.toString()) || appliedCoupon.target_ids.includes(item.id));
            let applicableSubtotal = applicableItems.reduce((s, i) => s + (i.price * i.qty), 0);
            discount = appliedCoupon.type === 'fixed' ? appliedCoupon.discount : Math.round(applicableSubtotal * (appliedCoupon.discount / 100));
        }

        if (appliedCoupon.max_discount && discount > appliedCoupon.max_discount) {
            discount = appliedCoupon.max_discount;
        }
    }

    const selectGov = document.getElementById('customer-gov');
    let shipping = 0;
    if (selectGov && selectGov.value) {
        shipping = parseFloat(selectGov.value) || 0;
    }

    if (appliedCoupon && appliedCoupon.free_shipping) {
        shipping = 0;
    }

    let total = subtotal - discount + shipping;
    if (total < 0) total = 0;

    document.getElementById('summary-subtotal').innerText = `${subtotal} ج.م`;
    document.getElementById('summary-shipping').innerText = `${shipping} ج.م`;
    document.getElementById('summary-total').innerText = `${total} ج.م`;

    const discRow = document.getElementById('summary-discount-row');
    if (discount > 0) {
        discRow.style.display = 'flex';
        document.getElementById('summary-discount').innerText = `-${discount} ج.م`;
    } else {
        discRow.style.display = 'none';
    }
}

async function submitOrder(e) {
    e.preventDefault();
    
    const name = document.getElementById('customer-name').value.trim();
    const phone = document.getElementById('customer-phone').value.trim();
    const govSelect = document.getElementById('customer-gov');
    const gov = govSelect.value; // shipping price
    const govName = govSelect.options[govSelect.selectedIndex]?.dataset?.name || govSelect.options[govSelect.selectedIndex]?.text?.replace(/\s*\(.*\)/, '').trim() || gov;
    const district = document.getElementById('customer-district').value.trim();
    const address = document.getElementById('customer-address').value.trim();
    const notes = document.getElementById('customer-notes').value.trim();

    if (cartItems.length === 0) return;

    let subtotal = cartItems.reduce((s, i) => s + (i.price * i.qty), 0);
    let discount = 0;

    if (appliedCoupon) {
        if (appliedCoupon.apply_type === 'all' || !appliedCoupon.apply_type) {
            discount = appliedCoupon.type === 'fixed' ? appliedCoupon.discount : Math.round(subtotal * (appliedCoupon.discount / 100));
        } else if (appliedCoupon.apply_type === 'categories') {
            const applicableItems = cartItems.filter(item => appliedCoupon.target_ids.includes(item.category));
            let applicableSubtotal = applicableItems.reduce((s, i) => s + (i.price * i.qty), 0);
            discount = appliedCoupon.type === 'fixed' ? appliedCoupon.discount : Math.round(applicableSubtotal * (appliedCoupon.discount / 100));
        } else {
            const applicableItems = cartItems.filter(item => appliedCoupon.target_ids.includes(item.id.toString()) || appliedCoupon.target_ids.includes(item.id));
            let applicableSubtotal = applicableItems.reduce((s, i) => s + (i.price * i.qty), 0);
            discount = appliedCoupon.type === 'fixed' ? appliedCoupon.discount : Math.round(applicableSubtotal * (appliedCoupon.discount / 100));
        }

        if (appliedCoupon.max_discount && discount > appliedCoupon.max_discount) {
            discount = appliedCoupon.max_discount;
        }
    }

    let shipping = parseFloat(gov) || 0;
    if (appliedCoupon && appliedCoupon.free_shipping) {
        shipping = 0;
    }

    let total = subtotal - discount + shipping;
    if (total < 0) total = 0;

    const itemsSummary = cartItems.map(item => ({
        id: item.id,
        name: item.name,
        price: item.price,
        qty: item.qty,
        color: item.color,
        size: item.size
    }));

    const orderData = {
        status: 'new',
        customer_name: name,
        customer_phone: phone,
        governorate: govName,
        district: district,
        address: address,
        notes: notes,
        items: itemsSummary,
        subtotal: subtotal,
        shipping: shipping,
        discount: discount,
        total: total,
        coupon: appliedCoupon ? appliedCoupon.code : null
    };

    try {
        const savedOrder = await SupabaseService.saveOrder(orderData);
        
        // Pixel Purchase Trigger
        trackPixel('Purchase', {
            content_ids: cartItems.map(i => i.id),
            content_name: cartItems.map(i => i.name).join(', '),
            value: total,
            currency: 'EGP'
        });

        // WhatsApp Notification
        sendWhatsAppNotification(savedOrder, cartItems);

        // Clear cart
        cartItems = [];
        localStorage.removeItem('perex_cart');
        updateCartUI();
        closeCheckout();
        
        // Success popup
        document.getElementById('success-overlay').classList.add('active');

    } catch (e) {
        alert('حدث خطأ أثناء إرسال الطلب: ' + e.message);
    }
}

function sendWhatsAppNotification(order, items) {
    if (!settings.store || !settings.store.whatsapp) return;
    
    const cleanNum = settings.store.whatsapp.replace(/\D/g, '');
    const num = cleanNum.startsWith('2') ? cleanNum : '2' + cleanNum;
    
    let text = `*طلب جديد رقم #${order.id}* 🛒\n\n`;
    text += `👤 *الاسم:* ${order.customer_name}\n`;
    text += `📞 *الهاتف:* ${order.customer_phone}\n`;
    text += `📍 *العنوان:* ${order.governorate} - ${order.district || ''} - ${order.address}\n`;
    if (order.notes) text += `📝 *ملاحظات:* ${order.notes}\n`;
    
    text += `\n*المنتجات المطلوبة:* 📦\n`;
    items.forEach((item, idx) => {
        const variantText = (item.color || item.size) ? ` (${[item.color, item.size].filter(x => x).join(' - ')})` : '';
        text += `${idx + 1}. ${item.name}${variantText} × ${item.qty} (${item.price} ج.م)\n`;
    });
    
    text += `\n💵 *قيمة المنتجات:* ${order.subtotal} ج.م\n`;
    if (order.discount > 0) text += `🎁 *الخصم (كود ${order.coupon}):* -${order.discount} ج.م\n`;
    text += `🚚 *الشحن:* ${order.shipping} ج.م\n`;
    text += `💰 *الإجمالي النهائي:* ${order.total} ج.م\n\n`;
    text += `_تم تأكيد هذا الطلب عبر Perex Store_`;
    
    const waUrl = `https://api.whatsapp.com/send?phone=${num}&text=${encodeURIComponent(text)}`;
    window.open(waUrl, '_blank');
}

// ===== UI HELPERS =====
function initUI() {
    document.getElementById('cart-icon').addEventListener('click', openCart);
    document.getElementById('close-cart').addEventListener('click', closeCart);
    document.getElementById('cart-overlay').addEventListener('click', closeCart);
    document.getElementById('close-checkout').addEventListener('click', closeCheckout);
    document.getElementById('checkout-overlay').addEventListener('click', closeCheckout);

    const couponInput = document.getElementById('coupon-input');
    if (couponInput) {
        couponInput.addEventListener('input', () => {
            if (couponInput.value.trim() === '') {
                appliedCoupon = null;
                const msg = document.getElementById('coupon-msg');
                if (msg) msg.innerText = '';
                calculateCartTotal();
                calculateShipping();
            }
        });
    }

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
    initSmartSearch();
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
    if (!p || !p.images || p.images.length === 0) return;
    const imgEl = btn.parentElement.querySelector('img');
    const counter = btn.parentElement.querySelector('.img-counter');
    
    const currentSrc = imgEl.src;
    let currentIdx = p.images.findIndex(img => {
        const url = typeof img === 'string' ? img : (img.url || '');
        return currentSrc === url || currentSrc.endsWith(url);
    });
    if (currentIdx === -1) currentIdx = 0;
    
    let nextIdx = currentIdx + dir;
    if (nextIdx < 0) nextIdx = p.images.length - 1;
    if (nextIdx >= p.images.length) nextIdx = 0;
    
    const nextImg = p.images[nextIdx];
    imgEl.src = typeof nextImg === 'string' ? nextImg : (nextImg.url || 'prerx logo.jpeg');
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

function showAddToCartNotification(product, color) {
    let container = document.getElementById('cart-notification');
    if (!container) {
        container = document.createElement('div');
        container.id = 'cart-notification';
        container.className = 'cart-notification';
        document.body.appendChild(container);
    }
    
    let imgSrc = 'prerx logo.jpeg';
    if (product.images && product.images.length > 0) {
        const matchedImg = product.images.find(img => 
            typeof img !== 'string' && 
            img.color && 
            img.color.trim().toLowerCase() === (color || '').trim().toLowerCase()
        );
        if (matchedImg && matchedImg.url) {
            imgSrc = matchedImg.url;
        } else {
            const firstImg = product.images[0];
            imgSrc = typeof firstImg === 'string' ? firstImg : (firstImg?.url || 'prerx logo.jpeg');
        }
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
            <img class="product-img" src="${imgSrc}" alt="${product.name}">
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
            <img class="product-img" src="${typeof product.images[0] === 'string' ? product.images[0] : (product.images[0]?.url || 'prerx logo.jpeg')}" alt="${product.name}">
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

// ===== SMART SEARCH ENGINE =====
function initSmartSearch() {
    const trigger    = document.getElementById('search-trigger');
    const overlay    = document.getElementById('search-overlay');
    const closeBtn   = document.getElementById('search-close-btn');
    const input      = document.getElementById('smart-search-input');
    const clearBtn   = document.getElementById('search-clear');
    const grid       = document.getElementById('search-results-grid');
    const info       = document.getElementById('search-results-info');

    if (!trigger || !overlay || !input) return;

    let searchTimeout = null;

    // ---- Open / Close ----
    function openSearch() {
        overlay.classList.add('active');
        document.body.style.overflow = 'hidden';
        setTimeout(() => input.focus(), 120);
    }

    function closeSearch() {
        overlay.classList.remove('active');
        document.body.style.overflow = '';
        input.value = '';
        clearBtn.style.display = 'none';
        renderEmpty();
        if (info) info.textContent = '';
    }

    trigger.addEventListener('click', openSearch);
    closeBtn.addEventListener('click', closeSearch);

    // Close when clicking backdrop
    overlay.addEventListener('click', (e) => {
        if (e.target === overlay) closeSearch();
    });

    // Keyboard: Escape closes, Ctrl+K / Cmd+K opens
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && overlay.classList.contains('active')) {
            closeSearch();
        }
        if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
            e.preventDefault();
            overlay.classList.contains('active') ? closeSearch() : openSearch();
        }
    });

    // ---- Clear button ----
    clearBtn.addEventListener('click', () => {
        input.value = '';
        clearBtn.style.display = 'none';
        renderEmpty();
        if (info) info.textContent = '';
        input.focus();
    });

    // ---- Live search (debounced 180ms) ----
    input.addEventListener('input', () => {
        const q = input.value.trim();
        clearBtn.style.display = q ? 'flex' : 'none';
        clearTimeout(searchTimeout);
        if (!q) {
            renderEmpty();
            if (info) info.textContent = '';
            return;
        }
        searchTimeout = setTimeout(() => runSearch(q), 180);
    });

    // ---- Helpers ----
    function renderEmpty() {
        grid.innerHTML = `
            <div class="search-empty-state">
                <i class="fa-solid fa-magnifying-glass"></i>
                <p>ابدأ بكتابة اسم المنتج أو الفئة</p>
            </div>`;
    }

    function highlight(text, query) {
        if (!text || !query) return text || '';
        const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        return String(text).replace(new RegExp(`(${escaped})`, 'gi'),
            '<mark>$1</mark>');
    }

    function runSearch(q) {
        const lower = q.toLowerCase();

        const results = products.filter(p => {
            if (p.is_visible === false) return false;
            const name  = (p.name        || '').toLowerCase();
            const desc  = (p.description || '').toLowerCase();
            const cat   = categories.find(c => c.id === p.category);
            const catName = (cat ? cat.name : '').toLowerCase();
            return name.includes(lower) || desc.includes(lower) || catName.includes(lower);
        });

        // Update info bar
        if (info) {
            info.innerHTML = results.length > 0
                ? `تم العثور على <span class="highlight-count">${results.length}</span> نتيجة لـ "${q}"`
                : `لا توجد نتائج لـ "${q}"`;
        }

        if (results.length === 0) {
            grid.innerHTML = `
                <div class="search-no-results">
                    <i class="fa-solid fa-face-sad-tear"></i>
                    <p>لا توجد منتجات تطابق "${q}"</p>
                </div>`;
            return;
        }

        grid.innerHTML = results.map((p, i) => {
            const cat     = categories.find(c => c.id === p.category);
            const catName = cat ? cat.name : '';
            const img     = (p.images && p.images.length) ? (typeof p.images[0] === 'string' ? p.images[0] : (p.images[0]?.url || 'prerx logo.jpeg')) : 'prerx logo.jpeg';
            const discount = p.old_price
                ? Math.round(((p.old_price - p.price) / p.old_price) * 100)
                : 0;

            return `
                <div class="search-result-card"
                     style="animation-delay:${i * 30}ms"
                     onclick="window.location.href='product.html?id=${p.id}'">
                    <div class="search-result-img">
                        <img src="${img}" alt="${p.name}" loading="lazy">
                    </div>
                    <div class="search-result-info">
                        ${catName ? `<span class="search-result-category">${highlight(catName, q)}</span>` : ''}
                        <div class="search-result-name">${highlight(p.name, q)}</div>
                        <div class="search-result-price">
                            ${p.old_price ? `<del>${p.old_price} ج.م</del>` : ''}
                            ${p.price} ج.م
                            ${discount > 0 ? `<span style="font-size:0.7rem;background:var(--primary-gradient);color:#fff;border-radius:5px;padding:1px 6px;margin-right:4px">${discount}%</span>` : ''}
                        </div>
                    </div>
                </div>`;
        }).join('');
    }

    // Add keyboard shortcut hint to bottom of panel
    const panel = overlay.querySelector('.search-panel');
    if (panel) {
        const hint = document.createElement('div');
        hint.className = 'search-shortcut-hint';
        hint.innerHTML = `<kbd>Esc</kbd> للإغلاق &nbsp;|&nbsp; <kbd>Ctrl</kbd>+<kbd>K</kbd> للفتح السريع`;
        panel.appendChild(hint);
    }
}
