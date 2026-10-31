const { Client, GatewayIntentBits } = require('discord.js');
const mineflayer = require('mineflayer');
const http = require('http');

// Tạo một HTTP server nhỏ để Render nhận diện port và không bị tắt
const server = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('Bot Minecraft AFK is running!\n');
});
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`HTTP Server đang lắng nghe trên cổng ${PORT}`);
});

// Khởi tạo Discord Bot
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

const TOKEN = process.env.DISCORD_TOKEN;
const PREFIX = '!mc';
let trackingChannelId = null; // Lưu lại kênh chat để gửi thông báo

// Thông tin tài khoản Minecraft và Server
const MC_CONFIG = {
  host: 'kingmc.vn',
  username: 'hiz200',
  // password: 'hiz300', // Bỏ comment dòng này nếu server yêu cầu đăng nhập /login
  version: false // Tự động nhận diện phiên bản
};

let bot = null;
let shardCount = 0;
let afkInterval = null;

// Khi Discord Bot sẵn sàng
client.once('ready', () => {
  console.log(`Bot Discord đã đăng nhập thành công với tên ${client.user.tag}`);
});

// Xử lý lệnh từ Discord
client.on('messageCreate', async (message) => {
  if (message.author.bot) return;
  if (!message.content.startsWith(PREFIX)) return;

  const args = message.content.slice(PREFIX.length).trim().split(/ +/);
  const command = args.shift().toLowerCase();

  trackingChannelId = message.channel.id; // Lưu kênh hiện tại để bắn thông báo

  if (command === 'afk') {
    message.reply('Đang tiến hành kết nối tài khoản `hiz200` vào `kingmc.vn` để cắm máy...');
    startMinecraftBot(message.channel);
  } else if (command === 'stop') {
    if (bot) {
      bot.quit();
      bot = null;
      if (afkInterval) clearInterval(afkInterval);
      message.reply('Đã dừng bot Minecraft thành công!');
    } else {
      message.reply('Bot Minecraft hiện không hoạt động.');
    }
  } else if (command === 'status') {
    if (bot) {
      message.reply(`Trạng thái: Bot đang chạy trên server `kingmc.vn`. Số shard đếm được: ${shardCount}`);
    } else {
      message.reply('Bot Minecraft đang tắt.');
    }
  }
});

// Hàm khởi động Mineflayer bot
function startMinecraftBot(channel) {
  if (bot) {
    try { bot.quit(); } catch (e) {}
  }

  bot = mineflayer.createBot(MC_CONFIG);

  bot.on('spawn', () => {
    console.log('Bot Minecraft đã vào game thành công!');
    if (channel) {
      channel.send('✅ **[THÔNG BÁO]** Tài khoản `hiz200` đã vào game thành công trên `kingmc.vn` và bắt đầu quá trình cắm máy AFK!');
    }

    // Tự động dùng đồng hồ hoặc lệnh sang SMP King sau khi vào sảnh (nếu cần)
    setTimeout(() => {
      bot.chat('/smp'); // Lệnh chuyển sang SMP King, ní có thể đổi lại nếu cần
    }, 3000);
  });

  bot.on('chat', (username, message) => {
    // Logic đếm shard hoặc đọc thông báo từ game nếu cần
    if (username === 'Server' && message.includes('shard')) {
      shardCount++;
    }
  });

  bot.on('kicked', (reason) => {
    console.log(`Bot bị kick khỏi server: ${reason}`);
    if (channel) channel.send(`⚠️ Bot bị kick khỏi server với lý do: ${reason}`);
  });

  bot.on('end', (reason) => {
    console.log(`Bot đã thoát, lý do: ${reason}`);
    if (channel) channel.send(`❌ Bot đã mất kết nối, đang tự động kết nối lại...`);
    // Tự động kết nối lại sau 10 giây
    setTimeout(() => startMinecraftBot(channel), 10000);
  });

  bot.on('error', (err) => {
    console.log('Lỗi Mineflayer:', err);
  });
}

// Đăng nhập Discord Bot
client.login(TOKEN);
