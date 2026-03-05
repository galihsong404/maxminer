import { ethers } from 'ethers';
import { prisma } from '../prisma/client';

// Load Config from Environment
const RPC_URL = process.env.BSC_RPC_URL || 'https://data-seed-prebsc-1-s1.binance.org:8545';
const PRIVATE_KEY = process.env.OWNER_PRIVATE_KEY;
const CONTRACT_ADDRESS = process.env.TOKEN_CONTRACT_ADDRESS;

const TOKEN_ABI = [
    "function mint(address to, uint256 amount) external"
];

let isProcessing = false;

export const processWithdrawals = async () => {
    // Prevent overlapping cron runs
    if (isProcessing) return;
    isProcessing = true;

    try {
        if (!PRIVATE_KEY || !CONTRACT_ADDRESS) {
            console.error('[PAYOUT SERVICE] Missing PRIVATE_KEY or CONTRACT_ADDRESS in environment.');
            return;
        }

        const provider = new ethers.JsonRpcProvider(RPC_URL);
        const wallet = new ethers.Wallet(PRIVATE_KEY, provider);
        const contract = new ethers.Contract(CONTRACT_ADDRESS, TOKEN_ABI, wallet);

        // Fetch up to 10 APPROVED withdrawals (manually audited)
        const pendingWithdrawals = await prisma.withdrawal.findMany({
            where: { status: 'APPROVED' },
            take: 10,
            orderBy: { createdAt: 'asc' }
        });

        if (pendingWithdrawals.length === 0) {
            isProcessing = false;
            return; // Nothing to process
        }

        console.log(`[PAYOUT SERVICE] Processing ${pendingWithdrawals.length} pending withdrawals...`);

        for (const withdrawal of pendingWithdrawals) {
            try {
                // Formatting amount to 18 decimals as expected by standard ERC20
                const amountToMint = ethers.parseUnits(withdrawal.amount.toString(), 18);

                // Execute Mint Transaction
                console.log(`[PAYOUT SERVICE] Minting ${withdrawal.amount} MAX to ${withdrawal.walletAddress}...`);

                const tx = await contract.mint(withdrawal.walletAddress, amountToMint);
                await tx.wait(1); // Wait for 1 confirmation

                // Update DB: Status = COMPLETED
                await prisma.withdrawal.update({
                    where: { id: withdrawal.id },
                    data: {
                        status: 'COMPLETED',
                        processedAt: new Date()
                    }
                });

                console.log(`[PAYOUT SERVICE] ✅ SUCCESS: ${withdrawal.id} (TX: ${tx.hash})`);

            } catch (txError: any) {
                console.error(`[PAYOUT SERVICE] ❌ FAILED processing ${withdrawal.id}:`, txError.message);

                // Update DB: Status = FAILED
                await prisma.withdrawal.update({
                    where: { id: withdrawal.id },
                    data: {
                        status: 'FAILED',
                        processedAt: new Date()
                    }
                });

                // User balance refund logic can be added here if needed,
                // but usually failed on-chain tx implies an admin review is safer.
            }
        }

    } catch (err: any) {
        console.error('[PAYOUT SERVICE] Critical Error:', err.message);
    } finally {
        isProcessing = false;
    }
};

// Start polling every minute
export const startPayoutService = () => {
    console.log('[PAYOUT SERVICE] Started polling for pending withdrawals...');
    setInterval(processWithdrawals, 60 * 1000); // Run every 60 seconds
};
