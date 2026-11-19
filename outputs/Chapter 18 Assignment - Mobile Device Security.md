# Chapter 18 Assignment – Mobile Device Security

**Course:** CompTIA A+ Guide to IT Technical Support (Andrews) – Chapter 18
**Date:** November 19, 2026

> **Before you submit:**
> - Every **ScreenShot** item must be taken on *your own* computer and show the **whole desktop, including the taskbar/notification area with the date and time**. Windows: press **Win + PrtScn** (saves to *Pictures > Screenshots*). Mac: **Shift + Cmd + 3**.
> - Replace anything in **[brackets]** with your own details (your phone model, OS version, etc.).
> - Related notes: [[Mobile Payment Services]], [[NFC]], [[Find My Device]], [[Android Studio Emulator]]

---

## Thinking Critically Questions

> ⚠️ I couldn't get the exact wording of the Chapter 18 Thinking Critically questions online. The answers below cover the main concepts these questions test (Core 2 Objective 2.8 – securing mobile devices). **Paste the questions from your book and I'll match an answer to each one exactly.**

1. **Locking a mobile device:** The strongest everyday protection is a screen lock — a long PIN or password, plus biometrics (fingerprint or face). Pattern and swipe locks are weakest. Set the device to wipe itself after about 10 failed unlock attempts so a thief can't keep guessing.
2. **Lost or stolen device:** First locate it with **Find My** (iOS) or **Find My Device** (Android). Then play a sound, lock it with a message (Lost Mode), and if you can't get it back, **remote wipe** it. Change the account passwords, and tell your carrier and your company's IT department (MDM).
3. **Corporate devices / BYOD:** Use **MDM (Mobile Device Management)** to push policies: required screen lock, encryption, remote wipe, app allow-lists, and separate work and personal profiles (Android Work Profile / iOS Managed Apple ID).
4. **Malware signs on a phone:** Battery drains fast, the phone runs hot, data use goes up, ads pop up, unknown apps appear, high resource use, slow performance, or texts you didn't send. Fix: uninstall suspicious apps, boot to Safe Mode (Android), run a reputable antimalware app, update the OS, and factory reset as a last resort (after backing up).
5. **Rooting / jailbreaking:** This removes the OS's security sandbox and blocks official updates. MDM often blocks these devices. Don't do it on any device that holds company or financial data.
6. **Backups:** iOS backs up to iCloud or to a computer (Finder/iTunes). Android backs up to your Google account (Google One). Always back up before a reset or an OS update.
7. **Sideloading and app sources:** Install apps only from official stores. On Android, leave "Install unknown apps" turned off. Before installing, check what permissions the app asks for.
8. **Encryption:** Modern iOS and Android encrypt the whole device by default once a screen lock is set. Without a lock code, encryption gives little real protection.

---

## Hands-On Project 18-1 – Researching Apps for Mobile Payment Services

### 1. How do mobile payments use NFC? How do you turn on NFC for Google Pay and Apple Pay?

**Website links:**
- Apple Pay – Set up: https://support.apple.com/en-us/108398
- Apple Pay security & privacy overview: https://support.apple.com/en-us/101554
- Google Wallet / Google Pay Help: https://support.google.com/wallet

**Answer:**
**NFC (near-field communication)** is a short-range radio technology that works at about 13.56 MHz over roughly 4 cm (1.5 inches) or less. When you hold the phone near a contactless terminal, the phone and the reader create a small electromagnetic field and exchange the payment data. Because the range is so short, a transaction is hard to intercept by accident.

- **Android (Google Pay / Google Wallet):** Open **Settings > Connected devices > Connection preferences > NFC** (on Samsung: **Settings > Connections > NFC and contactless payments**) and turn **NFC** on. Then go to **Contactless payments** and set **Google Wallet** as the default payment app. Open the Google Wallet app, add a card, and set a screen lock (required). To pay, unlock the phone and hold the back of it near the terminal.
- **iPhone (Apple Pay):** The iPhone has no NFC on/off switch. NFC is always ready for Apple Pay. Open the **Wallet** app, tap **+**, and add a card (or go to **Settings > Wallet & Apple Pay**). To pay, **double-click the side button** (or the Home button on older models), confirm with **Face ID / Touch ID / passcode**, and hold the top of the phone near the reader.

### 2. How is financial information stored, accessed, and sent securely?

**Website links:**
- Apple Pay security & privacy overview: https://support.apple.com/en-us/101554
- Apple Platform Security guide (Apple Pay section): https://support.apple.com/guide/security/welcome/web
- Google Wallet Help (privacy & security): https://support.google.com/wallet

**What security measures are in place?**
- **Tokenization:** The real card number is never stored on the phone or given to the merchant. The card network issues a **Device Account Number / virtual account number (token)** in its place.
- **Dynamic security code (cryptogram):** Each transaction creates a one-time code, so captured data can't be reused.
- **Authentication:** Face ID, Touch ID, fingerprint, PIN, or passcode is required before every payment.
- **Remote lock/wipe:** If the phone is lost, you can suspend or remove cards using Find My or Find My Device.

**Where is the data stored?**
- **Apple Pay:** The token is stored in the **Secure Element**, a separate certified chip in the iPhone that iOS and apps can't read. Apple doesn't keep your card number on its servers.
- **Google Pay:** Uses **Host Card Emulation (HCE)**. The token and limited-use keys are stored in an encrypted area of the phone (protected by the Android Keystore / hardware-backed security). Your actual card details are stored encrypted on Google's secure servers.

**What information is transmitted at the point of transaction?**
Only the **token (virtual account number)**, the **one-time cryptogram**, and the transaction details (amount, merchant). Your real card number, name, and security code are **not** sent to the merchant.

### 3. Three third-party mobile payment apps

**Website links:**
- PayPal: https://www.paypal.com/us/digital-wallet/ways-to-pay/pay-in-store (App Store / Google Play: search "PayPal")
- Venmo: https://venmo.com
- Cash App: https://cash.app

| App | OS versions (check the store listing for current requirements) | Cost | Advantages | Disadvantages | Security measures |
|---|---|---|---|---|---|
| **PayPal** | iOS and Android – recent versions (roughly iOS 16+ / Android 8+) | Free download. Paying friends from a bank balance is free; credit card payments ~2.9% + fee; instant transfer ~1.75% | Accepted almost everywhere online, buyer protection, can use tap-to-pay / QR codes | Fees for instant transfers and cards; accounts can be frozen | Encryption, 2-step verification, biometric login, fraud monitoring, Purchase Protection |
| **Venmo** (owned by PayPal) | iOS and Android – recent versions | Free download; bank/debit transfers free; credit card 3%; instant transfer 1.75% (min $0.25, max $25) | Easy to split bills with friends, Venmo debit card, QR payments | Feed is public by default (privacy risk); limited purchase protection for personal payments | PIN lock, biometrics, multi-factor authentication, encryption, privacy settings |
| **Cash App** | iOS and Android – recent versions | Free download; standard transfer free; instant deposit ~0.5%–1.75%; credit card 3% | Fast, free Cash Card (Visa debit), can buy stocks/bitcoin | Limited buyer protection; a common target for scams; fewer features outside the U.S. | Encryption, PIN/biometric security lock, sign-in codes, fraud detection, Cash Card can be turned off instantly |

### 4. If you bought one of these apps, which one and why?

**Answer:** I would choose **PayPal**. It's accepted at the most online and in-store merchants, it has the strongest **buyer/purchase protection** if something goes wrong, and it supports two-step verification and biometric login. Venmo and Cash App are convenient for paying friends, but they offer less protection when buying from businesses, and Venmo's public feed is a privacy concern. *(Change this if you prefer a different app – just explain your reason.)*

---

## Hands-On Project 18-2 – Practicing Locating Your iOS or Android Device

### Step 1 – Turn on Location Services
- **iPhone:** Settings > Privacy & Security > **Location Services** > On.
- **Android:** Settings > **Location** > Use location > On.

### Step 2 – Turn on the find-my-device feature
- **iPhone:** Settings > *[your name]* > **Find My** > **Find My iPhone** > On (also turn on *Find My network* and *Send Last Location*).
- **Android:** Settings > Security (or Google > **Find My Device**) > On. Make sure you're signed in with your Google account.

### Step 3 – Locate your device from a computer — 📸 **SCREENSHOT REQUIRED**
On your computer, go to **https://www.icloud.com/find** (iPhone) or **https://www.google.com/android/find** (Android). Sign in and let it find your phone on the map. **Take a full-desktop screenshot showing the map and the date/time on your taskbar.**

> 📸 *[Insert screenshot here]*

**Questions & answers:**
- **Was the device located? How accurate was the location?** Yes. The map showed my [device model] at my current location, within about [X] meters/feet. Accuracy depends on GPS, Wi-Fi, and cell-tower data.
- **What other information was shown?** The device name, its battery level, and when it was last seen/located.
- **What actions are available?**
  - *iPhone:* **Play Sound**, **Mark As Lost** (Lost Mode – locks the device, shows a message/phone number, suspends Apple Pay), **Erase This Device**, and **Directions**.
  - *Android:* **Play Sound**, **Secure Device** (locks it and shows a message/callback number), **Factory reset device** (erase).
- *(Optional test)* I used **Play Sound**, and the phone rang at full volume even though it was on silent.

### Step 4 – Research — 🔗 **WEBSITE LINK REQUIRED**

**Website links:**
- Apple – If your iPhone is lost or stolen: https://support.apple.com/en-us/101593
- Apple – Find My on iCloud.com: https://www.icloud.com/find
- Google – Find, lock, or erase a lost Android device: https://support.google.com/android/answer/6160491
- Google Find My Device: https://www.google.com/android/find

**Questions & answers:**
- **What should you do if the device is lost or stolen?** Locate it → play a sound if it's nearby → put it in **Lost Mode / Secure Device** with a contact number → report it to the police and your carrier (the carrier can block the IMEI) → **erase** it if you can't get it back → change your Apple ID/Google password and remove saved payment cards.
- **What happens if you erase the device?** All data and settings are deleted. On iPhone, after erasing you can **no longer locate it**, but **Activation Lock** still stops anyone else from using it without your Apple ID. On Android, **Factory Reset Protection (FRP)** requires your Google account after the reset.
- **Can you find a device that is off or offline?** iPhone: yes, often. The **Find My network** uses nearby Apple devices to report its location, and *Send Last Location* sends the location before the battery dies. Android: newer versions use Google's **Find Hub / Find My Device network** to show the last known location. Otherwise it shows the last location and runs the commands when the device comes back online.

---

## Real Problem 18-1 – Using Android Studio to Run an Android Emulator — 📸 **SCREENSHOT REQUIRED**

**Download link:** https://developer.android.com/studio
**Emulator guide:** https://developer.android.com/studio/run/emulator

**Steps:**
1. Download and install **Android Studio** (use the default settings; this installs the Android SDK and the **Android Emulator**). You need about 8 GB of RAM (16 GB is better) and virtualization turned on in BIOS/UEFI (**Intel VT-x / AMD-V**).
2. Open Android Studio. On the Welcome screen, choose **More Actions > Virtual Device Manager** (or, inside a project, **Tools > Device Manager**).
3. Click **Create Device (+)** → choose a phone such as **Pixel 8** → **Next**.
4. Select a **system image** (a recent Android release with Google Play) → click **Download** → **Next** → **Finish**.
5. Click the **▶ Play** button beside the virtual device. The emulator boots and shows an Android home screen.
6. Use the emulated phone: open **Settings**, check **About emulated device** for the Android version, and test **Security** settings (screen lock, Find My Device).
7. 📸 **Take a full-desktop screenshot showing the running emulator and the date/time on your taskbar.**

> 📸 *[Insert screenshot here]*

**Notes / troubleshooting:**
- If the emulator is slow or won't start, enable virtualization in BIOS/UEFI. On Windows, turn on **Windows Hypervisor Platform** (Control Panel > Programs > Turn Windows features on or off).
- **Why use an emulator?** You can test apps and practice support tasks on different Android versions and screen sizes without owning a physical device.
