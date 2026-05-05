let products = [];
let settings = {};
let shippingRates = [];
let coupons = [];
const CACHE_TTL = 300000; // 5 minutes in ms

// State
let appliedCoupon = null;

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
    
    try {
        updateProgress(20);
        settings = await fetchWithCache('settings', () => SupabaseService.getSettings(), (data) => {
            settings = data;
            applySettings();
        });
        updateProgress(40);

        const [p, ship, coup] = await Promise.all([
            fetchWithCache('products', () => SupabaseService.getProducts(), (data) => { products = data; loadProduct(); }),
            fetchWithCache('shipping', () => SupabaseService.getShippingRates(), (data) => { shippingRates = data; }),
            fetchWithCache('coupons', () => SupabaseService.getCoupons(), (data) => { coupons = data; })
        ]);

        products = p;
        shippingRates = ship;
        coupons = coup;
        updateProgress(100);
        
        applySettings();
        loadProduct();
        
        setTimeout(hidePreloader, 300);
        
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
    const isLight = currentTheme === 'light' || currentTheme === 'light_premium';
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
        }
        html, body {
            background-color: ${colors.bg} !important;
            color: ${colors.text} !important;
        }
        .landing-header, .landing-nav {
            background-color: ${isLight ? '#ffffff' : 'rgba(0,0,0,0.5)'} !important;
            color: ${colors.text} !important;
            border-bottom: 1px solid ${isLight ? '#f1f5f9' : 'transparent'} !important;
        }
        .landing-header a, .landing-header span, .landing-header h1, .landing-header p {
            color: ${colors.text} !important;
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
        .form-input, .form-select, input, select, textarea {
            background-color: ${isLight ? '#ffffff' : 'rgba(0,0,0,0.3)'} !important;
            color: ${colors.text} !important;
            border: 1px solid ${isLight ? '#cbd5e1' : colors.border} !important;
        }
        .landing-footer {
            background-color: ${colors.bg} !important;
            border-top-color: ${colors.border} !important;
            color: ${colors.muted} !important;
        }
        label { color: ${colors.text} !important; }
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
    document.body.style.backgroundColor = colors.bg;
    document.body.style.color = colors.text;
}

function loadProduct() {
    const urlParams = new URLSearchParams(window.location.search);
    const id = parseInt(urlParams.get('id'));
    const p = products.find(prod => prod.id === id);

    if (!p) {
        document.getElementById('landing-content').innerHTML = '<div style="grid-column: 1/-1; text-align: center;"><h2>المنتج غير موجود</h2><a href="index.html" class="btn btn-primary">العودة للمتجر</a></div>';
        return;
    }

    // Pixel ViewContent
    if (settings.store.pixel || p.pixel_id) {
        initPixel(p.pixel_id || settings.store.pixel);
        fbq('track', 'ViewContent', { content_ids: [p.id], content_name: p.name, value: p.price, currency: 'EGP' });
    }

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
                        <select id="l-gov" required class="review-input" style="margin-bottom:10px;" onchange="updateLandingTotal(${p.price})">
                            <option value="" disabled selected>المحافظة...</option>
                            ${shippingRates.map(r => `<option value="${r.price}" data-name="${r.name}">${r.name} (${r.price} ج.م)</option>`).join('')}
                        </select>
                    </div>
                    <div class="form-group"><input type="text" id="l-district" placeholder="المنطقة / الحي" required class="review-input" style="margin-bottom:10px;"></div>
                    <div class="form-group"><textarea id="l-address" placeholder="العنوان بالتفصيل (الشارع، رقم العمارة، إلخ)" required class="review-input" style="margin-bottom:15px;"></textarea></div>
                    
                    <div class="checkout-summary" style="background:rgba(0,0,0,0.2);padding:15px;border-radius:10px;margin-bottom:15px;">
                        <div style="display:flex;justify-content:space-between;margin-bottom:5px;"><span>سعر المنتج:</span> <span>${p.price} ج.م</span></div>
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
}

function applyLandingCoupon(basePrice) {
    const code = document.getElementById('l-coupon').value.toUpperCase().trim();
    const msg = document.getElementById('l-coupon-msg');
    if (!code) return;

    const coupon = coupons.find(c => c.code === code && c.is_active);
    if (!coupon) {
        msg.innerText = 'كود غير صحيح';
        msg.style.color = '#ef4444';
        return;
    }

    appliedCoupon = coupon;
    msg.innerText = `تم تطبيق خصم ${coupon.discount}%`;
    msg.style.color = '#22c55e';
    updateLandingTotal(basePrice);
}

function updateLandingTotal(basePrice) {
    const ship = parseFloat(document.getElementById('l-gov').value) || 0;
    const discount = appliedCoupon ? Math.round(basePrice * (appliedCoupon.discount / 100)) : 0;
    const total = basePrice - discount + ship;

    document.getElementById('l-ship-val').innerText = ship + ' ج.م';
    if (discount > 0) {
        document.getElementById('l-discount-row').style.display = 'flex';
        document.getElementById('l-discount-val').innerText = `-${discount} ج.م`;
    }
    document.getElementById('l-total-val').innerText = total + ' ج.م';
}

async function submitLandingOrder(e, productId) {
    e.preventDefault();
    const btn = e.submitter;
    if (btn) btn.disabled = true;

    // Pixel InitiateCheckout
    if (window.fbq) fbq('track', 'InitiateCheckout');

    const p = products.find(prod => prod.id === productId);
    const govSelect = document.getElementById('l-gov');
    
    const ship = parseFloat(govSelect.value) || 0;
    const discount = appliedCoupon ? Math.round(p.price * (appliedCoupon.discount / 100)) : 0;
    const total = p.price - discount + ship;

    const orderData = {
        customer_name: document.getElementById('l-name').value,
        customer_phone: document.getElementById('l-phone').value,
        governorate: govSelect.options[govSelect.selectedIndex].dataset.name,
        district: document.getElementById('l-district').value,
        address: document.getElementById('l-address').value,
        
        items: [{ id: p.id, name: p.name, price: p.price, qty: 1 }],
        subtotal: p.price,
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

        // WhatsApp
        let msg = `*${settings.store.waMsg}*\n\n`;
        msg += `👤 *العميل:* ${orderData.customer_name}\n`;
        msg += `📞 *الهاتف:* ${orderData.customer_phone}\n`;
        msg += `📍 *العنوان:* ${orderData.governorate} - ${orderData.district}\n`;
        msg += `🏠 *التفاصيل:* ${orderData.address}\n\n`;
        msg += `📦 *المنتج:* ${p.name}\n`;
        msg += `💰 *الإجمالي:* ${total} ج.م`;
        
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
    if (window.fbq) return;
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
