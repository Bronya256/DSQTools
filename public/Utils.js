
/**
 * 提取对象所需要分析的路径
 * 针对对象 itemData，提取 display.shiny 以及 actions 下的 condition 和 actions 路径
 * @param {Object} itemData 物品数据对象
 * @return {Array<Array<string>>} 返回需要分析的路径数组
 */
export function ParsedPaths(itemData) {
    const paths = [];
    // 检查 display.shiny 属性
    if (itemData.display && itemData.display.shiny) {
        paths.push(['display', 'shiny']);
    }
    // 检查 actions 键然后遍历
    if(itemData.actions)
    {
        // value 是数组
        for (const [actionKey, actionValue] of Object.entries(itemData.actions))
        {
            if(Array.isArray(actionValue))
            {
                actionValue.forEach((Obj, index) => {
                    if(Obj.condition)
                        paths.push(['actions', actionKey, index.toString(), 'condition']);

                    if(Obj.actions)
                        paths.push(['actions', actionKey, index.toString(), 'actions']);
                });
            }
        }
    }
    return paths;
}
/**
 * 根据路径获取对应的值
 * @param {Object} itemData 物品数据对象
 * @param {Array<string>} path 路径数组
 * @return {any} 返回对应路径的值，如果路径不存在则返回 undefined
 */
export function getValueByPath(obj, pathArr) {
    // 安全检查：如果对象为空或路径不是数组，直接返回 undefined
    if (!obj || !Array.isArray(pathArr)) {
        return undefined;
    }

    // 使用 reduce 逐层深入
    return pathArr.reduce((currentLayer, key) => {
        // 如果当前层级存在，且包含 key，则进入下一层；否则返回 undefined 并一路透传到底
        return (currentLayer && currentLayer[key] !== undefined) 
            ? currentLayer[key] 
            : undefined;
    }, obj);
}

/**
 * 根据路径修改对象中的值 (会直接修改原对象)
 * @param {Object} obj - 原始对象
 * @param {Array<string>} pathArr - 路径数组
 * @param {any} newValue - 新值
 */
export function setValueByPath(obj, pathArr, newValue) {
    if (!obj || !Array.isArray(pathArr) || pathArr.length === 0) return;

    const lastKeyIndex = pathArr.length - 1;
    
    // 遍历到倒数第二层
    let current = obj;
    for (let i = 0; i < lastKeyIndex; i++) {
        const key = pathArr[i];
        
        // 如果中间路径断了，是否需要自动创建对象？视需求而定，这里假设路径必须存在
        if (current[key] === undefined) {
            console.warn(`路径 ${key} 不存在，无法赋值`);
            return;
        }
        current = current[key];
    }

    // 在最后一层进行赋值
    const lastKey = pathArr[lastKeyIndex];
    current[lastKey] = newValue;
}

// // 本地测试
// // 假设这是你的原始数据 itemData
// const itemData = {
//     display: { shiny: true },
//     actions: {
//         all: [
//             { 
//                 condition: "js: vars('%player_level%') >= 220", 
//                 actions: ["console: say hello"] 
//             },
//             {
//                 condition: "js: vars('%balance%') > 100",
//                 actions: ["console: give money"]
//             }
//         ]
//     }
// };
// // 1. 获取所有感兴趣的路径
// const paths = getParsedPaths(itemData); 
// // paths 结果: 
// // [
// //   ['display', 'shiny'],
// //   ['actions', 'all', '0', 'condition'],
// //   ['actions', 'all', '1', 'condition']
// // ]

// // 2. 遍历路径并获取对应的值
// paths.forEach(path => {
//     const value = getValueByPath(itemData, path);
    
//     console.log(`路径: ${path.join('.')} \n值: ${value}`);
//     console.log('---');
// });
// setValueByPath(itemData, ['display', 'shiny'], "this is a string now");
// console.log('修改后 itemData.display.shiny:', itemData.display.shiny);
