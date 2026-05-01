const SUPABASE_URL = 'https://ecbxkudufxpvipxfcdtj.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_DTqljapdUl9XTLI-5u13_Q_1Qg6BDx2';

const _supabase = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Helper function to handle Supabase responses
async function handleSupabase(promise) {
    const { data, error } = await promise;
    if (error) {
        console.error('Supabase Error:', error);
        throw error;
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
        return await handleSupabase(_supabase.from('orders').select('*').order('created_at', { ascending: false }));
    },
    async saveOrder(order) {
        return await handleSupabase(_supabase.from('orders').insert(order));
    },
    async updateOrderStatus(id, status) {
        return await handleSupabase(_supabase.from('orders').update({ status }).eq('id', id));
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

    // Shipping Rates
    async getShippingRates() {
        return await handleSupabase(_supabase.from('shipping_rates').select('*'));
    },
    async saveShippingRate(rate) {
        return await handleSupabase(_supabase.from('shipping_rates').upsert(rate));
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
