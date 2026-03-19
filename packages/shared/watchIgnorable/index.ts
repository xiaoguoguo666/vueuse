import type { MultiWatchSources, WatchCallback, WatchSource, WatchStopHandle } from 'vue'
import type { Fn, MapOldSources, MapSources } from '../utils'
import type { WatchWithFilterOptions } from '../watchWithFilter'
import { watch } from 'vue'
import { bypassFilter, createFilterWrapper } from '../utils'

/**
 * watchIgnorable(source, callback, options) 组合式函数
 *
 * 技术解析：
 * - 扩展版的 watch，暴露了 ignoreUpdates(updater) 函数
 * - 允许更新源而不触发副作用
 */

/**
 * 可忽略的更新器类型
 */
export type IgnoredUpdater = (updater: () => void) => void

/**
 * 忽略之前异步更新的函数类型
 */
export type IgnoredPrevAsyncUpdates = () => void

/**
 * watchIgnorable 的返回类型接口
 */
export interface WatchIgnorableReturn {
  /**
   * 在回调函数内更新源时忽略 watch 触发
   */
  ignoreUpdates: IgnoredUpdater
  /**
   * 忽略之前已触发的异步更新
   */
  ignorePrevAsyncUpdates: IgnoredPrevAsyncUpdates
  /**
   * 停止 watch 侦听
   */
  stop: WatchStopHandle
}

// 函数重载
export function watchIgnorable<T, Immediate extends Readonly<boolean> = false>(
  source: WatchSource<T>,
  cb: WatchCallback<T, Immediate extends true ? T | undefined : T>,
  options?: WatchWithFilterOptions<Immediate>,
): WatchIgnorableReturn

export function watchIgnorable<
  T extends Readonly<MultiWatchSources>,
  Immediate extends Readonly<boolean> = false,
>(
  sources: [...T],
  cb: WatchCallback<MapSources<T>, MapOldSources<T, Immediate>>,
  options?: WatchWithFilterOptions<Immediate>,
): WatchIgnorableReturn

export function watchIgnorable<
  T extends object,
  Immediate extends Readonly<boolean> = false,
>(
  source: T,
  cb: WatchCallback<T, Immediate extends true ? T | undefined : T>,
  options?: WatchWithFilterOptions<Immediate>,
): WatchIgnorableReturn

/**
 * 可忽略更新的 watch
 *
 * 技术解析：
 * - 这是一个增强版的 watch 组合式函数
 * - 提供 ignoreUpdates 和 ignorePrevAsyncUpdates 两个核心功能
 * - 根据 flush 选项的不同，有两种实现方式
 *
 * @param source - 要侦听的数据源
 * @param cb - 回调函数
 * @param options - 配置选项
 * @returns 包含 stop、ignoreUpdates、ignorePrevAsyncUpdates 的对象
 */
export function watchIgnorable<Immediate extends Readonly<boolean> = false>(
  source: any,
  cb: any,
  options: WatchWithFilterOptions<Immediate> = {},
): WatchIgnorableReturn {
  // bypassFilter是一个函数，用于不过滤任何事件，传入什么函数就直接执行
  const {
    eventFilter = bypassFilter,
    ...watchOptions
  } = options

  /**
   * 技术解析：
   * - 使用 createFilterWrapper 包装回调函数
   * - 支持通过 eventFilter 过滤事件
   * - 默认使用 bypassFilter，即不过滤任何事件
   */
  const filteredCb = createFilterWrapper(
    eventFilter,
    cb,
  )

  let ignoreUpdates: IgnoredUpdater
  let ignorePrevAsyncUpdates: IgnoredPrevAsyncUpdates
  let stop: WatchStopHandle

  if (watchOptions.flush === 'sync') {
    /**
     * flush: 'sync' 模式的实现
     *
     * 技术解析：
     * - 同步模式下，watch 会立即触发回调
     * - 实现相对简单，使用一个简单的 ignore 标志
     */
    let ignore = false

    /**
     * 技术解析：
     * - flush: 'sync' 模式下，ignorePrevAsyncUpdates 是空操作
     * - 因为同步模式没有异步更新的概念
     * - 提供这个函数是为了保持 API 一致性
     */
    ignorePrevAsyncUpdates = () => {}

    /**
     * 技术解析：
     * - 在 flush: 'sync' 模式下的 ignoreUpdates 实现
     * - 设置 ignore 标志为 true
     * - 执行 updater 函数
     * - 恢复 ignore 标志为 false
     */
    ignoreUpdates = (updater: () => void) => {
      ignore = true
      updater()
      ignore = false
    }

    /**
     * 技术解析：
     * - 创建同步 watch
     * - 在回调中检查 ignore 标志
     * - 如果 ignore 为 false，才执行 filteredCb
     */
    stop = watch(
      source,
      (...args) => {
        if (!ignore)
          filteredCb(...args)
      },
      watchOptions,
    )
  }
  else {
    /**
     * flush: 'pre' 和 'post' 模式的实现
     *
     * 技术解析：
     * - 这是默认模式（flush: 'pre'）
     * - 使用两个计数器来追踪更新：
     *   - ignoreCounter：记录需要忽略的更新次数
     *   - syncCounter：记录实际的更新次数
     * - 通过比较这两个计数器来决定是否忽略更新
     */

    const disposables: Fn[] = []

    /**
     * 技术解析：
     * - ignoreCounter：在历史操作（undo、redo、revert）之前递增
     * - syncCounter：与源 ref 的每次更改同步递增
     * - 这样可以知道 ref 被修改了多少次，支持链式同步操作
     * - 如果同步触发器的数量多于忽略计数，说明源 ref 中有需要提交的修改
     */
    let ignoreCounter = 0
    let syncCounter = 0

    /**
     * 技术解析：
     * - ignorePrevAsyncUpdates 的实现
     * - 将 ignoreCounter 设置为当前的 syncCounter
     * - 这样可以忽略之前所有已触发但尚未执行的异步更新
     */
    ignorePrevAsyncUpdates = () => {
      ignoreCounter = syncCounter
    }

    /**
     * 技术解析：
     * - 使用一个同步 watch 来计数源的修改
     * - 每次源变化时，syncCounter 加 1
     * - 这个 watch 使用 flush: 'sync'，所以会立即执行
     */
    disposables.push(
      watch(
        source,
        () => {
          syncCounter++
        },
        { ...watchOptions, flush: 'sync' },
      ),
    )

    /**
     * 技术解析：
     * - ignoreUpdates 的实现
     * - 记录更新前的 syncCounter
     * - 执行 updater 函数（可能多次修改源）
     * - 计算实际更新次数并加到 ignoreCounter 上 表示这次需要忽略的更新次数
     * - 这样可以忽略 updater 函数内部的所有更新
     */
    ignoreUpdates = (updater: () => void) => {
      const syncCounterPrev = syncCounter
      updater()
      // 在这里记录updater中执行了几次操作，代表需要忽略的次数
      ignoreCounter += syncCounter - syncCounterPrev
    }

    /**
     * 技术解析：
     * - 创建异步 watch（flush: 'pre' 或 'post'）
     * - 在回调中判断是否需要忽略这次更新
     * - 判断逻辑：
     *   - 如果 ignoreCounter > 0 且 ignoreCounter === syncCounter
     *   - 说明只有忽略操作的修改，没有其他额外修改
     *   - 这种情况下忽略这次提交
     * - 否则，执行回调
     */
    disposables.push(
      watch(
        source,
        (...args) => {
          const ignore = ignoreCounter > 0 && ignoreCounter === syncCounter
          ignoreCounter = 0
          syncCounter = 0
          if (ignore)
            return

          filteredCb(...args)
        },
        watchOptions,
      ),
    )

    /**
     * 技术解析：
     * - stop 函数的实现
     * - 遍历 disposables 数组，调用每个清理函数
     * - 包括两个 watch 的停止函数
     */
    stop = () => {
      disposables.forEach(fn => fn())
    }
  }

  return { stop, ignoreUpdates, ignorePrevAsyncUpdates }
}

/**
 * @deprecated 请使用 watchIgnorable 代替
 */
export const ignorableWatch = watchIgnorable

/**
 * ========================================
 * 技术手段分析
 * ========================================
 *
 * 1. **函数重载（Function Overloads）**
 *    - 提供多个类型签名，支持不同的 source 类型
 *    - 提高 TypeScript 类型推断的准确性
 *
 * 2. **组合式函数（Composable）设计模式**
 *    - 遵循 Vue 3 Composition API 最佳实践
 *    - 通过 return 对象暴露 API
 *
 * 3. **策略模式（Strategy Pattern）**
 *    - 根据 flush 选项的不同，采用不同的实现策略
 *    - flush: 'sync' 使用简单的标志位
 *    - flush: 'pre'/'post' 使用双计数器机制
 *
 * 4. **双计数器机制**
 *    - ignoreCounter：记录需要忽略的更新次数
 *    - syncCounter：记录实际的更新次数
 *    - 通过比较两个计数器来决定是否忽略更新
 *
 * 5. **同步 watch + 异步 watch 组合**
 *    - 同步 watch：立即计数，精确追踪每次修改
 *    - 异步 watch：延迟执行，利用 Vue 的批量更新机制
 *    - 两者配合实现精确的忽略控制
 *
 * 6. **高阶函数（Higher-Order Functions）**
 *    - createFilterWrapper：包装回调函数，支持事件过滤
 *    - ignoreUpdates：接收 updater 函数，包装执行
 *
 * 7. **闭包（Closure）**
 *    - 使用闭包维护内部状态（ignore、ignoreCounter、syncCounter）
 *    - 这些状态对外不可见，只能通过返回的函数操作
 *
 * 8. **资源管理**
 *    - 使用 disposables 数组收集所有需要清理的资源
 *    - stop 函数统一清理所有资源
 *
 * 9. **API 一致性设计**
 *    - flush: 'sync' 模式下，ignorePrevAsyncUpdates 是空操作
 *    - 提供这个函数是为了保持 API 一致性
 *    - 让用户代码在不同 flush 模式下都能正常工作
 *
 * 10. **事件过滤机制**
 *     - 支持通过 eventFilter 自定义事件过滤
 *     - 默认使用 bypassFilter，即不过滤任何事件
 *     - 与 createFilterWrapper 配合使用
 */
