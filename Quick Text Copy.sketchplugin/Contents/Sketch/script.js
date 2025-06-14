const sketch = require('sketch')
const document = sketch.getSelectedDocument()
const UI = require('sketch/ui')

const PASTE_KEYWORD = '//paste'
const CLIPBOARD_KEY = 'com.example.quick-text-copy.clipboard'

// 复制功能，保持不变
function onCopyText(context) {
  const selectedLayers = document.selectedLayers
  const textLayers = selectedLayers.layers.filter(layer => layer.type === 'Text')

  if (textLayers.length === 0) {
    UI.message('请先选择一个文本图层进行复制 ☝️')
    return
  }
  if (textLayers.length > 1) {
    UI.message('请只选择一个文本图层进行复制 🧐')
    return
  }

  const textToCopy = textLayers[0].text
  sketch.Settings.setGlobalSettingForKey(CLIPBOARD_KEY, textToCopy)
  UI.message(`✅ 已复制: "${textToCopy}"`)
}

// --- 粘贴功能 (智能混合版) ---
function onPasteText(context) {
  const textToPaste = sketch.Settings.globalSettingForKey(CLIPBOARD_KEY)

  if (typeof textToPaste !== 'string') {
    UI.message('剪贴板中没有内容 🤷')
    return
  }

  const selectedLayers = document.selectedLayers
  if (selectedLayers.isEmpty) {
    UI.message('请选择要粘贴文本的目标图层 🎯')
    return
  }

  let updatedCount = 0
  let ambiguousComponentFound = false // 用于标记是否遇到了复杂组件

  function processLayer(layer) {
    // 情况 1: 普通文本图层
    if (layer.type === 'Text') {
      layer.text = textToPaste
      updatedCount++
    } 
    // 情况 2: 组件实例 - 核心智能逻辑
    else if (layer.type === 'SymbolInstance') {
      const textOverrides = layer.overrides.filter(
        o => o.property === 'stringValue' && o.affectedLayer.type === 'Text'
      )

      // 智能判断 1: 检查有没有使用关键词 "paste" 的精确目标
      const keywordTargets = textOverrides.filter(o => o.value && o.value.trim() === PASTE_KEYWORD)

      if (keywordTargets.length > 0) {
        keywordTargets.forEach(override => {
          override.value = textToPaste
        })
        updatedCount += keywordTargets.length
      } 
      // 智能判断 2: 如果没有关键词，检查组件是否只有一个文本字段
      else if (textOverrides.length === 1) {
        textOverrides[0].value = textToPaste
        updatedCount++
      } 
      // 智能判断 3: 如果有多个文本字段且未使用关键词，则标记为复杂组件
      else if (textOverrides.length > 1) {
        ambiguousComponentFound = true
      }
    } 
    // 情况 3: 组，递归处理
    else if (layer.layers && Array.isArray(layer.layers)) {
      layer.layers.forEach(processLayer)
    }
  }

  selectedLayers.forEach(processLayer)

  // 根据处理结果显示不同的提示信息
  if (updatedCount > 0) {
    let message = `🎉 成功粘贴到 ${updatedCount} 个字段！`
    if (ambiguousComponentFound) {
      message += ` (部分复杂组件已跳过)`
    }
    UI.message(message)
  } else {
    if (ambiguousComponentFound) {
      UI.message(`组件有多个文本字段。请将目标文本改为 "${PASTE_KEYWORD}" 后再试。`)
    } else {
      UI.message('在所选图层中没有找到可粘贴的目标。')
    }
  }
}