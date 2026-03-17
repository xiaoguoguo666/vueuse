/**
 * Vue 的注入键类型
 */
import type { InjectionKey } from 'vue'

/**
 * 本地注入函数，用于在组件树中注入值
 */
import { injectLocal } from '../injectLocal'

/**
 * 本地提供函数，用于在组件树中提供值
 */
import { provideLocal } from '../provideLocal'

/**
 * createInjectionState 函数的返回值类型
 * 返回一个包含两个函数的只读元组：
 * - useProvidingState: 在提供者组件中调用以创建和提供状态
 * - useInjectedState: 在消费者组件中调用以注入状态
 */
export type CreateInjectionStateReturn<Arguments extends Array<any>, Return> = Readonly<[
  /**
   * 在提供者组件中调用此函数以创建和提供状态。
   *
   * @param args 传递给组合式函数的参数
   * @returns 组合式函数返回的状态
   */
  useProvidingState: (...args: Arguments) => Return,
  /**
   * 在消费者组件中调用此函数以注入状态。
   *
   * @returns 注入的状态，如果没有提供且未设置默认值则返回 `undefined`
   */
  useInjectedState: () => Return | undefined,
]>

/**
 * createInjectionState 函数的配置选项接口
 */
export interface CreateInjectionStateOptions<Return> {
  /**
   * 自定义注入键，用于标识注入状态
   */
  injectionKey?: string | InjectionKey<Return>
  /**
   * 注入状态的默认值
   */
  defaultValue?: Return
}

/**
 * 创建可以在组件中注入的全局状态
 *
 * 通过 provide/inject 机制实现状态的跨层级传递
 * 支持自定义注入键和默认值
 *
 * @template Arguments - 组合式函数的参数类型数组
 * @template Return - 组合式函数的返回值类型
 * @param composable 要包装的组合式函数
 * @param options 配置选项
 * @returns 包含提供者和消费者函数的元组
 *
 * @see https://vueuse.org/createInjectionState
 *
 * @__NO_SIDE_EFFECTS__ 标记此函数无副作用，可用于生产环境优化
 *
 * @example
 * ```ts
 * // 创建可注入的状态
 * const [useProvideCount, useInjectCount] = createInjectionState(() => {
 *   return reactive({ count: 0 })
 * })
 *
 * // 在父组件中提供状态
 * const MyProvider = defineComponent({
 *   setup() {
 *     useProvideCount()
 *   }
 * })
 *
 * // 在子组件中注入状态
 * const MyConsumer = defineComponent({
 *   setup() {
 *     const countState = useInjectCount()
 *     // 使用 countState.count
 *   }
 * })
 * ```
 */
export function createInjectionState<Arguments extends Array<any>, Return>(
  composable: (...args: Arguments) => Return, // 要包装的组合式函数
  options?: CreateInjectionStateOptions<Return>, // 配置选项
): CreateInjectionStateReturn<Arguments, Return> {
  // 创建或使用提供的注入键，优先使用自定义键，否则使用 Symbol
  const key: string | InjectionKey<Return> = options?.injectionKey || Symbol(composable.name || 'InjectionState')

  // 获取默认值
  const defaultValue = options?.defaultValue

  // 创建提供者函数：执行组合式函数并将结果提供给后代组件
  const useProvidingState = (...args: Arguments) => {
    const state = composable(...args) // 执行组合式函数获取状态
    provideLocal(key, state) // 提供状态给后代组件
    return state // 返回状态
  }

  // 创建消费者函数：从祖先组件注入状态，如果找不到则使用默认值
  const useInjectedState = () => injectLocal(key, defaultValue)

  // 返回提供者和消费者函数的元组
  return [useProvidingState, useInjectedState]
}
