import type { MaybeRefOrGetter } from 'vue'
import type { ConfigurableWindow } from '../_configurable'
import type { MaybeElementRef } from '../unrefElement'
import { computed, shallowRef, toValue, watch } from 'vue'
import { defaultWindow } from '../_configurable'
import { unrefElement } from '../unrefElement'
import { useMutationObserver } from '../useMutationObserver'

export interface UseCssVarOptions extends ConfigurableWindow {
  initialValue?: string
  /**
   * Use MutationObserver to monitor variable changes
   * el.style.setProperty(color, 'blue')有这种操作，需要赋值为true，检测变化，更新值，否则不会更新值
   * @default false
   */
  observe?: boolean
}

/**
 * Manipulate CSS variables.
 *
 * @see https://vueuse.org/useCssVar
 * @param prop
 * @param target
 * @param options
 */
export function useCssVar(
  prop: MaybeRefOrGetter<string | null | undefined>,
  target?: MaybeElementRef,
  options: UseCssVarOptions = {},
) {
  // 解构 options 参数，设置默认值
  const { window = defaultWindow, initialValue, observe = false } = options

  // 创建响应式变量，存储 CSS 变量的当前值
  const variable = shallowRef(initialValue)

  // 计算属性：获取目标元素，如果未指定则使用文档根元素
  const elRef = computed(() => unrefElement(target) || window?.document?.documentElement)

  // 更新 CSS 变量值的函数
  function updateCssVar() {
    // 获取 CSS 变量名和目标元素
    const key = toValue(prop)
    const el = toValue(elRef)

    // 如果元素存在、窗口存在且变量名有效，则获取计算后的样式值
    if (el && window && key) {
      // 获取 CSS 自定义属性的值
      const value = window.getComputedStyle(el).getPropertyValue(key)?.trim()

      // 将获取到的值或现有值或初始值赋给响应式变量
      variable.value = value || variable.value || initialValue
    }
  }

  // 如果启用观察模式，当元素的样式或类发生改变时自动更新 CSS 变量
  if (observe) {
    useMutationObserver(elRef, updateCssVar, {
      attributeFilter: ['style', 'class'], // 只观察 style 和 class 属性的变化
      window,
    })
  }

  // 监听目标元素和 CSS 变量名的变化
  watch(
    [elRef, () => toValue(prop)],
    (_, old) => {
      // 在变化前先移除旧的 CSS 变量 在demo中的例子二 不会给变量清除掉（先清除，然后更新的时候模版又设置上了），但是如果是
      // elv?.value?.style.setProperty('--color-two', 'red')这种自己添加的会清除掉
      if (old[0] && old[1])
        old[0].style.removeProperty(old[1])
      // 然后更新新的 CSS 变量
      updateCssVar()
    },
    { immediate: true }, // 立即执行一次
  )

  // 监听响应式变量和目标元素的变化，同步到实际的 CSS 样式
  watch(
    [variable, elRef],
    ([val, el]) => {
      // 获取 CSS 变量名
      const raw_prop = toValue(prop)

      // 如果元素样式和变量名都存在，则设置 CSS 属性
      if (el?.style && raw_prop) {
        if (val == null)
          // 如果值为 null 或 undefined，则移除该 CSS 属性
        // 这个属性是通过代码添加的elv?.value?.style.setProperty('--color-two', 'red')
          el.style.removeProperty(raw_prop)
        else
          // 否则设置该 CSS 属性的值
          el.style.setProperty(raw_prop, val)
      }
    },
    { immediate: true }, // 立即执行一次
  )

  // 返回响应式的 CSS 变量值
  return variable
}
