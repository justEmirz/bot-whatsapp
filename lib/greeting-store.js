const fs = require('fs');
const path = require('path');

const STORE_DIR = path.join(process.cwd(), 'data');
const STORE_FILE = path.join(STORE_DIR, 'greetings.json');

function ensureStoreDir() {
    if (!fs.existsSync(STORE_DIR)) {
        fs.mkdirSync(STORE_DIR, { recursive: true });
    }
}

function loadStore() {
    try {
        ensureStoreDir();
        if (!fs.existsSync(STORE_FILE)) return {};
        const raw = fs.readFileSync(STORE_FILE, 'utf8');
        return raw ? JSON.parse(raw) : {};
    } catch (err) {
        console.error('❌ Failed to load greeting store:', err.message);
        return {};
    }
}

function saveStore(store) {
    ensureStoreDir();
    fs.writeFileSync(STORE_FILE, JSON.stringify(store, null, 2));
}

function ensureGroup(store, groupId) {
    if (!store[groupId]) {
        store[groupId] = {
            welcome: { enabled: false, text: '', image: '' },
            goodbye: { enabled: false, text: '', image: '' }
        };
    }
    if (!store[groupId].welcome) {
        store[groupId].welcome = { enabled: false, text: '', image: '' };
    }
    if (!store[groupId].goodbye) {
        store[groupId].goodbye = { enabled: false, text: '', image: '' };
    }

    return store[groupId];
}

function normalizeUrlOrPath(value) {
    return String(value || '').trim();
}

function resolveTemplate(template, context) {
    const map = {
        '{name}': context.name || '',
        '{group}': context.group || '',
        '{count}': String(context.count ?? ''),
        '{number}': context.number || ''
    };

    return String(template || '')
        .replace(/\{name\}|\{group\}|\{count\}|\{number\}/g, match => map[match] ?? match)
        .trim();
}

function getEntry(store, groupId, kind) {
    const group = ensureGroup(store, groupId);
    return group[kind];
}

function setEnabled(store, groupId, kind, enabled) {
    const entry = getEntry(store, groupId, kind);
    entry.enabled = Boolean(enabled);
    return entry;
}

function setText(store, groupId, kind, text) {
    const entry = getEntry(store, groupId, kind);
    entry.text = String(text || '').trim();
    return entry;
}

function setImage(store, groupId, kind, image) {
    const entry = getEntry(store, groupId, kind);
    entry.image = normalizeUrlOrPath(image);
    return entry;
}

function resetKind(store, groupId, kind) {
    const entry = getEntry(store, groupId, kind);
    entry.enabled = false;
    entry.text = '';
    entry.image = '';
    return entry;
}

module.exports = {
    STORE_FILE,
    loadStore,
    saveStore,
    ensureGroup,
    getEntry,
    setEnabled,
    setText,
    setImage,
    resetKind,
    resolveTemplate
};
