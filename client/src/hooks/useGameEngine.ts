import { useState, useEffect, useRef } from 'react';
import { api } from '../api';

export function useGameEngine() {
    const [isInitializing, setIsInitializing] = useState(true);
    const [profile, setProfile] = useState<any>(null);
    const [visualGold, setVisualGold] = useState(0);
    const [fuelSeconds, setFuelSeconds] = useState(0);
    const [unclaimedGold, setUnclaimedGold] = useState(0);

    // Mystery Box State (pass to UI)
    const [lootboxData, setLootboxData] = useState<any>(null);
    const [initError, setInitError] = useState<string | null>(null);

    const lastSyncTimeRef = useRef(Date.now());

    const init = async () => {
        try {
            // 1. Get Telegram WebApp Data
            const tg = (window as any).Telegram?.WebApp;
            const initDataRaw = tg?.initData;
            const referrerId = tg?.initDataUnsafe?.start_param; // Captured from t.me/bot?start=REF_ID

            // 2. Lockdown: Force Telegram Environment (Remove Dev Bypass)
            if (!initDataRaw) {
                console.warn("Unauthorized access: Not in Telegram environment.");
                setIsInitializing(false);
                return;
            }

            // 3. Login with official initData
            const loginRes = await api.login(initDataRaw, referrerId);
            if (!loginRes.success) {
                setInitError(loginRes.error || "Login failed");
                return;
            }
            await refreshProfile();

            // 4. Signal readiness to Telegram
            if (tg?.ready) tg.ready();
        } catch (e: any) {
            console.error("Initialization failed:", e);
            setInitError(e.message || "Network Error");
        } finally {
            setIsInitializing(false);
        }
    };

    const refreshProfile = async () => {
        try {
            const res = await api.getProfile();
            if (res.success) {
                setProfile(res.data);
                setVisualGold(Number(res.data.goldBalance));
                setFuelSeconds(res.data.fuel.remainingSeconds);
                lastSyncTimeRef.current = Date.now();
                setUnclaimedGold(0);
            }
        } catch (e) {
            console.error("Profile Fetch Error:", e);
        }
    };

    useEffect(() => {
        init();
    }, []);

    // Visual auto-mining tick (1s loop)
    useEffect(() => {
        if (!profile || fuelSeconds <= 0) return;

        let lastTick = Date.now();
        const interval = setInterval(() => {
            const now = Date.now();
            // Tick length in seconds (can handle minor tab-lag dynamically)
            const deltaSec = (now - lastTick) / 1000;
            lastTick = now;

            setFuelSeconds(prev => Math.max(0, prev - 1));

            const levelConfigs = [
                { level: 1, goldPerHr: 20000 }, { level: 2, goldPerHr: 32000 },
                { level: 3, goldPerHr: 48000 }, { level: 4, goldPerHr: 72000 },
                { level: 5, goldPerHr: 100000 }, { level: 6, goldPerHr: 140000 },
                { level: 7, goldPerHr: 200000 }, { level: 8, goldPerHr: 300000 },
                { level: 9, goldPerHr: 440000 }, { level: 10, goldPerHr: 640000 },
            ];

            const cfg = levelConfigs[profile.minerLevel - 1] || levelConfigs[0];
            const goldPerSec = cfg.goldPerHr / 3600;
            const multiplier = profile.ads.multiplier || 1.0;

            const increment = goldPerSec * multiplier * deltaSec;

            setVisualGold(prev => prev + increment);
            setUnclaimedGold(prev => prev + increment);
        }, 1000);

        return () => clearInterval(interval);
    }, [profile, fuelSeconds]);

    // Periodic Backend Sync Loop (every 10s) + Unload Sync
    useEffect(() => {
        if (!profile) return;

        const performSync = async () => {
            if (unclaimedGold > 0) {
                const goldToClaim = unclaimedGold;
                try {
                    const res = await api.syncMining(goldToClaim, lastSyncTimeRef.current);
                    setUnclaimedGold(curr => Math.max(0, curr - goldToClaim));
                    lastSyncTimeRef.current = res.serverTime || Date.now();
                } catch (e) {
                    console.error("Sync Error:", e);
                }
            }
        };

        const interval = setInterval(performSync, 10000);

        // [HIGH FIX F1] Ensure final sync on app close
        const handleUnload = () => {
            if (unclaimedGold > 0) {
                const payload = JSON.stringify({ claimedGold: unclaimedGold, lastSyncTimestamp: lastSyncTimeRef.current });
                const token = localStorage.getItem('token');

                // Synchronous fetch attempt (Fire and forget)
                fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:3000'}/api/mine/sync`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`
                    },
                    body: payload,
                    keepalive: true // Critical for unload requests
                }).catch(console.error);
            }
        };

        window.addEventListener('beforeunload', handleUnload);

        return () => {
            clearInterval(interval);
            window.removeEventListener('beforeunload', handleUnload);
        };
    }, [profile, unclaimedGold]);

    const requestAdAndRefuel = async () => {
        try {
            const res = await api.requestAd();
            if (res.success && res.sessionId) {

                // Snapshot pre-ad balances
                const preGold = Number(profile.goldBalance);
                const preMax = Number(profile.maxBalance);

                // 🚀 MONETAG REAL AD INTEGRATION
                // Open real Ad Link in a new tab with telegram_id and session_id tracking
                const monetagDirectLink = 'https://omg10.com/4/10688253';
                const telegramId = profile.id || 'unknown';
                const adUrl = `${monetagDirectLink}?telegram_id=${telegramId}&request_var=${res.sessionId}`;

                window.open(adUrl, '_blank');

                // Poll server every 3 seconds to check if Monetag Webhook arrived (Max 1 minute)
                let pollAttempts = 0;
                const maxAttempts = 20; // 3 sec * 20 = 60 seconds max

                const pollInterval = setInterval(async () => {
                    pollAttempts++;
                    const updated = await api.getProfile();

                    if (updated.success) {
                        const postFuel = Number(updated.data.fuel.remainingSeconds);
                        const postGold = Number(updated.data.goldBalance);
                        const postMax = Number(updated.data.maxBalance);

                        // If fuel updated, the Ad Webhook was successful
                        if (postFuel > 0) {
                            clearInterval(pollInterval);
                            setProfile(updated.data);

                            // Calculate Box Reward dynamically from backend increments
                            const diffGold = postGold - preGold;
                            const diffMax = postMax - preMax;

                            if (diffMax > 0 || diffGold > 0) {
                                setLootboxData({
                                    type: diffMax > 0 ? 'MAX' : 'GOLD',
                                    amount: diffMax > 0 ? diffMax : diffGold,
                                    label: diffMax > 0 ? 'Token Reward' : 'Bonus Gold'
                                });
                            }

                            setVisualGold(postGold);
                            setFuelSeconds(postFuel);
                            setUnclaimedGold(0);
                            lastSyncTimeRef.current = Date.now();
                        } else if (pollAttempts >= maxAttempts) {
                            // Stop polling if user abandoned the ad or it failed
                            clearInterval(pollInterval);
                            console.log("Ad validation timed out.");
                        }
                    }
                }, 3000); // Poll every 3 seconds

                return true;
            }
        } catch (e: any) {
            console.error("Ad Request Failed:", e);
            alert(e.message || "Failed to start Ad");
            return false;
        }
    };

    const convertGold = async (amount: number) => {
        try {
            await api.convertGoldToMax(amount);
            await refreshProfile(); // Refresh balances
        } catch (e: any) {
            alert(e.message || "Conversion failed");
        }
    };

    const upgradeLevel = async () => {
        try {
            await api.upgradeMiner();
            await refreshProfile();
        } catch (e: any) {
            alert(e.message || "Upgrade failed");
        }
    };

    /**
     * DEVELOPMENT ONLY: Simulates a login for testing on localhost.
     * This bypasses the need for the official Telegram environment.
     */
    const simulateDevLogin = async () => {
        if (window.location.hostname !== 'localhost') return;

        try {
            const mockUser = { id: 28491022, username: 'dev_user', is_premium: true };
            const initDataRaw = `user=${JSON.stringify(mockUser)}&auth_date=${Math.floor(Date.now() / 1000)}&hash=dev_bypass`;
            await api.login(initDataRaw);
            await refreshProfile();
        } catch (e) {
            console.error("Mock Login Failed:", e);
        }
    };

    return {
        isInitializing,
        profile,
        visualGold,
        fuelSeconds,
        lootboxData,
        setLootboxData,
        initError,
        refreshProfile,
        requestAdAndRefuel,
        convertGold,
        upgradeLevel,
        simulateDevLogin
    };
}
