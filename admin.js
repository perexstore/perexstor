let products = [];
let categories = [];
let coupons = [];
let orders = [];
let reviews = [];
let settings = {};
let landingPages = [];
let shipping = [];
let customers = {};

// Settings are now fetched from Supabase

const THEMES = {
    dark: { 
        primary: "#0ea5e9", secondary: "#38bdf8", bg: "#0f172a", card: "#1e293b", 
        text: "#f8fafc", muted: "#94a3b8", border: "rgba(255,255,255,0.05)", name: "السمة المظلمة" 
    },
    light: { 
        primary: "#0ea5e9", secondary: "#38bdf8", bg: "#ffffff", card: "#ffffff", 
        text: "#0f172a", muted: "#64748b", border: "#f1f5f9", name: "السمة الفاتحة" 
    },
    light_premium: { 
        primary: "#0d9488", secondary: "#14b8a6", bg: "#fafafa", card: "#ffffff", 
        text: "#0f172a", muted: "#64748b", border: "#e2e8f0", name: "السمة الفاتحة المتميزة" 
    },
    festive: { 
        primary: "#fcd34d", secondary: "#fbbf24", bg: "#7f1d1d", card: "#991b1b", 
        text: "#fef2f2", muted: "#fca5a5", border: "#b91c1c", name: "سمة الأعياد" 
    },
    ramadan: { 
        primary: "#f5d0fe", secondary: "#e879f9", bg: "#1e1b4b", card: "#2e1065", 
        text: "#fdf4ff", muted: "#d8b4fe", border: "#4c1d95", name: "سمة رمضان" 
    }
};

const COMMON_ICONS = [
    // Social
    "fa-facebook", "fa-facebook-f", "fa-instagram", "fa-tiktok", "fa-whatsapp", "fa-telegram", "fa-twitter", "fa-youtube", "fa-snapchat", "fa-linkedin",
    // Features / Common
    "fa-truck", "fa-truck-fast", "fa-shield-halved", "fa-medal", "fa-headset", "fa-credit-card", "fa-star", "fa-heart", "fa-check", "fa-check-double",
    "fa-gem", "fa-gift", "fa-clock", "fa-bolt", "fa-box", "fa-tag", "fa-cart-shopping", "fa-mobile-screen", "fa-headphones", "fa-plug", "fa-battery-full"
];

// Safety check for settings properties
if (!settings.auth) settings.auth = { user: "admin", pass: "perex2026" };
if (!settings.colors) settings.colors = { primary: "#0ea5e9", secondary: "#38bdf8", bg: "#0f172a" };
if (!settings.theme) settings.theme = "dark";
if (!settings.floatingBtns) settings.floatingBtns = [];
if (!settings.store) settings.store = { name: "Perex Store", logo: "prerx logo.jpeg", whatsapp: "201222711455", pixel: "", waMsg: "🛍️ طلب جديد من Perex Store" };

let activePickerTarget = null;
let activePickerType = 'solid'; // 'solid' or 'brands'
// Fetched from Supabase

// Global Vars
let selectedImages = [];
let currentOrderToPrint = null;
let isProcessingImages = false;

// ===== INITIALIZATION =====
document.addEventListener('DOMContentLoaded', async () => {
    showLoading();
    await initData();
    checkLogin();
    renderAll();
    setupEventListeners();
    initDragAndDrop();
    updateStats();
    hideLoading();
});

async function initData() {
    try {
        products = await SupabaseService.getProducts();
        categories = await SupabaseService.getCategories();
        coupons = await SupabaseService.getCoupons();
        orders = await SupabaseService.getOrders();
        settings = await SupabaseService.getSettings();
        shipping = await SupabaseService.getShippingRates();
        reviews = await SupabaseService.getReviews();
        
        // Migration Check: If products are empty in Supabase but exist in localStorage
        const localProds = JSON.parse(localStorage.getItem('perex_products')) || [];
        if (products.length === 0 && localProds.length > 0) {
            console.log('Migrating data to Supabase...');
            showToast('جاري نقل البيانات إلى Supabase...');
            
            // Migrate Products
            for (let p of localProds) {
                await SupabaseService.saveProduct(p);
            }
            // Migrate Categories
            const localCats = JSON.parse(localStorage.getItem('perex_categories')) || [];
            for (let c of localCats) {
                await SupabaseService.saveCategory(c);
            }
            // Migrate Settings
            const localSettings = JSON.parse(localStorage.getItem('perex_settings'));
            if (localSettings) {
                await SupabaseService.saveSettings(localSettings);
                settings = localSettings;
            }
            // Migrate Shipping
            const localShip = JSON.parse(localStorage.getItem('perex_shipping'));
            if (localShip) {
                await SupabaseService.saveShippingRates(localShip);
                shipping = localShip;
            }
            
            // Refresh Supabase data
            products = await SupabaseService.getProducts();
            categories = await SupabaseService.getCategories();
            showToast('تم نقل البيانات بنجاح');
        }

        // If shipping is still empty, add defaults
        if (shipping.length === 0) {
            const defaults = [
                { name: "القاهرة", price: 50 }, { name: "الجيزة", price: 50 }, { name: "الإسكندرية", price: 60 },
                { name: "القليوبية", price: 60 }, { name: "المنوفية", price: 70 }, { name: "الغربية", price: 70 },
                { name: "الدقهلية", price: 70 }, { name: "الشرقية", price: 70 }, { name: "البحيرة", price: 70 },
                { name: "دمياط", price: 80 }, { name: "كفر الشيخ", price: 80 }, { name: "الفيوم", price: 80 },
                { name: "بني سويف", price: 80 }, { name: "المنيا", price: 90 }, { name: "أسيوط", price: 90 },
                { name: "سوهاج", price: 100 }, { name: "قنا", price: 100 }, { name: "الأقصر", price: 100 },
                { name: "أسوان", price: 120 }, { name: "مطروح", price: 120 }, { name: "الوادي الجديد", price: 150 },
                { name: "شمال سيناء", price: 150 }, { name: "جنوب سيناء", price: 150 }, { name: "البحر الأحمر", price: 120 },
                { name: "السويس", price: 80 }, { name: "الإسماعيلية", price: 80 }, { name: "بورسعيد", price: 80 }
            ];
            for(let d of defaults) {
                await SupabaseService.saveShippingRate(d);
            }
            shipping = await SupabaseService.getShippingRates();
        }

    } catch (e) {
        console.error('Data Init Error:', e);
        showToast('فشل تحميل البيانات من Supabase. تأكد من إعداد الجداول.', 'error');
    } finally {
        // Ensure robust fallbacks
        if (!settings) settings = {};
        if (!settings.auth) settings.auth = { user: "admin", pass: "perex2026" };
        if (!settings.store) settings.store = { name: "Perex Store", logo: "prerx logo.jpeg", whatsapp: "201222711455", pixel: "", waMsg: "🛍️ طلب جديد من Perex Store" };
        if (!settings.theme) settings.theme = "dark";
        if (!settings.banner) settings.banner = { title: "ارتقِ بتجربة هاتفك", desc: "أحدث إكسسوارات الهواتف", cta: "تسوق الآن", img: "" };
        if (!settings.colors) settings.colors = { primary: "#0ea5e9", secondary: "#38bdf8", bg: "#0f172a" };
    }
}

function showLoading() {
    const loader = document.getElementById('loading-screen');
    if (loader) loader.style.display = 'flex';
}

function hideLoading() {
    const loader = document.getElementById('loading-screen');
    if (loader) {
        loader.style.transition = 'opacity 0.5s ease';
        loader.style.opacity = '0';
        setTimeout(() => {
            loader.style.display = 'none';
        }, 500);
    }
}

async function saveAll() {
    showToast('جاري المزامنة مع Supabase...');
    try {
        await SupabaseService.saveSettings(settings);
        // Also sync other lists if they were modified
        await SupabaseService.saveShippingRates(shipping);
        showToast('تمت المزامنة بنجاح');
    } catch (e) {
        console.error('Supabase Sync Error:', e);
        showToast('فشل المزامنة مع Supabase', 'error');
    }
}

// ===== LOGIN LOGIC =====
function checkLogin() {
    if (sessionStorage.getItem('perex_logged_in') === 'true') {
        document.getElementById('login-overlay').classList.add('hidden');
        document.getElementById('admin-panel').classList.remove('hidden');
    }
}

function doLogin() {
    try {
        const userInput = document.getElementById('login-user').value.trim();
        const passInput = document.getElementById('login-pass').value.trim();
        
        // Safety check
        if (!settings || !settings.auth) {
            console.warn('Settings not loaded yet, using defaults');
            if (!settings) settings = {};
            settings.auth = { user: "admin", pass: "perex2026" };
        }

        const correctUser = settings.auth.user || "admin";
        const correctPass = settings.auth.pass || "perex2026";

        if (userInput === correctUser && passInput === correctPass) {
            sessionStorage.setItem('perex_logged_in', 'true');
            location.reload();
        } else {
            const errorEl = document.getElementById('login-error');
            errorEl.style.display = 'block';
            errorEl.innerText = "اسم المستخدم أو كلمة المرور غير صحيحة";
        }
    } catch (err) {
        console.error('Login Error:', err);
        alert('حدث خطأ أثناء تسجيل الدخول: ' + err.message);
    }
}

function doLogout() {
    sessionStorage.removeItem('perex_logged_in');
    location.reload();
}

function forgotPassword() {
    if (!settings.store || !settings.store.settingsPwd) {
        alert('لم يتم تعيين كلمة مرور خاصة بقسم "إعدادات الموقع" من قبل. لا يمكنك استعادة حساب المدير بهذه الطريقة.');
        return;
    }
    const pwd = prompt('الرجاء إدخال كلمة المرور الخاصة بقسم "إعدادات الموقع" لاستعادة الحساب:');
    if (pwd === settings.store.settingsPwd) {
        const newUser = prompt('أدخل اسم المستخدم الجديد للوحة التحكم:');
        const newPass = prompt('أدخل كلمة المرور الجديدة للوحة التحكم:');
        if (newUser && newPass) {
            if (!settings.auth) settings.auth = {};
            settings.auth.user = newUser;
            settings.auth.pass = newPass;
            saveAll();
            alert('تم تغيير بيانات الدخول بنجاح! يمكنك الآن تسجيل الدخول بالبيانات الجديدة.');
            document.getElementById('login-user').value = newUser;
            document.getElementById('login-pass').value = newPass;
        } else {
            alert('تم إلغاء العملية، يجب إدخال اسم مستخدم وكلمة مرور.');
        }
    } else if (pwd !== null) {
        alert('كلمة مرور الإعدادات غير صحيحة!');
    }
}

// ===== TAB SWITCHING =====
function switchTab(tabId, el) {
    if (tabId === 'settings' && settings.store && settings.store.settingsPwd) {
        const pwd = prompt('الرجاء إدخال كلمة المرور للوصول إلى إعدادات الموقع:');
        if (pwd !== settings.store.settingsPwd) {
            showToast('كلمة المرور غير صحيحة', 'error');
            return;
        }
    }
    document.querySelectorAll('.tab-section').forEach(s => s.classList.remove('active'));
    document.getElementById('tab-' + tabId).classList.add('active');
    document.querySelectorAll('.nav-item').forEach(i => i.classList.remove('active'));
    el.classList.add('active');
    document.getElementById('top-bar-title').innerText = el.innerText.trim();
    if (window.innerWidth < 900) toggleSidebar();
    renderAll();
    if (tabId === 'orders') {
        if (orders.length > 0) {
            const maxId = Math.max(...orders.map(o => parseInt(o.id) || 0));
            localStorage.setItem('perex_last_seen_order_id', maxId);
        }
        const badges = [document.getElementById('orders-badge'), document.getElementById('notif-count')];
        badges.forEach(b => {
            if (b) b.classList.add('hidden');
        });
    }
}

function toggleSidebar() {
    document.getElementById('sidebar').classList.toggle('open');
}

// ===== RENDERERS =====
function renderAll() {
    renderCategories();
    renderProductsAdmin();
    renderCoupons();
    renderOrdersAdmin();
    renderLandingList();
    renderReviewsAdmin();
    renderShippingSettings();
    renderFeaturesSettings();
    renderSocialSettings();
    renderFloatingBtns();
    renderAllThemes();
    loadSettings();
}

// Categories
function renderCategories() {
    const list = document.getElementById('categories-drag-list');
    list.innerHTML = '';
    categories.sort((a, b) => a.order - b.order).forEach(cat => {
        const item = document.createElement('div');
        item.className = 'drag-item';
        item.draggable = true;
        item.dataset.id = cat.id;
        item.innerHTML = `
            <i class="fa-solid fa-grip-lines drag-handle"></i>
            <span class="drag-item-name">${cat.name} <small>(${cat.slug})</small></span>
            <div class="drag-item-actions">
                <button class="btn btn-icon btn-ghost btn-sm" onclick="editCat('${cat.id}')"><i class="fa-solid fa-pen"></i></button>
                <button class="btn btn-icon btn-danger btn-sm" onclick="deleteCat('${cat.id}')"><i class="fa-solid fa-trash"></i></button>
            </div>
        `;
        list.appendChild(item);
    });
    // Update product category dropdowns
    const selects = [document.getElementById('prod-category'), document.getElementById('prod-cat-filter')];
    selects.forEach(s => {
        if (!s) return;
        const val = s.value;
        s.innerHTML = s.id === 'prod-cat-filter' ? '<option value="">كل الأقسام</option>' : '';
        categories.forEach(c => {
            s.innerHTML += `<option value="${c.id}">${c.name}</option>`;
        });
        s.value = val;
    });
}

// Products
function renderProductsAdmin() {
    const tbody = document.getElementById('products-tbody');
    const search = document.getElementById('prod-search').value.toLowerCase();
    const cat = document.getElementById('prod-cat-filter').value;
    tbody.innerHTML = '';

    const filtered = products.filter(p => {
        return (p.name.toLowerCase().includes(search)) && (cat === '' || p.category === cat);
    });

    filtered.forEach((p, index) => {
        const tr = document.createElement('tr');
        const catName = categories.find(c => c.id === p.category)?.name || p.category;
        tr.innerHTML = `
            <td>${index + 1}</td>
            <td><img src="${p.images[0] || 'prerx logo.jpeg'}" class="thumb"></td>
            <td>${p.name}</td>
            <td>${catName}</td>
            <td>
                <div style="color:#fbbf24; font-size:0.85rem;">
                    ${generateStarRating(p.rating || 5)}
                </div>
            </td>
            <td>${p.price} ج.م</td>
            <td><del>${p.old_price || '-'}</del></td>
            <td>${p.stock}</td>
            <td>
                <label class="toggle"><input type="checkbox" ${p.is_visible !== false ? 'checked' : ''} onchange="toggleProductVisibility(${p.id})"><span class="toggle-slider"></span></label>
            </td>
            <td>
                <button class="btn btn-icon btn-ghost btn-sm" onclick="editProduct(${p.id})"><i class="fa-solid fa-pen"></i></button>
                <button class="btn btn-icon btn-danger btn-sm" onclick="deleteProduct(${p.id})"><i class="fa-solid fa-trash"></i></button>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

// Coupons
function renderCoupons() {
    const tbody = document.getElementById('coupons-tbody');
    if (!tbody) return;
    tbody.innerHTML = '';
    coupons.forEach(c => {
        const status = c.is_active ? '<span class="badge badge-new">مفعل</span>' : '<span class="badge badge-cancelled">معطل</span>';
        const discountVal = c.type === 'fixed' ? `${c.discount} ج.م` : `${c.discount}%`;
        const discountText = `${discountVal} ${c.free_shipping ? '+ شحن مجاني' : ''}`;
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td><strong>${c.code}</strong></td>
            <td>${discountText}</td>
            <td>${c.expiry_date || 'بدون تاريخ'}</td>
            <td>${c.current_uses} / ${c.max_uses}</td>
            <td>${status}</td>
            <td>
                <button class="btn btn-icon btn-ghost btn-sm" onclick="editCoupon('${c.id}')"><i class="fa-solid fa-pen"></i></button>
                <button class="btn btn-icon btn-danger btn-sm" onclick="deleteCoupon('${c.id}')"><i class="fa-solid fa-trash"></i></button>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

// Orders
function renderOrdersAdmin() {
    const tbody = document.getElementById('orders-tbody');
    const search = document.getElementById('order-search').value.toLowerCase();
    const status = document.getElementById('order-status-filter').value;
    const date = document.getElementById('order-date-filter').value;
    tbody.innerHTML = '';

    const filtered = orders.filter(o => {
        const cName = (o.customer_name || (o.customer && o.customer.name) || '').toLowerCase();
        const cPhone = o.customer_phone || (o.customer && o.customer.phone) || '';
        const matchesSearch = cName.includes(search) || cPhone.includes(search);
        const matchesStatus = status === '' || o.status === status;
        const oDate = (o.created_at || '').split('T')[0];
        const matchesDate = date === '' || oDate === date;
        return matchesSearch && matchesStatus && matchesDate;
    }).sort((a,b) => new Date(b.created_at || b.timestamp || 0) - new Date(a.created_at || a.timestamp || 0));

    filtered.forEach(o => {
        const tr = document.createElement('tr');
        const statusBadge = getStatusBadge(o.status);
        
        const customerName = o.customer_name || (o.customer && o.customer.name) || 'عميل';
        const customerPhone = o.customer_phone || (o.customer && o.customer.phone) || '-';
        const customerGov = o.governorate || (o.customer && o.customer.governorate) || '-';

        const displayDate = (o.created_at || '').split('T')[0] || o.date || '-';

        tr.innerHTML = `
            <td>#${o.id}</td>
            <td>${displayDate}</td>
            <td>${customerName}</td>
            <td>${customerPhone}</td>
            <td>${customerGov}</td>
            <td>${o.total} ج.م</td>
            <td>${statusBadge}</td>
            <td>
                <button class="btn btn-icon btn-primary btn-sm" onclick="viewOrder('${o.id}')"><i class="fa-solid fa-eye"></i></button>
                <button class="btn btn-icon btn-danger btn-sm" onclick="deleteOrder('${o.id}')"><i class="fa-solid fa-trash"></i></button>
            </td>
        `;
        tbody.appendChild(tr);
    });
    
    // Update badge count
    const lastSeenId = parseInt(localStorage.getItem('perex_last_seen_order_id')) || 0;
    const newOrders = orders.filter(o => o.status === 'new' && (parseInt(o.id) || 0) > lastSeenId).length;
    const isOrdersTab = document.getElementById('tab-orders').classList.contains('active');
    
    const badgeEl = document.getElementById('orders-badge');
    const notifEl = document.getElementById('notif-count');
    
    if (badgeEl) {
        badgeEl.innerText = newOrders;
        badgeEl.classList.toggle('hidden', newOrders === 0 || isOrdersTab);
    }
    if (notifEl) {
        notifEl.innerText = newOrders;
        notifEl.classList.toggle('hidden', newOrders === 0 || isOrdersTab);
    }
}

function getStatusBadge(status) {
    switch(status) {
        case 'new': return '<span class="badge badge-new">جديد</span>';
        case 'processing': return '<span class="badge badge-processing">قيد التنفيذ</span>';
        case 'done': return '<span class="badge badge-done">مكتمل</span>';
        case 'cancelled': return '<span class="badge badge-cancelled">ملغي</span>';
        default: return '<span class="badge">' + status + '</span>';
    }
}

// ===== ACTIONS: CATEGORY =====
function openCatModal() {
    document.getElementById('cat-modal-title').innerText = 'قسم جديد';
    document.getElementById('cat-edit-id').value = '';
    document.getElementById('cat-name').value = '';
    document.getElementById('cat-slug').value = '';
    document.getElementById('cat-modal').classList.add('active');
}

function editCat(id) {
    const cat = categories.find(c => c.id === id);
    if (!cat) return;
    document.getElementById('cat-modal-title').innerText = 'تعديل القسم';
    document.getElementById('cat-edit-id').value = cat.id;
    document.getElementById('cat-name').value = cat.name;
    document.getElementById('cat-slug').value = cat.slug;
    document.getElementById('cat-modal').classList.add('active');
}

async function saveCategory() {
    const name = document.getElementById('cat-name').value;
    const slug = document.getElementById('cat-slug').value;
    const id = document.getElementById('cat-edit-id').value;

    if (!name || !slug) return showToast('برجاء ملء جميع الحقول', 'error');

    const catData = { 
        name, 
        slug, 
        order: categories.length + 1, 
        is_visible: true 
    };
    if (id) catData.id = id;
    else catData.id = slug; // Fallback to slug if no ID

    try {
        await SupabaseService.saveCategory(catData);
        categories = await SupabaseService.getCategories();
        closeModal('cat-modal');
        renderCategories();
        showToast('تم حفظ القسم بنجاح');
    } catch (e) {
        showToast('فشل حفظ القسم: ' + e.message, 'error');
    }
}

async function deleteCat(id) {
    if (confirm('هل أنت متأكد من حذف هذا القسم؟')) {
        try {
            await SupabaseService.deleteCategory(id);
            categories = await SupabaseService.getCategories();
            renderCategories();
            showToast('تم حذف القسم');
        } catch (e) {
            showToast('فشل الحذف من Supabase', 'error');
        }
    }
}

// ===== ACTIONS: PRODUCT =====
function openProductModal() {
    document.getElementById('product-modal-title').innerText = 'منتج جديد';
    document.getElementById('prod-edit-id').value = '';
    document.getElementById('prod-name').value = '';
    document.getElementById('prod-price').value = '';
    document.getElementById('prod-old-price').value = '';
    document.getElementById('prod-stock').value = '99';
    document.getElementById('prod-badge').value = '';
    document.getElementById('prod-desc').value = '';
    document.getElementById('prod-pixel').value = '';
    document.getElementById('prod-img-url').value = '';
    selectedImages = [];
    renderImgPreviews();
    document.getElementById('product-modal').classList.add('active');
}

async function uploadToImgBB(base64Data) {
    if (!settings.store || !settings.store.imgbbKey) return base64Data;
    try {
        const base64Image = base64Data.split(',')[1];
        if (!base64Image) return base64Data;
        const formData = new FormData();
        formData.append('image', base64Image);
        
        const response = await fetch(`https://api.imgbb.com/1/upload?key=${settings.store.imgbbKey}`, {
            method: 'POST',
            body: formData
        });
        const data = await response.json();
        if (data.success) {
            return data.data.url;
        }
    } catch (e) {
        console.error('ImgBB Upload Error:', e);
    }
    return base64Data;
}

function handleProductImages(input) {
    const files = Array.from(input.files);
    const status = document.getElementById('prod-img-status');
    if (files.length === 0) return;

    status.innerText = 'جاري المعالجة (والرفع للسحابة إن وُجد المفتاح)...';
    status.style.color = 'var(--pr)';
    isProcessingImages = true;
    let processed = 0;
    files.forEach(file => {
        const reader = new FileReader();
        reader.onload = async (e) => {
            const compressed = await compressImage(e.target.result, 800, 800, 0.8);
            const finalUrl = await uploadToImgBB(compressed);
            selectedImages.push(finalUrl);
            renderImgPreviews();
            processed++;
            if (processed === files.length) {
                status.innerText = `تمت معالجة ${files.length} صورة بنجاح`;
                status.style.color = 'var(--su)';
                isProcessingImages = false;
                setTimeout(() => status.innerText = '', 3000);
            }
        };
        reader.readAsDataURL(file);
    });
}

function renderImgPreviews() {
    const container = document.getElementById('prod-img-preview');
    container.innerHTML = '';
    selectedImages.forEach((img, idx) => {
        const div = document.createElement('div');
        div.className = 'img-preview-item';
        div.innerHTML = `
            <img src="${img}">
            <button class="del-img" onclick="removeImg(${idx})"><i class="fa-solid fa-xmark"></i></button>
        `;
        container.appendChild(div);
    });
}

function removeImg(idx) {
    selectedImages.splice(idx, 1);
    renderImgPreviews();
}

async function compressImage(base64, maxWidth, maxHeight, quality) {
    return new Promise(resolve => {
        const img = new Image();
        img.src = base64;
        img.onload = () => {
            const canvas = document.createElement('canvas');
            let w = img.width;
            let h = img.height;
            if (w > h) { if (w > maxWidth) { h *= maxWidth / w; w = maxWidth; } }
            else { if (h > maxHeight) { w *= maxHeight / h; h = maxHeight; } }
            canvas.width = w; canvas.height = h;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0, w, h);
            
            // Try WebP first, fallback to JPEG
            const type = canvas.toDataURL('image/webp').indexOf('data:image/webp') === 0 ? 'image/webp' : 'image/jpeg';
            resolve(canvas.toDataURL(type, quality));
        };
    });
}

async function saveProduct() {
    if (isProcessingImages) {
        return showToast('برجاء الانتظار حتى تنتهي معالجة الصور', 'error');
    }
    const name = document.getElementById('prod-name').value.trim();
    const cat = document.getElementById('prod-category').value;
    const price = document.getElementById('prod-price').value;
    const id = document.getElementById('prod-edit-id').value;
    const imgUrl = document.getElementById('prod-img-url').value.trim();

    if (imgUrl && !selectedImages.includes(imgUrl)) {
        selectedImages.unshift(imgUrl);
    }

    if (!name || !price || !cat) {
        return showToast('برجاء إدخال الاسم والقسم والسعر', 'error');
    }

    if (selectedImages.length === 0) {
        return showToast('برجاء إضافة صورة واحدة على الأقل للمنتج', 'error');
    }

    const prodData = {
        name,
        category: cat,
        price: parseFloat(price),
        old_price: document.getElementById('prod-old-price').value ? parseFloat(document.getElementById('prod-old-price').value) : null,
        stock: parseInt(document.getElementById('prod-stock').value) || 0,
        badge: document.getElementById('prod-badge').value,
        description: document.getElementById('prod-desc').value,
        rating: parseFloat(document.getElementById('prod-rating').value) || 5,
        pixel_id: document.getElementById('prod-pixel').value,
        images: [...selectedImages],
        is_visible: true
    };

    if (id) prodData.id = parseInt(id);

    try {
        await SupabaseService.saveProduct(prodData);
        products = await SupabaseService.getProducts();
        closeModal('product-modal');
        renderProductsAdmin();
        updateStats();
        showToast('تم حفظ المنتج بنجاح');
    } catch (e) {
        showToast('فشل حفظ المنتج: ' + e.message, 'error');
    }
}

function editProduct(id) {
    const p = products.find(prod => prod.id == id);
    if (!p) return;
    document.getElementById('product-modal-title').innerText = 'تعديل المنتج';
    document.getElementById('prod-edit-id').value = p.id;
    document.getElementById('prod-name').value = p.name;
    document.getElementById('prod-category').value = p.category;
    document.getElementById('prod-price').value = p.price;
    document.getElementById('prod-old-price').value = p.old_price || '';
    document.getElementById('prod-stock').value = p.stock;
    document.getElementById('prod-badge').value = p.badge;
    document.getElementById('prod-desc').value = p.description || '';
    document.getElementById('prod-rating').value = p.rating || 5;
    document.getElementById('prod-pixel').value = p.pixel_id || '';
    selectedImages = [...p.images];
    renderImgPreviews();
    document.getElementById('product-modal').classList.add('active');
}

async function deleteProduct(id) {
    if (confirm('هل أنت متأكد من حذف هذا المنتج؟')) {
        try {
            await SupabaseService.deleteProduct(id);
            products = await SupabaseService.getProducts();
            renderProductsAdmin();
            showToast('تم حذف المنتج');
        } catch (e) {
            showToast('فشل الحذف من Supabase', 'error');
        }
    }
}

async function toggleProductVisibility(id) {
    const p = products.find(prod => prod.id == id);
    if (!p) return;
    const newStatus = !p.is_visible;
    try {
        await SupabaseService.saveProduct({ id, is_visible: newStatus });
        p.is_visible = newStatus;
        showToast('تم تحديث حالة الظهور');
    } catch (e) {
        showToast('فشل تحديث الحالة: ' + e.message, 'error');
    }
}

// ===== ACTIONS: COUPONS =====
function openCouponModal() {
    document.getElementById('coupon-modal-title').innerText = 'كوبون جديد';
    document.getElementById('coup-edit-id').value = '';
    document.getElementById('coup-code').value = '';
    document.getElementById('coup-type').value = 'percentage';
    document.getElementById('coup-discount').value = '';
    document.getElementById('coup-min-order').value = '';
    document.getElementById('coup-max-discount').value = '';
    document.getElementById('coup-free-shipping').checked = false;
    document.getElementById('coup-expiry').value = '';
    document.getElementById('coup-max-uses').value = '100';
    document.getElementById('coup-apply-type').value = 'all';
    toggleCoupTargeting();
    document.getElementById('coup-customers').value = '';
    document.getElementById('coup-active').checked = true;
    document.getElementById('coupon-modal').classList.add('active');
}

function toggleCoupTargeting() {
    const type = document.getElementById('coup-apply-type').value;
    const wrap = document.getElementById('coup-target-selection-wrap');
    const list = document.getElementById('coup-target-list');
    const label = document.getElementById('coup-target-label');
    
    if (type === 'all') {
        wrap.classList.add('hidden');
        return;
    }
    
    wrap.classList.remove('hidden');
    list.innerHTML = '';
    
    if (type === 'categories') {
        label.innerText = 'اختر الأقسام المشمولة بالخصم:';
        categories.forEach(cat => {
            list.innerHTML += `
                <div style="display:flex; gap:10px; margin-bottom:5px;">
                    <input type="checkbox" name="coup-targets" value="${cat.id}"> <span>${cat.name}</span>
                </div>
            `;
        });
    } else {
        label.innerText = 'اختر المنتجات المشمولة بالخصم:';
        products.forEach(p => {
            list.innerHTML += `
                <div style="display:flex; gap:10px; margin-bottom:5px;">
                    <input type="checkbox" name="coup-targets" value="${p.id}"> <span>${p.name}</span>
                </div>
            `;
        });
    }
}

async function saveCoupon() {
    const code = document.getElementById('coup-code').value.toUpperCase().trim();
    const type = document.getElementById('coup-type').value;
    const discount = document.getElementById('coup-discount').value || 0;
    const minOrder = document.getElementById('coup-min-order').value || 0;
    const maxDiscount = document.getElementById('coup-max-discount').value || 0;
    const freeShipping = document.getElementById('coup-free-shipping').checked;
    const id = document.getElementById('coup-edit-id').value;
    
    const applyType = document.getElementById('coup-apply-type').value;
    const targetIds = Array.from(document.querySelectorAll('input[name="coup-targets"]:checked')).map(cb => cb.value);

    if (!code) return showToast('برجاء إدخال الكود', 'error');

    const data = {
        code,
        type,
        discount: parseInt(discount),
        min_order: parseInt(minOrder),
        max_discount: parseInt(maxDiscount),
        free_shipping: freeShipping,
        apply_type: applyType,
        target_ids: targetIds,
        expiry_date: document.getElementById('coup-expiry').value || null,
        max_uses: parseInt(document.getElementById('coup-max-uses').value) || 100,
        current_uses: id ? coupons.find(c => c.id == id).current_uses : 0,
        is_active: document.getElementById('coup-active').checked
    };

    if (id && id.trim() !== '') data.id = parseInt(id);

    try {
        await SupabaseService.saveCoupon(data);
        coupons = await SupabaseService.getCoupons();
        closeModal('coupon-modal');
        renderCoupons();
        showToast('تم حفظ الكوبون بنجاح');
    } catch (e) {
        showToast('فشل حفظ الكوبون: ' + e.message, 'error');
    }
}

function editCoupon(id) {
    const c = coupons.find(coup => coup.id == id);
    if (!c) return;
    document.getElementById('coupon-modal-title').innerText = 'تعديل الكوبون';
    document.getElementById('coup-edit-id').value = c.id;
    document.getElementById('coup-code').value = c.code;
    document.getElementById('coup-type').value = c.type || 'percentage';
    document.getElementById('coup-discount').value = c.discount;
    document.getElementById('coup-min-order').value = c.min_order || '';
    document.getElementById('coup-max-discount').value = c.max_discount || '';
    document.getElementById('coup-free-shipping').checked = c.free_shipping || false;
    document.getElementById('coup-expiry').value = c.expiry_date || '';
    document.getElementById('coup-max-uses').value = c.max_uses;
    
    document.getElementById('coup-apply-type').value = c.apply_type || 'all';
    toggleCoupTargeting();
    if (c.target_ids) {
        c.target_ids.forEach(tid => {
            const cb = document.querySelector(`input[name="coup-targets"][value="${tid}"]`);
            if (cb) cb.checked = true;
        });
    }

    document.getElementById('coup-active').checked = c.is_active;
    document.getElementById('coupon-modal').classList.add('active');
}

async function deleteCoupon(id) {
    if (confirm('حذف الكوبون؟')) {
        try {
            await SupabaseService.deleteCoupon(id);
            coupons = await SupabaseService.getCoupons();
            renderCoupons();
            showToast('تم حذف الكوبون');
        } catch (e) {
            showToast('فشل الحذف من Supabase', 'error');
        }
    }
}

// ===== ACTIONS: ORDERS =====
function viewOrder(id) {
    const o = orders.find(ord => ord.id === id);
    const body = document.getElementById('order-modal-body');
    currentOrderToPrint = o;

    const customerName = o.customer_name || (o.customer && o.customer.name) || '';
    const customerPhone = o.customer_phone || (o.customer && o.customer.phone) || '';
    const gov = o.governorate || (o.customer && o.customer.governorate) || '';
    const district = o.district || (o.customer && o.customer.district) || '';
    const address = o.address || (o.customer && o.customer.address) || '';
    const notes = o.notes || (o.customer && o.customer.notes) || '';

    body.innerHTML = `
        <div class="form-grid">
            <div class="form-group"><label>الاسم</label><input type="text" id="order-edit-name" class="form-control" value="${customerName}"></div>
            <div class="form-group"><label>الهاتف</label><input type="text" id="order-edit-phone" class="form-control" value="${customerPhone}"></div>
            <div class="form-group"><label>المحافظة</label><input type="text" id="order-edit-gov" class="form-control" value="${gov}"></div>
            <div class="form-group"><label>المنطقة</label><input type="text" id="order-edit-district" class="form-control" value="${district}"></div>
            <div class="form-group form-full"><label>العنوان بالتفصيل</label><textarea id="order-edit-address" class="form-control" rows="2">${address}</textarea></div>
            <div class="form-group form-full"><label>ملاحظات العميل</label><textarea id="order-edit-notes" class="form-control" rows="2">${notes}</textarea></div>
        </div>
        <button class="btn btn-sm btn-success" style="margin-bottom:20px;" onclick="saveOrderDetails('${o.id}')">حفظ تعديلات البيانات</button>

        <div class="form-grid">
            <div class="form-group">
                <label>تغيير الحالة</label>
                <select class="form-control" id="order-edit-status" onchange="updateOrderStatus('${o.id}', this.value)">
                    <option value="new" ${o.status === 'new' ? 'selected' : ''}>جديد</option>
                    <option value="processing" ${o.status === 'processing' ? 'selected' : ''}>قيد التنفيذ</option>
                    <option value="done" ${o.status === 'done' ? 'selected' : ''}>مكتمل</option>
                    <option value="cancelled" ${o.status === 'cancelled' ? 'selected' : ''}>ملغي</option>
                </select>
            </div>
            <div class="form-group">
                <label>التاريخ</label>
                <div class="form-control">${(o.created_at || '').replace('T', ' ').split('.')[0]}</div>
            </div>
        </div>
        <hr style="margin:20px 0;opacity:0.1">
        <h3>المنتجات</h3>
        <table style="margin-top:10px;">
            <thead><tr><th>المنتج</th><th>الكمية</th><th>السعر</th></tr></thead>
            <tbody>
                ${o.items.map(item => `<tr><td>${item.name}</td><td>${item.qty || 1}</td><td>${item.price * (item.qty || 1)} ج.م</td></tr>`).join('')}
            </tbody>
        </table>
        <div style="text-align:left;margin-top:15px;font-weight:700; background:rgba(255,255,255,0.05); padding:15px; border-radius:10px;">
            <div style="margin-bottom:10px;">الإجمالي قبل الخصم: ${o.subtotal} ج.م</div>
            ${o.coupon ? `<div style="color:var(--su); margin-bottom:10px;">الكوبون المستخدم: <span style="background:rgba(34,197,94,0.1); padding:2px 8px; border-radius:5px;">${o.coupon}</span> ${o.discount === 0 ? '(شحن مجاني)' : ''}</div>` : ''}
            ${o.discount ? `<div style="color:var(--da); margin-bottom:10px;">قيمة الخصم: -${o.discount} ج.م</div>` : ''}
            
            <div class="form-group" style="display:flex; align-items:center; gap:10px; justify-content:flex-end; margin-bottom:10px;">
                <label>مصاريف الشحن:</label>
                <input type="number" id="order-edit-shipping" class="form-control" style="width:100px; text-align:center;" value="${o.shipping}">
            </div>
            
            <div class="form-group" style="display:flex; align-items:center; gap:10px; justify-content:flex-end; font-size:1.2rem; color:var(--pr); border-top:1px solid rgba(255,255,255,0.1); padding-top:10px;">
                <label>الإجمالي النهائي:</label>
                <input type="number" id="order-edit-total" class="form-control" style="width:120px; text-align:center; font-weight:bold; color:var(--pr);" value="${o.total}">
            </div>
        </div>
        <hr style="margin:20px 0;opacity:0.1">
        <h3>ملاحظات الإدارة (داخلية)</h3>
        <textarea class="form-control" style="margin-top:10px; background:rgba(0,0,0,0.3);" rows="3" placeholder="اكتب ملاحظاتك هنا..." onchange="saveOrderNote('${o.id}', this.value)">${o.adminNote || ''}</textarea>
    `;
    document.getElementById('order-modal').classList.add('active');
    document.getElementById('order-modal-print').onclick = () => printInvoice(o);
}

async function saveOrderDetails(id) {
    const o = orders.find(ord => ord.id === id);
    if (!o) return;
    
    const updatedData = {
        id: o.id,
        customer_name: document.getElementById('order-edit-name').value,
        customer_phone: document.getElementById('order-edit-phone').value,
        governorate: document.getElementById('order-edit-gov').value,
        district: document.getElementById('order-edit-district').value,
        address: document.getElementById('order-edit-address').value,
        notes: document.getElementById('order-edit-notes').value,
        shipping: parseFloat(document.getElementById('order-edit-shipping').value) || 0,
        total: parseFloat(document.getElementById('order-edit-total').value) || 0
    };
    
    try {
        await SupabaseService.saveOrder(updatedData); // upsert logic in supabase-client handles id
        orders = await SupabaseService.getOrders();
        renderOrdersAdmin();
        updateStats();
        showToast('تم حفظ تعديلات الطلب بنجاح');
    } catch (e) {
        showToast('فشل حفظ التعديلات في Supabase', 'error');
    }
}

async function deleteOrder(id) {
    if (confirm('هل أنت متأكد من حذف هذا الطلب نهائياً؟')) {
        try {
            await SupabaseService.deleteOrder(id);
            orders = await SupabaseService.getOrders();
            renderOrdersAdmin();
            updateStats();
            showToast('تم حذف الطلب بنجاح');
        } catch (e) {
            showToast('فشل حذف الطلب من Supabase', 'error');
        }
    }
}

async function updateOrderStatus(id, status) {
    try {
        await SupabaseService.updateOrderStatus(id, status);
        const o = orders.find(ord => ord.id === id);
        if (o) o.status = status;
        renderOrdersAdmin();
        updateStats();
        showToast('تم تحديث حالة الطلب');
    } catch (e) {
        showToast('فشل تحديث الحالة في Supabase', 'error');
    }
}

function printInvoice(o) {
    const win = window.open('', '_blank');
    const itemsHtml = o.items.map(i => `<tr><td>${i.name}</td><td>${i.qty || 1}</td><td>${i.price * (i.qty || 1)} ج.م</td></tr>`).join('');
    
    const storeName = settings.store.name || "Perex Store";
    const storeLogo = settings.store.logo ? `<img src="${settings.store.logo}" style="height:60px; object-fit:contain; margin-bottom:10px;">` : '';
    const storePhone = settings.store.whatsapp || "";

    win.document.write(`
        <html dir="rtl">
        <head><title>فاتورة ${o.id}</title><style>
            body{font-family:Arial, sans-serif;padding:40px;line-height:1.6;color:#333; direction:rtl;}
            .header{display:flex;justify-content:space-between;border-bottom:2px solid #eee;padding-bottom:20px;margin-bottom:20px;align-items:flex-start;}
            table{width:100%;border-collapse:collapse;margin:20px 0;font-size:14px;}
            th,td{padding:12px;text-align:right;border-bottom:1px solid #eee;}
            th{background:#f9fafb;}
            .total-box{text-align:left;margin-top:20px;padding:20px;background:#f9fafb;border-radius:10px;width:300px;margin-right:auto;}
            .total-row{display:flex;justify-content:space-between;margin-bottom:8px;}
            .final-total{font-weight:bold;font-size:1.4rem;color:#0ea5e9;border-top:2px solid #eee;margin-top:10px;padding-top:10px;}
            .coupon-tag{color:#16a34a;font-size:0.9rem;}
            .footer-msg {margin-top:40px;text-align:center;color:#999;font-size:0.9rem;border-top:1px solid #eee;padding-top:20px;}
        </style></head>
        <body onload="window.print()">
            <div class="header">
                <div>
                    ${storeLogo}
                    <h1 style="color:#0ea5e9;margin:0;font-size:24px;">${storeName}</h1>
                    <p style="margin:5px 0 0 0; color:#666;">رقم الهاتف: ${storePhone}</p>
                </div>
                <div style="text-align:left; padding-top:10px;">
                    <h3 style="margin:0;font-size:20px;">فاتورة رقم: #${o.id}</h3>
                    <p style="margin:5px 0;">التاريخ: ${(o.created_at || '').split('T')[0]}</p>
                </div>
            </div>
            <div style="background:#f4f4f5; padding:15px; border-radius:8px; margin-bottom:20px;">
                <h3 style="margin:0 0 10px 0; color:#333;">بيانات العميل</h3>
                <div style="display:flex; justify-content:space-between;">
                    <div><strong>الاسم:</strong> ${o.customer_name || (o.customer && o.customer.name)}</div>
                    <div><strong>الهاتف:</strong> ${o.customer_phone || (o.customer && o.customer.phone)}</div>
                    <div><strong>العنوان:</strong> ${o.governorate || (o.customer && o.customer.governorate)} - ${o.district || (o.customer && o.customer.district) || ''} <br> <small>${o.address || (o.customer && o.customer.address)}</small></div>
                </div>
            </div>
            <table>
                <thead><tr><th>المنتج</th><th>الكمية</th><th>الإجمالي</th></tr></thead>
                <tbody>${itemsHtml}</tbody>
            </table>
            <div class="total-box">
                <div class="total-row"><span>الإجمالي الفرعي:</span> <span>${o.subtotal} ج.م</span></div>
                ${o.coupon ? `<div class="total-row coupon-tag"><span>خصم (${o.coupon}):</span> <span>${o.discount > 0 ? '-' + o.discount + ' ج.م' : 'شحن مجاني'}</span></div>` : ''}
                <div class="total-row"><span>مصاريف الشحن:</span> <span>${o.shipping === 0 && o.coupon ? 'مجاني' : o.shipping + ' ج.م'}</span></div>
                <div class="total-row final-total"><span>الإجمالي النهائي:</span> <span>${o.total} ج.م</span></div>
            </div>
            <div class="footer-msg">شكراً لتسوقكم من ${storeName}</div>
        </body></html>
    `);
    win.document.close();
}

function exportTodayOrders() {
    const today = new Date().toISOString().split('T')[0];
    const todayOrders = orders.filter(o => (o.created_at || '').startsWith(today));
    if (todayOrders.length === 0) return showToast('لا توجد طلبات اليوم لتصديرها', 'error');
    
    let csv = "رقم الطلب,العميل,الهاتف,المحافظة,الإجمالي,الحالة\n";
    todayOrders.forEach(o => {
        const cName = o.customer_name || (o.customer && o.customer.name) || '';
        const cPhone = o.customer_phone || (o.customer && o.customer.phone) || '';
        const cGov = o.governorate || (o.customer && o.customer.governorate) || '';
        csv += `${o.id},${cName},${cPhone},${cGov},${o.total},${o.status}\n`;
    });
    
    const blob = new Blob(["\ufeff" + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `orders_${today}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

// ===== CUSTOMER SEARCH =====
function searchCustomers() {
    const query = document.getElementById('cust-search-input').value.toLowerCase();
    const results = document.getElementById('customer-results');
    results.innerHTML = '';

    if (!query) return;

    // Find customers from orders
    const found = {};
    orders.forEach(o => {
        const cName = o.customer_name || (o.customer && o.customer.name) || '';
        const cPhone = o.customer_phone || (o.customer && o.customer.phone) || '';
        const cDistrict = o.district || (o.customer && o.customer.district) || '';
        
        if (cName.toLowerCase().includes(query) || cPhone.includes(query) || cDistrict.toLowerCase().includes(query)) {
            if (!found[cPhone]) {
                found[cPhone] = { name: cName, phone: cPhone, district: cDistrict, orders: [], totalSpent: 0 };
            }
            found[cPhone].orders.push(o);
            found[cPhone].totalSpent += o.total;
        }
    });

    Object.values(found).forEach(c => {
        const div = document.createElement('div');
        div.className = 'card customer-card';
        div.style.marginBottom = '15px';
        div.innerHTML = `
            <div class="customer-info-grid">
                <div class="info-item"><label>الاسم</label><span>${c.name}</span></div>
                <div class="info-item"><label>الهاتف</label><span>${c.phone}</span></div>
                <div class="info-item"><label>المنطقة</label><span>${c.district || '-'}</span></div>
                <div class="info-item"><label>إجمالي المشتريات</label><span style="color:var(--su)">${c.totalSpent} ج.م</span></div>
                <div class="info-item"><label>عدد الطلبات</label><span>${c.orders.length}</span></div>
            </div>
            <button class="btn btn-sm btn-ghost" onclick="toggleCustOrders('${c.phone}')">عرض الطلبات</button>
            <div id="cust-orders-${c.phone}" class="hidden" style="margin-top:15px;border-top:1px solid var(--bo);padding-top:10px;">
                ${c.orders.map(o => `<div style="display:flex;justify-content:space-between;font-size:0.85rem;margin-bottom:5px;"><span>#${o.id} - ${o.date}</span><span>${o.total} ج.م</span></div>`).join('')}
            </div>
        `;
        results.appendChild(div);
    });
}

function toggleCustOrders(phone) {
    document.getElementById('cust-orders-' + phone).classList.toggle('hidden');
}

// ===== LANDING PAGES =====
function renderLandingList() {
    const list = document.getElementById('landing-pages-list');
    const select = document.getElementById('landing-product-select');
    list.innerHTML = '';
    select.innerHTML = '';

    products.forEach(p => {
        select.innerHTML += `<option value="${p.id}">${p.name}</option>`;
        const div = document.createElement('div');
        div.className = 'landing-card';
        div.innerHTML = `
            <img src="${p.images[0]}">
            <div class="landing-card-info">
                <h4>${p.name}</h4>
                <a href="landing.html?id=${p.id}" target="_blank">${window.location.origin}/landing.html?id=${p.id}</a>
            </div>
            <button class="btn btn-sm btn-primary" onclick="copyUrl('${window.location.origin}/landing.html?id=${p.id}')">نسخ</button>
        `;
        list.appendChild(div);
    });
}

function generateLanding() {
    showToast('تم تحديث قائمة صفحات الهبوط');
}

function copyUrl(url) {
    navigator.clipboard.writeText(url);
    showToast('تم نسخ الرابط');
}

// ===== REVIEWS MANAGEMENT =====
function renderReviewsAdmin() {
    const tbody = document.getElementById('reviews-tbody');
    if (!tbody) return;
    tbody.innerHTML = '';

    reviews.forEach((r) => {
        const tr = document.createElement('tr');
        const user = r.user_name || r.user || r.name || 'عميل مجهول';
        const text = r.comment || r.text || '';
        const rating = r.rating || 5;
        const displayDate = (r.created_at || '').split('T')[0] || r.date || '-';

        tr.innerHTML = `
            <td><strong>${user}</strong><br><small>${displayDate}</small></td>
            <td>${'⭐'.repeat(rating)}</td>
            <td style="max-width:200px; white-space:normal;">${text}</td>
            <td>
                <textarea class="form-control" placeholder="اكتب رداً..." onchange="replyToReview('${r.id}', this.value)">${r.reply || ''}</textarea>
            </td>
            <td>
                <button class="btn btn-icon btn-danger btn-sm" onclick="deleteReview('${r.id}')"><i class="fa-solid fa-trash"></i></button>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

async function replyToReview(reviewId, text) {
    try {
        await SupabaseService.updateReview(reviewId, { reply: text });
        reviews = await SupabaseService.getReviews();
        renderReviewsAdmin();
        showToast('تم حفظ الرد');
    } catch (e) {
        showToast('فشل حفظ الرد في Supabase', 'error');
    }
}

async function deleteReview(id) {
    if (confirm('هل أنت متأكد من حذف هذا التعليق؟')) {
        try {
            await SupabaseService.deleteReview(id);
            reviews = await SupabaseService.getReviews();
            renderReviewsAdmin();
            showToast('تم حذف التعليق');
        } catch (e) {
            showToast('فشل حذف التعليق', 'error');
        }
    }
}

// ===== FEATURES EDITOR =====
function renderFeaturesSettings() {
    const container = document.getElementById('features-settings-list');
    if (!container) return;
    container.innerHTML = '';
    
    if (!settings.features) {
        settings.features = [
            { title: "توصيل سريع", desc: "نضمن لك توصيل طلباتك بأسرع وقت ممكن لباب منزلك.", icon: "fa-truck-fast" },
            { title: "جودة أصلية", desc: "جميع منتجاتنا أصلية ومضمونة 100% لتضمن لك أفضل أداء.", icon: "fa-medal" },
            { title: "دعم فني 24/7", desc: "فريق خدمة العملاء متواجد دائماً للرد على استفساراتكم.", icon: "fa-headset" },
            { title: "دفع آمن", desc: "نوفر طرق دفع متعددة وآمنة لتسهيل عملية الشراء.", icon: "fa-credit-card" }
        ];
    }

    settings.features.forEach((f, idx) => {
        const div = document.createElement('div');
        div.className = 'card';
        div.style.marginBottom = '10px';
        div.style.background = 'rgba(0,0,0,0.2)';
        div.innerHTML = `
            <div class="card-body">
                <div class="form-grid">
                    <div class="form-group"><label>العنوان</label><input type="text" class="form-control" value="${f.title}" onchange="updateFeature(${idx}, 'title', this.value)"></div>
                    <div class="form-group">
                        <label>الأيقونة <i class="fa-solid ${f.icon}" id="feature-icon-preview-${idx}" style="margin-right:8px; color:var(--pr);"></i></label>
                        <div style="display:flex; gap:5px;">
                            <input type="text" class="form-control" id="feature-icon-input-${idx}" value="${f.icon}" oninput="document.getElementById('feature-icon-preview-${idx}').className = 'fa-solid ' + this.value" onchange="updateFeature(${idx}, 'icon', this.value)">
                            <button class="btn btn-ghost btn-sm" onclick="openIconPicker('feature-icon-input-${idx}', 'solid')"><i class="fa-solid fa-eye"></i></button>
                        </div>
                    </div>
                    <div class="form-group form-full"><label>الوصف</label><input type="text" class="form-control" value="${f.desc}" onchange="updateFeature(${idx}, 'desc', this.value)"></div>
                </div>
            </div>
        `;
        container.appendChild(div);
    });
}

async function updateFeature(idx, key, val) {
    settings.features[idx][key] = val;
    await saveAll();
}

// ===== ICON PICKER =====
function openIconPicker(targetId, type = 'solid') {
    activePickerTarget = targetId;
    activePickerType = type;
    const grid = document.getElementById('icon-picker-grid');
    grid.innerHTML = '';
    
    COMMON_ICONS.forEach(icon => {
        // Simple filter: brands usually for social, solid for features
        const isBrand = icon.includes('facebook') || icon.includes('instagram') || icon.includes('tiktok') || icon.includes('whatsapp') || icon.includes('telegram') || icon.includes('twitter') || icon.includes('youtube') || icon.includes('snapchat') || icon.includes('linkedin');
        
        if (type === 'brands' && !isBrand && !icon.includes('fa-')) return; 
        
        const btn = document.createElement('button');
        btn.className = 'icon-select-btn';
        const prefix = isBrand ? 'fa-brands' : 'fa-solid';
        btn.innerHTML = `<i class="${prefix} ${icon}"></i>`;
        btn.onclick = () => selectIcon(icon, prefix);
        grid.appendChild(btn);
    });
    
    document.getElementById('icon-picker-modal').classList.add('active');
}

function selectIcon(icon, prefix) {
    const input = document.getElementById(activePickerTarget);
    if (input) {
        input.value = icon;
        // Trigger input event to update preview
        input.dispatchEvent(new Event('input'));
        // Trigger change event to save
        input.dispatchEvent(new Event('change'));
    }
    closeModal('icon-picker-modal');
}

// ===== SOCIAL MEDIA MANAGEMENT =====
function renderSocialSettings() {
    const container = document.getElementById('social-settings-list');
    if (!container) return;
    container.innerHTML = '';
    
    if (!settings.social) settings.social = [];

    settings.social.forEach((s, idx) => {
        const div = document.createElement('div');
        div.className = 'card';
        div.style.marginBottom = '10px';
        div.style.background = 'rgba(0,0,0,0.2)';
        div.innerHTML = `
            <div class="card-body" style="display:flex; gap:10px; align-items:center;">
                <div class="form-group" style="width:50px; text-align:center;">
                    <i class="fa-brands ${s.icon.includes('fa-') ? s.icon : 'fa-' + s.platform}" id="social-icon-preview-${idx}" style="font-size:1.5rem; color:var(--pr);"></i>
                </div>
                <div class="form-group" style="flex:1;">
                    <label>الأيقونة</label>
                    <div style="display:flex; gap:5px;">
                        <input type="text" class="form-control" id="social-icon-input-${idx}" value="${s.icon}" oninput="document.getElementById('social-icon-preview-${idx}').className = 'fa-brands ' + this.value" onchange="updateSocial(${idx}, 'icon', this.value)">
                        <button class="btn btn-ghost btn-sm" onclick="openIconPicker('social-icon-input-${idx}', 'brands')"><i class="fa-solid fa-eye"></i></button>
                    </div>
                </div>
                <div class="form-group" style="flex:2;"><label>الرابط (URL)</label><input type="text" class="form-control" value="${s.url}" onchange="updateSocial(${idx}, 'url', this.value)"></div>
                <button class="btn btn-icon btn-danger" onclick="deleteSocial(${idx})" style="margin-top:15px;"><i class="fa-solid fa-trash"></i></button>
            </div>
        `;
        container.appendChild(div);
    });
}

async function addSocial() {
    if (!settings.social) settings.social = [];
    settings.social.push({ platform: "new", url: "https://", icon: "fa-link" });
    await saveAll();
    renderSocialSettings();
}

async function updateSocial(idx, key, val) {
    settings.social[idx][key] = val;
    await saveAll();
}

async function deleteSocial(idx) {
    settings.social.splice(idx, 1);
    await saveAll();
    renderSocialSettings();
}

// ===== SETTINGS =====
function loadSettings() {
    document.getElementById('banner-title').value = settings.banner.title;
    document.getElementById('banner-desc').value = settings.banner.desc;
    document.getElementById('banner-cta').value = settings.banner.cta;
    document.getElementById('set-whatsapp').value = settings.store.whatsapp;
    
    // Theme Loading
    selectTheme(settings.theme || 'dark', false);
    
    document.getElementById('set-email').value = settings.store.email || "";
    document.getElementById('set-address').value = settings.store.address || "";
    document.getElementById('set-pixel').value = settings.store.pixel || "";
    document.getElementById('set-imgbb-key').value = settings.store.imgbbKey || "";
    document.getElementById('set-wa-msg').value = settings.store.waMsg || "";
    document.getElementById('set-store-name').value = settings.store.name || "Perex Store";
    document.getElementById('set-settings-pwd').value = settings.store.settingsPwd || "";
    document.getElementById('new-username').value = settings.auth.user;
    
    if (settings.store.logo) {
        document.getElementById('store-logo-preview').innerHTML = `<img src="${settings.store.logo}" style="width:60px;height:60px;border-radius:50%;object-fit:cover;border:2px solid var(--pr);">`;
    }
    
    // Badge
    document.getElementById('badge-text').value = settings.badge.text || "حماية فائقة";
    document.getElementById('badge-icon').value = settings.badge.icon || "fa-shield-halved";
    document.getElementById('badge-icon-preview').className = 'fa-solid ' + (settings.badge.icon || 'fa-shield-halved');
    
    // Banner Toggle
    if (!settings.banner) settings.banner = {};
    document.getElementById('main-banner-active').checked = settings.banner.isActive !== false;

    if (settings.banner.img) {
        document.getElementById('banner-img-preview').innerHTML = `
            <div style="position:relative; display:inline-block;">
                <img src="${settings.banner.img}" style="max-width:200px;border-radius:10px;">
                <button class="btn btn-icon btn-danger btn-sm" style="position:absolute; top:5px; left:5px;" onclick="deleteBannerImg()"><i class="fa-solid fa-trash"></i></button>
            </div>
        `;
    } else {
        document.getElementById('banner-img-preview').innerHTML = '';
    }
    renderSliders();
}

function renderSliders() {
    const list = document.getElementById('sliders-list');
    list.innerHTML = '';
    if (!settings.sliders) settings.sliders = [];
    
    settings.sliders.forEach((s, idx) => {
        const div = document.createElement('div');
        div.className = 'drag-item';
        div.dataset.index = idx;
        div.style.flexDirection = 'column';
        div.style.alignItems = 'stretch';
        div.style.gap = '10px';
        div.draggable = true;
        div.innerHTML = `
            <div style="display:flex; justify-content:space-between; align-items:center;">
                <div style="display:flex; align-items:center; gap:10px;">
                    <img src="${s.img}" style="width:100px;height:50px;object-fit:cover;border-radius:5px;">
                    <span class="drag-item-name" style="cursor:move;">بنر إعلاني #${idx + 1} <i class="fa-solid fa-arrows-up-down" style="color:#999;font-size:0.8rem;"></i></span>
                </div>
                <button class="btn btn-icon btn-danger btn-sm" onclick="deleteSlider(${idx})"><i class="fa-solid fa-trash"></i></button>
            </div>
            <div class="form-group">
                <input type="text" class="form-control" placeholder="عنوان البنر (اختياري)" value="${s.title || ''}" onchange="updateSlider(${idx}, 'title', this.value)">
            </div>
            <div class="form-group">
                <input type="text" class="form-control" placeholder="وصف البنر (اختياري)" value="${s.desc || ''}" onchange="updateSlider(${idx}, 'desc', this.value)">
            </div>
        `;
        list.appendChild(div);
    });
}

function updateSlider(idx, key, val) {
    settings.sliders[idx][key] = val;
    saveAll();
    showToast('تم تحديث البنر');
}

function addSliderBanner(input) {
    const file = input.files[0];
    const reader = new FileReader();
    reader.onload = async (e) => {
        const compressed = await compressImage(e.target.result, 1600, 600, 0.85);
        const finalUrl = await uploadToImgBB(compressed);
        if (!settings.sliders) settings.sliders = [];
        settings.sliders.push({ img: finalUrl });
        saveAll();
        renderSliders();
        showToast('تم إضافة البنر بنجاح');
    };
    reader.readAsDataURL(file);
}

function deleteSlider(idx) {
    settings.sliders.splice(idx, 1);
    saveAll();
    renderSliders();
}

function handleBannerImg(input) {
    const file = input.files[0];
    const reader = new FileReader();
    reader.onload = async (e) => {
        const compressed = await compressImage(e.target.result, 1600, 800, 0.85);
        const finalUrl = await uploadToImgBB(compressed);
        settings.banner.img = finalUrl;
        document.getElementById('banner-img-preview').innerHTML = `
            <div style="position:relative; display:inline-block;">
                <img src="${finalUrl}" style="max-width:200px;border-radius:10px;">
                <button class="btn btn-icon btn-danger btn-sm" style="position:absolute; top:5px; left:5px;" onclick="deleteBannerImg()"><i class="fa-solid fa-trash"></i></button>
            </div>
        `;
        showToast('تم تحديث صورة البانر');
    };
    reader.readAsDataURL(file);
}

function deleteBannerImg() {
    if (confirm('هل أنت متأكد من حذف صورة البانر الرئيسي؟')) {
        settings.banner.img = "";
        saveAll();
        document.getElementById('banner-img-preview').innerHTML = '';
        showToast('تم حذف صورة البانر الرئيسي');
    }
}

function toggleMainBanner() {
    if (!settings.banner) settings.banner = {};
    settings.banner.isActive = document.getElementById('main-banner-active').checked;
    saveAll();
    showToast('تم تحديث حالة البانر الرئيسي');
}

function handleStoreLogo(input) {
    const file = input.files[0];
    const reader = new FileReader();
    reader.onload = async (e) => {
        const compressed = await compressImage(e.target.result, 400, 400, 0.9);
        const finalUrl = await uploadToImgBB(compressed);
        settings.store.logo = finalUrl;
        document.getElementById('store-logo-preview').innerHTML = `<img src="${finalUrl}" style="width:60px;height:60px;border-radius:50%;object-fit:cover;border:2px solid var(--pr);">`;
        showToast('تم رفع الشعار بنجاح');
    };
    reader.readAsDataURL(file);
}

async function saveSettings() {
    settings.banner.title = document.getElementById('banner-title').value;
    settings.banner.desc = document.getElementById('banner-desc').value;
    settings.banner.cta = document.getElementById('banner-cta').value;
    settings.theme = document.getElementById('selected-theme').value;
    
    const themeData = THEMES[settings.theme] || THEMES.dark;
    settings.colors = { primary: themeData.primary, secondary: themeData.secondary, bg: themeData.bg };

    settings.store.whatsapp = document.getElementById('set-whatsapp').value;
    settings.store.email = document.getElementById('set-email').value;
    settings.store.address = document.getElementById('set-address').value;
    settings.store.pixel = document.getElementById('set-pixel').value;
    settings.store.imgbbKey = document.getElementById('set-imgbb-key').value;
    settings.store.waMsg = document.getElementById('set-wa-msg').value;
    settings.store.name = document.getElementById('set-store-name').value;
    settings.store.settingsPwd = document.getElementById('set-settings-pwd').value;
    settings.auth.user = document.getElementById('new-username').value;
    if (document.getElementById('new-password').value) {
        settings.auth.pass = document.getElementById('new-password').value;
    }
    
    settings.badge = {
        text: document.getElementById('badge-text').value,
        icon: document.getElementById('badge-icon').value
    };

    await saveAll();
}

// ===== UTILS =====
function closeModal(id) {
    document.getElementById(id).classList.remove('active');
}

function selectTheme(themeId, autoSave = true) {
    // Visual Selection
    document.querySelectorAll('.theme-card').forEach(c => {
        c.style.borderColor = 'transparent';
        c.style.boxShadow = 'none';
        c.style.transform = 'scale(1)';
    });
    
    const selectedCard = document.getElementById('theme-' + themeId);
    if (selectedCard) {
        selectedCard.style.borderColor = 'var(--pr)';
        selectedCard.style.boxShadow = '0 0 0 4px rgba(14, 165, 233, 0.2)';
        selectedCard.style.transform = 'scale(1.05)';
        document.getElementById('selected-theme').value = themeId;
        
        const themeData = THEMES[themeId] || THEMES.dark;
        applyThemeToAdmin(themeData);

        if (autoSave) {
            settings.theme = themeId;
            settings.colors = { primary: themeData.primary, secondary: themeData.secondary, bg: themeData.bg };
            saveAll();
            showToast(`تم تفعيل ${themeData.name} بنجاح`, 'success');
        }
    }
}

function applyThemeToAdmin(colors) {
    document.documentElement.style.setProperty('--pr', colors.primary);
    document.documentElement.style.setProperty('--sc', colors.secondary);
    document.documentElement.style.setProperty('--ab', colors.bg);
    document.documentElement.style.setProperty('--cb', colors.card);
    document.documentElement.style.setProperty('--tx', colors.text);
    document.documentElement.style.setProperty('--mu', colors.muted);
    document.documentElement.style.setProperty('--bo', colors.border);
    
    // Explicitly set sidebar background if it's very dark
    document.documentElement.style.setProperty('--sb', colors.bg);
}

function renderAllThemes() {
    // Initialization of theme cards if needed, but they are static in HTML for now
}

function showToast(msg, type = 'success') {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = 'toast show';
    if (type === 'error') toast.style.borderRightColor = 'var(--da)';
    toast.innerHTML = `
        <div class="toast-icon"><i class="fa-solid ${type === 'success' ? 'fa-check' : 'fa-triangle-exclamation'}"></i></div>
        <div class="toast-body"><div class="toast-title">${type === 'success' ? 'نجاح' : 'تنبيه'}</div><div class="toast-msg">${msg}</div></div>
    `;
    container.appendChild(toast);
    setTimeout(() => { toast.remove(); }, 3000);
}

function updateStats() {
    const today = new Date().toISOString().split('T')[0];
    const month = today.substring(0, 7);
    
    const todayOrders = orders.filter(o => {
        const oDate = (o.created_at || '').split('T')[0] || o.date;
        return oDate === today && o.status !== 'cancelled';
    });
    const monthOrders = orders.filter(o => {
        const oDate = (o.created_at || '').split('T')[0] || o.date;
        return oDate && oDate.startsWith(month) && o.status !== 'cancelled';
    });
    
    document.getElementById('stat-orders-today').innerText = todayOrders.length;
    document.getElementById('stat-revenue-today').innerText = todayOrders.reduce((sum, o) => sum + o.total, 0);
    document.getElementById('stat-orders-month').innerText = monthOrders.length;
    document.getElementById('stat-revenue-month').innerText = monthOrders.reduce((sum, o) => sum + o.total, 0);
    
    // Top Products
    const prodSales = {};
    orders.forEach(o => {
        if (o.status === 'cancelled') return;
        o.items.forEach(i => {
            prodSales[i.name] = (prodSales[i.name] || 0) + 1;
        });
    });
    
    const topProds = Object.entries(prodSales).sort((a,b) => b[1] - a[1]).slice(0, 5);
    const topList = document.getElementById('top-products-list');
    if (topProds.length > 0) {
        topList.innerHTML = topProds.map(p => `<div style="display:flex;justify-content:space-between;margin-bottom:8px;"><span>${p[0]}</span><span class="badge badge-new">${p[1]} قطعة</span></div>`).join('');
    }
    
    // Recent Orders
    const recentList = document.getElementById('recent-orders-list');
    const recents = orders.slice(-5).reverse();
    if (recents.length > 0) {
        recentList.innerHTML = recents.map(o => `<div style="display:flex;justify-content:space-between;margin-bottom:8px;font-size:0.85rem;"><span>${o.customer.name}</span><span>${getStatusBadge(o.status)}</span></div>`).join('');
    }
}

// ===== DRAG AND DROP =====
function initDragAndDrop() {
    setupDragList('categories-drag-list', (items) => {
        items.forEach((item, idx) => {
            const cat = categories.find(c => c.id === item.dataset.id);
            if (cat) cat.order = idx + 1;
        });
        saveAll();
    });

    setupDragList('sliders-list', (items) => {
        const newSliders = [];
        items.forEach(item => {
            const idx = parseInt(item.dataset.index);
            if (settings.sliders[idx]) {
                newSliders.push(settings.sliders[idx]);
            }
        });
        settings.sliders = newSliders;
        saveAll();
        renderSliders(); // Re-render to update indices
    });
}

function setupDragList(containerId, onReorder) {
    const list = document.getElementById(containerId);
    if (!list) return;
    let draggedItem = null;

    list.addEventListener('dragstart', (e) => {
        const item = e.target.closest('.drag-item');
        if (!item) return;
        draggedItem = item;
        item.classList.add('dragging');
    });

    list.addEventListener('dragend', (e) => {
        const item = e.target.closest('.drag-item');
        if (!item) return;
        item.classList.remove('dragging');
        const items = [...list.querySelectorAll('.drag-item')];
        onReorder(items);
    });

    list.addEventListener('dragover', (e) => {
        e.preventDefault();
        const afterElement = getDragAfterElement(list, e.clientY);
        if (draggedItem) {
            if (afterElement == null) {
                list.appendChild(draggedItem);
            } else {
                list.insertBefore(draggedItem, afterElement);
            }
        }
    });
}

function getDragAfterElement(container, y) {
    const draggableElements = [...container.querySelectorAll('.drag-item:not(.dragging)')];
    return draggableElements.reduce((closest, child) => {
        const box = child.getBoundingClientRect();
        const offset = y - box.top - box.height / 2;
        if (offset < 0 && offset > closest.offset) {
            return { offset: offset, element: child };
        } else {
            return closest;
        }
    }, { offset: Number.NEGATIVE_INFINITY }).element;
}

function setupEventListeners() {
    // Add enter key for login
    const loginUser = document.getElementById('login-user');
    const loginPass = document.getElementById('login-pass');
    
    if (loginUser) {
        loginUser.addEventListener('keypress', (e) => { if (e.key === 'Enter') doLogin(); });
    }
    if (loginPass) {
        loginPass.addEventListener('keypress', (e) => { if (e.key === 'Enter') doLogin(); });
    }
}

function renderFloatingBtns() {
    const container = document.getElementById('floating-btns-list');
    if (!container) return;
    container.innerHTML = '';
    
    if (!settings.floatingBtns) settings.floatingBtns = [];

    settings.floatingBtns.forEach((btn, idx) => {
        const div = document.createElement('div');
        div.className = 'card';
        div.style.marginBottom = '15px';
        div.style.background = 'rgba(255,255,255,0.03)';
        div.style.border = '1px solid rgba(255,255,255,0.1)';
        
        // Determine prefix
        const isBrand = btn.icon.includes('facebook') || btn.icon.includes('instagram') || btn.icon.includes('tiktok') || btn.icon.includes('whatsapp') || btn.icon.includes('telegram') || btn.icon.includes('messenger') || btn.icon.includes('link') || btn.icon.includes('phone');
        const prefix = isBrand ? 'fa-brands' : 'fa-solid';

        div.innerHTML = `
            <div class="card-body" style="display:flex; gap:15px; align-items:center; flex-wrap:wrap;">
                <div style="width:60px; height:60px; border-radius:50%; background:${btn.color}; display:flex; align-items:center; justify-content:center; color:white; font-size:24px; box-shadow:0 4px 10px rgba(0,0,0,0.3);">
                    <i class="${prefix} ${btn.icon}" id="float-icon-preview-${idx}"></i>
                </div>
                <div style="flex:1; min-width:200px;">
                    <div class="form-grid" style="grid-template-columns: 1fr 1fr;">
                        <div class="form-group">
                            <label>الأيقونة</label>
                            <div style="display:flex; gap:5px;">
                                <input type="text" class="form-control" id="float-icon-input-${idx}" value="${btn.icon}" 
                                    oninput="document.getElementById('float-icon-preview-${idx}').className = '${prefix} ' + this.value" 
                                    onchange="updateFloatingBtn(${idx}, 'icon', this.value)">
                                <button class="btn btn-ghost btn-sm" onclick="openIconPicker('float-icon-input-${idx}', 'brands')"><i class="fa-solid fa-eye"></i></button>
                            </div>
                        </div>
                        <div class="form-group">
                            <label>اللون</label>
                            <input type="color" class="form-control" value="${btn.color}" style="height:42px; padding:2px;" onchange="updateFloatingBtn(${idx}, 'color', this.value)">
                        </div>
                    </div>
                    <div class="form-group" style="margin-top:10px;">
                        <label>الرابط (URL / رقم الهاتف / إيميل)</label>
                        <input type="text" class="form-control" value="${btn.url}" placeholder="https://..." onchange="updateFloatingBtn(${idx}, 'url', this.value)">
                    </div>
                </div>
                <button class="btn btn-icon btn-danger" onclick="deleteFloatingBtn(${idx})" title="حذف الزر"><i class="fa-solid fa-trash"></i></button>
            </div>
        `;
        container.appendChild(div);
    });
}

function addFloatingBtn() {
    if (!settings.floatingBtns) settings.floatingBtns = [];
    settings.floatingBtns.push({ id: Date.now(), icon: "fa-whatsapp", url: "#", color: "#25D366" });
    saveAll();
    renderFloatingBtns();
}

function updateFloatingBtn(idx, key, val) {
    settings.floatingBtns[idx][key] = val;
    saveAll();
    renderFloatingBtns();
}

function deleteFloatingBtn(idx) {
    settings.floatingBtns.splice(idx, 1);
    saveAll();
    renderFloatingBtns();
}

function exportDatabase() {
    const data = {
        products,
        categories,
        orders,
        settings,
        reviews: JSON.parse(localStorage.getItem('perex_reviews')) || [],
        shipping: JSON.parse(localStorage.getItem('perex_shipping')) || []
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `perex_store_backup_${new Date().toISOString().split('T')[0]}.json`;
    link.click();
    showToast('تم تصدير نسخة البيانات بنجاح');
}

function importDatabase(input) {
    const file = input.files[0];
    if (!file) return;
    
    if (confirm('استيراد البيانات سيقوم بمسح كافة البيانات الحالية واستبدالها. هل أنت متأكد؟')) {
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const data = JSON.parse(e.target.result);
                if (data.products) localStorage.setItem('perex_products', JSON.stringify(data.products));
                if (data.categories) localStorage.setItem('perex_categories', JSON.stringify(data.categories));
                if (data.orders) localStorage.setItem('perex_orders', JSON.stringify(data.orders));
                if (data.settings) localStorage.setItem('perex_settings', JSON.stringify(data.settings));
                if (data.reviews) localStorage.setItem('perex_reviews', JSON.stringify(data.reviews));
                if (data.shipping) localStorage.setItem('perex_shipping', JSON.stringify(data.shipping));
                
                showToast('تم استيراد البيانات بنجاح، سيتم إعادة التحميل...');
                setTimeout(() => location.reload(), 2000);
            } catch (err) {
                showToast('خطأ في تنسيق ملف البيانات', 'error');
            }
        };
        reader.readAsText(file);
    }
}

async function saveOrderNote(id, note) {
    try {
        await SupabaseService.saveOrder({ id, admin_note: note });
        const o = orders.find(ord => ord.id === id);
        if (o) o.adminNote = note;
        showToast('تم حفظ الملاحظة');
    } catch (e) {
        showToast('فشل حفظ الملاحظة', 'error');
    }
}

function renderShippingSettings() {
    const tbody = document.getElementById('shipping-tbody');
    if (!tbody) return;
    tbody.innerHTML = '';
    
    shipping.forEach(gov => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${gov.name}</td>
            <td><input type="number" class="form-control" value="${gov.price}" style="width:100px; text-align:center;" onchange="updateShippingPrice('${gov.id}', this.value)"></td>
            <td><button class="btn btn-sm btn-success" onclick="showToast('تم تحديث السعر')"><i class="fa-solid fa-check"></i></button></td>
        `;
        tbody.appendChild(tr);
    });
}

async function updateShippingPrice(id, price) {
    const gov = shipping.find(g => g.id === id);
    if (gov) {
        gov.price = parseFloat(price) || 0;
        try {
            await SupabaseService.saveShippingRate(gov);
            showToast('تم تحديث السعر');
        } catch (e) {
            showToast('فشل التحديث في Supabase', 'error');
        }
    }
}

function getFilteredOrders() {
    const day = document.getElementById('export-day').value;
    const month = document.getElementById('export-month').value;
    const year = document.getElementById('export-year').value;
    
    let filtered = orders;
    let title = "تقرير الطلبات";

    if (day) {
        filtered = orders.filter(o => {
            const oDate = (o.created_at || '').split('T')[0] || o.date;
            return oDate === day;
        });
        title = `تقرير طلبات يوم ${day}`;
    } else if (month) {
        filtered = orders.filter(o => {
            const oDate = (o.created_at || '').split('T')[0] || o.date;
            return oDate && oDate.startsWith(month);
        });
        title = `تقرير طلبات شهر ${month}`;
    } else if (year) {
        filtered = orders.filter(o => {
            const oDate = (o.created_at || '').split('T')[0] || o.date;
            return oDate && oDate.startsWith(year);
        });
        title = `تقرير طلبات سنة ${year}`;
    } else {
        showToast('برجاء تحديد اليوم أو الشهر أو السنة للتصدير', 'error');
        return null;
    }

    if (filtered.length === 0) {
        showToast('لا توجد طلبات في هذه الفترة', 'error');
        return null;
    }
    return { filtered, title };
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

function exportOrdersPDF() {
    const data = getFilteredOrders();
    if (!data) return;
    const { filtered, title } = data;

    const win = window.open('', '_blank');
    const tableRows = filtered.map((o, idx) => {
        const customerName = o.customer_name || (o.customer && o.customer.name) || 'عميل';
        const customerPhone = o.customer_phone || (o.customer && o.customer.phone) || '-';
        const customerGov = o.governorate || (o.customer && o.customer.governorate) || '-';
        const displayDate = (o.created_at || '').split('T')[0] || o.date || '-';
        
        return `
            <tr>
                <td>${idx + 1}</td>
                <td>#${o.id}</td>
                <td>${displayDate}</td>
                <td>${customerName}</td>
                <td>${customerPhone}</td>
                <td>${customerGov}</td>
                <td>${(o.items || []).map(i => `${i.name} (${i.qty})`).join(' - ')}</td>
                <td>${o.total} ج.م</td>
                <td>${o.status}</td>
            </tr>
        `;
    }).join('');

    const totalRevenue = filtered.reduce((sum, o) => sum + o.total, 0);

    win.document.write(`
        <html dir="rtl">
        <head>
            <title>${title}</title>
            <style>
                body { font-family: Arial, sans-serif; padding: 20px; line-height: 1.6; }
                .header { text-align: center; margin-bottom: 30px; border-bottom: 2px solid #0ea5e9; padding-bottom: 10px; }
                table { width: 100%; border-collapse: collapse; margin-top: 20px; font-size: 12px; }
                th, td { border: 1px solid #ddd; padding: 10px; text-align: right; }
                th { background-color: #f4f4f4; }
                .stats { display: flex; justify-content: space-between; margin-top: 20px; background: #f9fafb; padding: 15px; border-radius: 8px; font-weight:bold; }
            </style>
        </head>
        <body onload="window.print()">
            <div class="header">
                <h1 style="color:#0ea5e9; margin:0;">Perex Store</h1>
                <h2>${title}</h2>
                <p>عدد الطلبات: ${filtered.length}</p>
            </div>
            <table>
                <thead>
                    <tr><th>#</th><th>رقم الطلب</th><th>التاريخ</th><th>اسم العميل</th><th>الهاتف</th><th>المحافظة</th><th>المنتجات</th><th>الإجمالي</th><th>الحالة</th></tr>
                </thead>
                <tbody>${tableRows}</tbody>
            </table>
            <div class="stats"><span>إجمالي المبيعات:</span> <span style="color:#0ea5e9;">${totalRevenue} ج.م</span></div>
        </body>
        </html>
    `);
    win.document.close();
}

function exportOrdersExcel() {
    const data = getFilteredOrders();
    if (!data) return;
    const { filtered, title } = data;

    const totalRevenue = filtered.reduce((sum, o) => sum + o.total, 0);

    let html = `
        <html dir="rtl">
        <head><meta charset="utf-8"></head>
        <body>
            <table border="1">
                <tr><th colspan="9" style="background:#0ea5e9; color:white; font-size:16pt;">${title} - Perex Store</th></tr>
                <tr><th colspan="9">عدد الطلبات: ${filtered.length} | إجمالي المبيعات: ${totalRevenue} ج.م</th></tr>
                <tr style="background:#f4f4f4; font-weight:bold;">
                    <th>#</th>
                    <th>رقم الطلب</th>
                    <th>التاريخ</th>
                    <th>اسم العميل</th>
                    <th>رقم الهاتف</th>
                    <th>المحافظة</th>
                    <th>المنتجات</th>
                    <th>الإجمالي (ج.م)</th>
                    <th>الحالة</th>
                </tr>
                ${filtered.map((o, idx) => {
                    const customerName = o.customer_name || (o.customer && o.customer.name) || 'عميل';
                    const customerPhone = o.customer_phone || (o.customer && o.customer.phone) || '-';
                    const customerGov = o.governorate || (o.customer && o.customer.governorate) || '-';
                    const displayDate = (o.created_at || '').split('T')[0] || o.date || '-';
                    
                    return `
                    <tr>
                        <td>${idx + 1}</td>
                        <td>${o.id}</td>
                        <td>${displayDate}</td>
                        <td>${customerName}</td>
                        <td>'${customerPhone}</td>
                        <td>${customerGov}</td>
                        <td>${(o.items || []).map(i => `${i.name} (${i.qty})`).join(' - ')}</td>
                        <td>${o.total}</td>
                        <td>${o.status}</td>
                    </tr>
                `;
                }).join('')}
                <tr><td colspan="7" style="text-align:left; font-weight:bold;">المجموع النهائي:</td><td colspan="2" style="font-weight:bold;">${totalRevenue} ج.م</td></tr>
            </table>
        </body>
        </html>
    `;

    const blob = new Blob([html], { type: 'application/vnd.ms-excel' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${title}.xls`;
    link.click();
    showToast('تم تصدير ملف Excel بنجاح');
}

const iconList = {
    brands: [
        "fa-whatsapp", "fa-facebook", "fa-facebook-messenger", "fa-instagram", "fa-telegram", "fa-tiktok", "fa-youtube", "fa-twitter", "fa-snapchat", "fa-linkedin", "fa-pinterest", "fa-viber"
    ],
    solid: [
        "fa-phone", "fa-envelope", "fa-location-dot", "fa-link", "fa-shop", "fa-cart-shopping", "fa-bag-shopping", "fa-star", "fa-heart", "fa-user", "fa-gear", "fa-house", "fa-truck", "fa-credit-card", "fa-money-bill", "fa-percent", "fa-tag", "fa-gift", "fa-fire", "fa-bolt", "fa-shield-halved", "fa-mobile-screen", "fa-laptop", "fa-headphones", "fa-camera", "fa-image", "fa-video", "fa-magnifying-glass", "fa-bell", "fa-circle-info", "fa-circle-question", "fa-circle-exclamation", "fa-circle-check", "fa-clock", "fa-calendar", "fa-map", "fa-paper-plane", "fa-share-nodes", "fa-download", "fa-upload", "fa-print", "fa-trash", "fa-pen", "fa-eye", "fa-lock", "fa-unlock", "fa-key", "fa-bars", "fa-xmark", "fa-chevron-right", "fa-chevron-left", "fa-chevron-up", "fa-chevron-down"
    ]
};

function openIconPicker(inputId, type = 'all') {
    const grid = document.getElementById('icon-picker-grid');
    if (!grid) return;
    grid.innerHTML = '';
    
    let icons = [];
    if (type === 'brands') icons = iconList.brands;
    else if (type === 'solid') icons = iconList.solid;
    else icons = [...iconList.brands, ...iconList.solid];

    icons.forEach(icon => {
        const prefix = iconList.brands.includes(icon) ? 'fa-brands' : 'fa-solid';
        const div = document.createElement('div');
        div.className = 'icon-item';
        div.innerHTML = `<i class="${prefix} ${icon}"></i>`;
        div.onclick = () => {
            document.getElementById(inputId).value = icon;
            // Trigger input event to update preview
            document.getElementById(inputId).dispatchEvent(new Event('input'));
            // Trigger change event to save
            document.getElementById(inputId).dispatchEvent(new Event('change'));
            closeModal('icon-picker-modal');
        };
        grid.appendChild(div);
    });

    document.getElementById('icon-picker-modal').classList.add('active');
}
