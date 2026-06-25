# Zain Bot Tutorial 🤖

Bot WhatsApp sederhana menggunakan Baileys.

## Fitur

- Login WhatsApp dengan QR
- Support command `.js`
- Support command `.mjs`
- Auto load folder `commands/`
- Struktur bot modular

## Install

Pastikan sudah install:

- Node.js
- Git
- @barz-dev/baileys

kalau belum:
```bash
pkg install nodejs
pkg install git
npm install @barz-dev/baileys

Clone repo:

```bash
git clone https://github.com/justemirz/bot-whatsapp.git
```

Masuk folder:

```bash
cd bot-whatsapp
```

Install dependency:

```bash
npm install
```

Buat file environment:

```bash
cp .env.example .env
```

Edit:

```bash
nano .env
```

Isi sesuai akun kamu.

## Jalankan Bot

```bash
node index.js
```

Scan QR WhatsApp atau pairing code.

Jika berhasil:

```txt
Bot Connected!
```

## Membuat Command Baru

Buat file di folder:

```txt
commands/
```

Contoh:

```txt
commands/ping.js
```

Isi:

```javascript
export const ping = {
  command: ["ping"],

  run: async ({ reply }) => {
    await reply("pong!");
  }
};
```

Simpan, lalu restart bot.

## Struktur Folder

```txt
bot-tutor/
├── index.js
├── commands/
│   └── ping.js
├── lib/
├── .env
├── .env.example
├── package.json
└── package-lock.json
```

## Catatan

Jangan upload:

- `.env`
- folder `session/`
- `node_modules/`

File tersebut berisi data pribadi dan tidak diperlukan di GitHub.

## Credits

Created by Emir / Zain Bot
