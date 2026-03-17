import type { MaybeRef, Ref, ShallowRef, UnwrapRef } from 'vue'
import { noop, promiseTimeout, until } from '@vueuse/shared'
import { ref as deepRef, shallowRef, toValue } from 'vue'

/**
 * useAsyncState 返回值的基础接口定义
 * 定义了异步状态管理的基本属性和方法
 */
export interface UseAsyncStateReturnBase<Data, Params extends any[], Shallow extends boolean> {
  // 异步操作的状态数据
  state: Shallow extends true ? Ref<Data> : Ref<UnwrapRef<Data>>
  // 是否已完成异步操作
  isReady: Ref<boolean>
  // 是否正在加载中
  isLoading: Ref<boolean>
  // 错误信息
  error: Ref<unknown>
  // 执行异步操作的方法，可设置延迟时间并传入参数
  execute: (delay?: number, ...args: Params) => Promise<Data | undefined>
  // 立即执行异步操作的方法，无延迟
  executeImmediate: (...args: Params) => Promise<Data | undefined>
}

/**
 * useAsyncState 的返回值类型
 * 继承基础接口并实现 PromiseLike 接口，使其可以被 await
 */
export type UseAsyncStateReturn<Data, Params extends any[], Shallow extends boolean>
  = UseAsyncStateReturnBase<Data, Params, Shallow>
    & PromiseLike<UseAsyncStateReturnBase<Data, Params, Shallow>>

/**
 * useAsyncState 的配置选项接口
 * 定义了异步状态管理的各种配置参数
 */
export interface UseAsyncStateOptions<Shallow extends boolean, D = any> {
  /**
   * 当 immediate 为 true 时，第一次执行 promise 的延迟时间（毫秒）。
   *
   * @default 0
   */
  delay?: number

  /**
   * 在函数调用后立即执行 promise。
   * 如果设置了 delay，则会应用延迟。
   *
   * 设置为 false 时，需要手动执行。
   *
   * @default true
   */
  immediate?: boolean

  /**
   * 捕获到错误时的回调函数。
   */
  onError?: (e: unknown) => void

  /**
   * 捕获到成功结果时的回调函数。
   * @param {D} data 成功的数据
   */
  onSuccess?: (data: D) => void

  /**
   * 在执行 promise 之前将状态重置为初始状态。
   *
   * 这在多次调用 execute 函数时很有用（例如，刷新数据）。
   * 设置为 false 时，当前状态保持不变直到 promise 解析完成。
   *
   * @default true
   */
  resetOnExecute?: boolean

  /**
   * 是否使用 shallowRef。
   *
   * @default true
   */
  shallow?: Shallow

  /**
   * 执行 execute 函数时是否抛出错误
   *
   * @default false
   */
  throwError?: boolean
}

/**
 * 响应式的异步状态管理函数。
 * 不会阻塞 setup 函数，并在 promise 准备就绪时触发变化。
 *
 * 技术特点：
 * 1. 支持泛型，提供类型安全
 * 2. 使用执行计数器防止竞态条件
 * 3. 可选择使用浅层响应式（shallowRef）提升性能
 * 4. 实现 PromiseLike 接口，支持 await 操作
 * 5. 提供延迟执行和手动执行选项
 *
 * @see https://vueuse.org/useAsyncState
 * @param promise         要解析的 Promise 或异步函数
 * @param initialState    初始状态，在首次评估完成前使用
 * @param options         配置选项
 */
export function useAsyncState<Data, Params extends any[] = any[], Shallow extends boolean = true>(
  promise: Promise<Data> | ((...args: Params) => Promise<Data>),
  initialState: MaybeRef<Data>,
  options?: UseAsyncStateOptions<Shallow, Data>,
): UseAsyncStateReturn<Data, Params, Shallow> {
  // 解构配置选项，设置默认值
  const {
    immediate = true, // 是否立即执行
    delay = 0, // 延迟时间
    onError = globalThis.reportError ?? noop, // 错误处理函数
    onSuccess = noop, // 成功回调函数
    resetOnExecute = true, // 执行前是否重置状态
    shallow = true, // 是否使用浅层响应式
    throwError, // 是否抛出错误
  } = options ?? {}

  // 根据配置决定使用 shallowRef 还是 deepRef 创建响应式状态
  const state = shallow ? shallowRef(initialState) : deepRef(initialState)
  const isReady = shallowRef(false) // 是否准备就绪
  const isLoading = shallowRef(false) // 是否正在加载
  const error = shallowRef<unknown | undefined>(undefined) // 错误信息

  // 执行计数器，用于防止竞态条件
  let executionsCount = 0

  // 异步执行函数，支持延迟和参数传递
  async function execute(delay = 0, ...args: any[]) {
    // 生成当前执行的唯一ID，用于防止旧请求覆盖新请求的结果
    const executionId = (executionsCount += 1)

    // 根据配置决定是否在执行前重置状态
    if (resetOnExecute)
      state.value = toValue(initialState) // 将状态重置为初始值
    error.value = undefined // 清除错误信息
    isReady.value = false // 设置为未就绪状态
    isLoading.value = true // 设置为加载中状态

    // 如果设置了延迟，则等待指定时间
    if (delay > 0)
      await promiseTimeout(delay)

    // 根据 promise 类型决定如何执行
    const _promise = typeof promise === 'function'
      ? promise(...args as Params) // 如果是函数则调用并传入参数
      : promise // 否则直接使用 promise

    try {
      // 等待异步操作完成
      const data = await _promise

      // 使用执行ID检查，确保只有最新的请求更新状态（防止竞态条件）
      if (executionId === executionsCount) {
        state.value = data // 更新状态数据
        isReady.value = true // 设置为已就绪状态
      }

      onSuccess(data) // 调用成功回调
      return data // 返回数据
    }
    catch (e) {
      // 同样使用执行ID检查，确保只有最新的请求更新错误状态
      if (executionId === executionsCount)
        error.value = e // 更新错误信息

      onError(e) // 调用错误回调

      // 根据配置决定是否抛出错误
      if (throwError)
        throw e
    }
    finally {
      // 使用执行ID检查，确保只有最新的请求结束加载状态
      if (executionId === executionsCount)
        isLoading.value = false // 结束加载状态
    }
  }

  // 如果配置为立即执行，则在函数初始化时执行
  if (immediate) {
    execute(delay)
  }

  // 构建返回对象的基础结构
  const shell: UseAsyncStateReturnBase<Data, Params, Shallow> = {
    // 根据泛型参数确定正确的类型
    state: state as Shallow extends true ? ShallowRef<Data> : Ref<UnwrapRef<Data>>,
    isReady,
    isLoading,
    error,
    execute,
    // 立即执行版本，延迟时间为0
    executeImmediate: (...args: any[]) => execute(0, ...args),
  }

  // 等待加载完成的辅助函数
  function waitUntilIsLoaded() {
    return new Promise<UseAsyncStateReturnBase<Data, Params, Shallow>>((resolve, reject) => {
      // 使用 until 工具等待 isLoading 变为 false
      until(isLoading).toBe(false).then(() => resolve(shell)).catch(reject)
    })
  }

  // 返回扩展的对象，实现 PromiseLike 接口
  return {
    ...shell,
    // 实现 then 方法，使返回值可以被 await
    then(onFulfilled, onRejected) {
      return waitUntilIsLoaded()
        .then(onFulfilled, onRejected)
    },
  }
}
