let products = [];
let categories = [];
let coupons = [];
let settings = {};
let shippingRates = [];
let reviews = [];
let currentProduct = null;
let activeImgIndex = 0;

let selectedColor = null;
let selectedSize = null;
let selectedRating = 5;
let hoveredRating = 0;

let cartItems = JSON.parse(localStorage.getItem('perex_cart')) || [];
let appliedCoupon = null;

const CACHE_TTL = 300000; // 5 mins

// URL Parameter Parsing
const urlParams = new URLSearchParams(window.location.search);
const prodId = parseInt(urlParams.get('id'));

document.addEventListener('DOMContentLoaded', async () => {
    if (!prodId || isNaN(prodId)) {
        alert('منتج غير صالح');
        window.location.href = 'index.html';
        return;
    }
    
    await initData();
    initUI();
    initRatingStars();
    loadShippingSelects();
    updateCartUI();
});

async function initData() {
    const progress = document.getElementById('loader-progress');
    const updateProgress = (p) => { if (progress) progress.style.width = p + '%'; };
    
    // 1. Try to load from cache immediately for fast loading
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
    }
    if (cachedData.products) {
        products = cachedData.products;
        loadProductDetails();
    }
    if (cachedData.shipping) {
        shippingRates = cachedData.shipping;
        loadShippingSelects();
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
            SupabaseService.getCategories(),
            SupabaseService.getShippingRates(),
            SupabaseService.getCoupons(),
            SupabaseService.getReviews()
        ]);

        const [s, p, c, ship, coup, revs] = fetchResults.map(r => r.status === 'fulfilled' ? r.value : null);

        if (s) settings = s;
        if (p) products = p;
        if (c) categories = c;
        if (ship) shippingRates = ship;
        if (coup) coupons = coup;
        if (revs) reviews = revs;

        // Cache fresh data
        const freshData = { settings: s, products: p, categories: c, shipping: ship, coupons: coup };
        Object.entries(freshData).forEach(([key, val]) => {
            if (val) localStorage.setItem(`perex_cache_${key}`, JSON.stringify({ data: val, timestamp: Date.now() }));
        });

        updateProgress(100);
        
        applySettings();
        loadProductDetails();
        loadShippingSelects();
        renderReviews();
        renderRelatedProducts();
        renderYouMightAlsoLike();
        renderSocialLinks();
        renderFloatingButtons();
        
        const elapsed = Date.now() - startTime;
        setTimeout(() => {
            hidePreloader();
            if (currentProduct) {
                trackPixel('ViewContent', { content_ids: [currentProduct.id], content_name: currentProduct.name, value: currentProduct.price, currency: 'EGP' });
            }
            initSmartOffers();
        }, Math.max(0, 300 - elapsed));
        
    } catch (e) {
        console.error('Product Init Error:', e);
        hidePreloader();
    }
}

function hidePreloader() {
    const preloader = document.getElementById('preloader');
    if (preloader) preloader.classList.add('fade-out');
}

function applySettings() {
    if (!settings.store)  settings.store  = {};
    if (!settings.banner) settings.banner = {};
    if (!settings.badge)  settings.badge  = {};
    
    // Dynamic Branding Propagation for Product Page
    const storeName = settings.store.name || "Perex Store";
    document.title = `${storeName} - جاري التحميل...`;
    
    const logoImg = document.querySelector('.logo img');
    if (logoImg && settings.store.logo) logoImg.src = settings.store.logo;
    const logoSpan = document.querySelector('.logo span');
    if (logoSpan) logoSpan.innerText = storeName;
    
    const footerLogoImg = document.querySelector('.footer-about .logo img');
    if (footerLogoImg && settings.store.logo) footerLogoImg.src = settings.store.logo;
    const footerLogoSpan = document.querySelector('.footer-about .logo span');
    if (footerLogoSpan) footerLogoSpan.innerText = storeName;

    const footerCopyright = document.querySelector('.footer-bottom .copyright') || document.querySelector('.footer-bottom p');
    if (footerCopyright) {
        footerCopyright.innerHTML = `&copy; ${new Date().getFullYear()} ${storeName}. جميع الحقوق محفوظة.`;
    }

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
        body {
            background-color: var(--dark-bg);
            color: var(--text-color);
        }
        .header {
            background: ${isLight ? '#ffffff' : 'rgba(0,0,0,0.6)'} !important;
            backdrop-filter: blur(10px) !important;
            -webkit-backdrop-filter: blur(10px) !important;
            box-shadow: var(--shadow) !important;
            border-bottom: 1px solid ${colors.border} !important;
        }
    `;

    // Facebook Pixel Initialization
    if (settings.store && settings.store.pixel) {
        if (window.fbq) {
            fbq('init', settings.store.pixel);
            fbq('track', 'PageView');
        } else {
            !function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?
            n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;
            n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;
            t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,
            document,'script','https://connect.facebook.net/en_US/fbevents.js');
            fbq('init', settings.store.pixel);
            fbq('track', 'PageView');
        }
    }

    // TikTok Pixel Initialization
    if (settings.store && settings.store.tiktokPixel) {
        initTikTokPixel(settings.store.tiktokPixel);
    }
}

function loadProductDetails() {
    currentProduct = products.find(p => p.id === prodId);
    if (!currentProduct) {
        alert('المنتج غير متوفر حالياً');
        window.location.href = 'index.html';
        return;
    }

    // Update tab title with actual product name
    const storeName = (settings.store && settings.store.name) ? settings.store.name : 'Perex Store';
    document.title = `${currentProduct.name} | ${storeName}`;

    // Category
    const cat = categories.find(c => c.id === currentProduct.category);
    document.getElementById('prod-category-label').innerText = cat ? cat.name : '';

    // Meta details
    document.getElementById('prod-title').innerText = currentProduct.name;
    document.getElementById('prod-price').innerText = `${currentProduct.price} ج.م`;
    if (currentProduct.old_price) {
        document.getElementById('prod-old-price').innerText = `${currentProduct.old_price} ج.م`;
    } else {
        document.getElementById('prod-old-price').innerText = '';
    }

    // Badge
    const discount = currentProduct.old_price ? Math.round(((currentProduct.old_price - currentProduct.price) / currentProduct.old_price) * 100) : 0;
    const badgeContainer = document.getElementById('prod-badge-container');
    if (currentProduct.badge || discount > 0) {
        badgeContainer.innerHTML = `<span class="product-badge-highlight">${currentProduct.badge || `خصم ${discount}%`}</span>`;
    } else {
        badgeContainer.innerHTML = '';
    }

    // Description & Specs split
    const descParts = (currentProduct.description || '').split('===SPECIFICATIONS===');
    document.getElementById('prod-full-description').innerHTML = descParts[0] || 'لا يوجد وصف متاح لهذا المنتج حالياً.';
    
    // Parse Specs
    const specsTable = document.getElementById('prod-specs-table');
    specsTable.innerHTML = '';
    if (descParts[1] && descParts[1].trim()) {
        const specLines = descParts[1].trim().split('\n');
        specLines.forEach(line => {
            if (line.includes(':')) {
                const parts = line.split(':');
                const key = parts[0].trim();
                const val = parts.slice(1).join(':').trim();
                specsTable.innerHTML += `
                    <tr>
                        <td class="specs-key">${key}</td>
                        <td class="specs-value">${val}</td>
                    </tr>
                `;
            }
        });
    }
    
    if (specsTable.innerHTML === '') {
        specsTable.innerHTML = `<tr><td style="text-align: center; color: var(--muted-color); padding: 20px;">لا توجد مواصفات فنية متوفرة حالياً لهذا المنتج.</td></tr>`;
    }

    // Ratings score summary
    const ratingVal = currentProduct.rating || 5;
    document.getElementById('prod-rating-stars').innerHTML = generateStarRating(ratingVal);

    // Variants (Colors & Sizes)
    const colorWrap = document.getElementById('prod-color-selector-wrap');
    const colorContainer = document.getElementById('color-dots-container');
    if (currentProduct.has_colors && currentProduct.colors && currentProduct.colors.length > 0) {
        colorWrap.style.display = 'block';
        colorContainer.innerHTML = '';
        currentProduct.colors.forEach((color, idx) => {
            // Check if color is hex, otherwise fallback to simple CSS mapping or text
            const isHex = color.startsWith('#') || (color.length === 6 && !isNaN(parseInt(color, 16)));
            const colorValue = isHex ? (color.startsWith('#') ? color : '#' + color) : getColorHex(color);
            const activeClass = idx === 0 ? 'active' : '';
            if (idx === 0) {
                selectedColor = color;
                document.getElementById('selected-color-name').innerText = color;
            }
            
            colorContainer.innerHTML += `
                <div class="color-dot ${activeClass}" style="background-color: ${colorValue};" data-color="${color}" onclick="selectColorOption(this)" title="${color}"></div>
            `;
        });
    } else {
        colorWrap.style.display = 'none';
        selectedColor = null;
    }

    const sizeWrap = document.getElementById('prod-size-selector-wrap');
    const sizeContainer = document.getElementById('size-chips-container');
    if (currentProduct.has_sizes && currentProduct.sizes && currentProduct.sizes.length > 0) {
        sizeWrap.style.display = 'block';
        sizeContainer.innerHTML = '';
        currentProduct.sizes.forEach((size, idx) => {
            const activeClass = idx === 0 ? 'active' : '';
            if (idx === 0) {
                selectedSize = size;
                document.getElementById('selected-size-name').innerText = size;
            }
            sizeContainer.innerHTML += `
                <span class="size-chip ${activeClass}" data-size="${size}" onclick="selectSizeOption(this)">${size}</span>
            `;
        });
    } else {
        sizeWrap.style.display = 'none';
        selectedSize = null;
    }

    // Images Gallery
    activeImgIndex = 0;
    if (selectedColor && currentProduct.images && currentProduct.images.length > 0) {
        const firstColorImgIdx = currentProduct.images.findIndex(img => {
            if (typeof img === 'string') return false;
            return img.color && img.color.trim().toLowerCase() === selectedColor.trim().toLowerCase();
        });
        if (firstColorImgIdx !== -1) {
            activeImgIndex = firstColorImgIdx;
        }
    }
    renderGallery();
}

function getColorHex(colorName) {
    if (!colorName) return '#787878';
    
    // Normalize string
    const normalized = colorName.trim().toLowerCase();
    
    // Check if it's already a valid hex code (with or without #)
    if (/^#([0-9A-Fa-f]{3,8})$/.test(normalized)) return normalized;
    if (/^[0-9A-Fa-f]{6}$/.test(normalized)) return '#' + normalized;
    if (/^[0-9A-Fa-f]{3}$/.test(normalized)) return '#' + normalized;
    
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
    
    // Look up in map (support partial matches like "اللون الاحمر" or "أحمر غامق")
    for (const [key, val] of Object.entries(map)) {
        if (normalized.includes(key)) {
            return val;
        }
    }
    
    // Fallback: Check if it's a valid HTML color name or just return the colorName
    return colorName;
}

function selectColorOption(el) {
    document.querySelectorAll('.color-dot').forEach(d => d.classList.remove('active'));
    el.classList.add('active');
    selectedColor = el.getAttribute('data-color');
    document.getElementById('selected-color-name').innerText = selectedColor;

    // Switch image gallery to show the first image of this color
    if (currentProduct.images && currentProduct.images.length > 0) {
        const idx = currentProduct.images.findIndex(img => {
            if (typeof img === 'string') return false;
            return img.color && img.color.trim().toLowerCase() === selectedColor.trim().toLowerCase();
        });
        if (idx !== -1) {
            selectGalleryIndex(idx);
        }
    }
}

function selectSizeOption(el) {
    document.querySelectorAll('.size-chip').forEach(c => c.classList.remove('active'));
    el.classList.add('active');
    selectedSize = el.getAttribute('data-size');
    document.getElementById('selected-size-name').innerText = selectedSize;
}

function renderGallery() {
    const mainImg = document.getElementById('gallery-main-img');
    const thumbnails = document.getElementById('gallery-thumbnails');
    if (!mainImg || !thumbnails) return;
    
    const imgs = currentProduct.images && currentProduct.images.length > 0 ? currentProduct.images : ['prerx logo.jpeg'];
    
    const activeImg = imgs[activeImgIndex];
    mainImg.src = typeof activeImg === 'string' ? activeImg : (activeImg.url || 'prerx logo.jpeg');
    
    thumbnails.innerHTML = '';
    imgs.forEach((img, idx) => {
        const url = typeof img === 'string' ? img : (img.url || 'prerx logo.jpeg');
        const activeClass = idx === activeImgIndex ? 'active' : '';
        thumbnails.innerHTML += `
            <div class="thumbnail-item ${activeClass}" onclick="selectGalleryIndex(${idx})">
                <img src="${url}" alt="thumbnail">
            </div>
        `;
    });
}

function selectGalleryIndex(idx) {
    const imgs = currentProduct.images && currentProduct.images.length > 0 ? currentProduct.images : ['prerx logo.jpeg'];
    if (idx < 0) idx = imgs.length - 1;
    if (idx >= imgs.length) idx = 0;
    activeImgIndex = idx;
    renderGallery();
}

function slideGallery(delta) {
    selectGalleryIndex(activeImgIndex + delta);
}

function changeProductQty(delta) {
    const qtyInput = document.getElementById('product-qty');
    let qty = parseInt(qtyInput.value) || 1;
    qty += delta;
    if (qty < 1) qty = 1;
    qtyInput.value = qty;
}

function addProductToCart() {
    const qtyInput = document.getElementById('product-qty');
    const qty = parseInt(qtyInput.value) || 1;
    
    // Cart Item Object construction
    const cartId = `${currentProduct.id}_${selectedColor || ''}_${selectedSize || ''}`;
    
    const existing = cartItems.find(item => item.cartId === cartId || (item.id === currentProduct.id && item.color === selectedColor && item.size === selectedSize));
    
    if (existing) {
        existing.qty += qty;
    } else {
        cartItems.push({
            ...currentProduct,
            cartId,
            qty,
            color: selectedColor,
            size: selectedSize
        });
    }
    
    updateCartUI();
    showAddToCartNotification(currentProduct, selectedColor);
    
    // Pixel
    trackPixel('AddToCart', { content_ids: [currentProduct.id], content_name: currentProduct.name, value: currentProduct.price, currency: 'EGP' });
}

function switchProductTab(tab, el) {
    document.querySelectorAll('.tab-header-item').forEach(h => h.classList.remove('active'));
    document.querySelectorAll('.tab-content-item').forEach(c => c.classList.remove('active'));
    
    el.classList.add('active');
    document.getElementById(`tab-content-${tab}`).classList.add('active');
}

// ===== REVIEWS RENDERING & SUBMISSION =====
function renderReviews() {
    const list = document.getElementById('product-reviews-list');
    list.innerHTML = '';
    
    const prodReviews = reviews.filter(r => r.product_id == prodId || r.product_id == prodId.toString());
    document.getElementById('prod-reviews-count').innerText = `(${prodReviews.length} تقييمات)`;

    if (prodReviews.length === 0) {
        list.innerHTML = '<p style="color: var(--muted-color); padding: 20px; text-align: center;">لا توجد تقييمات لهذا المنتج حالياً. كن أول من يضيف تقييماً!</p>';
        return;
    }

    prodReviews.forEach(r => {
        const user = r.customer_name || 'عميل مجهول';
        const comment = r.comment || '';
        const rating = r.rating || 5;
        const date = (r.created_at || '').split('T')[0] || 'منذ فترة';
        
        list.innerHTML += `
            <div class="review-item" style="border-bottom: 1px solid var(--glass-border); padding: 20px 0;">
                <div style="display:flex; justify-content:space-between; margin-bottom:10px;">
                    <div>
                        <strong style="font-size:1.05rem;">${user}</strong>
                        <div style="color:#fbbf24; font-size:0.8rem; margin-top:2px;">${'★'.repeat(rating)}${'☆'.repeat(5 - rating)}</div>
                    </div>
                    <span style="font-size:0.8rem; color:var(--muted-color);">${date}</span>
                </div>
                <p style="font-size:0.95rem; line-height:1.6; color:var(--text-color);">${comment}</p>
                ${r.reply ? `
                    <div class="admin-reply" style="margin-top:15px; background:rgba(255,255,255,0.02); border-right:3px solid var(--primary-color); padding:10px 15px; border-radius:8px;">
                        <strong style="font-size:0.85rem; color:var(--primary-color);">رد المتجر:</strong>
                        <p style="font-size:0.9rem; margin-top:4px; color:var(--muted-color);">${r.reply}</p>
                    </div>
                ` : ''}
            </div>
        `;
    });
}

function initRatingStars() {
    const stars = document.querySelectorAll('#interactive-stars i');
    stars.forEach(star => {
        star.addEventListener('mouseover', () => {
            const val = parseInt(star.getAttribute('data-value'));
            stars.forEach(s => {
                if (parseInt(s.getAttribute('data-value')) <= val) {
                    s.classList.add('hovered');
                } else {
                    s.classList.remove('hovered');
                }
            });
        });
        
        star.addEventListener('mouseout', () => {
            stars.forEach(s => s.classList.remove('hovered'));
        });
        
        star.addEventListener('click', () => {
            selectedRating = parseInt(star.getAttribute('data-value'));
            stars.forEach(s => {
                if (parseInt(s.getAttribute('data-value')) <= selectedRating) {
                    s.classList.add('selected');
                } else {
                    s.classList.remove('selected');
                }
            });
        });
    });
    
    // Set 5 stars initially
    stars.forEach(s => s.classList.add('selected'));
}

async function submitProductReview(e) {
    e.preventDefault();
    const nameInput = document.getElementById('review-user-name');
    const commentInput = document.getElementById('review-user-comment');
    
    const name = nameInput.value.trim();
    const comment = commentInput.value.trim();
    
    if (!name || !comment) return;
    
    const reviewData = {
        product_id: prodId,
        customer_name: name,
        rating: selectedRating,
        comment: comment,
        is_visible: true
    };
    
    try {
        await SupabaseService.saveReview(reviewData);
        showToast('تمت إضافة تعليقك بنجاح! شكراً لك.');
        nameInput.value = '';
        commentInput.value = '';
        
        // Reload reviews
        reviews = await SupabaseService.getReviews();
        renderReviews();
    } catch(e) {
        showToast('فشل في إرسال التقييم: ' + e.message, 'error');
    }
}

// ===== RELATED PRODUCTS =====
function renderRelatedProducts() {
    const grid = document.getElementById('related-products-grid');
    const wrapper = document.getElementById('related-section-wrapper');
    if (!grid || !wrapper) return;
    grid.innerHTML = '';

    // Build set of relevant category IDs: primary + any related_categories
    const relatedCatIds = new Set([currentProduct.category]);
    (currentProduct.related_categories || []).forEach(id => relatedCatIds.add(id));

    // Collect products from all relevant categories, excluding current product
    const related = products
        .filter(p => relatedCatIds.has(p.category) && p.id !== prodId && p.is_visible !== false)
        .slice(0, 8);

    if (related.length === 0) {
        wrapper.style.display = 'none';
        return;
    }
    wrapper.style.display = '';

    related.forEach(p => {
        grid.innerHTML += buildProCard(p);
    });
}

// ===== YOU MAY ALSO LIKE =====
function renderYouMightAlsoLike() {
    const grid = document.getElementById('also-like-products-grid');
    const wrapper = document.getElementById('also-like-section-wrapper');
    if (!grid || !wrapper) return;
    grid.innerHTML = '';

    // Build set of category IDs already shown in related (to exclude them here)
    const relatedCatIds = new Set([currentProduct.category]);
    (currentProduct.related_categories || []).forEach(id => relatedCatIds.add(id));

    // Pick products from OTHER categories (shuffle for variety)
    let otherProducts = products.filter(
        p => !relatedCatIds.has(p.category) && p.id !== prodId && p.is_visible !== false
    );

    // If no other-category products, fall back to same category (excluding current)
    if (otherProducts.length === 0) {
        otherProducts = products.filter(p => p.id !== prodId && p.is_visible !== false);
    }

    // Shuffle and take up to 8
    const shuffled = otherProducts.sort(() => Math.random() - 0.5).slice(0, 8);

    if (shuffled.length === 0) {
        wrapper.style.display = 'none';
        return;
    }
    wrapper.style.display = '';

    shuffled.forEach(p => {
        grid.innerHTML += buildProCard(p);
    });
}

// ===== SHARED PRO CARD BUILDER =====
function buildProCard(p) {
    const discount = p.old_price ? Math.round(((p.old_price - p.price) / p.old_price) * 100) : 0;
    const imgSrc = (p.images && p.images.length > 0) ? (typeof p.images[0] === 'string' ? p.images[0] : (p.images[0].url || 'prerx logo.jpeg')) : 'prerx logo.jpeg';
    const catName = categories.find(c => c.id === p.category)?.name || '';
    const badgeLabel = p.badge || (discount > 0 ? `خصم ${discount}%` : '');
    return `
        <div class="product-card" onclick="window.location.href='product.html?id=${p.id}'">
            ${badgeLabel ? `<span class="product-badge">${badgeLabel}</span>` : ''}
            <div class="product-image">
                <img src="${imgSrc}" alt="${p.name}" loading="lazy">
            </div>
            <div class="card-quick-buy"><i class="fa-solid fa-eye"></i> عرض المنتج</div>
            <div class="product-info">
                <p class="product-category">${catName}</p>
                <h3 class="product-title">${p.name}</h3>
                <div style="color:#fbbf24; font-size:0.78rem; line-height:1;">
                    ${generateStarRating(p.rating || 5)}
                </div>
                <div class="product-price-row">
                    <span class="product-price">${p.price} ج.م</span>
                    ${p.old_price ? `<del class="product-old-price">${p.old_price} ج.م</del>` : ''}
                </div>
            </div>
        </div>
    `;
}



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

// ===== CART & E-COMMERCE CORE LOGIC =====
function openCart() {
    const sidebar = document.getElementById('cart-sidebar');
    const overlay = document.getElementById('cart-overlay');
    if (sidebar) {
        sidebar.classList.add('active');
        sidebar.style.transform = '';
        sidebar.style.visibility = '';
    }
    if (overlay) overlay.classList.add('active');
}

function closeCart() {
    const sidebar = document.getElementById('cart-sidebar');
    const overlay = document.getElementById('cart-overlay');
    if (sidebar) sidebar.classList.remove('active');
    if (overlay) overlay.classList.remove('active');
}

function changeQty(cartId, delta) {
    // Handle type coercion: cartId may be string from onclick, item.id may be number
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
                    <h4 class="cart-item-title" onclick="window.location.href='product.html?id=${item.id}'">${item.name}${variantText}</h4>
                    <div style="display:flex; justify-content:space-between; align-items:center; margin-top:5px;">
                        <span class="cart-item-price">${item.price} ج.م</span>
                        <div class="qty-controls" style="display:flex; align-items:center; gap:10px; background:rgba(255,255,255,0.05); padding:5px 10px; border-radius:8px;">
                            <button onclick="changeQty('${item.cartId || item.id}', -1)" style="background:none; border:none; color:var(--primary-color); cursor:pointer;"><i class="fa-solid fa-minus"></i></button>
                            <span>${item.qty}</span>
                            <button onclick="changeQty('${item.cartId || item.id}', 1)" style="background:none; border:none; color:var(--primary-color); cursor:pointer;"><i class="fa-solid fa-plus"></i></button>
                        </div>
                    </div>
                    <span class="remove-item" onclick="removeFromCart('${item.cartId || item.id}')" style="margin-top:10px; display:inline-block; font-size:0.8rem; color:#ef4444; cursor:pointer;"><i class="fa-solid fa-trash"></i> إزالة</span>
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
        calculateShipping();
        return;
    }
    
    // Check expiry
    if (coupon.expiry_date && new Date(coupon.expiry_date) < new Date()) {
        msg.innerText = 'كود الخصم منتهي الصلاحية';
        msg.style.color = '#ef4444';
        appliedCoupon = null;
        calculateCartTotal();
        calculateShipping();
        return;
    }

    let subtotal = cartItems.reduce((s, i) => s + (i.price * i.qty), 0);
    if (coupon.min_order && subtotal < coupon.min_order) {
        msg.innerText = `الحد الأدنى لتطبيق الكود هو ${coupon.min_order} ج.م`;
        msg.style.color = '#ef4444';
        appliedCoupon = null;
        calculateCartTotal();
        calculateShipping();
        return;
    }

    appliedCoupon = coupon;
    msg.innerText = 'تم تطبيق الكود بنجاح!';
    msg.style.color = '#22c55e';
    calculateCartTotal();
    calculateShipping();
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

    const subtotalEl = document.getElementById('cart-subtotal-price');
    const shippingEl = document.getElementById('cart-shipping-price');
    const totalEl = document.getElementById('cart-total-price');
    if (subtotalEl) subtotalEl.innerText = `${subtotal} ج.م`;
    if (shippingEl) shippingEl.innerText = `${shipping} ج.م`;
    if (totalEl) totalEl.innerText = `${total} ج.م`;

    const discountRow = document.getElementById('cart-discount-row');
    if (discountRow) {
        if (discount > 0) {
            discountRow.style.display = 'flex';
            const discPriceEl = document.getElementById('cart-discount-price');
            if (discPriceEl) discPriceEl.innerText = `-${discount} ج.م`;
        } else {
            discountRow.style.display = 'none';
        }
    }
}

function loadShippingSelects() {
    const selects = [document.getElementById('cart-gov'), document.getElementById('customer-gov')];
    selects.forEach(s => {
        if (!s) return;
        const current = s.value;
        s.innerHTML = `<option value="" disabled selected>${s.id === 'cart-gov' ? 'اختر محافظتك...' : 'المحافظة...'}</option>`;
        shippingRates.forEach(r => {
            if (r.is_active !== false) {
                const opt = document.createElement('option');
                opt.value = r.cost ?? r.price ?? 0;  // store the numeric price as value
                opt.dataset.name = r.name;
                opt.innerText = `${r.name} (${r.cost ?? r.price ?? 0} ج.م)`;
                s.appendChild(opt);
            }
        });
        if (current) s.value = current;
    });
}

// ===== CHECKOUT & ORDER SUBMISSION =====
function checkout() {
    if (cartItems.length === 0) return;
    
    // Copy values from Cart UI to Checkout Modal
    const cartSelect = document.getElementById('cart-gov');
    const chkSelect = document.getElementById('customer-gov');
    if (cartSelect && chkSelect && cartSelect.value) {
        chkSelect.value = cartSelect.value;
    }
    
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
    const gov = document.getElementById('customer-gov').value;
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

    // Resolve governorate name from the selected option's data-name attribute
    const govSelect = document.getElementById('customer-gov');
    const selectedOpt = govSelect ? govSelect.options[govSelect.selectedIndex] : null;
    const govName = (selectedOpt && selectedOpt.dataset.name) ? selectedOpt.dataset.name : gov;

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
        showToast('حدث خطأ أثناء حفظ الطلب: ' + e.message, 'error');
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

function closeSuccessModal() {
    document.getElementById('success-overlay').classList.remove('active');
}

// ===== UI GENERAL FLOW INTERACTION =====
function initUI() {
    // Mobile Menu - targets .navbar drawer (outside header for correct stacking context)
    const toggle = document.getElementById('menu-toggle');
    const navDrawer = document.getElementById('navbar');
    const overlay = document.getElementById('menu-overlay');
    const navCloseBtn = document.getElementById('nav-close-btn');

    const closeMenu = () => {
        if (!navDrawer) return;
        navDrawer.classList.remove('active');
        overlay.classList.remove('active');
        document.body.style.overflow = '';
        const icon = toggle ? toggle.querySelector('i') : null;
        if (icon) {
            icon.classList.add('fa-bars');
            icon.classList.remove('fa-xmark');
        }
    };

    const openMenu = () => {
        if (!navDrawer) return;
        navDrawer.classList.add('active');
        overlay.classList.add('active');
        document.body.style.overflow = 'hidden';
        const icon = toggle ? toggle.querySelector('i') : null;
        if (icon) {
            icon.classList.remove('fa-bars');
            icon.classList.add('fa-xmark');
        }
    };

    if (toggle && navDrawer && overlay) {
        toggle.addEventListener('click', (e) => {
            e.stopPropagation();
            navDrawer.classList.contains('active') ? closeMenu() : openMenu();
        });

        overlay.addEventListener('click', closeMenu);

        if (navCloseBtn) {
            navCloseBtn.addEventListener('click', closeMenu);
        }

        navDrawer.querySelectorAll('a').forEach(a => {
            a.addEventListener('click', closeMenu);
        });

        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && navDrawer.classList.contains('active')) closeMenu();
        });
    }


    // Cart Sidebar Toggle
    const cartBtn = document.getElementById('cart-icon');
    const closeBtn = document.getElementById('close-cart');
    const cartOverlay = document.getElementById('cart-overlay');

    if (cartBtn) cartBtn.onclick = () => openCart();
    if (closeBtn) closeBtn.onclick = () => closeCart();
    if (cartOverlay) cartOverlay.onclick = () => closeCart();

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

    // Header scrolled class toggle (matches homepage banner dimensions and scroll behavior)
    const header = document.getElementById('header');
    if (header) {
        window.addEventListener('scroll', () => {
            if (window.scrollY > 50) header.classList.add('scrolled');
            else header.classList.remove('scrolled');
        });
        // Initial check in case page loads scrolled
        if (window.scrollY > 50) header.classList.add('scrolled');
        else header.classList.remove('scrolled');
    }
}

function renderSocialLinks() {
    const list = document.querySelector('.footer-about .social-links');
    if (!list || !settings.social) return;
    list.innerHTML = '';
    
    settings.social.forEach(s => {
        list.innerHTML += `
            <a href="${s.url}" target="_blank" class="float-btn" style="width: 38px; height: 38px; font-size: 18px; margin: 0; box-shadow: none;">
                <i class="fa-brands ${s.icon}"></i>
            </a>
        `;
    });
}

function renderFloatingButtons() {
    const container = document.getElementById('floating-buttons-container');
    if (!container) return;
    container.innerHTML = '';
    
    if (!settings.floating_buttons) return;
    
    settings.floating_buttons.forEach(btn => {
        if (btn.is_active === false) return;
        
        const floatLink = document.createElement('a');
        floatLink.className = 'float-btn';
        floatLink.href = btn.link;
        floatLink.target = '_blank';
        floatLink.style.backgroundColor = btn.bg_color || '#10b981';
        floatLink.innerHTML = `<i class="fa-solid ${btn.icon}"></i>`;
        floatLink.title = btn.name;
        container.appendChild(floatLink);
    });
}

// ===== SMART OFFER SYSTEM INTEGRATION =====
let _smartOfferShowing = false; // Guard: only one popup at a time

function initSmartOffers() {
    const container = document.getElementById('smart-offer-container');
    if (!container || !settings.offers) return;

    // Check if offers should be displayed on product pages
    if (settings.offers.showInProductPage === false) return;

    // Welcome popup
    const w = settings.offers.welcome;
    if (w && w.enabled && !sessionStorage.getItem('offer_welcome_shown')) {
        setTimeout(() => {
            if (!_smartOfferShowing) showSmartOfferModal(w, 'welcome');
        }, (w.delay || 5) * 1000);
    }

    // Exit intent — use {once: true} so the listener fires only once ever
    const ex = settings.offers.exitIntent || settings.offers.exit;
    if (ex && ex.enabled && !sessionStorage.getItem('offer_exit_shown')) {
        const exitHandler = (e) => {
            if (e.clientY < 20 && !_smartOfferShowing && !sessionStorage.getItem('offer_exit_shown')) {
                showSmartOfferModal(ex, 'exit');
            }
        };
        document.addEventListener('mouseleave', exitHandler, { once: true });
    }

    // Cart abandonment reminder
    const c = settings.offers.cartAbandonment || settings.offers.cart;
    if (c && c.enabled && !sessionStorage.getItem('offer_cart_shown')) {
        let timer;
        const resetTimer = () => {
            clearTimeout(timer);
            if (cartItems.length > 0 && !_smartOfferShowing && !sessionStorage.getItem('offer_cart_shown')) {
                timer = setTimeout(() => {
                    if (!_smartOfferShowing) showSmartOfferModal(c, 'cart');
                }, (c.delay || 30) * 1000);
            }
        };
        document.addEventListener('mousemove', resetTimer, { passive: true });
        document.addEventListener('keypress', resetTimer, { passive: true });
        resetTimer();
    }
}

function showSmartOfferModal(o, type) {
    const container = document.getElementById('smart-offer-container');
    if (!container || _smartOfferShowing) return;
    _smartOfferShowing = true;

    // Use modal-overlay (display:flex + centered) not checkout-overlay (display:block)
    const popupOverlay = document.createElement('div');
    popupOverlay.className = 'modal-overlay active';
    popupOverlay.id = 'smart-offer-overlay';

    const modal = document.createElement('div');
    modal.className = 'success-animate';
    modal.style.cssText = `
        position: relative;
        width: 90%;
        max-width: 420px;
        background: ${o.bgColor || '#1e293b'};
        color: ${o.textColor || '#ffffff'};
        border: none;
        box-shadow: 0 25px 50px rgba(0,0,0,0.6);
        text-align: center;
        padding: 35px 30px 30px;
        border-radius: 24px;
        margin: auto;
    `;

    const iconColor = o.textColor || '#ffffff';
    modal.innerHTML = `
        <button class="modal-close" style="color:${iconColor}; opacity:0.8; position:absolute; top:14px; left:14px; background:none; border:none; font-size:1.3rem; cursor:pointer; line-height:1;" onclick="closeSmartOffer(this)"><i class="fa-solid fa-xmark"></i></button>
        <div style="font-size:3rem; margin-bottom:15px; color:${iconColor}"><i class="fa-solid ${o.icon}"></i></div>
        <h2 style="font-size:1.5rem; font-weight:800; margin-bottom:10px; color:${iconColor}">${o.title}</h2>
        <p style="margin-bottom:20px; font-size:0.95rem; line-height:1.7; opacity:0.9;">${o.desc}</p>
        ${o.coupon ? `
            <div style="border:2px dashed ${iconColor}; font-weight:bold; font-size:1.1rem; border-radius:12px; margin-bottom:20px; background:rgba(0,0,0,0.15); display:inline-block; padding:10px 24px;">
                كود الخصم: <span style="letter-spacing:2px; color:#fbbf24;">${o.coupon}</span>
            </div>
        ` : ''}
        <button class="btn" style="background:#ffffff; color:#1e293b; font-weight:bold; border-radius:12px; padding:12px 28px; width:100%;" onclick="acceptSmartOffer('${o.coupon || ''}', '${o.btnLink || ''}', this)">${o.btnText || 'استفد الآن'}</button>
    `;

    popupOverlay.appendChild(modal);
    container.appendChild(popupOverlay);

    // Close when clicking the dark background
    popupOverlay.addEventListener('click', (e) => {
        if (e.target === popupOverlay) closeSmartOffer(modal.querySelector('.modal-close'));
    });

    sessionStorage.setItem(`offer_${type}_shown`, 'true');
}

function closeSmartOffer(btn) {
    const overlay = document.getElementById('smart-offer-overlay');
    if (overlay) overlay.remove();
    _smartOfferShowing = false;
}

function acceptSmartOffer(coupon, link, btn) {
    if (coupon) {
        const input = document.getElementById('coupon-input');
        if (input) {
            input.value = coupon;
            applyCoupon();
            openCart();
        }
    }

    closeSmartOffer(btn);
    
    if (link && link !== '#') {
        window.location.href = link;
    }
}

// ===== PIXEL TRACKING INTEGRATION =====
function trackPixel(event, data = {}) {
    // Facebook Pixel (store-level)
    if (settings.store && settings.store.pixel) {
        if (window.fbq) {
            window.fbq('track', event, data);
        } else {
            console.log(`[Facebook Pixel Track - ${settings.store.pixel}]: ${event}`, data);
        }
    }
    // Facebook Pixel (product-level)
    if (settings.store && settings.store.pixelId) {
        if (window.fbq) {
            window.fbq('track', event, data);
        } else {
            console.log(`[Facebook Pixel Track - ${settings.store.pixelId}]: ${event}`, data);
        }
    }
    // Product custom pixel check
    if (currentProduct && currentProduct.pixel_id) {
        if (window.fbq) {
            window.fbq('trackSingle', currentProduct.pixel_id, event, data);
        } else {
            console.log(`[Product Specific Pixel Track - ${currentProduct.pixel_id}]: ${event}`, data);
        }
    }
    // TikTok Pixel
    trackTikTokPixel(event, data);
}

// ===== TIKTOK PIXEL =====
function initTikTokPixel(id) {
    if (!id) return;
    if (window.ttq && window.ttq._i && window.ttq._i[id]) {
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
    const ttMap = {
        'PageView':         () => window.ttq.page(),
        'ViewContent':      () => window.ttq.track('ViewContent',      { content_id: String((data.content_ids || [])[0] || ''), content_name: data.content_name, value: data.value, currency: data.currency || 'EGP' }),
        'AddToCart':        () => window.ttq.track('AddToCart',        { content_id: String((data.content_ids || [])[0] || ''), content_name: data.content_name, value: data.value, currency: data.currency || 'EGP' }),
        'InitiateCheckout': () => window.ttq.track('InitiateCheckout', { value: data.value, currency: data.currency || 'EGP' }),
        'Purchase':         () => window.ttq.track('CompletePayment',  { content_id: String((data.content_ids || [])[0] || ''), content_name: data.content_name, value: data.value, currency: data.currency || 'EGP' }),
        'Contact':          () => window.ttq.track('Contact')
    };
    if (ttMap[event]) ttMap[event]();
    else { try { window.ttq.track(event, data); } catch(e) {} }
}

// ===== CART ADD NOTIFICATION (same as main store page) =====
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

    if (cartNotificationTimeout) clearTimeout(cartNotificationTimeout);
    container.classList.remove('active');
    void container.offsetWidth; // Force reflow for animation
    container.classList.add('active');

    cartNotificationTimeout = setTimeout(() => closeCartNotification(), 6000);
}

function closeCartNotification() {
    const container = document.getElementById('cart-notification');
    if (container) container.classList.remove('active');
    if (cartNotificationTimeout) {
        clearTimeout(cartNotificationTimeout);
        cartNotificationTimeout = null;
    }
}

function checkoutFromNotification() {
    closeCartNotification();
    checkout();
}

function viewCartFromNotification() {
    closeCartNotification();
    openCart();
}

// Global helper for toast notifications
function showToast(text, type = 'success') {
    const toast = document.createElement('div');
    toast.className = 'toast';
    const icon = type === 'success' ? 'fa-circle-check' : 'fa-circle-exclamation';
    const color = type === 'success' ? '#22c55e' : '#ef4444';
    
    toast.innerHTML = `<i class="fa-solid ${icon}" style="color:${color}"></i> &nbsp; ${text}`;
    document.body.appendChild(toast);
    
    setTimeout(() => toast.classList.add('show'), 50);
    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => toast.remove(), 500);
    }, 3000);
}
