# Shora Hub Store

เว็บขายโปรและระบบ License Key พร้อม Discord login, เติมเครดิตด้วยซอง TrueMoney, ระบบหลังบ้าน, และ loader สำหรับเช็กคีย์/HWID

## Run Local

```powershell
npm.cmd start
```

เปิดเว็บที่ `http://localhost:3000`

หน้า Admin: `http://localhost:3000/admin`

ตั้งค่า env โดยคัดลอก `.env.example` เป็น `.env` แล้วแก้ค่าจริงก่อนรัน

## Netlify

โปรเจกต์นี้ deploy ผ่าน Netlify Functions ได้แล้ว

- Build command: `npm run build:netlify`
- Publish directory: `dist`
- Functions directory: `netlify/functions`

ต้องตั้งค่า Environment Variables ใน Netlify:

- `ADMIN_TOKEN`
- `SESSION_SECRET`
- `AUTO_ISSUE_KEYS`
- `TRUEMONEY_RECEIVER_PHONE`
- `DISCORD_CLIENT_ID`
- `DISCORD_CLIENT_SECRET`
- `DISCORD_REDIRECT_URI`
- `COOKIE_SECURE`
- `PUBLIC_BASE_URL`
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `SCRIPT_SOURCE_FILE`
- `SCRIPT_KEY_PREFIX`

Discord OAuth redirect สำหรับเว็บจริง:

```text
https://shora-hub.netlify.app/auth/discord/callback
```

## Script Loader

ตัวอย่างสำหรับลูกค้า:

```lua
getgenv().Key = "SHORA-XXXX-XXXX-XXXXX-XXXX-XXXXX-XXXX"
getgenv().id = "1021433794705768518"
loadstring(game:HttpGet("https://shora-hub.netlify.app/loader.lua"))()
```

## Security Notes

ห้าม commit ไฟล์ `.env`, `data/store.json`, `.netlify`, `dist`, `tmp`, หรือ log ขึ้น GitHub

สำหรับ production ควรใช้ Supabase เป็นแหล่งข้อมูลหลัก เพราะ Netlify Functions มี filesystem ชั่วคราวและไม่เหมาะกับการเก็บ order/key แบบถาวรในไฟล์ local
