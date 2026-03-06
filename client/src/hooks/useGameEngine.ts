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
    const [isAdLoading, setIsAdLoading] = useState(false); // [PHASE 9 FIX] Track SDK loading
    const [isConverting, setIsConverting] = useState(false); // [PHASE 10 FIX] Track conversion process

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

            // [PHASE 12 FIX] Resume pending ad claim after page reload
            // When Monetag SDK opens an ad in a new tab, the React app reloads on return.
            // The sessionId is saved in localStorage BEFORE the ad opens.
            const pendingSession = localStorage.getItem('pending_ad_session');
            if (pendingSession) {
                console.log("Resuming pending ad session:", pendingSession);
                localStorage.removeItem('pending_ad_session');
                try {
                    await api.claimAdSDK(pendingSession);
                    console.log("Pending ad session claimed successfully");
                } catch (e: any) {
                    console.warn("Pending ad claim failed (may already be claimed):", e.message);
                }
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
        if (isAdLoading) return false;
        setIsAdLoading(true);
        try {
            const res = await api.requestAd();
            if (res.success && res.sessionId) {
                const currentSessionId = res.sessionId;

                // [PHASE 12 FIX] Save sessionId to localStorage BEFORE opening ad
                // This survives page reloads when Monetag opens a new browser tab
                localStorage.setItem('pending_ad_session', currentSessionId);

                // Snapshot pre-ad balances
                const preGold = Number(profile.goldBalance);
                const preMax = Number(profile.maxBalance);

                // 🚀 MONETAG IN-APP VIDEO INTEGRATION
                const telegramId = profile.id || 'unknown';

                let adWatched = false;

                if (typeof (window as any).show_10685393 === 'function') {
                    try {
                        await (window as any).show_10685393({
                            custom: currentSessionId,
                            uid: telegramId
                        });
                        adWatched = true;
                        console.log("Monetag SDK: Ad completed");
                    } catch (error: any) {
                        console.error("Monetag SDK Error:", error);
                    }
                } else {
                    console.warn("Monetag SDK not loaded, claiming session directly for testing");
                    adWatched = true;
                }

                if (adWatched) {
                    // Call server directly to claim the reward
                    try {
                        await api.claimAdSDK(currentSessionId);
                        // Clear pending — successfully claimed in same session
                        localStorage.removeItem('pending_ad_session');

                        // Refresh profile to get updated fuel & balances
                        const updated = await api.getProfile();
                        if (updated.success) {
                            setProfile(updated.data);

                            const postGold = Number(updated.data.goldBalance);
                            const postMax = Number(updated.data.maxBalance);
                            const postFuel = Number(updated.data.fuel.remainingSeconds);

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
                        }
                    } catch (claimError: any) {
                        console.error("Claim SDK Error:", claimError);
                        // Don't clear localStorage — init() will retry on next reload
                    }
                }

                setIsAdLoading(false);
                return adWatched;
            } else {
                setIsAdLoading(false);
                return false;
            }
        } catch (e: any) {
            console.error("Ad Request Failed:", e);
            alert(e.message || "Failed to start Ad");
            setIsAdLoading(false);
            return false;
        }
    };

    const convertGold = async (amount: number) => {
        if (isConverting) return;
        setIsConverting(true);
        try {
            await api.convertGoldToMax(amount);
            await refreshProfile(); // Refresh balances
            return { success: true };
        } catch (e: any) {
            console.error("Conversion Error:", e);
            return { success: false, error: e.message || "Conversion failed" };
        } finally {
            setIsConverting(false);
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
        simulateDevLogin,
        isAdLoading,
        isConverting
    };
}
