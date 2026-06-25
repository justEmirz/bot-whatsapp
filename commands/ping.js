const { panel, formatDuration } = require('../lib/ui');

module.exports = async (sock, from, cmd, text, prefix, msg) => {
    if (cmd !== 'ping') return;

    try {
        const result = await sock.sendMessage(from, {
            text: panel({
                title: '🏓 Pong',
                subtitle: 'Bot aktif',
                lines: [
                    'Status: online',
                    `Uptime: ${formatDuration(process.uptime())}`
                ],
                footer: 'Zain Bot'
            })
        });

        console.log(`✅ Ping sent: ${result?.key?.id || '-'}`);
    } catch (err) {
        console.error(`❌ GAGAL KIRIM PESAN:`, err.message);
        console.error(err); // Print detail error
    }
};
