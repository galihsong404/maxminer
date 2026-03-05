const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

class Api {
    private token: string | null = localStorage.getItem('jwt');

    setToken(token: string) {
        this.token = token;
        localStorage.setItem('jwt', token);
    }

    getToken() {
        return this.token;
    }

    private async request(endpoint: string, options: RequestInit = {}) {
        const headers: any = {
            'Content-Type': 'application/json',
            ...options.headers,
        };
        if (this.token) {
            headers['Authorization'] = `Bearer ${this.token}`;
        }

        try {
            const response = await fetch(`${API_URL}${endpoint}`, {
                ...options,
                headers,
            });
            const data = await response.json().catch(() => ({}));

            if (!response.ok) {
                // Return text if not JSON (e.g. ad network callback responses)
                throw new Error(data.error || response.statusText);
            }
            return data;
        } catch (e: any) {
            console.error(`API Error on ${endpoint}:`, e.message);
            throw e;
        }
    }

    async login(initDataRaw: string, referrerId?: string) {
        const res = await this.request('/auth/telegram', {
            method: 'POST',
            body: JSON.stringify({ initDataRaw, referrerId })
        });
        if (res.token) this.setToken(res.token);
        return res;
    }

    async getProfile() {
        return this.request('/user/profile');
    }

    async getReferrals() {
        return this.request('/user/referrals');
    }

    async requestAd() {
        return this.request('/ad/request', { method: 'POST' });
    }

    // Dev Simulator: directly calls the backend's dev-callback which generates the HMAC and redirects
    async simulateAdCallback(sessionId: string, userId: string, rewardType: 'valued' | 'not_valued') {
        const res = await fetch(`${API_URL}/ad/dev-callback?uid=${userId}&custom=${sessionId}&reward_event_type=${rewardType}`);
        return res.ok;
    }

    async syncMining(claimedGold: number, lastSyncTimestamp: number) {
        return this.request('/mine/sync', {
            method: 'POST',
            body: JSON.stringify({ claimedGold, lastSyncTimestamp })
        });
    }

    async convertGoldToMax(goldAmount: number) {
        return this.request('/economy/convert', {
            method: 'POST',
            body: JSON.stringify({ goldAmount })
        });
    }

    async upgradeMiner() {
        return this.request('/economy/upgrade', { method: 'POST' });
    }

    async requestWithdrawal(amount: number, walletAddress: string) {
        return this.request('/economy/withdraw', {
            method: 'POST',
            body: JSON.stringify({ amount, walletAddress })
        });
    }
}

export const api = new Api();
