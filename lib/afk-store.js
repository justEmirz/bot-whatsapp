const fs = require('fs');
const path = require('path');

const STORE_DIR = path.join(process.cwd(), 'data');
const STORE_FILE = path.join(STORE_DIR, 'afk.json');

function ensureStoreDir() {
    if (!fs.existsSync(STORE_DIR)) {
        fs.mkdirSync(STORE_DIR, { recursive: true });
    }
}

function loadAfkStore() {
    try {
        ensureStoreDir();
        if (!fs.existsSync(STORE_FILE)) return {};
        const raw = fs.readFileSync(STORE_FILE, 'utf8');
        return raw ? JSON.parse(raw) : {};
    } catch (err) {
        console.error('❌ Failed to load AFK store:', err.message);
        return {};
    }
}

function saveAfkStore(store) {
    ensureStoreDir();
    fs.writeFileSync(STORE_FILE, JSON.stringify(store, null, 2));
}

function normalizeJid(jid) {
    return String(jid || '').replace(/:.*$/, '').split('@')[0];
}

function getAfkUser(store, jid) {
    const target = normalizeJid(jid);
    if (!target) return null;
    return store[target] || null;
}

function setAfkUser(store, jid, reason = '') {
    const target = normalizeJid(jid);
    if (!target) return null;

    store[target] = {
        reason: String(reason || '').trim(),
        since: Date.now()
    };

    saveAfkStore(store);
    return store[target];
}

function clearAfkUser(store, jid) {
    const target = normalizeJid(jid);
    if (!target || !store[target]) return null;

    const entry = store[target];
    delete store[target];
    saveAfkStore(store);
    return entry;
}

function listAfkUsers(store) {
    return Object.entries(store || {}).map(([jid, entry]) => ({ jid, ...entry }));
}

module.exports = {
    STORE_FILE,
    loadAfkStore,
    saveAfkStore,
    getAfkUser,
    setAfkUser,
    clearAfkUser,
    listAfkUsers,
    normalizeJid
};
