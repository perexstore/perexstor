const SUPABASE_URL = 'https://ecbxkudufxpvipxfcdtj.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_DTqljapdUl9XTLI-5u13_Q_1Qg6BDx2';

// Dynamic installation check for cloned stores
if (SUPABASE_URL === 'YOUR_SUPABASE_URL' || !SUPABASE_URL) {
    if (window.location.pathname.indexOf('setup.html') === -1) {
        window.location.href = 'setup.html';
    }
}

const _supabaseClient = (window.supabase || window.Supabase);
if (!_supabaseClient) {
    console.error('Supabase library not loaded! Check your script tags in HTML.');
}
const _supabase = _supabaseClient ? _supabaseClient.createClient(SUPABASE_URL, SUPABASE_ANON_KEY) : null;

// Helper function to handle Supabase responses
async function handleSupabase(promise) {
    if (!_supabase) {
        throw new Error('Supabase client not initialized. Check your configuration.');
    }
    const { data, error, status, statusText } = await promise;
    if (error) {
        console.error('Supabase Error Details:', {
            message: error.message,
            details: error.details,
            hint: error.hint,
            code: error.code,
            status: status
        });
        const msg = error.message || statusText || 'Unknown Supabase Error';
        throw new Error(`${msg} (${error.code || status})`);
    }
    return data;
}

const SupabaseService = {
    // Products
    async getProducts() {
        return await handleSupabase(_supabase.from('products').select('*').order('created_at', { ascending: false }));
    },
    async saveProduct(product) {
        if (product.id && !isNaN(product.id)) {
            return await handleSupabase(_supabase.from('products').update(product).eq('id', product.id));
        } else {
            const { id, ...newProduct } = product; // Remove dummy id if present
            return await handleSupabase(_supabase.from('products').insert(newProduct));
        }
    },
    async deleteProduct(id) {
        return await handleSupabase(_supabase.from('products').delete().eq('id', id));
    },

    // Categories
    async getCategories() {
        return await handleSupabase(_supabase.from('categories').select('*').order('order', { ascending: true }));
    },
    async saveCategory(category) {
        return await handleSupabase(_supabase.from('categories').upsert(category));
    },
    async deleteCategory(id) {
        return await handleSupabase(_supabase.from('categories').delete().eq('id', id));
    },

    // Coupons
    async getCoupons() {
        return await handleSupabase(_supabase.from('coupons').select('*'));
    },
    async saveCoupon(coupon) {
        return await handleSupabase(_supabase.from('coupons').upsert(coupon));
    },
    async deleteCoupon(id) {
        return await handleSupabase(_supabase.from('coupons').delete().eq('id', id));
    },

    // Orders
    async getOrders() {
        // Try ordering by created_at or timestamp based on schema
        return await handleSupabase(_supabase.from('orders').select('*').order('id', { ascending: false }));
    },
    async saveOrder(order) {
        // Fix: If the 'orders' table in Supabase doesn't have an auto-incrementing ID (Identity column),
        // we must provide a unique ID from the frontend.
        if (!order.id) {
            // Generating a 9-digit numeric ID (safe for both Int32 and Int64 columns)
            // Using a slice of timestamp + 2 random digits
            const timestampSlice = Date.now().toString().slice(-7); 
            const randomSuffix = Math.floor(Math.random() * 100).toString().padStart(2, '0');
            order.id = parseInt(timestampSlice + randomSuffix);
        }
        return await handleSupabase(_supabase.from('orders').upsert(order).select().single());
    },
    async updateOrderStatus(id, status) {
        return await handleSupabase(_supabase.from('orders').update({ status }).eq('id', id));
    },
    async deleteOrder(id) {
        return await handleSupabase(_supabase.from('orders').delete().eq('id', id));
    },

    // Settings
    async getSettings() {
        const data = await handleSupabase(_supabase.from('settings').select('*'));
        const settingsMap = {};
        data.forEach(item => {
            settingsMap[item.key] = item.value;
        });
        return settingsMap;
    },
    async saveSetting(key, value) {
        return await handleSupabase(_supabase.from('settings').upsert({ key, value, updated_at: new Date() }));
    },
    async saveSettings(settingsObj) {
        const promises = Object.entries(settingsObj).map(([key, value]) => {
            return this.saveSetting(key, value);
        });
        return await Promise.all(promises);
    },

    // Shipping Rates
    async getShippingRates() {
        return await handleSupabase(_supabase.from('shipping_rates').select('*'));
    },
    async saveShippingRate(rate) {
        return await handleSupabase(_supabase.from('shipping_rates').upsert(rate));
    },
    async saveShippingRates(rates) {
        return await handleSupabase(_supabase.from('shipping_rates').upsert(rates));
    },

    // Reviews
    async getReviews() {
        return await handleSupabase(_supabase.from('reviews').select('*').order('created_at', { ascending: false }));
    },
    async saveReview(review) {
        return await handleSupabase(_supabase.from('reviews').insert(review));
    },
    async updateReview(id, data) {
        return await handleSupabase(_supabase.from('reviews').update(data).eq('id', id));
    },
    async deleteReview(id) {
        return await handleSupabase(_supabase.from('reviews').delete().eq('id', id));
    }
};
