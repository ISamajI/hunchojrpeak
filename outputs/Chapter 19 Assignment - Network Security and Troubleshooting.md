# Chapter 19 Assignment – Network Security and Troubleshooting

**Course:** CompTIA A+ Guide to IT Technical Support (Andrews) – Chapter 19
**Grading:** 8 activities × 6 pts each
**Related notes:** [[Windows Defender Firewall]], [[Remote Desktop]], [[Network Troubleshooting Commands]], [[Port Scanning]], [[Chapter 18 Assignment - Mobile Device Security]]

> **Read first:**
> - **Every screenshot must show the whole desktop, including the taskbar clock (date & time).** Windows: **Win + PrtScn** (saved to *Pictures > Screenshots*).
> - **Almost all of this chapter is Windows-only** (Defender Firewall, Remote Desktop host, `net use`, `tracert`, `pathping`, mapped drives). A Mac can't produce these screenshots. Use a **Windows PC** (school lab, library, or a Windows virtual machine).
> - Replace anything in **[brackets]** with what you actually see.

---

## Thinking Critically (#1–28)

> ⚠️ **The questions are needed.** I couldn't find the exact text of Chapter 19's Thinking Critically questions online. Paste them or send photos, and I'll answer all 28 here.

---

## Applying Concepts 19-1 – Configuring Windows Defender Firewall (pg 944)

**How to open it:** Start → type **Windows Defender Firewall** → **Allow an app or feature through Windows Defender Firewall**. For traffic rules: **Advanced settings** → **Inbound Rules / Outbound Rules**.

### ScreenShot #1 – Allowed apps list
📸 *[Screenshot: "Allowed apps" window]*

**One app I might allow through, and why:**
**Microsoft Teams (or Zoom).** Video calls need incoming network connections to send and receive audio and video. If the firewall blocks the app, calls fail or connect without sound or video. I would allow it on **Private** networks (home/work) only, not on **Public** networks such as coffee-shop Wi-Fi.

### ScreenShot #2 – Advanced Security (Inbound Rules)
📸 *[Screenshot: "Windows Defender Firewall with Advanced Security" – Inbound Rules]*

**One type of traffic to allow, and why:**
**ICMPv4 Echo Request (ping) on the Private profile** – the rule is named *File and Printer Sharing (Echo Request – ICMPv4-In)*. Allowing ping lets me and other technicians test whether this computer can be reached on the local network, which is the first step in troubleshooting. On a private network the risk is low.

**One type of traffic to deny, and why:**
**Inbound Remote Desktop (TCP port 3389) on the Public profile.** RDP is one of the most attacked ports on the internet: attackers try to guess passwords, and ransomware gangs use RDP to break in. If there's no need for anyone to connect to this computer remotely, the port should stay closed. Other good choices to deny: inbound **SMB / File and Printer Sharing (TCP 445)** on public networks.

---

## Applying Concepts 19-2 – Configuring Remote Desktop on Two Computers (pg 965)

> Remote Desktop **host** requires **Windows 10/11 Pro, Enterprise, or Education**. **Windows Home can only connect out**, not accept connections. If you only have one computer, say so in your submission.

### Part 1 – Enable Remote Desktop (on the computer you'll connect *to*)
1. **Settings → System → Remote Desktop** → turn **Remote Desktop** On → **Confirm**.
   📸 *[Screenshot 1: Remote Desktop toggle On]*
2. Make sure **"Require devices to use Network Level Authentication (NLA)"** is checked. Note the **PC name** shown.
   📸 *[Screenshot 2: NLA setting + PC name]*
3. Click **Remote Desktop users** → **Add** → enter the user account allowed to connect → **OK**.
   📸 *[Screenshot 3: Remote Desktop Users dialog]*

### Part 2 – Use Remote Desktop (from the second computer)
1. Start → type **mstsc** → open **Remote Desktop Connection**. Enter the host's **PC name or IP address** (find it with `ipconfig` on the host) → **Connect**.
   📸 *[Screenshot 4: Remote Desktop Connection window with computer name]*
2. Sign in with the allowed account. If a certificate warning appears, accept it.
   📸 *[Screenshot 5: Remote session open, showing the other computer's desktop]*

*(Mac users: Microsoft's **Windows App** from the Mac App Store can connect **to** a Windows Pro computer, but the Mac can't be the host.)*

---

## Troubleshooting Network Connections – Command-Line Commands (pps 974–981) – 10 ScreenShots

Open **Command Prompt**: Start → type **cmd** → Enter. Type each command below, then take a screenshot of the whole desktop.

| # | Command to type | What it does |
|---|---|---|
| 1 | `ping 8.8.8.8` (or `ping google.com`) | Tests whether a host can be reached and measures round-trip time using ICMP echo |
| 2 | `hostname` | Shows the computer's name |
| 3 | `ipconfig /all` | Shows IP address, subnet mask, default gateway, DNS servers, MAC address, DHCP lease |
| 4 | `nslookup google.com` | Looks up a domain name in DNS and returns its IP address; shows which DNS server answered |
| 5 | `tracert google.com` | Lists every router (hop) between you and the destination |
| 6 | `pathping google.com` | Combines ping and tracert, then reports packet loss at each hop (takes ~1–2 minutes) |
| 7 | `net use` | Lists mapped network drives and connections (it may say "There are no entries in the list" – that's OK) |
| 8 | `net user` | Lists the user accounts on this computer |
| 9 | `netstat -an` | Shows active connections and listening ports |
| 10 | `whoami` | Shows the signed-in user as COMPUTERNAME\username |

📸 *[Screenshots 1–10: one per command]*

---

## Hands-On Project 19-1 – Researching a Wireless LAN

> ⚠️ I couldn't find this project's exact wording online. The answers below cover the usual questions for this project (planning a SOHO wireless network: choosing equipment, standards, security, cost). Send the exact questions and I'll match each one.

**Website links (2):**
1. TP-Link Archer AX55 (Wi-Fi 6 router): https://www.tp-link.com/us/home-networking/wifi-router/archer-ax55/
2. NETGEAR Nighthawk Wi-Fi 6 routers: https://www.netgear.com/home/wifi/routers/

**Answers:**
- **Which Wi-Fi standard should a small office use?** **802.11ax (Wi-Fi 6/6E)**, or **802.11be (Wi-Fi 7)** if the budget allows. Wi-Fi 6 works on 2.4 GHz and 5 GHz (6E adds 6 GHz), handles many devices at once using OFDMA/MU-MIMO, and works with older 802.11ac/n devices.
- **Equipment needed:** a wireless router or access point, a modem from the ISP, and an Ethernet switch for wired devices. For larger spaces, add a **mesh system** or extra access points.
- **Security settings to use:** **WPA3-Personal** (or WPA2/WPA3 mixed mode for older devices) with AES encryption and a strong passphrase. Change the default admin password, turn **WPS off**, keep the firmware updated, put visitors on a separate **guest network**, and consider MAC filtering or DHCP reservations for important devices.
- **Placement / coverage:** put the router in a central, high spot away from metal and microwaves. Use the 5 GHz band for speed and the 2.4 GHz band for range. Run a Wi-Fi analyzer to pick the least crowded channel (1, 6, or 11 on 2.4 GHz).
- **Cost:** Wi-Fi 6 routers cost roughly **$80–$200**; mesh systems roughly **$150–$400**.
- **My choice:** the **TP-Link Archer AX55**. It's affordable, supports Wi-Fi 6 and WPA3, has a guest network, and gives enough coverage for a small office or home.

---

## Hands-On Project 19-4 – Setting Up a Persistent Network Drive

**On the computer that will share the folder:**
1. In File Explorer, create **C:\Shared\Reports**. Inside it, create a text file such as **Report1.txt**.
   📸 *[Screenshot 1: folder/file structure in File Explorer]*
2. Right-click **Shared** → **Properties** → **Sharing** → **Advanced Sharing** → check **Share this folder** → **Permissions** → give your user **Change/Read**. Then open the **Security** tab and check the NTFS permissions.
   📸 *[Screenshot 2: Permissions tab]*
3. In Command Prompt, run `net share` to confirm the share exists, and `hostname` to note the computer name.
   📸 *[Screenshot 3: command prompt window]*

**Map the persistent drive (on the second computer, or on the same computer if you only have one):**
4. Run:
   ```
   net use Z: \\COMPUTERNAME\Shared /persistent:yes
   ```
   Then run `net use` to show the connection.
   📸 *[Screenshot 4: command prompt window showing Z: mapped]*
   **If you don't have a 2nd networked computer: STOP here and write: "I do not have a second networked computer."**
5. *(2nd computer only)* Open File Explorer → **This PC** → you should see drive **Z:**.
   📸 *[Screenshot 5]*
6. Restart the computer and check that **Z:** reconnects automatically.
   📸 *[Screenshot 6]*
   - **What does /persistent:yes do?** It saves the mapping so the drive reconnects every time you sign in.
   - **How do you remove it?** Run `net use Z: /delete`.
   - **Share permissions vs. NTFS permissions?** Share permissions apply only when the folder is reached over the network. NTFS permissions apply both locally and over the network. When both apply, the **more restrictive** permission wins.
7. 📸 *[Screenshot 7: final state]*

---

## Hands-On Project 19-5 – Scanning a Network for Connected Devices

**Tool:** **Advanced IP Scanner** (Windows, free) – https://www.advanced-ip-scanner.com — or **Angry IP Scanner** (Windows/Mac/Linux) – https://angryip.org
1. Install the scanner, then enter your subnet (for example **192.168.1.1–192.168.1.254**; find it with `ipconfig`) → **Scan**.
2. 📸 *[Screenshot: scan results listing the devices on your network]*

---

## Real Problem 19-1 – Using a Port Scanner

> **If you don't have a second networked computer:** make all the changes on the host computer, take screenshots of those windows, and write: *"I do not have a second networked computer."*

**Tool:** Advanced IP Scanner / Angry IP Scanner (above), or **Nmap/Zenmap** – https://nmap.org/download
1. Scan your network.
   📸 *[Screenshot 1: scanner results]*
2. Select a device and view its open ports/services (in Angry IP Scanner: **Tools → Preferences → Ports** → add `21,22,80,135,139,443,445,3389`).
   📸 *[Screenshot 2]*
   **Open ports seen:** *[e.g., Router 192.168.1.1 – 53 (DNS), 80 (HTTP), 443 (HTTPS)]*
3. Turn on Remote Desktop or file sharing on the host (or change a firewall rule), then scan again.
   📸 *[Screenshot 3]*
   **Open ports seen:** *[e.g., This PC – 135 (RPC), 139 (NetBIOS), 445 (SMB), 3389 (RDP, after enabling Remote Desktop)]*

**Common ports for reference:** 20/21 FTP · 22 SSH · 23 Telnet · 25 SMTP · 53 DNS · 80 HTTP · 110 POP3 · 143 IMAP · 443 HTTPS · 445 SMB · 3389 RDP

---

## Real Problem 19-2 – Implementing More Security for Remote Desktop

📸 *[Screenshot: the security setting you configured – e.g., Remote Desktop settings with NLA, or a firewall rule limiting 3389]*

**Answers – ways to make Remote Desktop more secure:**
1. **Require Network Level Authentication (NLA).** Users must sign in *before* a full session starts, which blocks many attacks.
2. **Use strong passwords and account lockout.** Set this in `secpol.msc` → *Account Lockout Policy* (for example, lock after 5 failed tries).
3. **Limit who can connect.** Add only specific users to *Remote Desktop Users*. Never use a blank password, and don't use the default Administrator account.
4. **Restrict by IP with the firewall.** Edit the inbound *Remote Desktop – User Mode (TCP-In)* rule → **Scope** → allow only certain remote IP addresses.
5. **Don't expose port 3389 to the internet.** Connect through a **VPN** or a **Remote Desktop Gateway**. Changing the port (registry key `HKLM\SYSTEM\CurrentControlSet\Control\Terminal Server\WinStations\RDP-Tcp\PortNumber`) hides it from automated scans, but it is *not* real security on its own.
6. **Use MFA, keep Windows updated, and turn off RDP when it isn't needed.**
