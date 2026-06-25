require('dotenv').config();
const { default: makeWASocket, useMultiFileAuthState, DisconnectReason } = require('@barz-dev/baileys');
const fs = require('fs');
const path = require('path');
const pino = require('pino');

// Import Helper & Store
const { panel } = require('./lib/ui');
const { loadStore, saveStore, ensureGroup, setEnabled } = require('./lib/greeting-store');
const { buildGreetingPayload } = require('./lib/greeting-utils');
const { loadAfkStore, getAfkUser, clearAfkUser } = require('./lib/afk-store');

// Konfigurasi dari .env
const PREFIX = process.env.BOT_PREFIX || '!';
const SEND_DELAY_MS = 1000;

// Daftar Grup Welcome/Goodbye
const WELCOME_GROUPS = new Set(
    String(process.env.WELCOME_GROUPS || '')
        .split(/[\s,]+/)
        .map(v => v.trim())
        .filter(Boolean)
);
const GOODBYE_GROUPS = new Set(
    String(process.env.GOODBYE_GROUPS || '')
        .split(/[\s,]+/)
        .map(v => v.trim())
        .filter(Boolean)
);

const commandHandlers = new Map();
const sendQueues = new Map();

/**
 * ============================================================
 * ESM PLUGIN LOADER - Support .mjs files dengan dynamic import
 * ============================================================
 */

/**
 * Load plugin dan return command function/module
 * Supports:
 * - CommonJS (.js): module.exports = function(...) { }
 * - CommonJS (.js): module.exports = { run: function(...) { }, command: [...] }
 * - ESM (.mjs): export default function(...) { }
 * - ESM (.mjs): export { pluginName } where pluginName has .run property
 * - ESM (.mjs): export { kyuSukaZyra } (named export pattern)
 * - ESM (.mjs): export { command: ['cmd'], run: fn }
 */
function loadPlugin(fullPath) {
    if (fullPath.endsWith('.mjs')) {
        // ESM loader dengan dynamic import
        return import(fullPath).then(mod => {
            // Case 1: export default is a function
            if (typeof mod.default === 'function') {
                return { type: 'function', handler: mod.default };
            }
            // Case 2: export default has .run property (object-style plugin)
            if (mod.default && typeof mod.default.run === 'function') {
                return { type: 'object', obj: mod.default };
            }
            // Case 3: named export where value is a function
            for (const [key, value] of Object.entries(mod)) {
                if (key !== 'default' && typeof value === 'function') {
                    return { type: 'function', handler: value };
                }
            }
            // Case 4: named export where value has .run property (like kyuSukaZyra)
            for (const [key, value] of Object.entries(mod)) {
                if (key !== 'default' && value && typeof value.run === 'function') {
                    return { type: 'object', obj: value };
                }
            }
            // Case 5: default export is an object
            if (typeof mod.default === 'object' && mod.default !== null) {
                return { type: 'object', obj: mod.default };
            }
            return null;
        }).catch(err => {
            console.error(`❌ ESM Load Error ${fullPath}:`, err.message);
            return null;
        });
    } else {
        // CommonJS loader
        try {
            const cmdModule = require(fullPath);
            if (typeof cmdModule === 'function') {
                return Promise.resolve({ type: 'function', handler: cmdModule });
            }
            if (typeof cmdModule === 'object' && cmdModule !== null) {
                return Promise.resolve({ type: 'object', obj: cmdModule });
            }
            return Promise.resolve(null);
        } catch (err) {
            console.error(`❌ CJS Load Error ${fullPath}:`, err.message);
            return Promise.resolve(null);
        }
    }
}

/**
 * Create a handler function from object-style plugin
 * Converts { run: fn, command: ['cmd'], ... } to legacy handler signature
 */
function createObjectHandler(obj) {
    return async (sock, from, cmd, text, prefix, msg) => {
        try {
            const body = text;
            const args = text ? text.split(' ') : [];

            // Create compatible message object for plugins
            const m = {
                sock,
                from,
                text: body,
                args,
                usedPrefix: prefix,
                command: cmd,
                message: msg,
                reply: (content) => sock.sendMessage(from, { text: String(content) }),
                replyWithMentions: (content, mentions) => sock.sendMessage(from, {
                    text: String(content),
                    mentions: mentions || []
                })
            };

            if (typeof obj.run === 'function') {
                await obj.run(m, {
                    args: m.args,
                    query: body,
                    usedPrefix: prefix,
                    command: cmd,
                    from,
                    sock
                });
            }
        } catch (err) {
            console.error(`[OBJECT HANDLER ERROR] ${cmd}:`, err.message);
        }
    };
}

/**
 * Register command handlers based on plugin loaded
 */
function registerCommandHandlers(fullPath, result) {
    if (!result) return;

    const ext = path.extname(fullPath);
    const baseName = path.basename(fullPath, ext);
    const isAdminFolder = fullPath.includes(`${path.sep}admin${path.sep}`);

    if (result.type === 'function') {
        // Function-based command (legacy style)
        if (isAdminFolder) {
            ['kick', 'promote', 'demote', 'linkgc', 'hidetag', 'botstatus', 'add', 'leave'].forEach(name => {
                commandHandlers.set(name, result.handler);
            });
        } else if (baseName === 'sticker') {
            ['sticker', 's', 'stiker', 'stick'].forEach(n => commandHandlers.set(n, result.handler));
        } else if (baseName === 'rvo') {
            commandHandlers.set('rvo', result.handler);
            commandHandlers.set('readviewonce', result.handler);
        } else if (baseName === 'asupan') {
            commandHandlers.set('asupan', result.handler);
        } else if (baseName === 'cekkhodam') {
            commandHandlers.set('cekkhodam', result.handler);
            commandHandlers.set('khodam', result.handler);
        } else if (baseName === 'greetings') {
            ['setwelcome', 'setgoodbye', 'test'].forEach(n => commandHandlers.set(n, result.handler));
        } else if (baseName === 'afk') {
            commandHandlers.set('afk', result.handler);
        } else if (baseName === 'tagall') {
            commandHandlers.set('tagall', result.handler);
        } else if (baseName === 'jadibot') {
            commandHandlers.set('jadibot', result.handler);
        } else if (baseName === 'vt') {
            commandHandlers.set('vt', result.handler);
            commandHandlers.set('tiktok', result.handler);
        } else {
            commandHandlers.set(baseName, result.handler);
        }
    } else if (result.type === 'object') {
        // Object-based command (new style with .command, .run, etc.)
        const obj = result.obj;

        // Register by .command array if present
        if (Array.isArray(obj.command)) {
            obj.command.forEach(name => {
                commandHandlers.set(name.toLowerCase(), createObjectHandler(obj));
            });
        }

        // Also register by filename (avoid duplicates)
        if (isAdminFolder) {
            ['kick', 'promote', 'demote', 'linkgc', 'hidetag', 'botstatus', 'add', 'leave'].forEach(name => {
                if (!commandHandlers.has(name)) {
                    commandHandlers.set(name, createObjectHandler(obj));
                }
            });
        } else if (baseName === 'sticker') {
            ['sticker', 's', 'stiker', 'stick'].forEach(n => {
                if (!commandHandlers.has(n)) commandHandlers.set(n, createObjectHandler(obj));
            });
        } else if (baseName === 'rvo') {
            if (!commandHandlers.has('rvo')) commandHandlers.set('rvo', createObjectHandler(obj));
            if (!commandHandlers.has('readviewonce')) commandHandlers.set('readviewonce', createObjectHandler(obj));
        } else if (baseName === 'cekkhodam') {
            if (!commandHandlers.has('cekkhodam')) commandHandlers.set('cekkhodam', createObjectHandler(obj));
            if (!commandHandlers.has('khodam')) commandHandlers.set('khodam', createObjectHandler(obj));
        } else if (baseName === 'greetings') {
            ['setwelcome', 'setgoodbye', 'test'].forEach(n => {
                if (!commandHandlers.has(n)) commandHandlers.set(n, createObjectHandler(obj));
            });
        } else if (!Array.isArray(obj.command)) {
            // Only register by filename if no .command array defined
            if (!commandHandlers.has(baseName)) {
                commandHandlers.set(baseName, createObjectHandler(obj));
            }
        }
    }
}

/**
 * ============================================================
 * LOAD COMMANDS - Async untuk support ESM
 * ============================================================
 */
async function loadCommands(dir) {
    if (!fs.existsSync(dir)) {
        console.log(`⚠️ Commands directory not found: ${dir}`);
        return;
    }

    const files = fs.readdirSync(dir);
    const loadPromises = [];

    for (const file of files) {
        const fullPath = `${dir}/${file}`;

        // Handle directories
        if (fs.statSync(fullPath).isDirectory()) {
            if (file === 'admin') {
                // Special handling for admin folder - load index.js
                const adminHandlerPath = `${fullPath}/index.js`;
                if (fs.existsSync(adminHandlerPath)) {
                    const result = await loadPlugin(adminHandlerPath);
                    if (result) {
                        console.log(`✅ Loaded Admin Handler from ${adminHandlerPath}`);
                        registerCommandHandlers(adminHandlerPath, result);
                    }
                }
                // Also check for .mjs admin handler
                const adminMjsPath = `${fullPath}/index.mjs`;
                if (fs.existsSync(adminMjsPath)) {
                    const result = await loadPlugin(adminMjsPath);
                    if (result) {
                        console.log(`✅ Loaded Admin ESM Handler from ${adminMjsPath}`);
                        registerCommandHandlers(adminMjsPath, result);
                    }
                }
            } else {
                await loadCommands(fullPath);
            }
            continue;
        }

        // Support both .js (CommonJS) and .mjs (ESM)
        if (!file.endsWith('.js') && !file.endsWith('.mjs')) continue;

        // Skip root index.js in commands folder
        if (dir === './commands' && file === 'index.js') continue;

        const loadPromise = loadPlugin(fullPath).then(result => {
            if (result) {
                const ext = path.extname(fullPath);
                const baseName = path.basename(fullPath, ext);
                console.log(`✅ Loaded: ${baseName}${ext} (${result.type})`);
                registerCommandHandlers(fullPath, result);
            }
        });

        loadPromises.push(loadPromise);
    }

    await Promise.all(loadPromises);
}

/**
 * ============================================================
 * HELPER FUNCTIONS
 * ============================================================
 */

/**
 * Enhanced extractText - support nested message types and self-messages
 */
function extractText(message, seen = new Set(), depth = 0) {
    if (!message || typeof message !== 'object' || depth > 10 || seen.has(message)) return '';
    seen.add(message);

    // Direct text fields - most common
    const candidates = [
        // Primary text fields
        message.conversation,
        message.extendedTextMessage?.text,
        message.imageMessage?.caption,
        message.videoMessage?.caption,
        message.documentMessage?.caption,
        message.audioMessage?.url,
        // Response message types
        message.buttonsResponseMessage?.selectedButtonId,
        message.listResponseMessage?.singleSelectReply?.selectedRowId,
        message.templateButtonReplyMessage?.selectedId,
        // Self-message format (device sync / multi-device)
        message.deviceSentMessage?.message?.conversation,
        message.deviceSentMessage?.message?.extendedTextMessage?.text,
        message.deviceHistoryMessage?.message?.conversation,
        message.deviceHistoryMessage?.message?.extendedTextMessage?.text,
    ];

    for (const value of candidates) {
        if (typeof value === 'string' && value.trim()) {
            return value.trim();
        }
    }

    // Wrapper types - recurse into nested messages
    const wrappers = [
        // Standard wrappers
        message.ephemeralMessage?.message,
        message.viewOnceMessage?.message,
        message.viewOnceMessageV2?.message,
        message.viewOnceMessageV2Extension?.message,
        // Self-message wrapper
        message.deviceSentMessage?.message,
        message.deviceHistoryMessage?.message,
        // Edit message
        message.message?.message,
        // Protocol message
        message.protocolMessage?.message,
    ];

    for (const nested of wrappers) {
        if (nested && typeof nested === 'object') {
            const text = extractText(nested, seen, depth + 1);
            if (text) return text;
        }
    }

    // Try to find any string property that looks like text
    const textProps = ['text', 'body', 'content', 'caption'];
    for (const prop of textProps) {
        const val = message[prop];
        if (typeof val === 'string' && val.trim()) {
            return val.trim();
        }
        // Also try nested in the same prop
        const nestedVal = message[prop]?.text || message[prop]?.body;
        if (typeof nestedVal === 'string' && nestedVal.trim()) {
            return nestedVal.trim();
        }
    }

    return '';
}

function normalizeText(text) {
    return String(text || '')
        .replace(/^[\u200b-\u200f\uFEFF]+/, '')
        .replace(/\u200e/g, '')
        .trim();
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

function normalizeJid(jid) {
    return String(jid || '').replace(/:.*$/, '').split('@')[0];
}

function extractMentionedJids(msg) {
    const contextInfos = [
        msg?.message?.extendedTextMessage?.contextInfo,
        msg?.message?.imageMessage?.contextInfo,
        msg?.message?.videoMessage?.contextInfo,
        msg?.message?.documentMessage?.contextInfo
    ].filter(Boolean);

    const mentioned = [];
    for (const ctx of contextInfos) {
        if (Array.isArray(ctx.mentionedJid)) mentioned.push(...ctx.mentionedJid);
        if (ctx.participant) mentioned.push(ctx.participant);
    }
    return [...new Set(mentioned.map(normalizeJid).filter(Boolean))];
}

function formatAfkDuration(since) {
    const elapsed = Math.max(0, Math.floor((Date.now() - Number(since || Date.now())) / 1000));
    const hours = Math.floor(elapsed / 3600);
    const minutes = Math.floor((elapsed % 3600) / 60);
    const seconds = elapsed % 60;
    const parts = [];
    if (hours) parts.push(`${hours}h`);
    if (minutes) parts.push(`${minutes}m`);
    if (!hours && !minutes) parts.push(`${seconds}s`);
    return parts.join(' ');
}

function seedGreetingGroups(store) {
    let changed = false;
    for (const groupId of WELCOME_GROUPS) {
        if (!store[groupId]) {
            ensureGroup(store, groupId);
            setEnabled(store, groupId, 'welcome', true);
            changed = true;
        }
    }
    for (const groupId of GOODBYE_GROUPS) {
        if (!store[groupId]) {
            ensureGroup(store, groupId);
            setEnabled(store, groupId, 'goodbye', true);
            changed = true;
        }
    }
    if (changed) saveStore(store);
}

/**
 * Queued send message - prevent spam
 */
function createQueuedSendMessage(sock) {
    const rawSendMessage = sock.sendMessage.bind(sock);

    return async (jid, content, options) => {
        const previous = sendQueues.get(jid) || Promise.resolve();
        const next = previous
            .catch(() => {})
            .then(async () => {
                if (Number.isFinite(SEND_DELAY_MS) && SEND_DELAY_MS > 0) {
                    await sleep(SEND_DELAY_MS);
                }
                return rawSendMessage(jid, content, options);
            });

        sendQueues.set(
            jid,
            next.finally(() => {
                if (sendQueues.get(jid) === next) {
                    sendQueues.delete(jid);
                }
            })
        );

        return next;
    };
}

/**
 * ============================================================
 * MAIN BOT FUNCTION
 * ============================================================
 */
async function startBot() {
    commandHandlers.clear();
    await loadCommands('./commands');
    console.log(`🚀 Total ${commandHandlers.size} command routes loaded.`);

    const greetingStore = loadStore();
    const afkStore = loadAfkStore();
    seedGreetingGroups(greetingStore);

    const { state, saveCreds } = await useMultiFileAuthState('session');

    const sock = makeWASocket({
        auth: state,
        printQRInTerminal: false, // Kita pakai Pairing Code
        logger: pino({ level: 'silent' })
    });

    // Override sendMessage with queued version
    sock.sendMessage = createQueuedSendMessage(sock);

    // Save credentials
    sock.ev.on('creds.update', saveCreds);

    // --- LOGIKA PAIRING CODE ---
    let isPairingCodeRequested = false;

    sock.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect, qr } = update;

        if (connection === 'open') {
            console.log('✅ Bot Connected!');
            isPairingCodeRequested = false; // Reset untuk reconnect
        } else if (connection === 'close') {
            const statusCode = lastDisconnect?.error?.output?.statusCode;
            const reason = lastDisconnect?.error?.output?.payload?.message || lastDisconnect?.error?.message || 'unknown';
            const isConflict = statusCode === 440 || String(reason).toLowerCase().includes('conflict');

            console.log('Connection closed due to', reason);

            if (isConflict) {
                console.log('⚠️ Session conflict detected. Stop other bot instance or logout other device.');
                return;
            }

            if (statusCode !== DisconnectReason.loggedOut) {
                startBot();
            }
        }

        // Fallback: request pairing code if connection is connecting
        if (connection === 'connecting' && !isPairingCodeRequested) {
            setTimeout(async () => {
                if (!sock.authState?.creds?.me && !isPairingCodeRequested) {
                    await requestPairingCode(sock);
                }
            }, 3000);
        }
    });

    // Pairing code request function
    async function requestPairingCode(sockInstance) {
        if (isPairingCodeRequested) return;
        isPairingCodeRequested = true;

        const phoneNumber = process.env.PHONE_NUMBER;

        if (!phoneNumber) {
            console.error('❌ PHONE_NUMBER tidak ditemukan di .env!');
            return;
        }

        console.log(`\n⏳ Requesting Pairing Code for ${phoneNumber}...`);

        try {
            const code = await sockInstance.requestPairingCode(phoneNumber);
            console.log(`\n🔑 PAIRING CODE: ${code}`);
            console.log('--- PENTING ---');
            console.log('1. Buka WhatsApp > Menu > Perangkat Tertaut.');
            console.log('2. Klik "Tautkan dengan Nomor Telepon".');
            console.log(`3. Masukkan kode: ${code}`);
            console.log('---------------\n');
        } catch (err) {
            console.error('❌ Gagal request Pairing Code:', err.message);
            isPairingCodeRequested = false; // Reset untuk retry
        }
    }

    // Request pairing code on creds update if not logged in
    sock.ev.on('creds.update', async () => {
        if (!sock.authState?.creds?.me && !isPairingCodeRequested) {
            await requestPairingCode(sock);
        }
    });

    // --- MESSAGE HANDLER ---
    sock.ev.on('messages.upsert', async (chatUpdate) => {
        try {
            const { messages, type } = chatUpdate;
            if (!messages?.length) return;

            const msg = messages[0];
            const msgKey = msg?.key;

            // Debug logging
            console.log(`[MSG] type=${type || 'unknown'} count=${messages.length}`);
            console.log(`[DBG] fromMe=${msgKey?.fromMe} remoteJid=${msgKey?.remoteJid}`);
            console.log(`[DBG] messageKeys=${Object.keys(msg?.message || {}).join(', ')}`);

            if (!msg?.message) {
                console.log('[DBG] Skip: no message object');
                return;
            }

            const from = msgKey.remoteJid;
            const sender = msgKey.participant || from;
            const fromMe = msgKey.fromMe === true;

            // FIXED: Proses semua pesan, termasuk self-messages (fromMe=true)
            // HAPUS: if (msg.key.fromMe) return; <- Ini menyebabkan self-chat tidak jalan

            // Extract message body
            let body = normalizeText(extractText(msg.message));

            // Fallback for wrapped messages
            if (!body) {
                const protoMsg = msg.message?.protocolMessage;
                if (protoMsg) {
                    body = normalizeText(extractText(protoMsg));
                }
            }

            console.log(`[DBG] body="${body}" fromMe=${fromMe}`);

            if (!body) {
                console.log('[DBG] Skip: empty body');
                return;
            }

            const senderKey = normalizeJid(sender);
            const mentionedJids = extractMentionedJids(msg);
            const senderAfk = getAfkUser(afkStore, senderKey);

            // Check prefix
            if (!body.startsWith(PREFIX)) {
                // AFK Mention - only for non-self messages
                if (!fromMe && mentionedJids.length) {
                    const afkMentions = mentionedJids
                        .map(jid => ({ jid, entry: getAfkUser(afkStore, jid) }))
                        .filter(item => item.entry);

                    if (afkMentions.length) {
                        await sock.sendMessage(from, {
                            text: panel({
                                title: '🌙 AFK Mention',
                                subtitle: 'Ada member sedang AFK',
                                lines: afkMentions.map(item =>
                                    `@${item.jid} - ${item.entry.reason || 'Sedang AFK'} (${formatAfkDuration(item.entry.since)})`
                                ),
                                footer: 'Jangan spam mention'
                            }),
                            mentions: afkMentions.map(item => `${item.jid}@s.whatsapp.net`)
                        });
                    }
                }
                return;
            }

            // Parse command
            const fullCmd = normalizeText(body.slice(PREFIX.length));
            const args = fullCmd.split(/ +/);
            const cmd = args[0].toLowerCase();
            const text = normalizeText(args.slice(1).join(' '));

            if (!cmd) return;

            console.log(`✅ [CMD] fromMe=${fromMe} cmd=${cmd} | from=${from} | text="${text}"`);
            console.log(`[DBG] Available commands: ${[...commandHandlers.keys()].slice(0, 10).join(', ')}...`);

            const commandFunc = commandHandlers.get(cmd);
            if (!commandFunc) {
                console.log(`⚠️ Unknown command: ${cmd}`);
                return;
            }

            try {
                await commandFunc(sock, from, cmd, text, PREFIX, msg);

                // Clear AFK - only for non-self messages
                if (!fromMe && senderAfk && cmd.toLowerCase() !== 'afk') {
                    clearAfkUser(afkStore, senderKey);
                    await sock.sendMessage(from, {
                        text: panel({
                            title: '🌙 AFK',
                            subtitle: 'Selamat datang kembali',
                            lines: ['Status AFK kamu otomatis dimatikan.'],
                            footer: 'AFK cleared'
                        })
                    });
                }
            } catch (err) {
                console.error(`[ERROR] Command ${cmd}:`, err.message);
            }
        } catch (err) {
            console.error('[HANDLER ERROR]', err);
        }
    });

    // --- GROUP PARTICIPANTS UPDATE (Welcome/Goodbye) ---
    sock.ev.on('group-participants.update', async (update) => {
        try {
            const groupId = update.id;
            const action = update.action;
            const participants = update.participants || [];

            if (!groupId || !participants.length) return;

            const store = loadStore();
            const groupEntry = ensureGroup(store, groupId);

            const isWelcomeActive = WELCOME_GROUPS.has(groupId) || groupEntry.welcome.enabled;
            const isGoodbyeActive = GOODBYE_GROUPS.has(groupId) || groupEntry.goodbye.enabled;

            if ((action === 'add' && isWelcomeActive) || (action === 'remove' && isGoodbyeActive)) {
                const groupMetadata = await sock.groupMetadata(groupId);
                const groupName = groupMetadata.subject;

                for (const participant of participants) {
                    const type = action === 'add' ? 'welcome' : 'goodbye';
                    const entry = type === 'welcome' ? groupEntry.welcome : groupEntry.goodbye;

                    const payload = buildGreetingPayload({
                        kind: type,
                        groupMetadata,
                        participantJid: participant,
                        entry,
                        count: groupMetadata.participants.length
                    });

                    await sock.sendMessage(groupId, {
                        ...(payload.image ? { image: payload.image } : {}),
                        caption: payload.caption,
                        mentions: [participant]
                    });
                }
            }
        } catch (err) {
            console.error('[GROUP UPDATE ERROR]', err);
        }
    });
}

// Start the bot
startBot().catch(console.error);