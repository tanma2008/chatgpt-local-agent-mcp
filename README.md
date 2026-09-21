# chatgpt-local-agent-mcp 🖥️

**chatgpt-local-agent-mcp** คือ Local MCP Server (Model Context Protocol) ประสิทธิภาพสูงสำหรับระบบปฏิบัติการ Windows ที่ออกแบบมาเพื่อให้ ChatGPT สามารถทำงานกับไฟล์ คำสั่ง ไดเรกทอรี เบราว์เซอร์ หน้าจอ และเดสก์ท็อปในเครื่องจริงของคุณได้อย่างปลอดภัย ภายใต้การควบคุมและกำกับดูแลของผู้ใช้ผ่านการยืนยันตัวตน (Authentication), สิทธิ์การใช้งาน (Scopes), นโยบายการรัน (Policy Modes) และโปรไฟล์พื้นที่ทำงาน (Workspace Profiles)

---

## 1. ชื่อโครงการ (Project Name)

**chatgpt-local-agent-mcp**  
ทำหน้าที่เป็นสะพานเชื่อมแบบสองทางระหว่าง ChatGPT ( reasoning/agent layer บนคลาวด์) กับเครื่องคอมพิวเตอร์ Windows ของคุณ (local execution context) ทำให้ ChatGPT มี "มือ" ในการอ่านไฟล์ แก้ไขโค้ด รันคำสั่ง ตรวจสอบ Git ควบคุมเบราว์เซอร์ และส่งอินพุตบนเดสก์ท็อปได้อย่างมีขอบเขต

---

## 2. ระบบนี้ทำอะไร (System Workflow)

ระบบนี้ทำงานเป็นตัวกลางระหว่าง ChatGPT กับเครื่อง Windows โดยมีลำดับขั้นตอนดังนี้:

```text
[ ChatGPT (Cloud) ]
        │
        ▼ (MCP Connector over Public HTTPS)
[ HTTPS / Cloudflare Tunnel ] (หรือ Tailscale Funnel)
        │
        ▼ (Proxy to localhost)
[ Local MCP Server (Express / Streamable HTTP) ] ── (127.0.0.1:8789)
        │
        ├─► [ OAuth 2.0 / GitHub Authentication Guard ]
        ├─► [ Workspace Profiles & Secret Path Filtering ]
        └─► [ Policy Mode & Fine-Grained Scope Validation ]
        │
        ▼ (Executed under Windows User Account)
[ Windows PC (Files / Shell / Git / Processes / Browser / Desktop) ]
```

* **ChatGPT** ทำหน้าที่เป็น **Brain** (ประมวลผล วางแผน คิดวิเคราะห์ และร้องขอการใช้มือ)
* **chatgpt-local-agent-mcp** ทำหน้าที่เป็น **Supervised Hands** (ตรวจสอบสิทธิ์ ควบคุมความปลอดภัย บันทึก Audit Journal และปฏิบัติตามคำสั่งบนเครื่องจริง)

---

## 3. สถาปัตยกรรมระบบ (Architecture Diagrams)

### 3.1 Local-Only Mode (ทดสอบภายในเครื่อง)
```text
[ Windows User / Browser ]
        │
        ▼ HTTP
┌─────────────────────────────────────────────────────────────┐
│ Local Windows PC (127.0.0.1:8789)                           │
│                                                             │
│  ├─► GET /healthz          (Health Check)                   │
│  ├─► GET /dashboard        (Local Control Web Dashboard)    │
│  └─► POST /mcp             (Streamable HTTP Transport)      │
└─────────────────────────────────────────────────────────────┘
```

### 3.2 Remote ChatGPT Connector Mode
```text
[ ChatGPT Action / Connector ]
        │
        ▼ Public HTTPS Request (e.g. https://mcp.your-domain.com/mcp)
[ Cloudflare Edge / DNS ]
        │
        ▼ Encrypted Cloudflare Tunnel (cloudflared)
[ Local Windows PC ]
        │
        ▼ Forward to Local Port
┌─────────────────────────────────────────────────────────────┐
│ Express Server (http://127.0.0.1:8789)                      │
│  ├── Host Header Validation                                 │
│  ├── Bearer Token Auth Middleware (src/index.ts)            │
│  ├── Preflight Policy & Scope Check (rejectToolPreflight)   │
│  ├── StreamableHTTPServerTransport                          │
│  └── McpServer Execution & Journal Logging                  │
└─────────────────────────────────────────────────────────────┘
```

### 3.3 OAuth 2.0 Authorization & Token Flow
```text
[ ChatGPT ]               [ Local MCP Server ]             [ GitHub OAuth ]
     │                             │                              │
     ├─── 1. GET /authorize ──────►│                              │
     │    (client_id, PKCE)        ├─── 2. Redirect to GitHub ────►│
     │                             │                              │
     │                             │◄── 3. User authenticates ─────┤
     │◄── 4. Redirect with code ───┤◄── 5. Callback (/callback) ────┘
     │                             │    (Check ALLOWED_LOGINS)
     ├─── 6. POST /token ─────────►│
     │    (code_verifier)          │ (Verify PKCE & Issue Token)
     │◄── 7. Access Token ─────────┤
```

### 3.4 Cloudflare Tunnel Connectivity Flow
```text
[ External Request ] ──► [ Cloudflare Ingress Rule ]
                              │ (hostname: mcp.your-domain.com)
                              ▼
                         [ cloudflared daemon ]
                              │ (Local HTTP Forward)
                              ▼
                         [ 127.0.0.1:8789 ]
```

---

## 4. เริ่มต้นใช้งาน — Path A: Local-Only Smoke Test

ใช้ Path A เพื่อทดสอบว่าโปรแกรมรันได้สมบูรณ์ในเครื่อง local ก่อนเชื่อมต่อภายนอก

### ข้อกำหนดของระบบ (Requirements)
* ระบบปฏิบัติการ Windows 10/11
* Node.js (แนะนำ v18 ขึ้นไป) และ npm
* PowerShell 5.1 หรือ PowerShell Core
* Git for Windows

### ขั้นตอนการรัน Local Smoke Test
1. เปิด PowerShell ในโฟลเดอร์ซอร์สโค้ด แล้วรันสคริปต์ติดตั้ง:
   ```powershell
   .\install-chatgpt-local-agent-mcp.bat
   ```
2. ตัวติดตั้งจะคัดลอกไฟล์ไปยังไดเรกทอรีทำงานจริง (Runtime Install Root):
   ```text
   %LOCALAPPDATA%\chatgpt-local-agent-mcp
   ```
3. กำหนดค่าคอนฟิกสำหรับทดสอบ Local-only ในไฟล์ `.env` ของโฟลเดอร์ runtime:
   ```env
   PUBLIC_BASE_URL=http://127.0.0.1:8789
   CLOUDFLARE_TUNNEL_ENABLED=false
   AUTH_REQUIRED=false
   NODE_ENV=development
   ```
4. เริ่มรันเซิร์ฟเวอร์ และเปิดดู Endpoints ในเครื่อง:
   * **Web Dashboard:** `http://127.0.0.1:8789/dashboard`
   * **Health Check:** `http://127.0.0.1:8789/healthz`
   * **MCP Endpoint:** `http://127.0.0.1:8789/mcp`

---

## 5. การเชื่อมต่อ Remote ChatGPT Connector — Path B

ทำขั้นตอนนี้เมื่อ Path A ทำงานผ่านแล้วเท่านั้น

```text
ChatGPT (Remote) ──► Public HTTPS Domain ──► Cloudflare Tunnel ──► http://127.0.0.1:8789 ──► Local MCP Server
```

### สิ่งที่ต้องเตรียมเพิ่มเติม:
* ชื่อโดเมนสาธารณะ (Public HTTPS Hostname)
* Cloudflare Tunnel (หรือ HTTPS Tunnel อื่นๆ เช่น Tailscale Funnel)
* GitHub OAuth App (สำหรับระบุตัวตนผู้ใช้)
* ChatGPT Connector OAuth Client Configuration ใน `.env`
* รายชื่อ GitHub Logins ที่อนุญาต (`ALLOWED_GITHUB_LOGINS`)

---

## 6. โครงสร้าง OAuth 2.0 (OAuth Architecture)

ระบบนี้ใช้ OAuth 2.0 สองชั้น (Two OAuth Layers) เพื่อความปลอดภัยสูงสุด:

```text
┌────────────────────────────────────────────────────────────────────────┐
│ Layer 1: User Authentication (GitHub OAuth App -> MCP Server)          │
│ - GITHUB_CLIENT_ID: ID ของ GitHub OAuth App                            │
│ - GITHUB_CLIENT_SECRET: Secret ของ GitHub OAuth App                    │
│ - ALLOWED_GITHUB_LOGINS: รายชื่อ GitHub User ที่มีสิทธิ์ใช้งาน             │
│ - Callback URL: https://<PUBLIC_BASE_URL>/callback                     │
└────────────────────────────────────────────────────────────────────────┘
                                   │
                                   ▼
┌────────────────────────────────────────────────────────────────────────┐
│ Layer 2: Client Connection (ChatGPT Client -> MCP Server)              │
│ - OAUTH_CLIENT_ID: ID สำหรับ ChatGPT ยิงเข้ามาต่อ                     │
│ - OAUTH_CLIENT_SECRET: Secret สำหรับ ChatGPT                           │
│ - OAUTH_REDIRECT_URIS: Callback URL ของ ChatGPT Connector             │
│   (เช่น https://chatgpt.com/connector/oauth/xxxx)                     │
└────────────────────────────────────────────────────────────────────────┘
```

### Endpoints ตามมาตรฐาน RFC 9728 & OAuth 2.0
* `GET /.well-known/oauth-protected-resource`: คืนค่า Metadata ของ Protected Resource
* `GET /.well-known/oauth-authorization-server`: คืนค่า Metadata ของ Authorization Server
* `GET /authorize`: จุดรับ Authorization request (รองรับ PKCE `S256`)
* `GET /callback`: จุดรับ Callback จาก GitHub เพื่อตรวจสอบ `ALLOWED_GITHUB_LOGINS`
* `POST /token`: จุดออก Access Token เมื่อส่ง `code_verifier` ถูกต้อง

---

## 7. การตั้งค่า Cloudflare Tunnel

สถาปัตยกรรมนี้ใช้ **Cloudflare Tunnel (cloudflared)** ในการส่งต่อ Traffic ไม่ใช่ Cloudflare Workers

### โครงสร้างไฟล์คอนฟิก `cloudflared` (config.yml)
```yaml
ingress:
  - hostname: mcp.your-domain.com
    service: http://127.0.0.1:8789
  - service: http_status:404
```

### การตั้งค่าใน `.env`
```env
PUBLIC_BASE_URL=https://mcp.your-domain.com
CLOUDFLARE_TUNNEL_ENABLED=true
CLOUDFLARED_CONFIG=C:\Users\Administrator\.cloudflared\config.yml
```

---

## 8. รายการ MCP Tools ทั้งหมด (54 Tools)

เซิร์ฟเวอร์เปิดใช้งานเครื่องมือ 54 ตัว ซึ่งแบ่งตามหมวดหมู่ใน `src/tools/registry.ts`:

### 8.1 Workspace & Filesystem Tools (18 Tools)
* `workspace_info`: ดูข้อมูลโครงสร้างพื้นที่ทำงานและโปรไฟล์ที่ตั้งค่าไว้
* `stat`: ตรวจสอบสถานะไฟล์/ไดเรกทอรี
* `stat_many`: ตรวจสอบสถานะไฟล์หลายรายการพร้อมกัน
* `list_dir`: แสดงรายการไฟล์ในไดเรกทอรี
* `tree`: แสดงโครงสร้างต้นไม้ของไดเรกทอรี
* `search`: ค้นหาเนื้อหาภายในไฟล์ด้วย Regex Pattern
* `read_file`: อ่านเนื้อหาในไฟล์
* `read_file_range`: อ่านเนื้อหาในไฟล์เฉพาะบรรทัดที่กำหนด
* `read_many`: อ่านไฟล์หลายรายการพร้อมกัน
* `hash`: คำนวณค่า Hash (SHA-256) ของไฟล์
* `write_file`: เขียนหรือสร้างไฟล์ใหม่
* `apply_patch`: รวมการแก้ไขแบบ Patch (Diff) เข้ากับไฟล์
* `mkdir`: สร้างไดเรกทอรีใหม่
* `copy`: คัดลอกไฟล์/ไดเรกทอรี
* `move`: ย้ายหรือเปลี่ยนชื่อไฟล์/ไดเรกทอรี
* `delete`: ลบไฟล์/ไดเรกทอรี
* `rollback_backup`: ย้อนคืนการแก้ไขไฟล์จาก Backup Snapshot

### 8.2 Git Tools (3 Tools)
* `git_status`: ตรวจสอบสถานะ Working Tree ของ Git
* `git_diff`: แสดงความเปลี่ยนแปลง (Diff) ของไฟล์ใน Git
* `git_commit`: สร้าง Git Commit ในเครื่อง local

### 8.3 Process Tools (7 Tools)
* `process_list`: แสดงรายการ Process ที่กำลังรันในระบบ
* `port_list`: แสดงรายการ TCP Listening Ports
* `wait_for_port`: รอจนกว่า Port ที่ระบุจะเปิดใช้งาน
* `tail_log`: อ่านส่วนท้ายของไฟล์ Log
* `start_process`: เริ่มต้นรัน Process ใหม่ใน Background
* `stop_process`: หยุดการทำงานของ Process
* `process_kill`: บังคับปิด Process ด้วย PID

### 8.4 Shell Tool (1 Tool)
* `shell`: รันคำสั่ง Shell (git-bash/MSYS) บนเครื่อง Windows

### 8.5 Screen Tools (3 Tools)
* `window_list`: แสดงรายการหน้าต่างโปรแกรมที่เปิดอยู่บน Desktop
* `screen_screenshot`: ถ่ายภาพหน้าจอ (Screenshot)
* `screen_ocr`: สกัดข้อความจากภาพหน้าจอด้วย OCR

### 8.6 Desktop Automation Tools (6 Tools)
* `desktop_mouse_position`: อ่านตำแหน่งปัจจุบันของเมาส์
* `desktop_mouse_move`: ขยับพิกัดเมาส์
* `desktop_mouse_click`: คลิกเมาส์ (ซ้าย/ขวา/กลาง/ดับเบิลคลิก)
* `desktop_key_press`: กดปุ่มคีย์บอร์ด
* `desktop_hotkey`: กดปุ่มคีย์บอร์ดแบบผสม (Hotkey เช่น Ctrl+C)
* `desktop_text_type`: พิมพ์ข้อความลงคีย์บอร์ด

### 8.7 Browser Automation Tools (16 Tools)
* `browser_session_create`: สร้างเบราว์เซอร์เซสชันใหม่ (Playwright)
* `browser_session_list`: แสดงรายการเซสชันเบราว์เซอร์ที่เปิดอยู่
* `browser_session_close`: ปิดเบราว์เซอร์เซสชัน
* `browser_cdp_connect`: เชื่อมต่อเบราว์เซอร์ผ่าน Chrome DevTools Protocol (CDP)
* `browser_page_list`: แสดงรายการแท็บหน้าเว็บ
* `browser_page_select`: สลับแท็บหน้าเว็บที่เปิดอยู่
* `browser_navigate`: เปิด URL ในเบราว์เซอร์
* `browser_snapshot`: ดึง DOM Tree / เนื้อหาของหน้าเว็บ
* `browser_console`: อ่าน Console Logs ของเบราว์เซอร์
* `browser_network`: อ่าน Network Requests/Responses
* `browser_wait`: รอองค์ประกอบหน้าเว็บตาม Selector
* `browser_click`: คลิกองค์ประกอบบนหน้าเว็บ
* `browser_fill`: กรอกข้อมูลในฟอร์มหน้าเว็บ
* `browser_type`: พิมพ์ข้อความบนหน้าเว็บ
* `browser_press_key`: กดปุ่มบนหน้าเว็บ
* `browser_screenshot`: ถ่ายภาพหน้าเว็บในเบราว์เซอร์

---

## 9. สิทธิ์การใช้งาน (MCP Scopes)

ระบบจำกัดการเข้าถึงเครื่องมือตาม Scope 10 กลุ่มใน `src/scopes.ts`:

| Scope | คำอธิบาย | หมวดเครื่องมือที่ครอบคลุม |
| :--- | :--- | :--- |
| `mcp:read` | อ่านข้อมูลและสำรวจระบบ | Workspace, Read File, Tree, Stat, Search, Hash |
| `mcp:write` | เขียน เปลี่ยนแปลง หรือลบไฟล์ | Write File, Copy, Mkdir, Move, Rollback Backup |
| `mcp:patch` | ประยุกต์ใช้ไฟล์ Patch | Apply Patch |
| `mcp:delete` | ลบไฟล์และไดเรกทอรี | Delete File |
| `mcp:git` | ตรวจสอบและบันทึก Git | Git Status, Git Diff, Git Commit |
| `mcp:process` | จัดการ Process และ Port | Process List, Start/Stop Process, Port List |
| `mcp:shell` | Exec คำสั่ง Shell | Shell Execution |
| `mcp:screen` | อ่านหน้าจอและ OCR | Window List, Screenshot, Screen OCR |
| `mcp:desktop` | ควบคุม เมาส์/คีย์บอร์ด | Mouse Move/Click, Key Press, Hotkey, Text Type |
| `mcp:browser` | ควบคุมและทดสอบเบราว์เซอร์ | Browser Automation & CDP Attachment |

---

## 10. ระบบความปลอดภัย (Security Model)

> [!WARNING]
> **ระบบนี้ไม่ใช่ OS Sandbox!**  
> เซิร์ฟเวอร์ทำงานด้วยสิทธิ์ของ Windows Account ที่เปิดรันเซิร์ฟเวอร์ หาก Account นั้นสามารถอ่านไฟล์ รันคำสั่ง หรือควบคุมเบราว์เซอร์ใดได้ เครื่องมือที่เปิดให้อาจสามารถเข้าถึงทรัพยากรเหล่านั้นได้เช่นกัน

### มาตรการป้องกันหลายชั้น (Multi-Layer Security)
1. **Host Header Validation:** ป้องกัน DNS Rebinding Attacks
2. **GitHub OAuth Allowlist:** อนุญาตเฉพาะ User ที่มีรายชื่อใน `ALLOWED_GITHUB_LOGINS`
3. **PKCE S256 Enforcement:** บังคับใช้ PKCE สำหรับการแลกเปลี่ยน OAuth Token
4. **Workspace Profile Constraints:** จำกัดการทำงานของไฟล์ให้อยู่เฉพาะไดเรกทอรีที่กำหนด
5. **Secret Deny Globs:** บล็อกการอ่าน/เขียนไฟล์ความลับโดยอัตโนมัติ (เช่น `**/.env`, `**/*secret*`, `**/*token*`, `**/*credential*`)
6. **Command Policy Guards:** กรองการรันคำสั่ง Shell (`workspace_guarded` / `disabled` / `full`)
7. **Audit Journal & Backups:** บันทึกการทำงานทุกครั้งลง `data/journal.jsonl` และสำรองไฟล์ก่อนลบ/แก้ไข

---

## 11. โปรไฟล์พื้นที่ทำงาน (Workspace Profiles)

หากไม่ได้ระบุ `GPT_FS_MCP_WORKSPACE_PROFILES_JSON` ระบบจะสร้างโปรไฟล์เริ่มต้นครอบคลุม Root Drives ที่พบในเครื่อง เช่น `C:\` และ `D:\`

### ตัวอย่างการกำหนด Workspace Profile จำกัดเฉพาะโฟลเดอร์
```json
[
  {
    "name": "my-project",
    "label": "My Test Project",
    "rootPath": "D:\\projects\\my-project",
    "allowedPolicyModes": ["observe", "diagnose", "edit"],
    "backupPolicy": "snapshot",
    "secretDenyGlobs": ["**/.env", "**/*secret*", "**/*token*"]
  }
]
```

---

## 12. ตารางตัวแปรสภาพแวดล้อม (Configuration Variables)

| Variable | หน้าที่ | ตัวอย่าง / ค่าเริ่มต้น | ความปลอดภัย |
| :--- | :--- | :--- | :--- |
| `GPT_FS_MCP_HOST` | IP ที่ใช้ Bind เซิร์ฟเวอร์ | `127.0.0.1` | Local Only |
| `GPT_FS_MCP_PORT` | Port ที่เปิดรับ Connection | `8789` | Standard Port |
| `PUBLIC_BASE_URL` | URL สาธารณะของเซิร์ฟเวอร์ | `https://mcp.your-domain.com` | Match DNS |
| `AUTH_REQUIRED` | บังคับใช้ OAuth Authentication | `true` | Critical |
| `AUTH_REQUIRE_PKCE` | บังคับใช้ PKCE S256 | `true` | High |
| `CLOUDFLARE_TUNNEL_ENABLED` | เปิดใช้งาน Cloudflare Tunnel integration | `true` / `false` | Network |
| `GITHUB_CLIENT_ID` | Client ID ของ GitHub OAuth App | `Ov23li...` | OAuth Identity |
| `GITHUB_CLIENT_SECRET` | Client Secret ของ GitHub OAuth App | `***` | **Secret (Do Not Share)** |
| `ALLOWED_GITHUB_LOGINS` | รายชื่อ GitHub Logins ที่อนุญาต | `tanma2008` | Access Control |
| `OAUTH_CLIENT_ID` | Client ID สำหรับ ChatGPT Connector | `4b5f9d3a-...` | Client Auth |
| `OAUTH_CLIENT_SECRET` | Client Secret สำหรับ ChatGPT Connector | `***` | **Secret (Do Not Share)** |
| `OAUTH_REDIRECT_URIS` | Callback URL ของ ChatGPT Connector | `https://chatgpt.com/connector/oauth/...` | OAuth Redirect |
| `GPT_FS_MCP_MAX_POLICY_MODE` | นโยบายความปลอดภัยสูงสุด | `destructive` / `operate` / `edit` | Security Ceiling |
| `GPT_FS_MCP_SHELL_POLICY` | นโยบายการรันคำสั่ง Shell | `workspace_guarded` / `full` / `disabled` | Command Access |
| `GPT_FS_MCP_PROCESS_POLICY` | นโยบายการจัดการ Process | `workspace_guarded` / `full` / `disabled` | Process Access |

---

## 13. การติดตั้งและโครงสร้างไดเรกทอรี (Installation Details)

### ความแตกต่างระหว่าง โฟลเดอร์ซอร์สโค้ด กับ ไดเรกทอรีทำงานจริง
* **Extracted Source Folder:** โฟลเดอร์ซอร์สโค้ดที่ดาวน์โหลดหรือดึงมาจาก Repository
* **Runtime Install Folder (`%LOCALAPPDATA%\chatgpt-local-agent-mcp`):** โฟลเดอร์ที่สคริปต์ติดตั้งจะคัดลอกไฟล์ไปคอมไพล์ รันเซิร์ฟเวอร์ และเก็บข้อมูลจริง

### สิ่งที่ไม่ควร Commit หรือนำส่งออกสู่อภิปรายสาธารณะ:
* `.env` และ `.env.local`
* `data/` (ไฟล์ `journal.jsonl` และ `backups/`)
* `node_modules/` และ `dist/`
* ไฟล์ `*.log`
* ภาพถ่ายหน้าจอ (Screenshots) และ Artifacts จากเบราว์เซอร์

---

## 14. คำสั่งสำหรับนักพัฒนา (Development Commands)

คำสั่งที่รองรับใน `package.json`:

```powershell
# ติดตั้ง Dependencies
npm ci

# ตรวจสอบ Type ด้วย TypeScript
npm run type-check

# คอมไพล์ TypeScript ไปยัง dist/
npm run build

# รัน Automated Unit Tests
npm test

# เริ่มต้นรัน MCP Server จาก dist/index.js
npm start

# รันในพัฒนา mode (Watch Mode ด้วย tsx)
npm run dev

# Audit ตรวจสอบความปลอดภัยก่อน Publish / Share โฟลเดอร์
npm run audit:publish-safe
```

---

## 15. การแก้ไขปัญหาที่พบบ่อย (Troubleshooting)

### 15.1 ตอบกลับ `{"error":"invalid_request","error_description":"Authorization request is invalid"}` เมื่อยิง `/authorize`
* **สาเหตุ:** `resource` parameter ที่ ChatGPT ส่งเข้ามาไม่ตรงกับ `config.resourceUri` (ซึ่งสร้างจาก `PUBLIC_BASE_URL` ใน `.env`) หรือ `OAUTH_REDIRECT_URIS` ใน `.env` ไม่ตรงกับที่ ChatGPT ส่งมา หรือยังไม่ได้ Restart MCP service หลังอัปเดต `.env`
* **แก้ไข:** ตรวจสอบว่า `PUBLIC_BASE_URL` ใน `.env` ตรงกับ Domain ที่ใช้งานจริง แล้วทำการ Restart MCP Service

### 15.2 `/mcp` ตอบกลับ HTTP `401 Unauthorized`
* **สาเหตุ:** ยิง Request ไปยังจุดส่งสัญญาณ MCP โดยไม่ได้แนบ `Authorization: Bearer <TOKEN>` หรือ Token หมดอายุ
* **แก้ไข:** ทำ OAuth Authorization Flow ผ่าน ChatGPT ให้เสร็จสมบูรณ์ก่อน

### 15.3 Cloudflare ตอบกลับ HTTP `530` Error
* **สาเหตุ:** Cloudflare DNS และ Ingress Rule ชี้ไปยัง Tunnel แต่โปรแกรม `cloudflared` บนเครื่อง Local ไม่ได้รันอยู่ หรือ MCP Server บน Port 8789 ปิดอยู่
* **แก้ไข:** ตรวจสอบว่า Local MCP Server บน Port 8789 ทำงานอยู่ และสั่งรัน `cloudflared tunnel run`

### 15.4 เบราว์เซอร์อัตโนมัติทำงานไม่ได้
* **สาเหตุ:** ยังไม่ได้ติดตั้ง Playwright Browser Binaries
* **แก้ไข:** รันคำสั่ง `npx playwright install` ในโฟลเดอร์ runtime

---

## 16. ข้อจำกัดของ ChatGPT (ChatGPT Limitations)

โปรดทราบว่า MCP Server ทำหน้าที่เปิดเผยและประมวลผลเครื่องมือ (Expose Tools) ตามสิทธิ์ที่ให้ไว้ แต่ **ChatGPT/OpenAI มีระบบความปลอดภัย (Safety & Confirmation Layer) ของตนเอง**:

* การกระทำบางอย่าง (เช่น การเขียนลบไฟล์สำคัญ การกดส่งข้อความ การเข้าถึงหน้าเว็บที่มีการ Login ไว้) ChatGPT อาจขึ้นเตือนให้ผู้ใช้กดยืนยัน (Confirm) บน UI ของ ChatGPT เอง
* การเพิ่มสิทธิ์ใน MCP Server ไม่สามารถข้ามผ่านการบล็อกความปลอดภัยระดับ Platform Layer ของ OpenAI ได้

---

## 17. สถาปัตยกรรมสำหรับ AI Commander (AI Commander Architecture Integration)

*(Planned / Possible Integration)*

โปรเจกต์นี้ได้รับการออกแบบโมดูลาร์เพื่อรองรับการขยายไปสู่สถาปัตยกรรม **AI Commander / Multi-Agent Framework**:

```text
┌────────────────────────────────────────────────────────────────────────┐
│                        AI Commander Gateway                            │
│           (Orchestrator / Multi-Agent Decision Engine)                 │
└────────────────────────────────────────────────────────────────────────┘
                                   │
         ┌─────────────────────────┼─────────────────────────┐
         ▼                         ▼                         ▼
┌─────────────────┐       ┌─────────────────┐       ┌─────────────────┐
│ Local Node MCP  │       │ Remote Worker 1 │       │ Remote Worker 2 │
│ (This Project)  │       │ (Linux Agent)   │       │ (Cloud Agent)   │
└─────────────────┘       └─────────────────┘       └─────────────────┘
```

1. **Stateless Streamable HTTP Compliance:** ทำให้สามารถซ้อน Gateway Proxy ด้านหน้าเพื่อแจกจ่ายงานไปยัง Local Nodes หลายเครื่องได้
2. **Audit Journaling Standard:** โครงสร้าง `journal.jsonl` สามารถส่งต่อเข้าสู่ระบบ Log Centralized Management เพื่อวิเคราะห์พฤติกรรมของ AI Agent ได้

---

## 18. หมายเหตุสำหรับนักพัฒนาและผู้ดูแลระบบ (Developer & Maintainer Notes)

* **สถานะโปรเจกต์:** โปรเจกต์นี้เป็นซอฟต์แวร์ open-source (MIT License) ในลักษณะ DIY (Do-It-Yourself)
* **การใช้งานอย่างระมัดระวัง:** ตรวจสอบการตั้งค่าสิทธิ์ Scopes, Workspace Profiles และการเปิด Tunnel เสมอเพื่อความปลอดภัยของข้อมูลในเครื่อง
* **AI-Assisted Development:** โปรเจกต์นี้พัฒนาและออกแบบโดยมีการสนับสนุนจากเครื่องมือ AI ในกระบวนการเขียนโค้ด ตรวจสอบ และทำเอกสารประกอบ

---

## สิทธิบัตรและสัญญาอนุญาต (License)

MIT License - อ่านรายละเอียดเพิ่มเติมได้ในไฟล์ [LICENSE](LICENSE)
