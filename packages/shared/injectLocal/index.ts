/**
 * Vue 的注入键类型
 */
import type { InjectionKey } from 'vue'

/**
 * 获取当前组件实例、作用域和注入上下文的 API
 * - getCurrentInstance: 获取当前组件实例
 * - getCurrentScope: 获取当前活动的作用域
 * - hasInjectionContext: 检查是否有注入上下文
 * - inject: Vue 的原生注入函数
 */
import { getCurrentInstance, getCurrentScope, hasInjectionContext, inject } from 'vue'

/**
 * 本地提供的状态映射表
 * 存储每个组件实例或作用域中本地提供的状态
 */
import { localProvidedStateMap } from '../provideLocal/map'

/**
 * 在原生 inject 的基础上，允许在同一个组件中先调用 provide 后直接调用 inject 来获取值
 *
 * 解决了 Vue 原生 inject 无法在同一组件中先 provide 后 inject 的限制
 * 通过本地状态映射表实现本地提供值的查找和注入
 *
 * @template T - 注入值的类型
 * @param key - 注入键，可以是 InjectionKey、字符串或数字
 * @param defaultValue - 默认值，当找不到注入值时返回
 * @param treatDefaultAsFactory - 是否将默认值视为工厂函数
 * @returns 注入的值或默认值
 *
 * @example
 * ```ts
 * // 在同一组件中先提供后注入
 * injectLocal('MyInjectionKey', 1)
 * const injectedValue = injectLocal('MyInjectionKey') // injectedValue === 1
 * ```
 *
 * @__NO_SIDE_EFFECTS__ 标记此函数无副作用，可用于生产环境优化
 */
// @ts-expect-error overloads are not compatible
// 由于函数重载兼容性问题，需要忽略类型检查错误
export const injectLocal: typeof inject = <T>(...args) => {
  // 获取注入键，可能是 InjectionKey、字符串或数字
  const key = args[0] as InjectionKey<T> | string | number

  // 获取当前组件实例的代理对象
  const instance = getCurrentInstance()?.proxy

  // 获取所有者对象，优先使用组件实例，否则使用当前作用域
  const owner = instance ?? getCurrentScope()

  // 检查是否在 setup 上下文中调用
  if (owner == null && !hasInjectionContext())
    throw new Error('injectLocal must be called in setup')

  // 检查本地状态映射表中是否存在该所有者的提供状态
  // 并且该键是否存在于本地提供状态中
  if (owner && localProvidedStateMap.has(owner) && key in localProvidedStateMap.get(owner)!)
    // 如果存在，直接从本地状态映射表中返回值
    return localProvidedStateMap.get(owner)![key]

  // 如果本地没有找到，使用原生 inject 函数从正常的提供链中查找
  // @ts-expect-error overloads are not compatible
  // 由于函数重载兼容性问题，需要忽略类型检查错误
  return inject(...args)
}
