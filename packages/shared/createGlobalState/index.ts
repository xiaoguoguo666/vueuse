/**
 * 任意函数类型
 */
import type { AnyFn } from '../utils'

/**
 * Vue 的 effectScope API，用于创建响应式作用域
 */
import { effectScope } from 'vue'

/**
 * createGlobalState 函数的返回值类型
 * 保持与输入函数相同的类型
 */
export type CreateGlobalStateReturn<Fn extends AnyFn = AnyFn> = Fn

/**
 * 在全局作用域中保持状态，使其可在 Vue 实例之间复用
 *
 * 通过 effectScope 管理响应式副作用，确保全局状态的响应性
 * 第一次调用时创建状态，后续调用返回相同的状态实例
 *
 * @see https://vueuse.org/createGlobalState
 * @param stateFactory 创建状态的工厂函数
 * @returns 返回一个函数，调用时返回全局共享的状态
 *
 * @__NO_SIDE_EFFECTS__ 标记此函数无副作用，可用于生产环境优化
 *
 * @example
 * ```ts
 * // 创建全局状态
 * const useGlobalCounter = createGlobalState(() => {
 *   return ref(0)
 * })
 *
 * // 在多个组件中使用相同的状态
 * const counter1 = useGlobalCounter() // 返回相同的 ref
 * const counter2 = useGlobalCounter() // 返回相同的 ref
 * ```
 */
export function createGlobalState<Fn extends AnyFn>(
  stateFactory: Fn,
): CreateGlobalStateReturn<Fn> {
  // 标记状态是否已初始化
  let initialized = false

  // 存储全局状态
  let state: any

  // 创建一个独立的响应式作用域，用于管理副作用
  // effectScope(true) 创建一个活跃的作用域
  // effectScope 接受一个参数，以“分离”模式创建。分离的作用域不会被其父作用域收集。
  const scope = effectScope(true)

  // 返回一个函数，该函数实现了单例模式
  return ((...args: any[]) => {
    if (!initialized) {
      // 第一次调用时，在作用域内运行工厂函数创建状态
      // 这样可以确保响应式副作用被正确捕获到这个作用域中
      state = scope.run(() => stateFactory(...args))!
      initialized = true
    }
    // 后续调用直接返回已创建的状态
    return state
  }) as Fn
}
