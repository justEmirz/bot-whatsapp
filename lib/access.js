const { isOperator } = require('./operator-store');

function normalizeNumber(value) {
    return String(value || '').replace(/\D/g, '');
}

function getAdminNumbers() {
    const raw = [
        process.env.ADMIN_NUMBERS,
        process.env.ADMIN_NUMBER,
        process.env.OWNER,
        process.env.PHONE_NUMBER
    ]
        .filter(Boolean)
        .join(',');

    return new Set(
        raw
            .split(/[\s,]+/)
            .map(normalizeNumber)
            .filter(Boolean)
    );
}

function isWhitelistedAdmin(jid) {
    const target = normalizeNumber(jid);
    if (!target) return false;
    return getAdminNumbers().has(target) || isOperator(target);
}

module.exports = {
    normalizeNumber,
    getAdminNumbers,
    isWhitelistedAdmin
};
