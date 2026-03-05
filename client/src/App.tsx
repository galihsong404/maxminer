import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { useAccount } from 'wagmi';
import { Coins, Users, Rocket, PlayCircle, Star, ArrowRight, ShieldAlert, Loader2 } from 'lucide-react';
import { useGameEngine } from './hooks/useGameEngine';
import { api } from './api';

const App: React.FC = () => {
  const { isConnected } = useAccount();
  const [activeTab, setActiveTab] = useState<'MINE' | 'UPGRADE' | 'FRIENDS' | 'WALLET'>('MINE');

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
    simulateDevLogin
  } = useGameEngine();

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

  const [tltInfo, setTltInfo] = useState<{ id: string; prefix: string; isPremium: boolean; finalLevel: number; reason: string } | null>(null);
  const [showTltModal, setShowTltModal] = useState(false);

  useEffect(() => {
    if (profile && profile.minerLevel > 1 && !localStorage.getItem('tlt_shown')) {
      const idStr = String(profile.id);
      const prefix = idStr.length >= 10 ? idStr[0] : '-';
      setTltInfo({
        id: idStr,
        prefix,
        isPremium: false,
        finalLevel: profile.minerLevel,
        reason: "Veteran Telegram Account Bonus"
      });
      setShowTltModal(true);
      localStorage.setItem('tlt_shown', 'true');
    }
  }, [profile]);

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
    if (goldBalance >= 5000) {
      await convertGold(5000);
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
            This mining facility is only accessible via the official **@maxxx_miner_bot** on Telegram for security and authentication.
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

        <div className="relative z-10 flex flex-col items-center bg-slate-950/40 backdrop-blur-md px-10 py-12 rounded-[50px] border border-white/5">
          <motion.div animate={{ scale: [1, 1.05, 1], opacity: [0.8, 1, 0.8] }} transition={{ repeat: Infinity, duration: 2 }} className="mb-8">
            <img src="/logo.png" alt="Logo" className="h-24 object-contain drop-shadow-[0_0_15px_rgba(255,255,255,0.3)]" />
          </motion.div>
          <div className="flex items-center gap-2 text-indigo-400 font-black tracking-widest uppercase text-xs">
            <Loader2 className="animate-spin w-4 h-4" />
            Loading Mining Operations...
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white font-sans selection:bg-amber-500/30">

      {/* Dynamic Background */}
      <div className="fixed inset-0 z-0">
        <img
          src="/src/assets/mine-bg.png"
          alt="Mine Background"
          className="w-full h-full object-cover opacity-30"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-black/80 via-black/50 to-black/90" />
      </div>

      <div className="relative z-10 max-w-md mx-auto min-h-screen flex flex-col p-4">
        <header className="flex justify-between items-center py-4 mb-4">
          <div className="flex items-center gap-3">
            <img src="/logo.png" alt="Max Miner Logo" className="h-10 object-contain drop-shadow-xl" />
          </div>
          <div className="bg-white/90 backdrop-blur-md px-4 py-2 rounded-full border border-white/20 flex items-center gap-2 shadow-lg">
            <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-xs font-black text-slate-900 uppercase">Online</span>
          </div>
        </header>

        {activeTab === 'MINE' && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex-1 flex flex-col h-full overflow-hidden pb-1">

            {/* Top Info Cards - Ultra Compressed */}
            <div className="grid grid-cols-2 gap-2 mb-2">
              <div className="bg-white border-2 border-indigo-100 p-2 rounded-xl flex flex-col items-center shadow-md">
                <span className="text-[8px] text-indigo-500 font-black uppercase tracking-widest mb-0.5">Gold Vault</span>
                <span className="text-lg font-black text-indigo-900 leading-none">{Math.floor(goldBalance).toLocaleString()}</span>
              </div>
              <div className="bg-indigo-600 border-2 border-indigo-500 p-2 rounded-xl flex flex-col items-center shadow-md">
                <span className="text-[8px] text-white/90 font-black uppercase tracking-widest mb-0.5">Max Tokens</span>
                <span className="text-lg font-black text-white leading-none">{maxBalance.toFixed(1)}</span>
              </div>
            </div>

            {/* Central Area - Compressed sizes and margins */}
            <div className="flex-1 flex flex-col items-center justify-center relative min-h-[140px]">
              <div className="absolute top-0 w-full text-center z-20">
                <div className="bg-slate-950/95 border border-indigo-500/50 px-3 py-1 rounded-2xl shadow-xl inline-flex flex-col items-center">
                  <div className="inline-block bg-indigo-600 px-2 py-0.5 rounded-full text-[8px] font-black text-white uppercase tracking-widest shadow-sm">
                    Level {currentLevelInfo.level}
                  </div>
                  <div className="text-base text-white font-black tracking-tighter italic leading-tight my-0.5">
                    +{(currentLevelInfo.goldPerHr * adTier.multiplier).toLocaleString()} <span className="text-indigo-400 text-[9px]">/ Hr</span>
                  </div>
                  <div className={`px-2 py-[2px] rounded font-black ${adTier.bg} ${adTier.color} uppercase text-[7px] tracking-widest shadow-sm border border-white/5`}>
                    {adTier.name} x{adTier.multiplier.toFixed(1)}
                  </div>
                </div>
              </div>

              {/* Central Pickaxe Logo - Golden Pickaxe (Purple Bg) */}
              <div className="relative w-36 h-36 mt-8 rounded-full bg-white shadow-[0_0_30px_rgba(255,255,255,0.2)] overflow-hidden flex items-center justify-center">
                {isConnected && fuelSeconds > 0 && (
                  <motion.div animate={{ rotate: 360 }} transition={{ duration: 10, repeat: Infinity, ease: "linear" }} className="absolute inset-0 rounded-full border-[3px] border-dashed border-emerald-400/30 z-20" />
                )}

                {isConnected && fuelSeconds > 0 && (
                  <motion.div
                    animate={{
                      rotate: [0, -15, 10, -5, 0],
                      scale: [1, 1.1, 1]
                    }}
                    transition={{
                      duration: 0.5,
                      repeat: Infinity,
                      repeatType: "reverse"
                    }}
                    className="z-10 w-full h-full flex items-center justify-center p-4"
                  >
                    <img src="/src/assets/pickaxe.png" alt="Golden Pickaxe" className="w-full h-full object-contain" />
                  </motion.div>
                )}
                {(!isConnected || fuelSeconds <= 0) && (
                  <div className="z-10 opacity-50 grayscale w-full h-full flex items-center justify-center p-4">
                    <img src="/src/assets/pickaxe.png" alt="Inactive Pickaxe" className="w-full h-full object-contain" />
                  </div>
                )}
              </div>
            </div>

            {/* Bottom Controls - Ultra Compressed */}
            <div className="mt-auto space-y-2 relative z-30">
              <div className="bg-white p-3 rounded-2xl shadow-lg border-2 border-indigo-100">
                <div className="flex justify-between items-end mb-1.5">
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

              <button
                onClick={refuel}
                disabled={fuelSeconds > 0 || adWatchCount >= MAX_ADS_PER_DAY}
                className={`w-full group p-3 rounded-2xl font-black flex items-center justify-center gap-2 transition-all active:scale-[0.98] shadow-lg border-[3px]
                  ${fuelSeconds === 0 && adWatchCount < MAX_ADS_PER_DAY
                    ? 'bg-indigo-600 text-white border-white hover:bg-indigo-500'
                    : 'bg-white text-slate-300 border-slate-100 cursor-not-allowed'
                  }`}
              >
                <PlayCircle size={28} />
                <div className="text-left">
                  <div className="text-[10px] opacity-90 uppercase tracking-[0.2em] font-black">
                    {adWatchCount >= MAX_ADS_PER_DAY ? 'Limit Reached' : fuelSeconds > 0 ? 'Rig Online' : 'Refuel Needed'}
                  </div>
                  <div className="text-xl leading-tight uppercase font-black tracking-tight">
                    {adWatchCount >= MAX_ADS_PER_DAY ? 'Daily Max' : fuelSeconds > 0 ? formatTime(fuelSeconds) : 'Start Refill'}
                  </div>
                </div>
              </button>
            </div>
          </motion.div>
        )}

        {activeTab === 'UPGRADE' && (
          <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="flex-1 flex flex-col">
            <h2 className="text-3xl font-black mb-6 italic uppercase tracking-tighter text-white drop-shadow-[0_4px_10px_rgba(0,0,0,1)]">Gear<span className="text-indigo-400"> Shop</span></h2>
            <div className="space-y-4 flex-1 overflow-y-auto pr-2 pb-6">
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
          <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="flex-1 overflow-y-auto pb-8">
            <h2 className="text-3xl font-black mb-4 italic uppercase tracking-tighter text-white drop-shadow-lg">Referral<span className="text-indigo-400"> Power</span></h2>
            <div className="bg-gradient-to-br from-blue-700 to-indigo-900 p-8 rounded-[40px] shadow-2xl mb-6 relative overflow-hidden border border-white/20">
              <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 blur-3xl rounded-full" />
              <h3 className="text-xl font-black mb-2 drop-shadow-md uppercase italic tracking-tight">Recruit Miners, Earn $MAX</h3>
              <p className="text-sm text-blue-100 mb-6 opacity-90 leading-relaxed font-bold drop-shadow-sm">
                Earn passive $MAX from every block mined in your network. 10% from direct refs, down to 1% at Level 5.
              </p>
              <button onClick={copyInviteLink} className={`w-full py-4 font-black rounded-2xl transition-all active:scale-[0.98] uppercase tracking-widest text-xs shadow-xl ${copyFeedback ? 'bg-emerald-500 text-white' : 'bg-white text-indigo-950 hover:bg-blue-50'}`}>
                {copyFeedback ? 'LINK READY! ✅' : 'INVITE PARTNERS'}
              </button>
            </div>
            <div className="space-y-3 mb-6">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="p-4 bg-blue-950/60 backdrop-blur-xl border border-white/10 rounded-2xl flex justify-between items-center shadow-lg">
                  <span className="font-bold text-blue-200 uppercase text-[10px] tracking-widest">Tier {i + 1} Passive</span>
                  <span className="font-black text-indigo-300 text-sm">{[10, 5, 2, 1, 1][i]}% Commission</span>
                </div>
              ))}
            </div>
            <div className="p-5 bg-indigo-950/40 backdrop-blur-md rounded-2xl border border-white/5 text-[10px] text-indigo-200/60 italic text-center leading-relaxed">
              * Passive income is calculated per individual ad impression within your hierarchy. Multi-level networking exponentially increases your yield.
            </div>
          </motion.div>
        )}

        {activeTab === 'WALLET' && (
          <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="flex-1 flex flex-col">
            <h2 className="text-3xl font-black mb-6 italic uppercase tracking-tighter text-white drop-shadow-lg">Bank<span className="text-indigo-400"> vault</span></h2>
            <div className="bg-blue-950/70 backdrop-blur-xl border border-white/20 p-8 rounded-[40px] mb-6 relative overflow-hidden shadow-2xl">
              <h3 className="text-xs font-bold text-indigo-300 uppercase tracking-widest mb-6 drop-shadow-sm text-center">Currency Exchange</h3>
              <div className="flex items-center justify-between bg-black/40 p-5 rounded-[30px] mb-6 border border-white/5">
                <div className="text-center flex-1">
                  <div className="text-[10px] text-indigo-400 font-black uppercase mb-1">PAY GOLD</div>
                  <div className="text-2xl font-black text-white">5,000</div>
                </div>
                <div className="px-4"><ArrowRight className="text-indigo-500" size={24} /></div>
                <div className="text-center flex-1">
                  <div className="text-[10px] text-sky-400 font-black uppercase mb-1">GET $MAX</div>
                  <div className="text-2xl font-black text-white">4.0</div>
                </div>
              </div>
              <button onClick={convertGoldToMax} disabled={goldBalance < 5000} className={`w-full py-4 rounded-2xl font-black transition-all shadow-xl uppercase tracking-widest text-xs ${goldBalance >= 5000 ? 'bg-indigo-500 text-white hover:bg-indigo-400' : 'bg-slate-900/50 text-slate-500 cursor-not-allowed border border-white/5'}`}>SWAP CURRENCY</button>
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

        <nav className="fixed bottom-0 left-0 right-0 bg-blue-950/90 backdrop-blur-3xl border-t border-white/20 h-24 px-8 flex justify-between items-center z-50 max-w-md mx-auto rounded-t-[40px] shadow-[0_-10px_40px_rgba(0,0,0,0.5)]">
          {[
            { id: 'MINE', icon: Star, label: 'Mine' },
            { id: 'UPGRADE', icon: Rocket, label: 'Boost' },
            { id: 'FRIENDS', icon: Users, label: 'Ref' },
            { id: 'WALLET', icon: Coins, label: 'Vault' }
          ].map(tab => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id as any)} className={`flex flex-col items-center gap-2 flex-1 transition-all ${activeTab === tab.id ? 'text-indigo-400 scale-110 drop-shadow-[0_0_8px_rgba(129,140,248,0.5)]' : 'text-blue-300/40 hover:text-blue-300'}`}>
              <tab.icon size={26} fill={activeTab === tab.id ? "currentColor" : "none"} />
              <span className="text-[10px] font-black uppercase tracking-[0.2em]">{tab.label}</span>
            </button>
          ))}
        </nav>
      </div>

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
                <div className="text-[100px] my-6 drop-shadow-lg">{lootboxData.type === 'GOLD' ? '🪙' : '💎'}</div>
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
                  <div className="flex justify-between text-xs"><span>Account status:</span><span className="font-bold text-sky-400 uppercase">Veteran</span></div>
                  <div className="flex justify-between text-xs"><span>Reward:</span><span className="text-amber-500 font-black">Level {tltInfo?.finalLevel || 0} Upgrade</span></div>
                </div>
                <button onClick={() => setShowTltModal(false)} className="w-full py-4 bg-amber-500 text-slate-950 font-black rounded-xl uppercase tracking-widest shadow-lg shadow-amber-500/20 hover:bg-amber-400">Start Mining</button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default App;
