const { Client, GatewayIntentBits } = require('discord.js');
const mineflayer = require('mineflayer');

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ]
});

const accounts = [
    { username: 'hiz200', password: 'hiz300' }
];

let currentAccIndex = 0;
let bot = null;
let afkInterval = null;
let shardTimer = null;
let shardCount = 0;
let isAfkActive = false;
let trackingChannel = null;

function createMinecraftBot() {
    const acc = accounts[currentAccIndex];
    console.log(`Đang kết nối vào KingMC với tài khoản: ${acc.username}...`);

    bot = mineflayer.createBot({
        host: 'kingmc.vn',
        port: 25565,
        username: acc.username,
        version: false
    });

    bot.once('spawn', () => {
        console.log(`Đã vào sảnh thành công: ${acc.username}`);
        if (trackingChannel) {
            trackingChannel.send(`🟢 Bot đã kết nối vào sảnh KingMC thành công với tài khoản **${acc.username}**! Đang tiến hành chọn cụm SMP King...`);
        }
        
        // 1. Sau 3 giây ở sảnh, mở menu bằng đồng hồ hoặc dùng lệnh /smp
        setTimeout(async () => {
            try {
                const clockItem = bot.inventory.items().find(item => item.name.includes('clock') || item.name.includes('compass') || item.name.includes('watch'));
                if (clockItem) {
                    await bot.equip(clockItem, 'hand');
                    bot.activateItem();
                } else {
                    bot.chat('/smp');
                }
            } catch (err) {
                console.log('Lỗi mở menu sảnh:', err);
            }
        }, 3000);

        // 2. Sau 5 giây chuyển vào cụm SMP King
        setTimeout(() => {
            bot.chat('/smp');
            if (trackingChannel) {
                trackingChannel.send(`🔵 Đang chuyển vào cụm **SMP King**...`);
            }
        }, 5000);

        // 3. Sau 8 giây đăng nhập mật khẩu và thông báo hoàn tất vào game
        setTimeout(() => {
            bot.chat(`/login ${acc.password}`);
            console.log(`Đã đăng nhập mật khẩu cho ${acc.username}`);
            if (trackingChannel) {
                trackingChannel.send(`✅ Tài khoản **${acc.username}** đã đăng nhập vào thế giới thành công! Sẵn sàng nhận lệnh.`);
            }
        }, 8000);
    });

    // Lắng nghe phản hồi từ game (báo pay, thông báo, v.v.)
    bot.on('message', (jsonMsg) => {
        const messageText = jsonMsg.toString();
        // Lọc các tin nhắn quan trọng từ server để báo về Discord
        if (trackingChannel && (messageText.toLowerCase().includes('pay') || messageText.toLowerCase().includes('thành công') || messageText.toLowerCase().includes('gửi') || messageText.toLowerCase().includes('không đủ'))) {
            trackingChannel.send(`📥 **[Phản hồi từ KingMC]:** \`${messageText}\``);
        }
    });

    bot.on('kicked', (reason) => {
        console.log(`Bị đá ra khỏi server: ${reason}`);
        if (trackingChannel) trackingChannel.send(`⚠️ Bot đã bị đá khỏi server với lý do: \`${reason}\``);
        stopAfkSession();
        switchAccount();
    });

    bot.on('end', (reason) => {
        console.log(`Mất kết nối: ${reason}`);
        stopAfkSession();
    });

    bot.on('error', (err) => {
        console.log(`Lỗi kết nối Minecraft: ${err}`);
    });
}

function startAfkSession(channel) {
    if (!bot) return;
    isAfkActive = true;
    trackingChannel = channel;
    shardCount = 0;

    // Gõ lệnh vào khu afk
    bot.chat('/afk');
    trackingChannel.send('🚀 **[AFK Mode]:** Đã gõ lệnh `/afk` thành công! Bot đã đứng vào khu cắm máy nhận shard.');

    // Vòng lặp chống kẹt / giữ kết nối mỗi 3 phút
    if (afkInterval) clearInterval(afkInterval);
    afkInterval = setInterval(() => {
        if (bot && bot.entity && isAfkActive) {
            bot.look(bot.entity.yaw + 1.5, bot.entity.pitch, true);
            bot.setControlState('jump', true);
            setTimeout(() => {
                bot.setControlState('jump', false);
            }, 500);
        }
    }, 180000);

    // Cứ mỗi 1 tiếng thông báo số shard kiếm được
    if (shardTimer) clearInterval(shardTimer);
    shardTimer = setInterval(() => {
        if (isAfkActive && trackingChannel) {
            shardCount += 10;
            trackingChannel.send(`⏰ **Thông báo AFK (1 giờ trôi qua):** Tài khoản hiz200 đã cắm máy và kiếm được khoảng **${shardCount} shard**!`);
        }
    }, 3600000);
}

function stopAfkSession() {
    isAfkActive = false;
    if (afkInterval) clearInterval(afkInterval);
    if (shardTimer) clearInterval(shardTimer);
}

function switchAccount() {
    currentAccIndex++;
    if (currentAccIndex < accounts.length) {
        console.log('Đang đổi sang tài khoản dự phòng tiếp theo...');
        setTimeout(createMinecraftBot, 5000);
    } else {
        console.log('Đã hết tài khoản dự phòng!');
    }
}

client.once('ready', () => {
    console.log(`Discord Bot đã online: ${client.user.tag}`);
    createMinecraftBot();
});

client.on('messageCreate', async (message) => {
    if (message.author.bot) return;

    trackingChannel = message.channel;

    // Lệnh bật AFK: ?mc afk
    if (message.content === '?mc afk') {
        if (!bot) return message.reply('Bot Minecraft chưa kết nối vào game!');
        if (isAfkActive) return message.reply('Chế độ AFK đang được bật sẵn rồi bro ơi!');
        startAfkSession(message.channel);
    }

    // Lệnh tắt AFK: ?mc afk offline
    if (message.content === '?mc afk offline') {
        if (!isAfkActive) return message.reply('Bot hiện tại có đang AFK đâu bro!');
        stopAfkSession();
        message.reply('🛑 Đã tắt chế độ AFK cắm máy!');
    }

    // Lệnh pay: !pay [tên] [số tiền]
    if (message.content.startsWith('!pay')) {
        const args = message.content.split(' ');
        const target = args[1];
        const amount = args[2];

        if (!target || !amount) {
            return message.reply('Thiếu thông tin rồi bro! Cú pháp: `!pay [tên_game] [số_tiền]`');
        }

        if (!bot) {
            return message.reply('Bot Minecraft chưa kết nối vào game!');
        }

        try {
            bot.chat(`?mc pay ${target} ${amount}`);
            message.reply(`📤 Đã gửi lệnh chuyển **${amount}** cho **${target}** trên KingMC! Đang đợi server xác nhận...`);
        } catch (err) {
            message.reply('Lỗi khi gửi lệnh vào game!');
        }
    }
});

client.login(process.env.DISCORD_TOKEN);
    
