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
        let f = pathArr[pathArr.length - 1] == 'actions' ? 'Array<String>' : 'String';
        const op = document.createElement('option');
        // 将数组路径转为字符串显示
        op.value = JSON.stringify(pathArr); 
        const displayLabel = pathArr.length > 1 
            ? `${pathArr[pathArr.length-1]} ( ` + f + ' )'
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
    resetEditor(); // 重置右侧
    rebuildAndSaveGlobal(); // 保存更改
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

    let typeStr = 'Unknown';
    if (Array.isArray(currentRawValue)) typeStr = 'Array';
    else if (typeof currentRawValue === 'string') typeStr = 'String';
    
    propTypeDisplay.innerText = `Type: ${typeStr}`;
    
    parseRawValueToConditions(currentRawValue, typeStr);
    refreshConditionSelect();
}

function parseRawValueToConditions(val, type) {
    parsedConditions = []; 

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
    if (cleanStr.startsWith('checkitem_amount_nameequals:')) {
        const parts = cleanStr.split(',nbtstrings:');
        const itemName = parts[0].replace('checkitem_amount_nameequals:', '');
        const nbtPart = parts[1] || '';

        let finalType = 'unknown';
        let finalKey = nbtPart;

        if (nbtPart.includes('NeigeItems..id=')) {
            finalType = 'neigeitems';
            finalKey = nbtPart.split('NeigeItems..id=')[1];
        } else if (nbtPart.includes('PublicBukkitValues..mythicmobs:type=')) {
            finalType = 'mythicmobs';
            finalKey = nbtPart.split('PublicBukkitValues..mythicmobs:type=')[1];
        }

        return { type: finalType, name: itemName, key: finalKey };
    }

    return { type: 'unknown', name: '未知变量', key: cleanStr };
}

function analyzeRemoveContent(str) {
    let amount = 0;
    const amtMatch = str.match(/,amt:(\d+)/);
    if (amtMatch) amount = parseInt(amtMatch[1]);

    const strWithoutAmt = str.replace(/,amt:\d+/, '');
    const strForAnalysis = strWithoutAmt.replace('checkitem_amount_remove_nameequals:', 'checkitem_amount_nameequals:');
    
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
    } else {
        inputType.disabled = false;
        inputName.disabled = false;
        inputAmount.disabled = false;

        inputType.value = cond.type || 'unknown';
        inputName.value = cond.name;
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
    }
}

function rebuildAndSaveGlobal() {
    let finalOutput = null;
    const propType = propTypeDisplay.innerText.includes('Array') ? 'Array' : 'String';

    if (propType === 'String') {
        // 重建 JS 条件字符串
        const parts = parsedConditions.map(cond => {
            if (cond.type === 'raw') return cond.key;
            
            let varStr = '';
            if (cond.type === 'money') varStr = '%cmi_user_balance%';
            else if (cond.type === 'level') varStr = '%player_level%';
            else if (cond.type === 'meta') varStr = `%cmi_user_meta_${cond.key}%`;
            else if (cond.type === 'mythicmobs') {
                varStr = `%checkitem_amount_nameequals:${cond.name},nbtstrings:PublicBukkitValues..mythicmobs:type=${cond.key}%`;
            } else if (cond.type === 'neigeitems') {
                varStr = `%checkitem_amount_nameequals:${cond.name},nbtstrings:NeigeItems..id=${cond.key}%`;
            }
            
            const logicStr = `vars("${varStr}") >= ${cond.amount}`;
            
            // 【关键修改】实时更新当前对象的 rawLogic 属性，并同步到 UI
            cond.rawLogic = logicStr;
            return logicStr;
        });
        
        if (parts.length > 1) {
            finalOutput = "js:\n  " + parts.join(' &&\n  ');
        } else {
            // 如果只有一条，保持单行比较紧凑好看
            finalOutput = "js: " + parts.join(' && ');
        }

    } else {
        // 重建 Actions 数组
        finalOutput = parsedConditions.map(cond => {
            if (cond.type === 'raw') return cond.key; 
            
            let logicStr = '';
            if (cond.type === 'money') {
                logicStr = `console: cmi money take %player_name% ${cond.amount}`;
            } else {
                let innerStr = '';
                if (cond.type === 'mythicmobs') {
                    innerStr = `checkitem_amount_remove_nameequals:${cond.name},nbtstrings:PublicBukkitValues..mythicmobs:type=${cond.key},amt:${cond.amount}`;
                } else if (cond.type === 'neigeitems') {
                    innerStr = `checkitem_amount_remove_nameequals:${cond.name},nbtstrings:NeigeItems..id=${cond.key},amt:${cond.amount}`;
                } else {
                    logicStr = `console: say Unknown Action Rebuild ${cond.name}`;
                }
                if(!logicStr) logicStr = `console: papi parse %player_name% %${innerStr}%`;
            }
            
            // 【关键修改】实时更新当前对象的 rawLogic
            cond.rawLogic = logicStr;
            return logicStr;
        });
    }

    // 1. 写入 GlobalData
    const { globalParsedData } = getGlobalData();
    const itemData = globalParsedData[currentKeyName];
    Utils.setValueByPath(itemData, currentPath, finalOutput);
    setGlobalData({ globalParsedData });
    
    // 2. 【关键修改】强制刷新当前编辑器里的 "原始逻辑" 框
    if (currentConditionIdx !== -1) {
        inputLogic.value = parsedConditions[currentConditionIdx].rawLogic;
    }

    // 3. 【关键修改】导出整个 YAML 到右侧 ChangeBoxB
    try {
        const yamlStr = yaml.dump(globalParsedData, {
            indent: 2,
            lineWidth: -1, // 不换行
            noRefs: true   // 禁用引用
        });
        yamlOutput.value = yamlStr;
    } catch (e) {
        console.error("YAML导出失败", e);
        yamlOutput.value = "导出失败: " + e.message;
    }

    // 更新 Select 显示，1s后恢复
    
    var originalText = propSelect.options[propSelect.selectedIndex].text;
    propSelect.options[propSelect.selectedIndex].text = "已保存 ✔";
    setTimeout(() => {
        propSelect.options[propSelect.selectedIndex].text = originalText;
    }, 1000);
}