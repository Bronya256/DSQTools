const express = require('express');
const path = require('path');
const app = express();
const PORT = 3000;

// 自动托管整个 public 文件夹下的静态资源喵
app.use(express.static(path.join(__dirname, 'public')));

// 启动服务器喵
app.listen(PORT, () => {
    console.log(`----------------------------------------------------`);
    console.log(`Express 服务器已在 http://localhost:${PORT} 准备就绪喵！`);
    console.log(`----------------------------------------------------`);
});