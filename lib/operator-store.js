const fs = require('fs');
const path = require('path');

const STORE_DIR = path.join(process.cwd(), 'data');
const STORE_FILE = path.join(STORE_DIR, 'operators.json');

function ensureStoreDir() {
    if (!fs.existsSync(STORE_DIR)) {
        fs.mkdirSync(STORE_DIR, { recursive: true });
    }
}

function normalizeNumber(value) {
    return String(value || '').replace(/\D/g, '');
}

function loadOperators() {
    try {
        ensureStoreDir();
        if (!fs.existsSync(STORE_FILE)) return [];
        const raw = fs.readFileSync(STORE_FILE, 'utf8');
        const parsed = raw ? JSON.parse(raw) : [];
        return Array.isArray(parsed) ? parsed : [];
    } catch (err) {
        console.error('❌ Failed to load operator store:', err.message);
        return [];
    }
}

function saveOperators(operators) {
    ensureStoreDir();
    fs.writeFileSync(STORE_FILE, JSON.stringify([...new Set(operators)], null, 2));
}

function listOperators() {
    return loadOperators().map(normalizeNumber).filter(Boolean);
}

function addOperator(jid) {
    const number = normalizeNumber(jid);
    if (!number) return false;

    const current = new Set(listOperators());
    current.add(number);
    saveOperators([...current]);
    return true;
}

function removeOperator(jid) {
    const number = normalizeNumber(jid);
    if (!number) return false;

    const current = listOperators().filter(item => item !== number);
    saveOperators(current);
    return true;
}

function isOperator(jid) {
    const number = normalizeNumber(jid);
    if (!number) return false;
    return listOperators().includes(number);
}

module.exports = {
    STORE_FILE,
    loadOperators,
    saveOperators,
    listOperators,
    addOperator,
    removeOperator,
    isOperator,
    normalizeNumber
};
