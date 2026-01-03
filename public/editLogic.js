import yaml from 'js-yaml'; // 引入yaml库用于导出
import * as Utils from './Utils.js';
import { getGlobalData, setGlobalData } from './script.js';

// ============================================================
// 状态管理喵
// ============================================================
let currentKeyName = "";       // 当前选中的物品Key
let currentPath = [];          // 当前选中的属性路径 (Array)
let currentRawValue = null;    // 当前属性的原始值 (String or Array)
let parsedConditions = [];     // 解析后的条件列表 (核心数据)
let currentConditionIdx = -1;  // 当前正在编辑的条件索引

// DOM 元素缓存
const propSelect = document.getElementById('propSelect');
const propTypeDisplay = document.getElementById('propTypeDisplay');
const conditionSelectWrapper = document.getElementById('conditionSelectWrapper');
const conditionSelect = document.getElementById('conditionSelect');
const detailForm = document.getElementById('detailForm');
const emptyDetailTip = document.getElementById('emptyDetailTip');

// 编辑器输入框
const inputType = document.getElementById('editType');
const inputName = document.getElementById('editName');
const inputKey = document.getElementById('editKey');
const inputAmount = document.getElementById('editAmount');
const inputLogic = document.getElementById('editLogic'); // 只读的，用于显示原始逻辑

// 结果输出框 (ChangeBoxB)
const yamlOutput = document.getElementById('yamlOutput');

// 按钮
const btnSave = document.getElementById('savePropBtn');
const btnDel = document.getElementById('delPropBtn');
const btnPlus = document.getElementById('plusCondition');
const btnSync = document.getElementById('syncPropBtn'); 
const inputUseName = document.getElementById('checkUseName'); // 勾选框

// ============================================================
// 初始化与导出函数喵
// ============================================================

// 初始化下拉框选项（供 script.js 调用）
export function refreshPropSelect(keyName) {
    currentKeyName = keyName;
    const { globalParsedData } = getGlobalData();
    const itemData = globalParsedData[keyName];

    // 清空现有选项
    propSelect.innerHTML = '';
    parsedConditions = [];
    resetEditor();
    
    // 初始清空 YAML 输出，等待用户操作或后续逻辑填充（可选）
    // yamlOutput.value = ''; 

    if (!itemData) return;

    // 获取所有可解析路径
    const paths = Utils.ParsedPaths(itemData);

    if (paths.length === 0) {
        const op = document.createElement('option');
        op.text = "没有可修改属性";
        propSelect.add(op);
        propTypeDisplay.innerText = "Type: None";
        return;
    }

    // 填充 Select
    paths.forEach(pathArr => {
        let objType = pathArr[pathArr.length - 1] == 'actions' ? 'Array<String>' : 'String';
        let fstKey = pathArr[0] == 'display' ? 'display' : 'action';
        const op = document.createElement('option');
        // 将数组路径转为字符串显示
        op.value = JSON.stringify(pathArr); 
        // console.log(op.value);
        const displayLabel = pathArr.length > 1 
            ? fstKey + `: ${pathArr[pathArr.length-1]} ( ` + objType + ' )'
            : pathArr.join(' > ');
        op.text = displayLabel;
        propSelect.add(op);
    });

    // 默认选中第一个并触发加载
    propSelect.selectedIndex = 0;
    loadPropData(); 
}

// 绑定主属性选择事件
propSelect.addEventListener('change', loadPropData);

// 绑定条件选择事件 (S2)
conditionSelect.addEventListener('change', () => {
    const idx = parseInt(conditionSelect.value);
    loadConditionDetail(idx);
});

// 绑定保存按钮
btnSave.addEventListener('click', () => {
    saveCurrentEdit();
    rebuildAndSaveGlobal(); // 核心保存逻辑
    
    // 给个视觉反馈喵
    const originalText = btnSave.innerText;
    btnSave.innerText = "OK!";
    setTimeout(() => btnSave.innerText = originalText, 1000);
});

// 绑定删除按钮
btnDel.addEventListener('click', () => {
    if(currentConditionIdx === -1) return;
    parsedConditions.splice(currentConditionIdx, 1);
    refreshConditionSelect(); // 刷新列表
    rebuildAndSaveGlobal(); // 保存更改
    console.log(currentConditionIdx);
});

// 绑定添加按钮
btnPlus.addEventListener('click', () => {
    const newCond = {
        type: 'money',
        name: '新条件',
        key: '',
        amount: 0,
        rawLogic: '', 
        isParsed: true
    };
    parsedConditions.push(newCond);
    refreshConditionSelect();
    conditionSelect.value = parsedConditions.length - 1;
    loadConditionDetail(parsedConditions.length - 1);
    
    // 添加后立刻保存一次，为了生成 rawLogic
    rebuildAndSaveGlobal();
});

// ============================================================
// 核心逻辑区域喵
// ============================================================

function loadPropData() {
    if (!propSelect.value) return;

    currentPath = JSON.parse(propSelect.value);
    const { globalParsedData } = getGlobalData();
    const itemData = globalParsedData[currentKeyName];
    
    currentRawValue = Utils.getValueByPath(itemData, currentPath);
    const lastKey = currentPath[currentPath.length - 1];

    let typeStr = 'String';
    // 只要是 actions 或者是 lore，就肯定是数组，哪怕它现在是空的
    if (lastKey === 'actions' || lastKey === 'lore') {
        typeStr = 'Array';
    }
    
    propTypeDisplay.innerText = `Type: ${typeStr}`;
    
    parseRawValueToConditions(currentRawValue, typeStr);
    refreshConditionSelect();
}

function parseRawValueToConditions(val, type) {
    parsedConditions = []; 

    if (val === undefined || val === null) return; 
    if (type === 'String') {
        let cleanVal = val.startsWith('js:') ? val.substring(3).trim() : val;
        const parts = cleanVal.split('&&');
        
        parts.forEach(part => {
            part = part.trim();
            const match = part.match(/vars\("(.+?)"\)\s*(>=|==|>|<|<=)\s*([\d\.]+)/);
            
            if (match) {
                const varContent = match[1]; 
                const amount = parseFloat(match[3]);
                const parsedItem = analyzeVarContent(varContent);
                parsedItem.amount = amount;
                parsedItem.rawLogic = part; 
                parsedItem.isParsed = true; 
                parsedItem.isAction = false; 
                parsedConditions.push(parsedItem);
            } else {
                parsedConditions.push({
                    type: 'raw',
                    name: 'Raw Logic',
                    key: part,
                    amount: 0,
                    rawLogic: part,
                    isParsed: false
                });
            }
        });

    } else if (type === 'Array') {
        val.forEach(line => {
            if (line.includes('checkitem_amount_remove_nameequals')) {
                const match = line.match(/%(checkitem_amount_remove_.+?)%/);
                if (match) {
                    const content = match[1]; 
                    const parsedItem = analyzeRemoveContent(content);
                    parsedItem.rawLogic = line;
                    parsedItem.isParsed = true;
                    parsedItem.isAction = true; 
                    parsedConditions.push(parsedItem);
                    return; 
                }
            }
            
            if (line.includes('cmi money take')) {
                const moneyMatch = line.match(/cmi money take %player_name% ([\d\.]+)/);
                if (moneyMatch) {
                    parsedConditions.push({
                        type: 'money',
                        name: '扣除金币',
                        key: 'balance',
                        amount: parseFloat(moneyMatch[1]),
                        rawLogic: line,
                        isParsed: true,
                        isAction: true
                    });
                    return;
                }
            }

            parsedConditions.push({
                type: 'raw', 
                name: '指令',
                key: line, 
                amount: 0,
                rawLogic: line,
                isParsed: false
            });
        });
    }
}

function analyzeVarContent(str) {
    const cleanStr = str.replace(/^%|%$/g, '');

    if (cleanStr === 'cmi_user_balance') {
        return { type: 'money', name: '金币需求', key: 'balance' };
    }
    if (cleanStr === 'player_level') {
        return { type: 'level', name: '等级需求', key: 'level' };
    }
    if (cleanStr.startsWith('cmi_user_meta_')) {
        const metaKey = cleanStr.replace('cmi_user_meta_', '');
        return { type: 'meta', name: '玩家数据', key: metaKey };
    }
    // nbt处理
    if (cleanStr.includes('_nameequals:') || cleanStr.includes('_nbtstrings:')) {
        const isNameEquals = cleanStr.includes('_nameequals:');
        // 分割字符串
        // 如果是 nameequals，它长这样: ...nameequals:名字,nbtstrings:...
        // 如果是 nbtstrings，它长这样: ...nbtstrings:...
        let itemName = '未知物品';
        let nbtPart = '';
        if (isNameEquals) {
            const parts = cleanStr.split(',nbtstrings:');
            // 提取 nameequals: 后面的部分
            // 注意：可能是 checkitem_amount_nameequals 或 checkitem_amount_remove_nameequals
            const namePart = parts[0].split('_nameequals:')[1]; 
            itemName = namePart || '未知';
            nbtPart = parts[1] || '';
        } else {
            // 没有 nameequals，直接提取 nbtstrings 后面的
            nbtPart = cleanStr.split('_nbtstrings:')[1] || '';
            itemName = 'NBT物品(无名)';
        }
        let finalType = 'unknown';
        let finalKey = nbtPart;

        if (nbtPart.includes('NeigeItems..id=')) {
            finalType = 'neigeitems';
            finalKey = nbtPart.split('NeigeItems..id=')[1];
        } else if (nbtPart.includes('PublicBukkitValues..mythicmobs:type=')) {
            finalType = 'mythicmobs';
            finalKey = nbtPart.split('PublicBukkitValues..mythicmobs:type=')[1];
        }

        return { 
            type: finalType, 
            name: itemName, 
            key: finalKey, 
            useName: isNameEquals // 【新增标记】
        };
    }

    return { type: 'unknown', name: '未知变量', key: cleanStr };
}

function analyzeRemoveContent(str) {
    let amount = 0;
    const amtMatch = str.match(/,amt:(\d+)/);
    if (amtMatch) amount = parseInt(amtMatch[1]);

    const strWithoutAmt = str.replace(/,amt:\d+/, '');
    const strForAnalysis = strWithoutAmt.replace('checkitem_amount_remove_', 'checkitem_amount_');
    
    const baseInfo = analyzeVarContent(strForAnalysis);
    baseInfo.amount = amount;
    return baseInfo;
}

// ============================================================
// UI 更新区域喵
// ============================================================

function refreshConditionSelect() {
    conditionSelectWrapper.hidden = false;
    conditionSelect.innerHTML = '';

    if (parsedConditions.length === 0) {
        const op = document.createElement('option');
        op.text = "空";
        conditionSelect.add(op);
        resetEditor();
        return;
    }

    parsedConditions.forEach((cond, index) => {
        const op = document.createElement('option');
        op.value = index;
        
        let icon = '❓';
        if (cond.type === 'money') icon = '💰';
        else if (cond.type === 'level') icon = '🆙';
        else if (cond.type === 'meta') icon = '💾';
        else if (cond.type === 'mythicmobs') icon = '⚔️';
        else if (cond.type === 'neigeitems') icon = '❄️';
        else if (cond.type === 'raw') icon = '📝'; 

        op.text = `${icon} ${cond.name} [x${cond.amount}]`;
        conditionSelect.add(op);
    });

    // 尝试保持当前选中的索引，如果越界则归零
    if (currentConditionIdx >= 0 && currentConditionIdx < parsedConditions.length) {
        conditionSelect.selectedIndex = currentConditionIdx;
        loadConditionDetail(currentConditionIdx);
    } else {
        conditionSelect.selectedIndex = 0;
        loadConditionDetail(0);
    }
}

function loadConditionDetail(index) {
    currentConditionIdx = index;
    const cond = parsedConditions[index];

    if (!cond) {
        resetEditor();
        return;
    }

    emptyDetailTip.hidden = true;
    detailForm.hidden = false;

    const types = ['money', 'level', 'meta', 'mythicmobs', 'neigeitems', 'raw'];
    inputType.innerHTML = '';
    types.forEach(t => {
        const op = document.createElement('option');
        op.value = t;
        op.text = t.toUpperCase();
        inputType.add(op);
    });
    
    if (!cond.isParsed && cond.type === 'raw') {
        inputType.value = 'raw';
        inputType.disabled = true;
        inputName.value = 'RAW COMMAND/LOGIC';
        inputName.disabled = true;
        inputKey.value = cond.key; 
        inputAmount.value = 0;
        inputAmount.disabled = true;
        inputLogic.value = cond.rawLogic;
        inputUseName.checked = false; 
        inputUseName.disabled = true;
    } else {
        inputType.disabled = false;
        inputName.disabled = false;
        inputAmount.disabled = false;

        inputType.value = cond.type || 'unknown';

        inputName.value = cond.name;
        inputUseName.checked = (cond.useName !== undefined) ? cond.useName : true;
        inputUseName.disabled = false;
        // 如果是 money/level/meta 类型，这个勾选框没意义，可以禁用掉
        if(['money','level','meta'].includes(cond.type)){
             inputUseName.disabled = true;
        }

        inputKey.value = cond.key;
        inputAmount.value = cond.amount;
        // 这里的 rawLogic 会在 rebuildAndSaveGlobal 后被更新
        inputLogic.value = cond.rawLogic || '(保存后生成)';
        
    }
}

function resetEditor() {
    currentConditionIdx = -1;
    emptyDetailTip.hidden = false;
    detailForm.hidden = true;
}

// ============================================================
// 数据保存与重建区域喵 (核心修改)
// ============================================================

function saveCurrentEdit() {
    if (currentConditionIdx === -1) return;
    
    const cond = parsedConditions[currentConditionIdx];
    cond.type = inputType.value;
    
    if (cond.type === 'raw') {
        cond.key = inputKey.value; 
        cond.rawLogic = inputKey.value;
    } else {
        cond.name = inputName.value;
        cond.key = inputKey.value;
        cond.amount = parseFloat(inputAmount.value);
        cond.isParsed = true;
        cond.useName = inputUseName.checked;
    }
}

// 【新增函数】核心生成器，根据条件列表和目标类型生成最终字符串/数组
function generateOutputFromConditions(conditions, targetType) {
    if (targetType === 'String') {
        // 生成 JS 逻辑
        const parts = conditions.map(cond => {
            if (cond.type === 'raw') return cond.key;
            
            let varStr = '';
            // 处理 useName 逻辑
            const useName = (cond.useName !== undefined) ? cond.useName : true;
            
            if (cond.type === 'money') varStr = '%cmi_user_balance%';
            else if (cond.type === 'level') varStr = '%player_level%';
            else if (cond.type === 'meta') varStr = `%cmi_user_meta_${cond.key}%`;
            else if (cond.type === 'mythicmobs' || cond.type === 'neigeitems') {
                // 【核心修改点1】：根据 checkbox 决定格式
                const prefix = useName ? `nameequals:${cond.name},` : ``;
                const idKey = cond.type === 'mythicmobs' ? 'PublicBukkitValues..mythicmobs:type' : 'NeigeItems..id';
                varStr = `%checkitem_amount_${prefix}nbtstrings:${idKey}=${cond.key}%`;
            }
            
            // 实时更新对象的 rawLogic (仅用于当前编辑视图回显，不影响 Sync)
            const logicStr = `vars("${varStr}") >= ${cond.amount}`;
            cond.rawLogic = logicStr; 
            return logicStr;
        });
        
        if (parts.length === 0) return undefined;
        if (parts.length > 1) return "js:\n  " + parts.join(' &&\n  ');
        // 只有1个条件用join和parts[0]没区别
        return "js: " + parts.join(' && ');

    } else {
        // 生成 Actions 数组
        return conditions.map(cond => {
            if (cond.type === 'raw') return cond.key; 
            
            let logicStr = '';
            // 处理 useName 逻辑
            const useName = (cond.useName !== undefined) ? cond.useName : true;

            if (cond.type === 'money') {
                let plus = cond.amount >= 0 ? '+' : '';
                logicStr = `console: cmi money take %player_name% ${cond.amount}`;
            } else if (cond.type === 'meta') {
                let plus = cond.amount >= 0 ? '+' : '';
                logicStr = `console: cmi usermeta increment %player_name% ${cond.key} ` + plus + `${cond.amount}`;
            } else if (cond.type === 'mythicmobs' || cond.type === 'neigeitems') {

                const actionType = useName ? 'remove_nameequals' : 'remove_nbtstrings';
                const idKey = cond.type === 'mythicmobs' ? 'PublicBukkitValues..mythicmobs:type' : 'NeigeItems..id';
                
                let innerStr = "";
                if(useName) {
                    // 格式: remove_nameequals:名字,nbtstrings:ID=KEY,amt:数量
                    innerStr = `${actionType}:${cond.name},nbtstrings:${idKey}=${cond.key},amt:${cond.amount}`;
                } else {
                    // 格式: remove_nbtstrings:ID=KEY,amt:数量
                    innerStr = `${actionType}:${idKey}=${cond.key},amt:${cond.amount}`;
                }
                
                logicStr = `console: papi parse %player_name% %checkitem_amount_${innerStr}%`;
                
            } else {
                logicStr = `console: say Unknown Action Rebuild ${cond.name}`;
            }
            
            cond.rawLogic = logicStr;
            return logicStr;
        });
    }
}

// 修改 rebuildAndSaveGlobal 来调用上面的函数
function rebuildAndSaveGlobal() {
    const propType = propTypeDisplay.innerText.includes('Array') ? 'Array' : 'String';
    const finalOutput = generateOutputFromConditions(parsedConditions, propType); // 调用新函数

    // 1. 写入 GlobalData
    const { globalParsedData } = getGlobalData();
    const itemData = globalParsedData[currentKeyName];
    Utils.setValueByPath(itemData, currentPath, finalOutput);
    setGlobalData({ globalParsedData });
    
    // 2. 刷新 rawLogic 显示
    if (currentConditionIdx !== -1) {
        inputLogic.value = parsedConditions[currentConditionIdx].rawLogic;
    }

    // 3. 导出 YAML (保持不变)
    try {
        const yamlStr = yaml.dump(globalParsedData, {
            indent: 2,
            lineWidth: -1,
            noRefs: true
        });
        yamlOutput.value = yamlStr;
    } catch (e) {
        yamlOutput.value = "导出失败: " + e.message;
    }

    // 视觉反馈 (保持不变)
    var originalText = propSelect.options[propSelect.selectedIndex].text;
    propSelect.options[propSelect.selectedIndex].text = "已保存 ✔";
    setTimeout(() => {
        propSelect.options[propSelect.selectedIndex].text = originalText;
    }, 1000);
};

// 绑定同步按钮事件
btnSync.addEventListener('click', () => {
    // 简单的确认防手滑
    if(!confirm("确认要将当前条件同步到该物品下的【所有】其他路径吗？\n(包括 actions 和 condition)")) return;

    saveCurrentEdit(); // 先保存当前编辑框的内容

    const { globalParsedData } = getGlobalData();
    const itemData = globalParsedData[currentKeyName];
    const allPaths = Utils.ParsedPaths(itemData); // 获取所有路径

    // 遍历所有路径进行覆盖
    allPaths.forEach(targetPath => {
        // 跳过自己，虽然覆盖也没事，但为了性能跳过
        if (JSON.stringify(targetPath) === JSON.stringify(currentPath)) return;

        // 判断目标路径是 String 还是 Array
        // 规则：只要路径最后是 'actions' 或者是 'actions' 下的 'actions' 列表，就是 Array
        // 但根据 ParsedPaths 的逻辑，actions 下面还有 index 和 'actions'/'condition'
        // 一般来说：endsWith 'actions' -> Array, endsWith 'condition' -> String
        // 或者直接看原来的值类型
        
        const lastKey = targetPath[targetPath.length - 1];
        // 如果是 'actions' 键，或者是 actions 列表里的 actions 字段，肯定是 Array
        // 如果是 'condition'，肯定是 String (js check)
        // 如果是 display.shiny，是 String (true/false 被 yaml 转 string 或者 boolean) -> 这里假设 boolean 转 string
        
        let targetType = 'String';
        if (lastKey === 'actions') targetType = 'Array';
        
        // 生成新的值
        const newContent = generateOutputFromConditions(parsedConditions, targetType);
        
        // 写入
        Utils.setValueByPath(itemData, targetPath, newContent);
    });

    setGlobalData({ globalParsedData });
    rebuildAndSaveGlobal(); // 触发一次保存以更新右侧 YAML 输出

    alert("同步完成喵！所有的条件都已经变成一样的了！");
});