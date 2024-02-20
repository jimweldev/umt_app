import { create } from 'zustand'
import { devtools, persist } from 'zustand/middleware'

const systemSettingStore = (set) => ({
  systemSettings: [],
  setSystemSetting: (systemSetting) => {
    set(() => ({
      systemSettings: systemSetting
    }))
  },
  removeSystemSettings: () => {
    set(() => ({
      systemSettings: []
    }))
  }
})

const useSystemSettingStore = create(
  devtools(
    persist(systemSettingStore, {
      name: 'systemSettings'
    })
  )
)

export default useSystemSettingStore
