import type { WritableComputedRef } from 'vue'
import type { BasicColorSchema, UseColorModeOptions } from '../useColorMode'
import { computed } from 'vue'
import { useColorMode } from '../useColorMode'

/**
 * useDark 函数的配置选项接口
 * 继承自 UseColorModeOptions，但省略了 modes 和 onChanged（这两个由 useDark 内部处理）
 */
export interface UseDarkOptions extends Omit<UseColorModeOptions<BasicColorSchema>, 'modes' | 'onChanged'> {
  /**
   * 当 isDark=true 时应用到目标元素的值
   * @default 'dark'
   */
  valueDark?: string

  /**
   * 当 isDark=false 时应用到目标元素的值
   * @default ''
   */
  valueLight?: string

  /**
   * 自定义处理更新的回调函数
   * 当提供此选项时，会覆盖默认行为
   * @default undefined
   * @param isDark - 当前是否是暗黑模式
   * @param defaultHandler - 默认处理函数
   * @param mode - 当前颜色模式
   */
  onChanged?: (isDark: boolean, defaultHandler: ((mode: BasicColorSchema) => void), mode: BasicColorSchema) => void
}

/**
 * useDark 函数的返回值类型
 * 是一个可写的 computed 属性，用于读写暗黑模式状态
 */
export type UseDarkReturn = WritableComputedRef<boolean>

/**
 * 响应式暗黑模式，带自动数据持久化
 *
 * 是 useColorMode 的简化版本，专门用于管理暗黑模式
 * 支持系统设置检测、持久化到 storage 等功能
 *
 * @see https://vueuse.org/useDark
 * @param options - 配置选项
 * @returns 可写的 computed 属性，用于设置和获取暗黑模式状态
 *
 * @example
 * ```vue
 * <script setup>
 * const isDark = useDark()
 * </script>
 *
 * <template>
 *   <button @click="isDark = !isDark">
 *     {{ isDark ? 'Light' : 'Dark' }}
 *   </button>
 * </template>
 * ```
 */
export function useDark(options: UseDarkOptions = {}): UseDarkReturn {
  const {
    valueDark = 'dark',
    valueLight = '',
  } = options

  // 使用 useColorMode，但自定义 modes 和 onChanged
  const mode = useColorMode({
    ...options,
    onChanged: (mode, defaultHandler) => {
      // 如果提供了自定义回调，则调用它，并转换 mode 为布尔值
      if (options.onChanged)
        options.onChanged?.(mode === 'dark', defaultHandler, mode)
      else
        // 否则使用默认处理函数
        defaultHandler(mode)
    },
    modes: {
      dark: valueDark,
      light: valueLight,
    },
  })

  // 获取系统设置的颜色模式
  const system = computed(() => mode.system.value)

  // 暗黑模式的可写 computed 属性
  const isDark = computed<boolean>({
    get() {
      // getter：判断当前模式是否是 'dark'
      return mode.value === 'dark'
    },
    set(v) {
      // setter：设置模式
      const modeVal = v ? 'dark' : 'light'
      // 如果新值与系统设置一致，则设置为 'auto'
      //  这个设计的核心思想是：
      // - 如果用户选择的是系统当前的设置 → 理解为"跟随系统"
      // - 如果用户选择的不是系统当前的设置 → 理解为"固定这个设置"
      if (system.value === modeVal)
        mode.value = 'auto'
      else
        mode.value = modeVal
    },
  })

  return isDark
}
