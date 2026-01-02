const express = require('express');
const path = require('path');
const app = express();
const PORT = 3000;

// 自动托管整个 public 文件夹下的静态资源喵
app.use(express.static(path.join(__dirname, 'public')));
// 自动托管 node_modules 文件夹下的静态资源喵
app.use('/node_modules', express.static(path.join(__dirname, 'node_modules')));

// 启动服务器喵
app.listen(PORT, () => {
    console.log(`----------------------------------------------------`);
    console.log(`Express 服务器已在 http://localhost:${PORT} 准备就绪喵！`);
    console.log(`----------------------------------------------------`);
});