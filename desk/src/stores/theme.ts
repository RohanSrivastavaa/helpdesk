import { defineStore } from "pinia"
import { ref } from "vue"

export const useThemeStore = defineStore("theme", () => {
  const isDark = ref(false)

  function initTheme() {
    const saved = localStorage.getItem("theme")
    if (saved) {
      isDark.value = saved === "dark"
    } else {
      isDark.value = window.matchMedia("(prefers-color-scheme: dark)").matches
    }
    applyTheme()
  }

  function toggleTheme() {
    isDark.value = !isDark.value
    localStorage.setItem("theme", isDark.value ? "dark" : "light")
    applyTheme()
  }

  function applyTheme() {
    document.documentElement.setAttribute(
      "data-theme",
      isDark.value ? "dark" : "light"
    )
  }

  return { isDark, initTheme, toggleTheme }
})
