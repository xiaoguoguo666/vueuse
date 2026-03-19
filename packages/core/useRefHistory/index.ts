import type { ConfigurableEventFilter, ConfigurableFlush, Fn } from '@vueuse/shared'
import type { Ref } from 'vue'
import type { CloneFn } from '../useCloned'
import type { UseManualRefHistoryReturn } from '../useManualRefHistory'
import { pausableFilter, watchIgnorable } from '@vueuse/shared'
import { useManualRefHistory } from '../useManualRefHistory'

/**
 * useRefHistory 的配置选项接口
 *
 * @template Raw - 原始数据类型
 * @template Serialized - 序列化后的数据类型，默认为 Raw
 */
export interface UseRefHistoryOptions<Raw, Serialized = Raw> extends ConfigurableEventFilter, ConfigurableFlush {
  /**
   * 是否侦听深度变化，默认为 false
   *
   * 当设置为 true 时，也会为历史记录中的值创建克隆
   *
   * @default false
   */
  deep?: boolean

  /**
   * 保留的最大历史记录数量。默认为无限制。
   */
  capacity?: number

  /**
   * 拍摄快照时是否克隆，是 dump: JSON.parse(JSON.stringify(value)) 的快捷方式。
   * 默认为 false
   *
   * @default false
   */
  clone?: boolean | CloneFn<Raw>
  /**
   * 将数据序列化到历史记录中
   */
  dump?: (v: Raw) => Serialized
  /**
   * 从历史记录中反序列化数据
   */
  parse?: (v: Serialized) => Raw
  /**
   * 用于确定是否应该提交的函数
   * @param oldValue 上一个值
   * @param newValue 新值
   * @returns 布尔值，指示是否应该提交
   */
  shouldCommit?: (oldValue: Raw | undefined, newValue: Raw) => boolean
}

/**
 * useRefHistory 的返回类型接口
 *
 * @template Raw - 原始数据类型
 * @template Serialized - 序列化后的数据类型
 */
export interface UseRefHistoryReturn<Raw, Serialized> extends UseManualRefHistoryReturn<Raw, Serialized> {
  /**
   * 一个 ref，表示是否启用了追踪
   */
  isTracking: Ref<boolean>

  /**
   * 暂停变化追踪
   */
  pause: () => void

  /**
   * 恢复变化追踪
   *
   * @param [commit] 如果为 true，恢复后将创建一条历史记录
   */
  resume: (commit?: boolean) => void

  /**
   * 在函数作用域内自动暂停和自动恢复的语法糖
   *
   * @param fn 要执行的函数
   */
  batch: (fn: (cancel: Fn) => void) => void

  /**
   * 清除数据并停止侦听
   */
  dispose: () => void
}

/**
 * 追踪 ref 的变化历史，同时提供撤销和重做功能。
 *
 * @see https://vueuse.org/useRefHistory
 * @param source 要追踪的 ref 数据源
 * @param options 配置选项
 */
export function useRefHistory<Raw, Serialized = Raw>(
  source: Ref<Raw>,
  options: UseRefHistoryOptions<Raw, Serialized> = {},
): UseRefHistoryReturn<Raw, Serialized> {
  const {
    deep = false,
    flush = 'pre',
    eventFilter,
    shouldCommit = () => true,
  } = options

  /**
   * 创建可暂停的事件过滤器
   *
   * 技术解析：
   * - pausableFilter 是一个高阶函数，用于创建可暂停的事件过滤器
   * - 它包装了用户提供的 eventFilter（如果有的话）如果没有默认是 bypassFilter
   * export const bypassFilter: EventFilter = (invoke) => {
      return invoke()  // 直接调用，不做任何过滤
      }
   * - 返回 pause、resume、isActive 等控制函数
   */
  const {
    eventFilter: composedFilter,
    pause,
    resume: resumeTracking,
    isActive: isTracking,
  } = pausableFilter(eventFilter)

  /**
   * 追踪最后一个原始值，用于 shouldCommit 比较
   */
  let lastRawValue: Raw | undefined = source.value

  /**
   * 创建可忽略更新的 watch
   *
   * 技术解析：
   * - watchIgnorable 是一个增强版的 watch
   * - 提供 ignoreUpdates 和 ignorePrevAsyncUpdates忽略之前的异步更新 方法
   * - 可以在特定操作时忽略 watch 的触发
   */
  const {
    ignoreUpdates,
    ignorePrevAsyncUpdates,
    stop,
  } = watchIgnorable(
    source,
    commit,
    { deep, flush, eventFilter: composedFilter },
  )

  /**
   * 设置源 ref 的值
   *
   * 技术解析：
   * - 这个函数用于在撤销/重做时更新源 ref
   * - 使用 ignorePrevAsyncUpdates 忽略之前的异步更新
   * - 使用 ignoreUpdates 忽略本次更新，避免触发新的历史记录
   *
   * 支持在最后一次历史操作后进行的更改
   * 示例：
   *   撤销，修改
   *   撤销，撤销，修改
   * 如果状态已经有更改，它们将被忽略
   * 示例：
   *   修改，撤销
   *   撤销，修改，撤销
   */
  function setSource(source: Ref<Raw>, value: Raw) {
    ignorePrevAsyncUpdates()

    ignoreUpdates(() => {
      source.value = value
      lastRawValue = value
    })
  }

  /**
   * 创建手动历史记录管理
   *
   * 技术解析：
   * - useManualRefHistory 提供底层的历史记录管理功能
   * - 包含 undo、redo、commit 等核心功能
   * - 通过组合模式复用 useManualRefHistory 的功能
   * - 当 deep 为 true 时，自动启用 clone 选项
   */
  const manualHistory = useManualRefHistory(source, { ...options, clone: options.clone || deep, setSource })

  const { clear, commit: manualCommit } = manualHistory

  /**
   * 提交当前值到历史记录
   *
   * 技术解析：
   * - 这个保护只适用于 flush 'pre' 和 'post'
   * - 如果用户手动触发提交，则重置 watcher
   * - 这样我们不会在异步 watcher 中触发额外的提交
   * - 通过 shouldCommit 函数判断是否应该提交
   *  用户修改 source.value → watch 触发异步 commit
2. 用户手动调用 commit() → 这里需要 ignorePrevAsyncUpdates()
3. 否则，异步的 commit 也会执行，导致重复提交
详解在最后
   */
  function commit() {
    // 忽略之前的异步提交
    ignorePrevAsyncUpdates()

    if (!shouldCommit(lastRawValue, source.value))
      return

    lastRawValue = source.value
    manualCommit()
  }

  /**
   * 恢复追踪
   *
   * @param commitNow 如果为 true，立即提交当前值到历史记录
   */
  function resume(commitNow?: boolean) {
    resumeTracking()
    if (commitNow)
      commit()
  }

  /**
   * 批量操作
   *
   * 技术解析：
   * - 在函数执行期间暂停追踪
   * - 函数执行完毕后自动提交（除非被取消）
   * - 提供 cancel 函数可以取消提交
   * - 适用于需要多次修改但只记录一次历史记录的场景
   */
  function batch(fn: (cancel: Fn) => void) {
    let canceled = false

    const cancel = () => canceled = true

    ignoreUpdates(() => {
      fn(cancel)
    })

    if (!canceled)
      commit()
  }

  /**
   * 清理资源
   *
   * 技术解析：
   * - 停止 watch 侦听
   * - 清除历史记录
   */
  function dispose() {
    stop()
    clear()
  }

  return {
    ...manualHistory,
    isTracking,
    pause,
    resume,
    commit,
    batch,
    dispose,
  }
}

/**
 * ========================================
 * 技术手段分析
 * ========================================
 *
 * 1. **组合式函数（Composable）设计模式**
 *    - 遵循 Vue 3 Composition API 最佳实践
 *    - 将复杂功能封装为可复用的函数
 *    - 通过 return 对象暴露 API
 *
 * 2. **组合模式（Composition Pattern）**
 *    - 复用 useManualRefHistory 的核心功能
 *    - 通过扩展返回对象添加新功能
 *    - 避免代码重复，提高可维护性
 *
 * 3. **高阶函数（Higher-Order Functions）**
 *    - pausableFilter：创建可暂停的事件过滤器
 *    - watchIgnorable：创建可忽略更新的 watch
 *    - 这些函数接收函数作为参数，返回增强后的函数
 *
 * 4. **TypeScript 泛型编程**
 *    - Raw 和 Serialized 泛型支持类型安全
 *    - 函数重载提供精确的类型推断
 *    - 接口继承复用类型定义
 *
 * 5. **响应式系统高级应用**
 *    - watchIgnorable：增强版 watch，支持忽略更新
 *    - ignoreUpdates：临时禁用 watch 触发
 *    - ignorePrevAsyncUpdates：忽略之前的异步更新
 *
 * 6. **事件过滤机制**
 *    - ConfigurableEventFilter：可配置的事件过滤器
 *    - pausableFilter：可暂停的事件过滤器
 *    - 支持自定义事件过滤逻辑
 *
 * 7. **状态管理设计**
 *    - lastRawValue：追踪上一个值，用于 shouldCommit 比较
 *    - isTracking：控制追踪状态
 *    - 通过闭包维护内部状态
 *
 * 8. **API 设计模式**
 *    - pause/resume：控制追踪状态
 *    - batch：批量操作的语法糖
 *    - commit：手动提交历史记录
 *    - dispose：资源清理
 *
 * 9. **性能优化**
 *    - deep 选项控制是否深度侦听
 *    - clone 选项控制是否克隆值
 *    - capacity 选项限制历史记录数量
 *
 * 10. **扩展性设计**
 *     - dump/parse：自定义序列化/反序列化
 *     - shouldCommit：自定义提交判断逻辑
 *     - eventFilter：自定义事件过滤
 */
// ## 场景分析：先修改source.value再手动调用commit()的执行流程

// ### 前提条件
// - 默认 `flush: 'pre'`（异步 flush）
// - `shouldCommit = () => true`（总是返回 true）
// - 操作顺序：`修改 source.value` → 紧接着 `手动调用 commit()`

// ---

// ### 执行流程（按时间顺序）

// #### 1. 修改 `source.value` 时
// ```typescript
// source.value = newValue // 触发 watchIgnorable
// ```
// - 内部同步 watch 立即执行：`syncCounter = 1`（记录修改次数）
// - 异步 watch 回调（自动 commit）进入微任务队列，等待执行

// #### 2. 手动调用 `commit()` 时
// ```typescript
// function commit() {
//   ignorePrevAsyncUpdates()  // ①
//   if (!shouldCommit(lastRawValue, source.value)) return  // ② 返回 true，继续执行
//   lastRawValue = source.value  // ③ 更新为当前值
//   manualCommit()  // ④ 手动提交到历史记录
// }
// ```
// - ① `ignorePrevAsyncUpdates()` 执行：`ignoreCounter = syncCounter = 1`（标记忽略之前的异步更新）
// - ② `shouldCommit` 返回 true，不拦截
// - ③ 更新 `lastRawValue` 为当前最新值
// - ④ 手动执行提交，**历史记录新增1条**

// #### 3. 微任务阶段，异步 watch 回调执行
// ```typescript
// // watchIgnorable 内部的异步 watch 回调
// (...args) => {
//   const ignore = ignoreCounter > 0 && ignoreCounter === syncCounter  // 1 === 1 → true
//   ignoreCounter = 0
//   syncCounter = 0
//   if (ignore) return  // 直接返回，不执行 commit

//   filteredCb(...args) // 不会执行到这里
// }
// ```
// - 判定为需要忽略，自动提交被拦截
// - **不会产生重复提交**

// ---

// ### 最终结果
// ✅ **只会提交1次**，不会重复提交，完全符合预期。

// `ignorePrevAsyncUpdates()` 的存在就是为了避免这种场景下的重复提交问题。
