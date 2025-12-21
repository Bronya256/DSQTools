import yaml from 'js-yaml';

// 读取页面元素
const TrmText = document.getElementById('trmText');
const outputBox = document.getElementById('ouputBox');
const button = document.getElementById('myButton');
const prevBtn = document.getElementById('prevBtn');
const nextBtn = document.getElementById('nextBtn');

let slidesData = []; // 轮播数据
let currentSlideIndex = 0;

// 处理按钮点击：解析文本并触发显示
button.addEventListener('click', function() {
    if (button.classList.contains('bounce')) return;

    button.classList.add('bounce');

    const originalText = button.innerText;
    button.innerText = '处理中... 🕗';

    ProcessText(TrmText.value);

    document.getElementById('outputCard').hidden = false;
    outputBox.hidden = false;
    outputBox.style.display = 'block';
    outputBox.style.opacity = 0;
    requestAnimationFrame(() => {
        outputBox.style.transition = 'opacity 300ms ease';
        outputBox.style.opacity = 1;
    });

    button.addEventListener('animationend', function() {
        button.classList.remove('bounce');
        button.innerText = originalText;
    }, { once: true });
});

prevBtn.addEventListener('click', () => changeSlide(-1));
nextBtn.addEventListener('click', () => changeSlide(1));

// 主流程：把 YAML 文本解析成 slidesData
function ProcessText(input) {
    slidesData = [];
    currentSlideIndex = 0;

    try {
        const result = yaml.load(input);

        if (!result) {
            outputBox.innerText = '没有数据哦？';
            loadIcon('barrier');
            hideNav();
            return;
        }

        for (const [key, value] of Object.entries(result)) {
            itemParse(key, value);
        }

        renderSlides();
    } catch (e) {
        outputBox.innerText = `解析出错啦！\n原因: ${e.reason}\n位置: 第${e.mark ? e.mark.line + 1 : '?'}行`;
        loadIcon('barrier');
        hideNav();
        console.error(e);
    }
}

// 解析单个物品，收集 Display 下的 name / lore / material
function itemParse(key, value) {
    if (typeof value !== 'object' || value === null) return;

    const display = value.Display || value.display;
    if (!display) return;

    const material = display.material || display.Material || value.material || 'barrier';
    const rawName = display.name || display.Name || key;
    const loreArray = display.lore || display.Lore || [];

    const loreLines = Array.isArray(loreArray)
        ? loreArray.map(line => cleanColorCodes(String(line)))
        : [cleanColorCodes(String(loreArray))];

    slidesData.push({
        name: cleanColorCodes(String(rawName)),
        lore: loreLines,
        material
    });
}

// 根据 slidesData 渲染当前要展示的内容
function renderSlides() {
    if (slidesData.length === 0) {
        outputBox.innerText = '解析成功，但没有可展示的物品。';
        hideNav();
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

    const loreText = slide.lore.join('\n');
    outputBox.innerText = `${slide.name}\n${loreText}`;
}

function changeSlide(direction) {
    if (slidesData.length === 0) return;
    showSlide(currentSlideIndex + direction);
}

// 隐藏左右切换按钮
function hideNav() {
    prevBtn.style.display = 'none';
    nextBtn.style.display = 'none';
}

function cleanColorCodes(text) {
    return text ? text.replace(/&[0-9a-fk-or]/gi, '') : '';
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
