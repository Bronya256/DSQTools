import yaml from 'js-yaml';
// const fs = require('fs');
const TrmText = document.getElementById('trmText');
const outputBox = document.getElementById('ouputBox');
// 1. 找到那个按钮
const button = document.getElementById('myButton');

// 2. 监听“点击”事件
button.addEventListener('click', function() {
    
    // 如果按钮正在动，就先别打断它
    if (button.classList.contains('bounce')) return;

    // 添加 'bounce' 类名，开始动画
    button.classList.add('bounce');

    // 更改按钮文字
    const originalText = button.innerText;
    button.innerText = "操！走！ 🏀";

    // outputBox处理
    const Text = ProcessText(TrmText.value);
    outputBox.innerText = `正在处理以下配置文件...\n\n${Text}\n\n处理完成！🎉`;
    document.getElementById('outputCard').hidden = false;

    // 让 outputBox 显示
    outputBox.hidden = false;
    outputBox.style.display = 'block';
    // 淡入效果（需要在 CSS 中支持或允许内联 transition）
    outputBox.style.opacity = 0;
    requestAnimationFrame(() => {
        outputBox.style.transition = 'opacity 300ms ease';
        outputBox.style.opacity = 1;
    });

    // 3. 监听动画结束事件
    button.addEventListener('animationend', function() {
        button.classList.remove('bounce');
        button.innerText = originalText; // 恢复文字
    }, { once: true });
});

function ProcessText(input) {
    var output = "什么都没有！";
    try {
        // 2. 尝试解析
        const result = yaml.load(input);
        
        // 3. 解析成功：检查是否为 undefined (例如只写了注释)
        if (!result) { 
             output = '没有数据吗我问一嘴';
        }
        else
        {
            console.log(result);
            for(const [key, value] of Object.entries(result)) itemParse(key, value);
            
            // 4. 渲染数据
            output = `${JSON.stringify(result, null, 2)}`;
        }
    } catch (e) {
        // 5. 解析失败：优雅地提示用户
        output = `
            解析出错啦 (＞﹏＜)
            错误原因: ${e.reason}
            位置: 第 ${e.mark.line + 1} 行
        `;
        console.error(e); // 在控制台也打印一下方便调试
    }
    return output
}

function itemParse(key, value)
{
    if(typeof value === 'object' && value !== null) 
    {
        if(Object.hasOwn(value, 'display')) {
            if(Object.hasOwn(value.display, 'lore')) {
                const loreArray = value.display.lore;
                console.log(loreArray);
            }
        }
    }
}