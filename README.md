# TRON Auto-Delegate Bot

A Node.js automation script for TRON wallets that alternates daily between claiming rewards and staking/delegating energy.

## 🚀 Features
- **Alternating Actions**: Automatically switches between claiming rewards (Day 1) and staking/voting/delegating (Day 2).
- **Stake V2 Compatible**: Uses the latest TRON staking protocol.
- **Customizable**: Set your own SR address, target wallet, and TRX fee reserve.
- **Lightweight**: Zero-dependency state management using a local JSON file.

---

## 🛠️ Setup

### 1. Clone & Install
```bash
git clone <your-repo-url>
cd tron-catfee-autodelegate
npm install
```

### 2. Configure Environment
Rename `.env.example` to `.env` and fill in your details:
```bash
PRIVATE_KEY=your_private_key_here
TARGET_WALLET=address_to_receive_energy
VOTE_SR_ADDRESS=TTcYhypP8m4phDhN6oRexz2174zAerjEWP
TRX_FEE_RESERVE=20
```

---

## 🐧 Linux Server Deployment (Crontab)

To run the script automatically every day at **midnight**, you can use the provided setup script or manually configure crontab.

### 1. Using the automated script (Recommended)
Give the script execution permissions and run it:
```bash
chmod +x setup-cron.sh
./setup-cron.sh install
```
To stop the bot later:
```bash
./setup-cron.sh uninstall
```

### 2. Manual Configuration
1. Open your crontab editor:
   ```bash
   crontab -e
   ```
2. Add the following line at the end:
   ```bash
   0 0 * * * /usr/bin/node /home/user/tron-catfee-autodelegate/index.js >> /home/user/tron-catfee-autodelegate/cron.log 2>&1
   ```

### Does crontab activate at midnight?
Yes! The expression `0 0 * * *` specifically tells the server to run the command at exactly **00:00 (Midnight)** every single day.

---

## ⚙️ How it works
The script maintains a `state.json` file to track its last action.
- **Run 1**: Claims all pending voting rewards.
- **Run 2**: Stakes available TRX (minus reserve), votes for your chosen SR, and delegates all available energy power.
- **Repeat**: The cycle continues automatically.

## ⚠️ Security
- **Never** commit your `.env` file to version control.
- Ensure your server has restricted access, as it contains your wallet's private key.
