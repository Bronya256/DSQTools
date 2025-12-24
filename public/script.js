import yaml from 'js-yaml';
import { autoToHTML } from '@sfirew/minecraft-motd-parser';

// 读取页面元素
const TrmText = document.getElementById('trmText');
const outputBox = document.getElementById('ouputBox');
const myButton = document.getElementById('myButton');
const prevBtn = document.getElementById('prevBtn');
const nextBtn = document.getElementById('nextBtn');
const applyBtn = document.getElementById('applyBtn');
const errMessage = document.getElementById('errMessage');

let slidesData = []; // 轮播数据
let currentSlideIndex = 0;

// 处理按钮点击：解析文本并触发显示
myButton.addEventListener('click', function() {
    if (myButton.classList.contains('bounce')) return;

    myButton.classList.add('bounce');

    const originalText = myButton.innerText;
    myButton.innerText = '处理中... 🕗';

    ProcessText(TrmText.value);
    // console.log(TrmText.value);

    // 显示结果区域
    document.getElementById('outputCard').hidden = false;
    outputBox.hidden = false;
    outputBox.style.display = 'block';
    outputBox.style.opacity = 0;
    requestAnimationFrame(() => {
        outputBox.style.transition = 'opacity 300ms ease';
        outputBox.style.opacity = 1;
    });

    myButton.addEventListener('animationend', function() {
        myButton.classList.remove('bounce');
        myButton.innerText = originalText;
    }, { once: true });
});

applyBtn.addEventListener('click', function() {
    // TODO: 读取
});

prevBtn.addEventListener('click', () => showSlide(currentSlideIndex - 1));
nextBtn.addEventListener('click', () => showSlide(currentSlideIndex + 1));

// 主流程：把 YAML 文本解析成 slidesData
function ProcessText(input) {
    errMessage.hidden = true;
    slidesData = [];
    currentSlideIndex = 0;
    try {
        const result = yaml.load(input);

        if (!result) {
            errMessage.hidden = false;
            errMessage.innerText = '没有数据哦？';
            loadIcon('barrier');
            return;
        }

        for (const [key, value] of Object.entries(result)) {
            itemParse(key, value);
        }

        document.getElementById('advancedPanel').hidden = false;
        renderSlides();
    } catch (e) {
        errMessage.hidden = false;
        errMessage.innerText = `解析出错啦！\n原因: ${e.reason}\n位置: 第${e.mark ? e.mark.line + 1 : '?'}行`;
        loadIcon('barrier');
        console.error(e);
    }
}

// 解析单个物品，收集 Display 下的 name / lore / material
// slidesData存入原始数据
function itemParse(key, value) {
    if (typeof value !== 'object' || value === null) return;

    const display = value.Display || value.display;
    if (!display) return;

    slidesData.push({
        keyName: key,
        name: display.name || display.Name || '',
        lore: display.lore || display.Lore || [],
        material: display.material || display.Material || 'barrier'
    });
    const loreArray = display.lore || display.Lore || [];

    // 处理 lore，确保是数组形式
    const loreLines = Array.isArray(loreArray)
        ? loreArray.map(line => autoToHTML(formattedText(String(line))))
        : [autoToHTML(formattedText(loreArray[0] || ''))];

}

// 根据 slidesData 渲染当前要展示的内容
function renderSlides() {
    if (slidesData.length === 0) {

        errMessage.hidden = false;
        errMessage.innerText = '解析成功，但没有可展示的物品。';
        return;
    }

    prevBtn.style.display = slidesData.length > 1 ? 'flex' : 'none';
    nextBtn.style.display = slidesData.length > 1 ? 'flex' : 'none';

    showSlide(currentSlideIndex);
}

function showSlide(index) {
    if (slidesData.length === 0) return;

    currentSlideIndex = (index + slidesData.length) % slidesData.length;
    const slide = slidesData[currentSlideIndex];

    loadIcon(slide.material);

    var newLore = [];
    if(slide.lore.length > 0 && typeof slide.lore[0] == 'string') 
        newLore = slide.lore.map(line => autoToHTML(formattedText(line)));
    else if(slide.lore.length > 0 && Array.isArray(slide.lore))
        newLore = slide.lore[0].map(line => autoToHTML(formattedText(line)));
    const loreText = newLore.join('<br>');
    console.log(loreText);
    document.getElementById('currentItemName').innerText = '当前物品键: ' + slide.keyName;
    document.getElementById('itemName').innerHTML = autoToHTML(formattedText(slide.name));
    document.getElementById('itemLore').innerHTML = loreText;
}

function formattedText(text) {
    return text ? text.replace(/&/g, '§') : '';
}

function loadIcon(material) {
    const Icon = document.getElementById('pixelIcon');
    let mat = material;
    mat = mat.replaceAll(' ', '_').toLowerCase();
    const newSrc = `https://assets.mcasset.cloud/1.20.1/assets/minecraft/textures/item/${mat}.png`;
    const defaultSrc = `https://assets.mcasset.cloud/1.20.1/assets/minecraft/textures/item/barrier.png`;

    let tmpImage = new Image();
    tmpImage.onload = () => { Icon.src = newSrc; };
    tmpImage.onerror = () => { Icon.src = defaultSrc; };
    tmpImage.src = newSrc;
}

