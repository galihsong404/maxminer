import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { useAccount } from 'wagmi';
import { Coins, Users, Rocket, PlayCircle, Star, ArrowRight, ShieldAlert, Loader2, ChevronDown, ChevronUp, Shield } from 'lucide-react';
import { useGameEngine } from './hooks/useGameEngine';
import { api } from './api';
import { AdminView } from './components/AdminView';

const App: React.FC = () => {
  const { isConnected } = useAccount();
  const [activeTab, setActiveTab] = useState<'MINE' | 'UPGRADE' | 'FRIENDS' | 'WALLET'>('MINE');

  // Admin View State
  const [showAdminView, setShowAdminView] = useState(false);

  // New Feature States
  const [showWelcome, setShowWelcome] = useState(true);
  const [referrals, setReferrals] = useState<any>(null);
  const [loadingReferrals, setLoadingReferrals] = useState(false);
  const [expandedLevel, setExpandedLevel] = useState<number | null>(1);

  useEffect(() => {
    const timer = setTimeout(() => setShowWelcome(false), 2000);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (activeTab === 'FRIENDS' && !referrals && !loadingReferrals) {
      setLoadingReferrals(true);
      api.getReferrals().then(res => {
        if (res.success) setReferrals(res.data);
      }).catch(console.error).finally(() => setLoadingReferrals(false));
    }
  }, [activeTab]);

  const {
    isInitializing,
    profile,
    visualGold,
    fuelSeconds,
    lootboxData,
    setLootboxData,
    refreshProfile,
    requestAdAndRefuel,
    convertGold,
    upgradeLevel,
    simulateDevLogin,
    initError,
    isAdLoading,
    isConverting,
    unclaimedGold,
    claimGold,
    isClaiming,
    registrationBonus,
    setRegistrationBonus
  } = useGameEngine();

  const [conversionResult, setConversionResult] = useState<{ success: boolean; message: string } | null>(null);

  const maxFuelSeconds = 15 * 60;
  const MAX_ADS_PER_DAY = 50;

  const goldBalance = visualGold;
  const maxBalance = profile ? Number(profile.maxBalance) : 0;
  const minerLevel = profile ? profile.minerLevel : 1;
  const adWatchCount = profile?.ads?.count || 0;

  const getAdTier = () => {
    if (adWatchCount < 10) return { name: 'BRONZE', multiplier: 1, color: 'text-white', bg: 'bg-amber-600' };
    if (adWatchCount < 25) return { name: 'SILVER', multiplier: 1.2, color: 'text-indigo-900', bg: 'bg-white' };
    if (adWatchCount < 40) return { name: 'GOLD', multiplier: 1.5, color: 'text-white', bg: 'bg-amber-500' };
    return { name: 'DIAMOND', multiplier: 2.0, color: 'text-white', bg: 'bg-sky-500' };
  };

  const adTier = getAdTier();

  const [tltInfo, setTltInfo] = useState<{ tierName: string; level: number; bonusGold: number; isPremium: boolean } | null>(null);
  const [showTltModal, setShowTltModal] = useState(false);

  // Handle Registration Bonus Notification
  useEffect(() => {
    if (registrationBonus) {
      setTltInfo({
        tierName: registrationBonus.tierName,
        level: registrationBonus.level,
        bonusGold: registrationBonus.bonusGold,
        isPremium: registrationBonus.tierName.includes('VIP')
      });
      setShowTltModal(true);
      // Clear after capturing to local state
      setRegistrationBonus(null);
    }
  }, [registrationBonus, setRegistrationBonus]);

  const levels = [
    { level: 1, cost: 0, goldPerHr: 20000, name: 'Wooden Pickaxe' },
    { level: 2, cost: 50000, goldPerHr: 32000, name: 'Iron Drill' },
    { level: 3, cost: 150000, goldPerHr: 48000, name: 'Steel Drill' },
    { level: 4, cost: 400000, goldPerHr: 72000, name: 'Steam Engine' },
    { level: 5, cost: 1000000, goldPerHr: 100000, name: 'Excavator' },
    { level: 6, cost: 2500000, goldPerHr: 140000, name: 'Laser Drill' },
    { level: 7, cost: 6000000, goldPerHr: 200000, name: 'Plasma Drill' },
    { level: 8, cost: 15000000, goldPerHr: 300000, name: 'Quantum Miner' },
    { level: 9, cost: 40000000, goldPerHr: 440000, name: 'Antimatter Rig' },
    { level: 10, cost: 100000000, goldPerHr: 640000, name: 'Singularity Core' },
  ];

  const currentLevelInfo = levels[minerLevel - 1] || levels[9];

  const refuel = async () => {
    if (fuelSeconds > 0) return;
    if (adWatchCount >= MAX_ADS_PER_DAY) return;
    await requestAdAndRefuel();
  };

  const convertGoldToMax = async () => {
    if (goldBalance >= selectedExchangeAmount) {
      const result = await convertGold(selectedExchangeAmount);
      if (result) {
        setConversionResult({
          success: result.success,
          message: result.success ? `Successfully converted ${selectedExchangeAmount.toLocaleString()} Gold to ${(selectedExchangeAmount / 1250).toFixed(1)} $MAX!` : (result.error || "Conversion failed")
        });
        // Auto-hide result after 4 seconds
        setTimeout(() => setConversionResult(null), 4000);
      }
    }
  };

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}m ${s}s`;
  };

  const [copyFeedback, setCopyFeedback] = useState(false);
  const copyInviteLink = () => {
    if (!profile) return;
    const botUrl = "https://t.me/maxxx_miner_bot";
    const inviteLink = `${botUrl}?start=${profile.id}`;
    navigator.clipboard.writeText(inviteLink);
    setCopyFeedback(true);
    setTimeout(() => setCopyFeedback(false), 2000);
  };

  const handleWithdrawal = async (amount: number, address: string) => {
    try {
      await api.requestWithdrawal(amount, address);
      alert("Withdrawal submitted successfully! Pending review.");
      await refreshProfile();
    } catch (e: any) {
      alert(e.message || "Withdrawal failed");
    }
  };

  if (!isInitializing && !profile) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-8 text-center relative overflow-hidden">
        {/* Background Image with 100% Visibility */}
        <div className="absolute inset-0 z-0">
          <img src="/mine_bg.png" alt="Background" className="w-full h-full object-cover" />
          <div className="absolute inset-0 bg-slate-950/30 backdrop-blur-[1px]" />
        </div>

        <div className="relative z-10 flex flex-col items-center bg-slate-950/60 backdrop-blur-xl p-8 rounded-[40px] border border-white/10 shadow-2xl">
          <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} className="w-24 h-24 bg-red-500/20 rounded-full flex items-center justify-center mb-6 border border-red-500/30">
            <ShieldAlert className="text-red-500 w-12 h-12" />
          </motion.div>
          <h1 className="text-3xl font-black text-white mb-2 uppercase tracking-tighter italic drop-shadow-md">Access Restricted</h1>
          <p className="text-slate-200 mb-8 max-w-xs leading-relaxed text-sm drop-shadow-sm">
            {initError ? `ERROR: ${initError}` : "This mining facility is only accessible via the official **@maxxx_miner_bot** on Telegram for security and authentication."}
          </p>
          <div className="flex flex-col gap-3 w-full max-w-xs">
            <a href="https://t.me/maxxx_miner_bot" className="w-full py-4 bg-gradient-to-r from-indigo-500 to-blue-600 text-white font-black rounded-2xl shadow-xl shadow-blue-500/30 hover:scale-105 active:scale-95 transition-all uppercase tracking-widest text-xs flex items-center justify-center gap-2">
              OPEN TELEGRAM BOT
            </a>

            {window.location.hostname === 'localhost' && (
              <button
                onClick={simulateDevLogin}
                className="w-full py-3 bg-slate-100 text-slate-900 font-bold rounded-2xl border border-white/20 hover:bg-white transition-all uppercase tracking-widest text-[10px]"
              >
                DEBUG: SIMULATE LOGIN
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  if (isInitializing) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center text-white p-6 relative overflow-hidden">
        <div className="absolute inset-0 z-0">
          <img src="/mine_bg.png" alt="Background" className="w-full h-full object-cover" />
          <div className="absolute inset-0 bg-slate-950/20" />
        </div>

        <div className="relative z-10 w-full flex-1 flex flex-col items-center justify-center">
          <motion.div
            animate={{
              scale: [1, 1.08, 1],
              opacity: [0.9, 1, 0.9]
            }}
            transition={{
              repeat: Infinity,
              duration: 3,
              ease: "easeInOut"
            }}
            className="mb-12 w-full max-w-[280px]"
          >
            <img src="/logo.png" alt="Max Miner Logo" className="w-full h-auto object-contain drop-shadow-[0_0_30px_rgba(255,255,255,0.2)]" />
          </motion.div>

          <div className="absolute bottom-12 flex flex-col items-center gap-4">
            <div className="flex items-center gap-3 text-indigo-400 font-black tracking-[0.3em] uppercase text-[10px]">
              <Loader2 className="animate-spin w-4 h-4" />
              Initializing Base Operations
            </div>
            <div className="h-1 w-32 bg-white/5 rounded-full overflow-hidden border border-white/10">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: "100%" }}
                transition={{ duration: 3 }}
                className="h-full bg-gradient-to-r from-indigo-500 to-blue-500"
              />
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Welcome / Splash Screen (VIP Overhaul)
  if (showWelcome && profile) {
    return (
      <motion.div
        key="welcome"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-slate-950/90 backdrop-blur-2xl"
      >
        <motion.img
          initial={{ scale: 0.5, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: 'spring', damping: 10, mass: 0.75, stiffness: 100 }}
          src="/logo.png"
          alt="Max Miner"
          className="w-48 h-auto drop-shadow-[0_0_50px_rgba(255,255,255,0.3)] mb-8"
        />
        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="text-white text-3xl font-black italic uppercase tracking-tighter drop-shadow-lg"
        >
          Welcome, <span className="text-indigo-400">Miner</span>
        </motion.div>
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: "150px" }}
          transition={{ delay: 1, duration: 1 }}
          className="h-1 bg-gradient-to-r from-indigo-500 to-blue-500 mt-6 rounded-full"
        />
      </motion.div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white font-sans selection:bg-amber-500/30">

      <div className="fixed inset-0 z-0">
        <img
          src="/mine_bg.png"
          alt="Mine Background"
          className="w-full h-full object-cover"
        />
      </div>

      <div className="relative z-10 max-w-md mx-auto h-screen flex flex-col pt-3 px-3 overflow-hidden">
        <header className="flex justify-between items-center mb-4">
          <div className="flex items-center ml-2">
            <img src="/logo.png" alt="Max Miner Logo" className="h-[68px] object-contain drop-shadow-xl" />
          </div>
          <div className="flex items-center gap-2">
            {profile?.role && (profile.role === 'ADMIN' || profile.role === 'SUPER_ADMIN') && (
              <button
                onClick={() => setShowAdminView(true)}
                className="bg-indigo-600/90 hover:bg-indigo-500 backdrop-blur-md px-3 py-1.5 rounded-full border border-indigo-400 p-2 shadow-lg flex items-center gap-1 transition-colors"
              >
                <Shield size={14} className="text-white" />
                <span className="text-[10px] font-black text-white uppercase ml-1">Admin</span>
              </button>
            )}
            <div className="bg-white/90 backdrop-blur-md px-3 py-1.5 rounded-full border border-white/20 flex items-center gap-2 shadow-lg">
              <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <div className="flex flex-col">
                <span className="text-[10px] font-black text-slate-900 uppercase leading-tight">Online</span>
                <span className="text-[8px] text-slate-500 font-mono leading-tight">{profile?.id} | {profile?.role}</span>
              </div>
            </div>
          </div>
        </header>

        {activeTab === 'MINE' && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex-1 flex flex-col h-full overflow-hidden pb-20">

            {/* Top Info Cards - Compact */}
            <div className="grid grid-cols-2 gap-2 mb-1">
              <div className="bg-white p-2 rounded-2xl flex flex-col items-center shadow-lg relative overflow-hidden group">
                <div className="absolute inset-0 bg-amber-500/10 opacity-0 group-hover:opacity-100 transition-opacity" />
                <span className="text-[8px] text-amber-600 font-black uppercase tracking-widest mb-0.5 z-10">Gold Vault</span>
                <span className="text-lg font-black text-slate-900 leading-none z-10">{Math.floor(goldBalance).toLocaleString()}</span>
              </div>
              <div className="bg-white p-2 rounded-2xl flex flex-col items-center shadow-lg relative overflow-hidden group">
                <div className="absolute inset-0 bg-indigo-500/10 opacity-0 group-hover:opacity-100 transition-opacity" />
                <span className="text-[8px] text-indigo-600 font-black uppercase tracking-widest mb-0.5 z-10">Max Tokens</span>
                <span className="text-lg font-black text-slate-900 leading-none z-10">{maxBalance.toFixed(1)}</span>
              </div>
            </div>

            {/* Unclaimed Gold & Claim Button */}
            <div className="mt-2 mb-2 w-full bg-slate-900/60 backdrop-blur-md rounded-[20px] p-3 flex items-center justify-between border border-white/10 shadow-xl">
              <div className="flex flex-col">
                <span className="text-[9px] text-amber-400 font-black uppercase tracking-widest">Mining Yield</span>
                <span className="text-xl font-black text-white italic tracking-tighter">
                  +{Math.floor(unclaimedGold).toLocaleString()}
                </span>
              </div>
              <button
                onClick={claimGold}
                disabled={isClaiming || unclaimedGold <= 0}
                className={`px-5 py-2.5 rounded-[14px] font-black uppercase text-[10px] tracking-widest shadow-lg transition-all active:scale-95 ${unclaimedGold > 0 && !isClaiming
                  ? 'bg-amber-500 text-slate-900 hover:bg-amber-400 shadow-amber-500/20'
                  : 'bg-white/5 text-white/30 cursor-not-allowed border border-white/5'
                  }`}
              >
                {isClaiming ? 'Claiming...' : 'Claim Gold'}
              </button>
            </div>

            {/* Central Area - Level Info + Logo */}
            <div className="flex-1 flex flex-col items-center justify-center">
              {/* Level Info Box - Royal Blue Solid */}
              <div className="bg-blue-600 px-4 py-1.5 rounded-2xl inline-flex flex-col items-center shadow-lg mb-6 -mt-8 border border-white/20">
                <div className="inline-block bg-gradient-to-r from-amber-400 to-amber-500 px-2.5 py-0.5 rounded-full text-[8px] font-black text-slate-950 uppercase tracking-widest">
                  Level {currentLevelInfo.level}
                </div>
                <div className="text-base text-white font-black tracking-tighter italic leading-tight my-0.5">
                  +{(currentLevelInfo.goldPerHr * adTier.multiplier).toLocaleString()} <span className="text-blue-200 text-[9px]">/ Hr</span>
                </div>
                <div className={`px-2 py-[2px] rounded font-black ${adTier.bg} ${adTier.color} uppercase text-[7px] tracking-widest border border-white/10`}>
                  {adTier.name} x{adTier.multiplier.toFixed(1)}
                </div>
              </div>

              {/* Pickaxe Logo */}
              {isConnected && fuelSeconds > 0 ? (
                <motion.img
                  src="/pickaxe.png"
                  alt="Axe"
                  animate={{ rotate: [0, -10, 6, -3, 0], scale: [1, 1.03, 1] }}
                  transition={{ duration: 0.8, repeat: Infinity, repeatType: "reverse" }}
                  className="w-48 h-48 object-contain"
                />
              ) : (
                <img src="/pickaxe.png" alt="Axe" className="w-48 h-48 object-contain" />
              )}
            </div>

            {/* Bottom Controls - Flush with Nav */}
            <div className="mt-auto mb-6 space-y-1 relative z-30">
              <div className="bg-white p-2 rounded-xl shadow-lg border-2 border-indigo-100">
                <div className="flex justify-between items-end mb-1">
                  <div>
                    <div className="text-[8px] text-indigo-400 font-black uppercase tracking-widest mb-0.5">Fuel Reserve</div>
                    <div className="text-lg font-black text-indigo-900 italic tracking-tighter leading-none">{formatTime(fuelSeconds)}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-[8px] text-indigo-400 font-black uppercase tracking-widest mb-0.5">Efficiency</div>
                    <div className="text-emerald-500 font-black text-sm leading-none">100% ACTIVE</div>
                  </div>
                </div>
                <div className="h-2.5 bg-indigo-50 rounded-full overflow-hidden border border-indigo-100 p-0.5 shadow-inner">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${(fuelSeconds / maxFuelSeconds) * 100}%` }}
                    className={`h-full rounded-full transition-all duration-1000 ${fuelSeconds < 60 ? 'bg-gradient-to-r from-red-600 to-rose-700' : 'bg-indigo-600'
                      }`}
                  />
                </div>
              </div>

              <motion.button
                onClick={refuel}
                disabled={fuelSeconds > 0 || adWatchCount >= MAX_ADS_PER_DAY || isAdLoading}
                animate={fuelSeconds === 0 && adWatchCount < MAX_ADS_PER_DAY && !isAdLoading ? { scale: [1, 1.05, 1], boxShadow: ["0px 0px 0px rgba(79,70,229,0)", "0px 0px 30px rgba(79,70,229,0.5)", "0px 0px 0px rgba(79,70,229,0)"] } : {}}
                transition={{ duration: 1.5, repeat: Infinity }}
                className={`w-full group p-4 rounded-[24px] font-black flex items-center justify-center gap-3 transition-all active:scale-[0.98] border-[3px] shadow-2xl relative overflow-hidden
                  ${fuelSeconds === 0 && adWatchCount < MAX_ADS_PER_DAY && !isAdLoading
                    ? 'bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 text-white border-white/20'
                    : 'bg-slate-900/80 backdrop-blur-md text-slate-500 border-white/5 cursor-not-allowed'
                  }`}
              >
                {/* Glossy Overlay */}
                <div className="absolute inset-0 bg-gradient-to-b from-white/20 to-transparent opacity-50 pointer-events-none" />

                {isAdLoading ? (
                  <Loader2 size={32} className="animate-spin text-white shadow-lg rounded-full" />
                ) : (
                  <PlayCircle size={32} className={fuelSeconds === 0 && adWatchCount < MAX_ADS_PER_DAY ? "animate-pulse shadow-lg rounded-full" : ""} />
                )}

                <div className="text-left relative z-10">
                  <div className="text-[10px] opacity-90 uppercase tracking-[0.2em] font-black text-indigo-200">
                    {adWatchCount >= MAX_ADS_PER_DAY ? 'Limit Reached' : fuelSeconds > 0 ? 'Rig Online' : isAdLoading ? 'Awaiting Ad...' : 'Action Required'}
                  </div>
                  <div className="text-2xl leading-tight uppercase font-black tracking-tight drop-shadow-md">
                    {adWatchCount >= MAX_ADS_PER_DAY ? 'Daily Max' : fuelSeconds > 0 ? formatTime(fuelSeconds) : isAdLoading ? 'LOAD AD...' : 'START MINING'}
                  </div>
                </div>
              </motion.button>
            </div>
          </motion.div>
        )}

        {activeTab === 'UPGRADE' && (
          <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="flex-1 flex flex-col min-h-0">
            <h2 className="text-3xl font-black mb-6 italic uppercase tracking-tighter text-white drop-shadow-[0_4px_10px_rgba(0,0,0,1)]">Gear<span className="text-indigo-400"> Shop</span></h2>
            <div className="space-y-4 flex-1 overflow-y-auto pr-2 pb-32 no-scrollbar">
              {levels.slice(1).map((lvl) => (
                <div key={lvl.level} className={`p-5 rounded-[32px] border-2 transition-all 
                  ${minerLevel >= lvl.level ? 'bg-indigo-950 border-indigo-600 shadow-[inset_0_2px_10px_rgba(0,0,0,0.5)]' : 'bg-white border-white shadow-2xl'}
                `}>
                  <div className="flex justify-between items-center">
                    <div>
                      <div className="flex items-center gap-3">
                        <span className={`text-xl font-black tracking-tighter ${minerLevel >= lvl.level ? 'text-white' : 'text-slate-900'}`}>{lvl.name}</span>
                        <span className={`text-[10px] px-2.5 py-1 rounded-full font-black uppercase tracking-widest ${minerLevel >= lvl.level ? 'bg-indigo-600 text-white' : 'bg-indigo-50 text-indigo-600'}`}>Lv {lvl.level}</span>
                      </div>
                      <div className={`text-sm font-black mt-1 ${minerLevel >= lvl.level ? 'text-indigo-200' : 'text-indigo-600 tracking-tight'}`}>+{lvl.goldPerHr.toLocaleString()} / Hr Output</div>
                    </div>
                    {minerLevel < lvl.level && (
                      <button
                        disabled={minerLevel !== lvl.level - 1 || goldBalance < lvl.cost}
                        onClick={upgradeLevel}
                        className={`px-6 py-3.5 rounded-2xl text-xs font-black transition-all shadow-xl ${minerLevel === lvl.level - 1 && goldBalance >= lvl.cost ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-300'
                          }`}
                      >
                        {lvl.cost.toLocaleString()} G
                      </button>
                    )}
                    {minerLevel >= lvl.level && <span className="text-emerald-400 font-black uppercase text-[10px] bg-emerald-400/20 px-4 py-1.5 rounded-full border-2 border-emerald-400/30 shadow-sm">OWNED</span>}
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        )}

        {activeTab === 'FRIENDS' && (
          <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="flex-1 overflow-y-auto pb-32 no-scrollbar min-h-0">
            <div className="mb-4">
              <h2 className="text-3xl font-black italic uppercase tracking-tighter text-white drop-shadow-lg bg-black/40 backdrop-blur-sm px-4 py-1 rounded-2xl inline-block">
                Referral<span className="text-indigo-400"> Power</span>
              </h2>
            </div>
            <div className="bg-gradient-to-br from-blue-700 to-indigo-900 p-8 rounded-[40px] shadow-2xl mb-6 relative overflow-hidden border border-white/20">
              <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 blur-3xl rounded-full" />
              <h3 className="text-xl font-black mb-2 drop-shadow-md uppercase italic tracking-tight">Recruit Miners, Earn $MAX</h3>
              <p className="text-sm text-blue-100 mb-6 opacity-90 leading-relaxed font-bold drop-shadow-sm">
                Earn fixed $MAX tokens every time an ad is watched in your network. 5.0 MAX from direct refs, down to 0.5 MAX at Level 5.
              </p>
              <button onClick={copyInviteLink} className={`w-full py-4 font-black rounded-2xl transition-all active:scale-[0.98] uppercase tracking-widest text-xs shadow-xl ${copyFeedback ? 'bg-emerald-500 text-white' : 'bg-white text-indigo-950 hover:bg-blue-50'}`}>
                {copyFeedback ? 'LINK READY! Γ£à' : 'INVITE PARTNERS'}
              </button>
            </div>
            <div className="bg-slate-900/50 backdrop-blur-md rounded-[32px] border border-white/10 overflow-hidden mb-6 shadow-2xl p-4 min-h-[150px] relative">
              {loadingReferrals ? (
                <div className="absolute inset-0 flex items-center justify-center">
                  <Loader2 className="w-8 h-8 text-indigo-500 animate-spin" />
                </div>
              ) : (
                <div className="space-y-3">
                  {[
                    { level: 1, title: 'Level 1 (Direct)', yield: '+5.0 MAX/AD', key: 'level1', totalKey: 'totalLevel1' },
                    { level: 2, title: 'Level 2 (Indirect)', yield: '+2.5 MAX/AD', key: 'level2', totalKey: 'totalLevel2' },
                    { level: 3, title: 'Level 3 (Network)', yield: '+1.0 MAX/AD', key: 'level3', totalKey: 'totalLevel3' },
                    { level: 4, title: 'Level 4 (Network)', yield: '+0.5 MAX/AD', key: 'level4', totalKey: 'totalLevel4' },
                    { level: 5, title: 'Level 5 (Network)', yield: '+0.5 MAX/AD', key: 'level5', totalKey: 'totalLevel5' }
                  ].map((tier) => {
                    const isExpanded = expandedLevel === tier.level;
                    const tierData = referrals?.[tier.key] || [];
                    const tierTotal = referrals?.stats?.[tier.totalKey] || 0;

                    return (
                      <div key={tier.level} className="bg-slate-950/80 rounded-2xl border border-white/5 overflow-hidden transition-all duration-300 shadow-lg">
                        <button
                          onClick={() => setExpandedLevel(isExpanded ? null : tier.level)}
                          className={`w-full p-4 flex items-center justify-between transition-colors ${isExpanded ? 'bg-indigo-600/10' : 'hover:bg-white/5'}`}
                        >
                          <div className="flex items-center gap-3">
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center font-black text-white text-xs shadow-inner ${isExpanded ? 'bg-indigo-500' : 'bg-slate-800 border border-white/10'}`}>
                              L{tier.level}
                            </div>
                            <div className="text-left">
                              <div className="text-white font-black text-sm tracking-tight uppercase">{tier.title}</div>
                              <div className="text-[10px] text-slate-400 font-bold mt-0.5">{tierTotal} Miners Active</div>
                            </div>
                          </div>
                          <div className="flex items-center gap-4">
                            <div className="text-emerald-400 font-black text-[10px] bg-emerald-400/10 px-3 py-1.5 rounded-full border border-emerald-400/20 shadow-sm leading-none shrink-0">
                              {tier.yield} YIELD
                            </div>
                            {isExpanded ? <ChevronUp className="w-5 h-5 text-slate-500 shrink-0" /> : <ChevronDown className="w-5 h-5 text-slate-500 shrink-0" />}
                          </div>
                        </button>

                        <AnimatePresence>
                          {isExpanded && (
                            <motion.div
                              initial={{ height: 0, opacity: 0 }}
                              animate={{ height: 'auto', opacity: 1 }}
                              exit={{ height: 0, opacity: 0 }}
                              transition={{ duration: 0.2 }}
                              className="overflow-hidden bg-black/20"
                            >
                              <div className="p-4 max-h-[250px] overflow-y-auto space-y-2 border-t border-white/5">
                                {tierData.length > 0 ? (
                                  tierData.map((ref: any, idx: number) => (
                                    <div key={idx} className="flex items-center justify-between p-3 bg-slate-900/60 rounded-xl border border-white/5">
                                      <div className="flex items-center gap-3">
                                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center font-black text-white uppercase text-xs">
                                          {ref.username.replace('@', '').charAt(0)}
                                        </div>
                                        <div>
                                          <div className="text-slate-200 font-bold text-sm tracking-tight">{ref.username}</div>
                                          <div className="text-[9px] text-indigo-400 font-black tracking-widest uppercase mt-0.5">Lv. {ref.minerLevel} Miner</div>
                                        </div>
                                      </div>
                                      <div className="text-[9px] text-slate-500 uppercase font-black">
                                        {new Date(ref.joinedAt).toLocaleDateString()}
                                      </div>
                                    </div>
                                  ))
                                ) : (
                                  <div className="text-center py-6 text-slate-500 text-xs font-bold italic">
                                    No recruits at this level yet.
                                  </div>
                                )}
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
            <div className="p-5 bg-slate-900/80 backdrop-blur-md rounded-2xl border border-white/5 text-[10px] text-slate-300/80 italic text-center leading-relaxed">
              * Passive income is calculated per individual ad impression within your hierarchy. Multi-level networking exponentially increases your yield.
            </div>
          </motion.div>
        )}

        {activeTab === 'WALLET' && (
          <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="flex-1 flex flex-col">
            <h2 className="text-3xl font-black mb-6 italic uppercase tracking-tighter text-white drop-shadow-lg">Bank<span className="text-indigo-400"> vault</span></h2>
            <div className="bg-blue-950/70 backdrop-blur-xl border border-white/20 p-8 rounded-[40px] mb-6 relative overflow-hidden shadow-2xl">
              <h3 className="text-xs font-bold text-indigo-300 uppercase tracking-widest mb-6 drop-shadow-sm text-center">Currency Exchange</h3>
              {/* Amount Selector */}
              <div className="flex gap-2 mb-6">
                <button
                  onClick={() => setSelectedExchangeAmount(50000)}
                  className={`flex-1 py-3 rounded-2xl font-black text-[10px] uppercase transition-all border ${selectedExchangeAmount === 50000 ? 'bg-indigo-500/20 border-indigo-500 text-indigo-400' : 'bg-slate-900/50 border-white/5 text-slate-500'}`}
                >
                  50K GOLD
                </button>
                <button
                  onClick={() => setSelectedExchangeAmount(500000)}
                  className={`flex-1 py-3 rounded-2xl font-black text-[10px] uppercase transition-all border ${selectedExchangeAmount === 500000 ? 'bg-sky-500/20 border-sky-500 text-sky-400' : 'bg-slate-900/50 border-white/5 text-slate-500'}`}
                >
                  500K GOLD
                </button>
              </div>

              <div className="flex items-center justify-between bg-black/40 p-5 rounded-[30px] mb-6 border border-white/5">
                <div className="text-center flex-1">
                  <div className="text-[10px] text-indigo-400 font-black uppercase mb-1">PAY GOLD</div>
                  <div className="text-2xl font-black text-white">{selectedExchangeAmount.toLocaleString()}</div>
                </div>
                <div className="px-4"><ArrowRight className="text-indigo-500" size={24} /></div>
                <div className="text-center flex-1">
                  <div className="text-[10px] text-sky-400 font-black uppercase mb-1">GET $MAX</div>
                  <div className="text-2xl font-black text-white">{(selectedExchangeAmount / 1250).toFixed(1)}</div>
                </div>
              </div>
              <button
                onClick={convertGoldToMax}
                disabled={goldBalance < selectedExchangeAmount || isConverting}
                className={`w-full py-4 rounded-2xl font-black transition-all shadow-xl uppercase tracking-widest text-xs flex items-center justify-center gap-2
                  ${goldBalance >= selectedExchangeAmount && !isConverting ? 'bg-indigo-500 text-white hover:bg-indigo-400' : 'bg-slate-900/50 text-slate-500 cursor-not-allowed border border-white/5'}`}
              >
                {isConverting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    PROCESSING...
                  </>
                ) : (
                  'SWAP CURRENCY'
                )}
              </button>

              <AnimatePresence>
                {conversionResult && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className={`mt-4 p-3 rounded-xl text-center text-[10px] font-black uppercase tracking-widest border
                      ${conversionResult.success ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-red-500/10 text-red-400 border-red-500/20'}`}
                  >
                    {conversionResult.message}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
            <div className="bg-gradient-to-br from-slate-900/90 to-blue-950/90 backdrop-blur-2xl border border-white/10 p-8 rounded-[40px] mb-8 text-center shadow-2xl">
              <p className="text-indigo-200/60 text-[10px] uppercase font-black tracking-widest mb-2">Available Tokens</p>
              <div className="text-6xl font-black mb-8 text-white drop-shadow-2xl">{maxBalance.toFixed(1)} <span className="text-indigo-400 text-xl font-bold italic lowercase">$max</span></div>
              {!isConnected ? (
                <ConnectButton.Custom>
                  {({ openConnectModal }) => (
                    <button onClick={openConnectModal} className="w-full py-5 bg-gradient-to-r from-blue-600 to-indigo-700 text-white font-black rounded-2xl shadow-xl shadow-blue-950/40 uppercase tracking-widest text-xs hover:scale-[1.02] active:scale-95 transition-all">LINK EXTERNAL WALLET</button>
                  )}
                </ConnectButton.Custom>
              ) : (
                <button disabled={maxBalance < 1000} onClick={() => { const address = prompt("Enter BSC Wallet Address:"); if (address && maxBalance >= 1000) handleWithdrawal(1000, address); }} className={`w-full py-5 rounded-2xl font-black transition-all shadow-xl uppercase tracking-widest text-xs ${maxBalance >= 1000 ? 'bg-white text-indigo-950 hover:bg-blue-50' : 'bg-slate-900/50 text-slate-500 border border-white/5'}`}>INITIATE WITHDRAWAL (1.0K+)</button>
              )}
            </div>
          </motion.div>
        )}

        <nav className="fixed bottom-0 left-0 right-0 bg-slate-900 border-t border-indigo-500/20 h-24 px-6 flex justify-between items-center z-50 max-w-md mx-auto rounded-t-[32px] shadow-[0_-10px_40px_rgba(0,0,0,0.4)]">
          {[
            { id: 'MINE', icon: Star, label: 'Mine', color: 'text-amber-400', bg: 'bg-amber-400/10' },
            { id: 'UPGRADE', icon: Rocket, label: 'Boost', color: 'text-indigo-400', bg: 'bg-indigo-400/10' },
            { id: 'FRIENDS', icon: Users, label: 'Ref', color: 'text-emerald-400', bg: 'bg-emerald-400/10' },
            { id: 'WALLET', icon: Coins, label: 'Vault', color: 'text-sky-400', bg: 'bg-sky-400/10' }
          ].map(tab => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className="relative flex flex-col items-center justify-center flex-1 h-full transition-all duration-300"
              >
                {isActive && (
                  <motion.div
                    layoutId="nav-bg"
                    className={`absolute inset-x-2 inset-y-4 rounded-2xl ${tab.bg} border border-white/5 -z-10`}
                    transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                  />
                )}
                <div className={`transition-all duration-300 ${isActive ? `${tab.color} scale-110 drop-shadow-[0_0_10px_rgba(255,255,255,0.2)]` : 'text-slate-500'}`}>
                  <tab.icon size={26} fill={isActive ? "currentColor" : "none"} />
                </div>
                <span className={`text-[9px] font-black uppercase tracking-widest mt-1 transition-colors duration-300 ${isActive ? tab.color : 'text-slate-500'}`}>
                  {tab.label}
                </span>
              </button>
            );
          })}
        </nav>
      </div>

      <AnimatePresence>
        {showAdminView && profile && (
          <AdminView
            onClose={() => setShowAdminView(false)}
            userRole={profile.role}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {!!lootboxData && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-slate-950/90 backdrop-blur-md">
            <motion.div initial={{ scale: 0.8 }} animate={{ scale: 1 }} className="bg-slate-900 border border-slate-800 p-8 rounded-[40px] w-full max-w-sm flex flex-col items-center relative overflow-hidden shadow-2xl">
              {/* Modal Background */}
              <div className="absolute inset-0 z-0 opacity-20">
                <img src="/mine_bg.png" alt="BG" className="w-full h-full object-cover" />
              </div>

              <div className="relative z-10 flex flex-col items-center">
                <h2 className="text-2xl font-black mb-1 text-white uppercase italic text-center">{lootboxData.label}</h2>
                <div className="my-10 drop-shadow-[0_0_35px_rgba(251,191,36,0.4)] bg-white/5 p-8 rounded-full border border-white/10">
                  {lootboxData.type === 'GOLD' ? (
                    <Coins className="w-24 h-24 text-amber-500" />
                  ) : (
                    <Star className="w-24 h-24 text-indigo-400" />
                  )}
                </div>
                <div className="text-4xl font-black text-white mb-8">+{lootboxData.amount.toLocaleString()}</div>
                <button onClick={() => setLootboxData(null)} className="w-full py-4 bg-white text-slate-950 font-black rounded-2xl shadow-lg hover:bg-slate-100 transition-colors">COLLECT</button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showTltModal && tltInfo && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
            <motion.div initial={{ scale: 0.9 }} animate={{ scale: 1 }} className="bg-slate-900 border border-slate-700 rounded-3xl p-6 w-full max-w-sm flex flex-col items-center relative overflow-hidden shadow-2xl">
              {/* Modal Background */}
              <div className="absolute inset-0 z-0 opacity-30">
                <img src="/mine_bg.png" alt="BG" className="w-full h-full object-cover" />
              </div>

              <div className="relative z-10 w-full flex flex-col items-center">
                <h1 className="text-xl font-black text-amber-500 uppercase mb-6 italic">Loyalty Bonus</h1>
                <div className="w-full bg-slate-800/90 backdrop-blur-sm p-4 rounded-xl mb-6 flex flex-col gap-2 border border-slate-700/50">
                  <div className="flex justify-between text-xs text-slate-300"><span>Account Tier:</span><span className="font-bold text-sky-400 capitalize">{tltInfo.tierName}</span></div>
                  <div className="flex justify-between text-xs text-slate-300"><span>Miner Reward:</span><span className="text-amber-500 font-black">Level {tltInfo.level}</span></div>
                  <div className="flex justify-between text-xs text-slate-300"><span>Gold Reward:</span><span className="text-amber-500 font-black">+{tltInfo.bonusGold.toLocaleString()}</span></div>
                </div>
                <button onClick={() => setShowTltModal(false)} className="w-full py-4 bg-amber-500 text-slate-950 font-black rounded-xl uppercase tracking-widest shadow-lg shadow-amber-500/20 hover:bg-amber-400 transition-all active:scale-95">START MINING</button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default App;
