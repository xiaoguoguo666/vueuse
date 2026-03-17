/**
 * Vue 的 EffectScope 类型
 */
import type { EffectScope } from 'vue'

/**
 * 任意函数类型
 */
import type { AnyFn } from '../utils'

/**
 * Vue 的 effectScope API，用于创建响应式作用域
 */
import { effectScope } from 'vue'

/**
 * 在作用域销毁时执行清理函数的工具函数
 */
import { tryOnScopeDispose } from '../tryOnScopeDispose'

/**
 * 检查是否在客户端环境的工具函数
 */
import { isClient } from '../utils'

/**
 * createSharedComposable 函数的返回值类型
 */
export type SharedComposableReturn<T extends AnyFn = AnyFn> = T

/**
 * 创建可共享的组合式函数，使其可以在多个 Vue 实例间共享状态
 *
 * 通过订阅计数和 effectScope 实现状态的共享和自动清理
 * 当第一个使用者调用时创建状态，当最后一个使用者离开时清理状态
 *
 * @template Fn - 组合式函数的类型
 * @param composable 要包装的组合式函数
 * @returns 可共享的组合式函数
 *
 * @see https://vueuse.org/createSharedComposable
 *
 * @__NO_SIDE_EFFECTS__ 标记此函数无副作用，可用于生产环境优化
 *
 * @example
 * ```ts
 * // 创建可共享的计数器
 * const useSharedCounter = createSharedComposable(() => {
 *   const count = ref(0)
 *   const inc = () => count.value++
 *   return { count, inc }
 * })
 *
 * // 在多个组件中使用，它们将共享同一个状态
 * const counter1 = useSharedCounter() // { count: 0, inc: fn }
 * const counter2 = useSharedCounter() // { count: 0, inc: fn } - 同一实例
 * counter1.inc()
 * console.log(counter2.count) // 1
 * ```
 */
export function createSharedComposable<Fn extends AnyFn>(composable: Fn): SharedComposableReturn<Fn> {
  // 如果不在客户端环境（如 SSR），直接返回原函数
  if (!isClient)
    return composable

  // 记录当前有多少个使用者
  let subscribers = 0

  // 存储组合式函数的返回值（共享状态）
  let state: ReturnType<Fn> | undefined

  // 存储响应式作用域
  let scope: EffectScope | undefined

  // 清理函数：减少订阅者数量，当没有订阅者时停止作用域并清理状态
  const dispose = () => {
    subscribers -= 1
    // 当订阅者数量为 0 时，停止作用域并清理资源
    if (scope && subscribers <= 0) {
      scope.stop() // 停止作用域，清理所有响应式副作用
      state = undefined // 清理状态
      scope = undefined // 清理作用域引用
    }
  }

  // 返回一个函数，实现订阅计数和状态共享
  return <Fn>((...args) => {
    // 增加订阅者数量
    subscribers += 1

    // 如果还没有创建作用域和状态，则创建它们
    if (!scope) {
      scope = effectScope(true) // 创建并立即激活作用域
      // 在作用域内运行组合式函数，确保所有响应式副作用被捕获到此作用域中
      state = scope.run(() => composable(...args))
    }

    // 注册作用域销毁时的清理函数
    tryOnScopeDispose(dispose)

    // 返回共享的状态
    return state
  })
}
