const fs = require('fs');
const path = require('path');
const { resolveTemplate } = require('./greeting-store');

function getParticipantName(groupMetadata, participantJid) {
    const localPart = String(participantJid || '').split('@')[0];
    const participant = groupMetadata?.participants?.find(item => item.id === participantJid);
    return participant?.notify || participant?.name || localPart;
}

function resolveImageSource(imageValue) {
    const source = String(imageValue || '').trim();
    if (!source) return null;

    if (/^https?:\/\//i.test(source)) {
        return { url: source };
    }

    const resolvedPath = path.isAbsolute(source) ? source : path.join(process.cwd(), source);
    if (fs.existsSync(resolvedPath)) {
        return fs.readFileSync(resolvedPath);
    }

    return null;
}

function isValidImageSource(imageValue) {
    const source = String(imageValue || '').trim();
    if (!source) return false;
    if (/^https?:\/\//i.test(source)) return true;

    const resolvedPath = path.isAbsolute(source) ? source : path.join(process.cwd(), source);
    return fs.existsSync(resolvedPath);
}

function buildGreetingPayload({ kind, groupMetadata, participantJid, entry, count, preview = false }) {
    const groupName = groupMetadata?.subject || 'Grup';
    const name = getParticipantName(groupMetadata, participantJid);
    const mention = `@${String(participantJid || '').split('@')[0]}`;
    const defaultText = kind === 'welcome'
        ? `Selamat datang, ${mention}.\nSemoga betah di {group}.`
        : `${mention} telah keluar dari {group}.\nSemoga sukses selalu.`;

    const rawText = entry?.text?.trim() || defaultText;
    const caption = resolveTemplate(rawText, {
        name,
        group: groupName,
        count,
        number: String(participantJid || '').split('@')[0]
    });

    const image = resolveImageSource(entry?.image);

    return {
        caption,
        image,
        mentions: [participantJid].filter(Boolean),
        groupName,
        name,
        mention
    };
}

module.exports = {
    getParticipantName,
    resolveImageSource,
    isValidImageSource,
    buildGreetingPayload
};
