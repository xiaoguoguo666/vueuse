/**
 * Vue 的注入键类型
 */
import type { InjectionKey } from 'vue'

/**
 * 本地提供的键类型
 */
import type { LocalProvidedKey } from './map'

/**
 * 获取当前组件实例、作用域和提供函数的 API
 * - getCurrentInstance: 获取当前组件实例
 * - getCurrentScope: 获取当前活动的作用域
 * - provide: Vue 的原生提供函数
 */
import { getCurrentInstance, getCurrentScope, provide } from 'vue'

/**
 * 本地提供的状态映射表
 * 存储每个组件实例或作用域中本地提供的状态
 */
import { localProvidedStateMap } from './map'

/**
 * provideLocal 函数的返回值类型
 */
export type ProvideLocalReturn = void

/**
 * 在原生 provide 的基础上，允许在同一个组件中先调用 provide 后直接调用 inject 来获取值
 *
 * 通过本地状态映射表记录提供的值，使 injectLocal 能够在同一组件中访问到本地提供的值
 * 同时仍调用原生 provide 以保持正常的提供链
 *
 * @template T - 提供值的类型
 * @template K - 注入键的类型
 * @param key - 注入键，可以是 InjectionKey 或其他类型
 * @param value - 要提供的值
 *
 * @example
 * ```ts
 * // 在同一组件中提供和注入
 * provideLocal('MyInjectionKey', 1)
 * const injectedValue = injectLocal('MyInjectionKey') // injectedValue === 1
 * ```
 */
export function provideLocal<T, K = LocalProvidedKey<T>>(key: K, value: K extends InjectionKey<infer V> ? V : T): ProvideLocalReturn {
  // 获取当前组件实例的代理对象
  const instance = getCurrentInstance()?.proxy

  // 获取所有者对象，优先使用组件实例，否则使用当前作用域
  const owner = instance ?? getCurrentScope()

  // 检查是否在 setup 上下文中调用
  if (owner == null)
    throw new Error('provideLocal must be called in setup')

  // 如果本地状态映射表中不存在该所有者的记录，则创建一个新的空对象
  if (!localProvidedStateMap.has(owner))
    localProvidedStateMap.set(owner, Object.create(null))

  // 获取该所有者的本地提供状态对象
  const localProvidedState = localProvidedStateMap.get(owner)!

  // 将提供的键值对存储到本地状态映射表中
  // @ts-expect-error allow InjectionKey as key
  // 允许 InjectionKey 作为对象的键
  localProvidedState[key] = value

  // 同时调用原生 provide 函数，确保正常的提供链仍然有效
  return provide<T, K>(key, value)
}
