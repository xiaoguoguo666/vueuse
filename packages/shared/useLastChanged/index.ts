import type { ShallowRef, WatchOptions, WatchSource } from 'vue'
import { shallowReadonly, shallowRef, watch } from 'vue'
import { timestamp } from '../utils'

/**
 * useLastChanged 的配置选项接口
 *
 * 技术解析：
 * - 使用 TypeScript 泛型来支持类型推断
 * - Immediate 泛型控制是否立即执行侦听
 * - InitialValue 泛型根据 initialValue 的类型来推断返回值类型
 * - 继承自 Vue 的 WatchOptions，复用 watch 的所有配置选项
 *
 * @template Immediate - 是否立即执行侦听的布尔类型
 * @template InitialValue - 初始值的类型（number | null | undefined）
 */
export interface UseLastChangedOptions<
  Immediate extends boolean,
  InitialValue extends number | null | undefined = undefined,
> extends WatchOptions<Immediate> {
  /**
   * 初始时间戳值
   * 如果未提供，默认值为 null
   */
  initialValue?: InitialValue
}

/**
 * useLastChanged 的返回类型
 *
 * 技术解析：
 * - 使用联合类型表示两种可能的返回类型
 * - Readonly<ShallowRef<T>> 确保返回的 ref 是只读的，防止外部修改
 * - 根据配置选项的不同，返回值可能是 number | null 或纯 number
 */
export type UseLastChangedReturn = Readonly<ShallowRef<number | null>> | Readonly<ShallowRef<number>>

/**
 * 记录数据最后一次变化的时间戳
 *
 * 技术解析：
 * - 这是一个组合式函数（Composable），遵循 Vue 3 Composition API 最佳实践
 * - 使用函数重载（Function Overloads）提供精确的类型推断
 * - 使用 shallowRef 而不是 ref，因为时间戳是基本类型，不需要深度响应式
 * - 使用 shallowReadonly 包装返回值，确保外部无法直接修改时间戳
 * - 使用 watch 侦听数据源变化，每次变化时更新时间戳
 *
 * @see https://vueuse.org/useLastChanged
 *
 * @param source - 要侦听的数据源，可以是 ref、computed、getter 函数或数组
 * @param options - 配置选项，继承自 watch 的所有选项
 * @returns 只读的 shallowRef，包含最后一次变化的时间戳
 */
export function useLastChanged(source: WatchSource, options?: UseLastChangedOptions<false>): Readonly<ShallowRef<number | null>>
export function useLastChanged(source: WatchSource, options: UseLastChangedOptions<true> | UseLastChangedOptions<boolean, number>): Readonly<ShallowRef<number>>
export function useLastChanged(source: WatchSource, options: UseLastChangedOptions<boolean, any> = {}): UseLastChangedReturn {
  /**
   * 技术解析：
   * - 使用 shallowRef 创建浅层响应式引用
   * - 为什么用 shallowRef 而不是 ref？
   *   1. 时间戳是基本类型（number | null），不需要深度代理
   *   2. 性能更好，避免不必要的深度响应式追踪
   *   3. 对于基本类型，shallowRef 和 ref 的行为完全一致
   *
   * - 使用空值合并运算符 ?? 处理初始值
   *   - 如果 options.initialValue 是 undefined，使用 null 作为默认值
   *   - 如果 options.initialValue 是 null 或 number，则使用提供的值
   */
  const ms = shallowRef<number | null>(options.initialValue ?? null)

  /**
   * 技术解析：
   * - 使用 Vue 的 watch 侦听数据源变化
   * - watch 的回调函数在数据源变化时执行
   * - 每次变化时调用 timestamp() 获取当前时间戳并更新 ms.value
   * - options 直接透传给 watch，支持所有 watch 配置（immediate、deep、flush 等）
   *
   * timestamp() 函数通常返回 Date.now()，即当前时间的毫秒级时间戳
   */
  watch(
    source,
    () => ms.value = timestamp(),
    options,
  )

  /**
   * 技术解析：
   * - 使用 shallowReadonly 包装返回值
   * - 为什么返回只读的 ref？
   *   1. 封装性：时间戳应该由内部逻辑控制，外部不应直接修改
   *   2. 防止意外修改：避免外部代码错误地修改时间戳
   *   3. 单向数据流：遵循 Vue 的单向数据流原则
   *
   * - 使用 shallowReadonly 而不是 readonly：
   *   1. 与 shallowRef 配对使用，保持一致性
   *   2. 对于基本类型，性能相同
   */
  return shallowReadonly(ms)
}
