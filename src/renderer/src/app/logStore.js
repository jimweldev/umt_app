import { create } from 'zustand'
import { devtools, persist } from 'zustand/middleware'

const MAX_LOGS = 1000

const logStore = (set) => ({
  logs: [],
  setLogs: (payload) => {
    set(() => ({
      logs: payload
    }))
  },
  addLog: (log) => {
    set((state) => ({
      logs: [log, ...state.logs.slice(0, MAX_LOGS - 1)]
    }))
  },
  removeLogs: () => {
    set(() => ({
      logs: []
    }))
  }
})

const useLogStore = create(
  devtools(
    persist(logStore, {
      name: 'logs'
    })
  )
)

export default useLogStore
