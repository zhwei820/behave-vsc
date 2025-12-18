# 测试 Print 输出是否正确显示

## 问题分析

之前有很多 `print()` 输出没有显示在 `Behave VSC` 输出窗口中，主要原因是：

### 1. **Behave 默认捕获 stdout** (根本原因 🎯)
- Behave 框架默认会**捕获所有 stdout 和 stderr 输出**
- 这是 behave 的设计特性，用于在测试失败时才显示输出
- 即使禁用 Python 缓冲，behave 也会拦截所有 print() 输出
- 需要使用 `--no-capture` 和 `--no-capture-stderr` 参数来禁用捕获

### 2. **Python 输出缓冲问题** (次要原因)
- 当 Python 的 stdout 不是终端（TTY）时，Python 默认使用**全缓冲模式**
- 这意味着 `print()` 输出会被缓冲，直到缓冲区满或程序结束

### 3. Node.js 事件循环阻塞导致输出停止
- 当输出量很大时，VS Code 的输出通道写入速度可能跟不上
- 这会导致 Node.js 事件循环阻塞，进而导致子进程的管道填满
- 子进程在管道满时会阻塞，造成看似"输出停止"的现象

### 4. ANSI 转义序列清理不完整
- 之前的清理函数只移除了特定的 ANSI 代码，不够全面

## 修复方案

### 修改 1: 禁用 Behave 的输出捕获 (关键修复 ⭐)
**文件**: `src/runners/runOrDebug.ts`

```typescript
const OVERRIDE_ARGS = [
  "--show-skipped",
  "--no-capture",        // 允许 print() 输出显示
  "--no-capture-stderr", // 允许 stderr 输出显示
  "--junit",
  "--junit-directory"
];
```

这会在运行 behave 时自动添加这些参数：
```bash
python -m behave --no-capture --no-capture-stderr ...
```

**这是最关键的修改**，因为 behave 默认会捕获所有输出，即使解决了 Python 缓冲问题，输出仍然不会显示。

### 修改 2: 添加 PYTHONUNBUFFERED 环境变量
**文件**: `src/runners/behaveRun.ts` 和 `src/runners/behaveDebug.ts`

```typescript
// 设置 PYTHONUNBUFFERED=1 确保所有 print() 输出立即刷新到 stdout
const env = { ...process.env, ...wr.wkspSettings.envVarOverrides, PYTHONUNBUFFERED: '1' };
```

这相当于在命令行运行：
```bash
PYTHONUNBUFFERED=1 python -m behave ...
```

或在 Python 代码中：
```python
python -u -m behave ...  # -u 参数等同于 PYTHONUNBUFFERED=1
```

### 修改 3: 防止事件循环阻塞和管道背压 (关键修复 ⭐)
**文件**: `src/runners/behaveRun.ts`

```typescript
// 设置流为 flowing 模式，防止管道背压
if (cp.stdout) {
  cp.stdout.setEncoding('utf8');
  cp.stdout.resume();  // 确保流保持流动状态
}
if (cp.stderr) {
  cp.stderr.setEncoding('utf8');
  cp.stderr.resume();  // 确保流保持流动状态
}

// 使用异步批处理机制防止阻塞事件循环
let outputBuffer = '';
let isProcessing = false;

const flushOutput = () => {
  if (isProcessing || !outputBuffer) return;
  
  isProcessing = true;
  const toProcess = outputBuffer;
  outputBuffer = '';
  
  // 使用 setImmediate 将处理延迟到下一个事件循环
  setImmediate(() => {
    const cleaned = cleanBehaveText(toProcess);
    config.logger.logInfoNoLF(cleaned, wkspUri);
    isProcessing = false;
    
    // 如果处理时又积累了数据，继续刷新
    if (outputBuffer) {
      flushOutput();
    }
  });
};

const log = (str: string) => {
  if (!str) return;
  
  outputBuffer += str;
  
  // 当缓冲区较大时立即刷新，防止内存问题
  if (outputBuffer.length > 8192) {
    flushOutput();
  } else {
    // 否则延迟刷新，批量处理多个快速输出
    setImmediate(flushOutput);
  }
};

cp.stdout?.on('data', (chunk: string) => log(chunk));
cp.stderr?.on('data', (chunk: string) => log(chunk));

// 进程结束时确保刷新所有剩余输出
cp.on('close', () => {
  if (outputBuffer) {
    const cleaned = cleanBehaveText(outputBuffer);
    config.logger.logInfoNoLF(cleaned, wkspUri);
    outputBuffer = '';
  }
});
```

**这个修复解决了"输出到一半就停止"的问题**：

1. **`resume()`**: 确保流保持在 flowing 模式，即使消费速度慢也不会完全阻塞
2. **异步批处理**: 使用 `setImmediate()` 将输出处理移到下一个事件循环，防止同步处理大量数据时阻塞
3. **批量合并**: 将快速连续的多个小输出合并成一个批次，减少 logger 调用次数
4. **背压控制**: 当缓冲区达到 8KB 时立即刷新，防止内存占用过大
5. **最终刷新**: 确保进程结束时所有剩余输出都被处理

### 修改 4: 设置流编码
**文件**: `src/runners/behaveRun.ts`

```typescript
// 设置编码为 utf8 以正确处理输出
if (cp.stdout) cp.stdout.setEncoding('utf8');
if (cp.stderr) cp.stderr.setEncoding('utf8');
```

这确保所有输出都以字符串形式处理，而不是 Buffer。

### 修改 3: 改进 ANSI 转义序列清理
**文件**: `src/common.ts`

```typescript
export function cleanBehaveText(text: string) {
  // 移除所有 ANSI 转义序列（颜色、格式化、光标移动等）
  // 模式说明：\x1b 匹配 ESC 字符，\[ 匹配 [，[0-9;]* 匹配控制代码，[a-zA-Z] 匹配命令字母
  return text.replace(/\x1b\[[0-9;]*[a-zA-Z]/g, '');
}
```

这个正则表达式能够匹配所有标准的 ANSI SGR（Select Graphic Rendition）序列：
- `\x1b[0m` - 重置
- `\x1b[33m` - 黄色
- `\x1b[1;32m` - 加粗绿色
- `\x1b[2J` - 清屏
- 等等...

## 测试方法

创建一个测试步骤文件，包含多个 print 语句：

```python
# steps/test_steps.py
from behave import given, when, then
import sys

@given('I test print output')
def step_impl(context):
    print("=== Testing print output ===")
    print("Line 1: This should appear immediately")
    print("Line 2: Multiple prints", flush=True)
    print("Line 3: With different content")
    sys.stdout.write("Line 4: Using sys.stdout.write\n")
    sys.stderr.write("Line 5: This is stderr output\n")
    print("Line 6: Final print statement")
```

运行测试后，所有这些输出应该立即显示在 `Behave VSC` 输出窗口中。

## 技术细节

### Python 缓冲模式
Python 的输出缓冲有三种模式：
1. **无缓冲** (unbuffered): 立即输出每个字符
2. **行缓冲** (line buffered): 遇到换行符时输出（TTY 默认）
3. **全缓冲** (fully buffered): 缓冲区满或程序结束时输出（非 TTY 默认）

`PYTHONUNBUFFERED=1` 将模式改为**无缓冲**或**行缓冲**。

### 为什么 flush=True 不够
即使在代码中使用 `print(..., flush=True)`，也只能刷新特定的那条 print 语句。
设置 `PYTHONUNBUFFERED=1` 可以全局禁用缓冲，这样：
- 所有 print() 语句都会立即输出
- 第三方库的输出也会立即显示
- 不需要修改任何测试代码

## 验证清单

运行测试后，检查 `Behave VSC` 输出窗口应该能看到：
- [x] 所有 print() 语句的输出
- [x] sys.stdout.write() 的输出
- [x] sys.stderr.write() 的输出（错误信息）
- [x] 第三方库（如 logging）的输出
- [x] 输出不包含 ANSI 颜色代码
- [x] 输出按实时顺序显示，不是等到测试结束才显示
