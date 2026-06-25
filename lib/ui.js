function titleCase(text) {
    return String(text || '')
        .trim()
        .split(/\s+/)
        .filter(Boolean)
        .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
        .join(' ');
}

function truncate(text, max = 120) {
    const value = String(text || '');
    if (value.length <= max) return value;
    return `${value.slice(0, Math.max(0, max - 1)).trimEnd()}…`;
}

function formatDuration(totalSeconds) {
    const seconds = Math.max(0, Math.floor(totalSeconds || 0));
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;

    const parts = [];
    if (days) parts.push(`${days}d`);
    if (hours) parts.push(`${hours}h`);
    if (minutes) parts.push(`${minutes}m`);
    parts.push(`${secs}s`);
    return parts.join(' ');
}

function panel({ title, subtitle, lines = [], footer = 'Zain Bot' }) {
    const body = Array.isArray(lines) ? lines.filter(Boolean).join('\n') : String(lines || '');
    const normalizedBody = body
        ? body.split('\n').map(line => `│ ✦ ${line}`).join('\n')
        : '│ ✦ -';

    return [
        `╭─〔 ${title} 〕─╮`,
        subtitle ? `│ ${subtitle}` : '│',
        `├────────────────`,
        normalizedBody,
        `├────────────────`,
        footer ? `│ ${footer}` : '│',
        `╰────────────────╯`
    ].join('\n');
}

module.exports = {
    titleCase,
    truncate,
    formatDuration,
    panel
};
