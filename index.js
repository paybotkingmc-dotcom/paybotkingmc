const { Client, GatewayIntentBits } = require('discord.js');
const mineflayer = require('mineflayer');
const http = require('http');

// Tạo HTTP server giả lập để Render nhận diện port và không bị lỗi No open ports detected
const server = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('Bot Minecraft AFK & Discord Service is running 24/7!\n');
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`[HTTP] Server đang lắng nghe trên cổng ${PORT}`);
});

// Khởi tạo Discord Bot với các quyền cần thiết
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

const TOKEN = process.env.DISCORD_TOKEN;
const PREFIX = '!mc';
let trackingChannelId = null;

// Cấu hình tài khoản Minecraft và Server
const MC_CONFIG = {
  host: 'kingmc.vn',
  username: 'hiz200',
  // password: 'matkhau_cua_ni', // Bỏ comment (dấu //) dòng này và điền mật khẩu nếu server yêu cầu /login
  version: false // Tự động nhận diện phiên bản Minecraft của server
};

let bot = null;
let shardCount = 0;

// Khi Discord Bot đã đăng nhập thành công
client.once('ready', () => {
  console.log(`[DISCORD] Bot đã online với tên tài khoản: ${client.user.tag}`);
});

// Lắng nghe lệnh từ kênh chat Discord
client.on('messageCreate', async (message) => {
  if (message.author.bot) return;
  if (!message.content.startsWith(PREFIX)) return;

  const args = message.content.slice(PREFIX.length).trim().split(/ +/);
  const command = args.shift().toLowerCase();

  // Lưu lại ID kênh chat hiện tại để bot biết đường bắn tin nhắn thông báo về đây
  trackingChannelId = message.channel.id;

  if (command === 'afk') {
    message.reply('🔄 Đang tiến hành kết nối tài khoản `hiz200` vào server `kingmc.vn`...');
    startMinecraftBot(message.channel);
  } 
  else if (command === 'stop') {
    if (bot) {
      try {
        bot.quit();
      } catch (e) {}
      bot = null;
      message.reply('🛑 Đã dừng bot Minecraft thành công!');
    } else {
      message.reply('⚠️ Bot Minecraft hiện không hoạt động.');
    }
  } 
  else if (command === 'status') {
    if (bot) {
      message.reply(`🟢 Trạng thái: Bot đang chạy cắm máy trên \`kingmc.vn\`. Tổng số shard ghi nhận được: **${shardCount}**`);
    } else {
      message.reply('🔴 Bot Minecraft hiện đang tắt.');
    }
  }
  else if (command === 'pay') {
    // Hỗ trợ lệnh phụ nếu ní muốn bot thực hiện chuyển tiền trong game
    const targetUser = args[0];
    const amount = args[1];
    if (bot && targetUser && amount) {
      bot.chat(`/pay ${targetUser} ${amount}`);
      message.reply(`💸 Đã lệnh cho `hiz200` chuyển ${amount} cho ${targetUser} thành công!`);
    } else {
      message.reply('❌ Cú pháp sai hoặc bot chưa vào game! Dùng: `!mc pay <tên_người_nhận> <số_tiền>`');
    }
  }
});

// Hàm khởi động và quản lý vòng đời Mineflayer Bot
function startMinecraftBot(channel) {
  if (bot) {
    try {
      bot.quit();
    } catch (e) {}
  }

  console.log('[MINECRAFT] Đang khởi tạo kết nối Mineflayer...');
  bot = mineflayer.createBot(MC_CONFIG);

  // Sự kiện khi bot chui thành công vào trong server
  bot.on('spawn', () => {
    console.log('[MINECRAFT] Bot đã vào game thành công!');
    
    if (channel) {
      channel.send('✅ **[THÔNG BÁO THÀNH CÔNG]** Tài khoản `hiz200` đã kết nối vào `kingmc.vn` và bắt đầu cắm máy AFK!');
    } else if (trackingChannelId) {
      const trackChan = client.channels.cache.get(trackingChannelId);
      if (trackChan) {
        trackChan.send('✅ **[THÔNG BÁO THÀNH CÔNG]** Tài khoản `hiz200` đã kết nối vào `kingmc.vn` và bắt đầu cắm máy AFK!');
      }
    }

    // Tự động gửi lệnh chuyển sang sảnh SMP sau 3 giây vào game
    setTimeout(() => {
      if (bot) {
        bot.chat('/smp');
        console.log('[MINECRAFT] Đã gửi lệnh /smp để vào khu cắm máy.');
      }
    }, 3000);
  });

  // Lắng nghe tin nhắn trong game (để đếm shard hoặc đọc thông báo)
  bot.on('chat', (username, message) => {
    if (username === 'Server' && message.toLowerCase().includes('shard')) {
      shardCount++;
      console.log(`[MINECRAFT] Đã thu thập thêm shard! Tổng: ${shardCount}`);
    }
  });

  // Xử lý khi bot bị đá khỏi server
  bot.on('kicked', (reason) => {
    console.log(`[MINECRAFT] Bot bị kick khỏi server. Lý do:`, reason);
    if (trackingChannelId) {
      const trackChan = client.channels.cache.get(trackingChannelId);
      if (trackChan) {
        trackChan.send(`⚠️ **[CẢNH BÁO]** Bot bị kick khỏi server với lý do: \`${reason}\``);
      }
    }
  });

  // Xử lý khi mất kết nối / crash game
  bot.on('end', (reason) => {
    console.log(`[MINECRAFT] Bot đã mất kết nối. Lý do: ${reason}. Đang chuẩn bị kết nối lại sau 10 giây...`);
    if (trackingChannelId) {
      const trackChan = client.channels.cache.get(trackingChannelId);
      if (trackChan) {
        trackChan.send(`❌ **[MẤT KẾT NỐI]** Bot đã sập nguồn (${reason}), hệ thống đang tự động vào lại sau 10 giây...`);
      }
    }

    // Tự động kết nối lại sau 10 giây để đảm bảo cắm máy 24/7 không lo gián đoạn
    setTimeout(() => {
      startMinecraftBot(null);
    }, 10000);
  });

  // Bắt lỗi ngoại lệ tránh bot bị crash app tổng
  bot.on('error', (err) => {
    console.log('[MINECRAFT ERROR]:', err);
  });
}

// Thực hiện đăng nhập Discord Bot vào hệ thống
client.login(TOKEN);
