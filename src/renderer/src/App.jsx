import React, { useEffect, useState } from 'react'
import Ping from 'ping.js'
import { toast } from 'react-toastify'
import ReactPaginate from 'react-paginate'
import { config } from './config'
import useLogStore from './app/logStore'
import useSystemSettingStore from './app/seystemSetting'
import axios from 'axios'

import Avatar from './assets/avatar.jpg'

// icons
import { TbLoader } from 'react-icons/tb'

axios.defaults.baseURL = config.base_url

const p = new Ping()

let emessage = ''
let eversion = ''
let eupn = ''
let ecomputerName = ''
let ecpuUsage = ''
let ecomputerUptime = ''
let euserStatus = ''
let eisFirstLoad = true;

const App = () => {
  const { systemSettings, setSystemSetting, removeSystemSettings } = useSystemSettingStore(
    (state) => ({
      systemSettings: state.systemSettings,
      setSystemSetting: state.setSystemSetting,
      removeSystemSettings: state.removeSystemSettings
    })
  )

  const { logs, setLogs, addLog, removeLogs } = useLogStore((state) => ({
    logs: state.logs,
    setLogs: state.setLogs,
    addLog: state.addLog,
    removeLogs: state.removeLogs
  }))

  // DEV TOOLS
  useEffect(() => {
    if (!config.dev_tools) {
      const handleKeyDown = (event) => {
        if (event.altKey || (event.ctrlKey && event.shiftKey && event.key === 'I')) {
          event.preventDefault()
        }
      }

      window.addEventListener('keydown', handleKeyDown)

      return () => {
        window.removeEventListener('keydown', handleKeyDown)
      }
    }
  }, [])

  // SYSTEM SETTINGS
  const [isSystemSettingsSet, setIsSystemSettingsSet] = useState(false)
  const [isSystemSettingsLoading, setIsSystemSettingsLoading] = useState(false)

  useEffect(() => {
    fetchSystemSettings()
  }, [])

  const fetchSystemSettings = () => {
    setIsSystemSettingsLoading(true)

    if (isSystemSettingsSet === false) {
      setIsSystemSettingsSet(true)
      setIsSystemSettingsLoading(true)

      axios
        .get('/umt-app/system-settings')
        .then((response) => {
          setSystemSetting(response.data)
        })
        .catch(() => {
          toast.error('Error syncing ping settings.')
        })
        .finally(() => {
          setIsSystemSettingsLoading(false)
        })
    } else {
      axios
        .get('/umt-app/system-settings')
        .then((response) => {
          toast.success('Ping settings synced successfully!')
          setSystemSetting(response.data)
        })
        .catch(() => {
          toast.error('Error syncing ping settings.')
        })
        .finally(() => {
          setIsSystemSettingsLoading(false)
        })
    }
  }

  // ELECTRON
  const [isReadyToLog, setIsReadyToLog] = useState(false)

  const [message, setMessage] = useState('')
  const [version, setVersion] = useState('')

  const [upn, setUpn] = useState('')
  const [computerName, setComputerName] = useState('')

  const [cpuUsage, setCpuUsage] = useState('')
  const [computerUptime, setComputerUptime] = useState('')
  const [userStatus, setUserStatus] = useState('')

  useEffect(() => {
    const appInfoHandler = (event, arg) => {
      setMessage(arg.message)
      setVersion(arg.version)

      emessage = arg.message
      eversion = arg.version
    }

    window.bridge.appInfo(appInfoHandler)

    //===============================
    const osInfoHandler = (event, arg) => {
      setUpn(arg.upn)
      setComputerName(arg.computerName)

      eupn = arg.upn
      ecomputerName = arg.computerName
    }

    window.bridge.osInfo(osInfoHandler)

    //===============================
    const machineInfoHandler = (event, arg) => {
      setCpuUsage(arg.cpuUsage)
      setComputerUptime(arg.computerUptime)
      setUserStatus(arg.userStatus)

      ecpuUsage = arg.cpuUsage
      ecomputerUptime = arg.computerUptime
      euserStatus = arg.userStatus
    }

    window.bridge.machineInfo(machineInfoHandler)

    return () => {
      window.bridge.appInfo(appInfoHandler)
      window.bridge.osInfo(osInfoHandler)
      window.bridge.machineInfo(machineInfoHandler)
    }
  }, [])

  useEffect(() => {
    if (isReadyToLog && isSystemSettingsSet) {
      sendLog()
    }
  }, [userStatus])

  // CHECKER FOR SENDING LOGS
  const [count, setCount] = useState(0)

  useEffect(() => {
    const intervalId = setInterval(() => {
      if (isReadyToLog) {
        clearInterval(intervalId)
        return
      }

      if (
        emessage !== '' ||
        eversion !== '' ||
        eupn !== '' ||
        ecomputerName !== '' ||
        ecpuUsage !== '' ||
        ecomputerUptime !== '' ||
        euserStatus !== ''
      ) {
        setIsReadyToLog(true)
        clearInterval(intervalId)
      } else {
        // don't send log if upn is empty
        setIsReadyToLog(false)
      }

      setCount((prevCount) => prevCount + 1)
    }, 1000)

    return () => clearInterval(intervalId)
  }, [
    emessage,
    eversion,
    eupn,
    ecomputerName,
    ecpuUsage,
    ecomputerUptime,
    euserStatus,
    isReadyToLog
  ])

  // SENDING LOGS
  const sendLog = () => {
    if (euserStatus !== 'Active') return

    p.ping(systemSettings.website?.value, function (err, ping) {
      if (err) {
        ping = 0
      }

      const dateTimeLocal = getDateTime()

      const data = {
        id: null,
        computer_username: eupn,
        local_date_and_time: dateTimeLocal,
        computer_name: ecomputerName,
        ip_address: systemSettings?.ip_address,
        cpu_load: ecpuUsage,
        uptime: ecomputerUptime,
        ping,
        created_at: null,
        is_first_load: eisFirstLoad
      }

      axios
        .post('/umt-app/umt-logs', data)
        .then((res) => {
          addLog(res.data.record)
        })
        .catch((error) => {
          toast.error(error.response.message)
          addLog(data)
        })
        .finally(() => {
          eisFirstLoad = false
        })
    })
  }

  useEffect(() => {
    if (isReadyToLog && isSystemSettingsSet) {
      sendLog()

      const interval = setInterval(() => {
        sendLog()
      }, systemSettings.interval?.value * 60 * 1000)

      return () => clearInterval(interval)
    }
  }, [isReadyToLog, isSystemSettingsSet, systemSettings])

  const getDateTime = () => {
    const now = new Date()
    const year = now.getUTCFullYear()
    const month = String(now.getUTCMonth() + 1).padStart(2, '0')
    const day = String(now.getUTCDate()).padStart(2, '0')
    const hours = String(now.getUTCHours()).padStart(2, '0')
    const minutes = String(now.getUTCMinutes()).padStart(2, '0')
    const seconds = String(now.getUTCSeconds()).padStart(2, '0')

    return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`
  }

  // SYNC LOGS
  const [isLogsLoading, setIsLogsLoading] = useState(false)
  const syncLogs = () => {
    setIsLogsLoading(true)

    const filteredLogs = logs.filter((obj) => obj.created_at === null).reverse()

    const data = {
      logs: filteredLogs,
      hostname: ecomputerName,
      username: eupn
    }

    axios
      .post('/umt-app/umt-logs/sync', data)
      .then((res) => {
        setLogs(res.data.records)

        toast.success('Uptime logs synced successfully!')
      })
      .catch((error) => {
        toast.error('User verification failed. User not found.')
      })
      .finally(() => {
        setIsLogsLoading(false)
      })
  }

  const convertUtcToLocal = (utcDateString) => {
    if (!utcDateString) {
      return ''
    }

    const utcDate = new Date(utcDateString)
    const timezoneOffsetInMinutes = utcDate.getTimezoneOffset()
    const timezoneOffsetInMilliseconds = timezoneOffsetInMinutes * 60 * 1000 * -1
    const localDate = new Date(utcDate.getTime() + timezoneOffsetInMilliseconds)
    const year = localDate.getFullYear()
    const month = String(localDate.getMonth() + 1).padStart(2, '0')
    const day = String(localDate.getDate()).padStart(2, '0')
    const hours = String(localDate.getHours()).padStart(2, '0')
    const minutes = String(localDate.getMinutes()).padStart(2, '0')
    const seconds = String(localDate.getSeconds()).padStart(2, '0')

    return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`
  }

  /*******************************************
   ***** PAGINATE
   *******************************************/
  const [filteredMonitoringLogs, setFilteredMonitoringLogs] = useState([])

  const [page, setPage] = useState(1)
  const [limit, setLimit] = useState(10)
  const [search, setSearch] = useState('')

  useEffect(() => {
    setFilteredMonitoringLogs(paginateArray())
  }, [logs, page, limit, search])

  const paginateArray = () => {
    try {
      const startIndex = (page - 1) * parseInt(limit)
      const endIndex = startIndex + parseInt(limit)

      return logs
        .filter((log) => {
          return log.local_date_and_time?.includes(search)
        })
        .slice(startIndex, endIndex)
    } catch (error) {
      removeLogs()
    }
  }
  /*******************************************/

  const restartApp = () => {
    window.bridge.restartApp(); // Send message to restart the app
  };
  
  const minimizeApp = () => {
    window.bridge.minimizeApp(); // Send message to restart the app
  };

  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false)

  return (
    <>
      <div className="wrapper">
        <nav id="sidebar" className={`sidebar js-sidebar ${isSidebarCollapsed && 'collapsed'}`}>
          <div className="sidebar-content js-simplebar">
            <div className="">
              <div className="sidebar-cta-content">
                <img
                  src={Avatar}
                  className="avatar object-fit-cover rounded-circle border border-muted border-1 mb-1"
                />
                <strong className="d-inline-block text-uppercase ellipsis w-100 mb-0">{upn}</strong>
                <div className="text-sm mb-3">USERNAME</div> <i className="fa fa-save"></i>
                <strong className="d-inline-block text-uppercase">{computerName}</strong>
                <div className="text-sm">COMPUTER NAME</div>
              </div>
            </div>

            <ul className="sidebar-nav"></ul>

            <div className="sidebar-cta">
              <div className="sidebar-cta-content">
                <strong className="d-inline-block mb-2">MegaTool API</strong>
                <div className="text-sm">{systemSettings.version?.value}</div>
                <div className="text-sm">{systemSettings.update?.value}</div>
              </div>

              <div className="sidebar-cta-content">
                <strong className="d-inline-block mb-2">UMT</strong>
                <div className="text-sm">Uptime Monitoring Tool</div>
                <div className="text-sm">Version {version}</div>
                <div className="text-sm">{config.app_update}</div>
                <div className="text-sm">{message}</div>
              </div>
            </div>
          </div>
        </nav>

        <div className="main">
          <nav className="navbar navbar-expand navbar-light navbar-bg">
            <a
              className="js-sidebar-toggle"
              onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
            >
              <i className="hamburger align-self-center"></i>
            </a>

            <div className="navbar-collapse collapse">
              <ul className="navbar-nav navbar-align">
                <li className="nav-item">
                  <a className="nav-link">
                    <button className='btn btn-sm btn-secondary me-2' onClick={minimizeApp}>
                      Minimize
                    </button>

                    <button className='btn btn-sm btn-primary' onClick={restartApp}>
                      Restart
                    </button>
                  </a>
                </li>
              </ul>
            </div>
          </nav>

          <main className="content">
            <div className="container-fluid p-0">
              <h1 className="h3 mb-3">Dashboard</h1>
              {/* <button
            onClick={() => {
              removeLogs()
            }}
          >
            Clear {count}
          </button> */}

              <div className="row">
                <div className="col-lg-9">
                  <div className="card">
                    <div className="card-body">
                      <div className="d-flex justify-content-between align-items-center mb-3">
                        <h5 className="card-title mb-0">My Logs</h5>

                        <button
                          className="btn btn-primary btn-sm"
                          title="sync logs"
                          onClick={() => syncLogs()}
                          disabled={isLogsLoading}
                        >
                          {isLogsLoading ? (
                            <TbLoader className="feather rotate" />
                          ) : (
                            <TbLoader className="feather" />
                          )}
                        </button>
                      </div>

                      <div className="d-flex flex-column flex-md-row justify-content-between align-items-center gap-2 mb-3">
                        <label className="d-flex justify-content-between align-items-center gap-1">
                          <span>Show</span>
                          <select
                            className="form-select form-select-sm"
                            onChange={(e) => {
                              setPage(1)
                              setLimit(e.target.value)
                            }}
                          >
                            <option value="10">10</option>
                            <option value="25">25</option>
                            <option value="50">50</option>
                            <option value="100">100</option>
                          </select>
                          <span>entries</span>
                        </label>

                        <label className="d-flex justify-content-between align-items-center gap-1">
                          <span>Search: </span>
                          <input
                            className="form-control form-control-sm"
                            type="text"
                            value={search}
                            onInput={(e) => setSearch(e.target.value)}
                          />
                        </label>
                      </div>

                      <div className="table-responsive mb-3">
                        <table className="table table-striped table-hover mb-0">
                          <thead>
                            <tr>
                              <th>ID</th>
                              <th>User ID</th>
                              <th>Local Date & Time</th>
                              <th>Date & Time Created Server</th>
                              <th>Is Synced</th>
                              <th>CPU Load</th>
                              <th>Computer Name</th>
                              <th>IP Address</th>
                              <th>Computer Uptime</th>
                              <th>Ping (ms)</th>
                            </tr>
                          </thead>
                          <tbody>
                            {filteredMonitoringLogs.map((log, index) => {
                              return (
                                <tr key={index}>
                                  <td>{log.id}</td>
                                  <td>{log.user_id}</td>
                                  <td>{convertUtcToLocal(log.local_date_and_time)}</td>
                                  <td>
                                    {isLogsLoading && !log.created_at
                                      ? 'Syncing...'
                                      : convertUtcToLocal(log.created_at)}
                                  </td>
                                  <td>
                                    {isLogsLoading && !log.created_at
                                      ? 'Syncing...'
                                      : convertUtcToLocal(log.created_at)
                                      ? 'Yes'
                                      : 'No'}
                                  </td>
                                  <td>{log.cpu_load}</td>
                                  <td>{log.computer_name}</td>
                                  <td>{log.ip_address}</td>
                                  <td>{log.uptime}</td>
                                  <td>{log.ping}</td>
                                </tr>
                              )
                            })}
                            {filteredMonitoringLogs && filteredMonitoringLogs.length === 0 && (
                              <tr className="text-center">
                                <td colSpan="100%">No records to show.</td>
                              </tr>
                            )}
                          </tbody>
                        </table>
                      </div>

                      <div className="d-flex flex-column flex-md-row justify-content-between align-items-center gap-2">
                        <label className="d-flex justify-content-between align-items-center">
                          {`Showing ${
                            filteredMonitoringLogs?.length > 0 ? (page - 1) * limit + 1 : 0
                          } to ${(page - 1) * limit + filteredMonitoringLogs?.length} of ${
                            logs?.length
                          } entries`}
                        </label>

                        <ReactPaginate
                          containerClassName="pagination pagination-sm mb-0"
                          pageCount={Math.ceil(logs?.length / limit) || 1}
                          marginPagesDisplayed="2"
                          pageRangeDisplayed="3"
                          onPageChange={(event) => {
                            setPage(event.selected + 1)
                          }}
                          forcePage={page - 1}
                          previousLabel={<span>&laquo;</span>}
                          nextLabel={<span>&raquo;</span>}
                          breakLabel="..."
                          breakClassName="page-item disabled"
                          breakLinkClassName="page-link"
                          pageClassName="page-item"
                          pageLinkClassName="page-link"
                          previousClassName="page-item"
                          previousLinkClassName="page-link"
                          nextClassName="page-item"
                          nextLinkClassName="page-link"
                          activeClassName="active"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                <div className="col-lg-3">
                  <div className="card">
                    <div className="card-body">
                      <div className="d-flex justify-content-between align-items-center mb-3">
                        <h5 className="card-title mb-0">Settings</h5>

                        <button
                          className="btn btn-primary btn-sm"
                          title="sync settings"
                          onClick={() => fetchSystemSettings()}
                          disabled={isSystemSettingsLoading}
                        >
                          {isSystemSettingsLoading ? (
                            <TbLoader className="feather rotate" />
                          ) : (
                            <TbLoader className="feather" />
                          )}
                        </button>
                      </div>

                      <div className="mb-3">
                        <div className="input-group input-group-lg">
                          <span className="input-group-text" style={{ width: '120px' }}>
                            Ping Interval
                          </span>
                          <input
                            type="text"
                            className="form-control"
                            value={`${systemSettings?.interval?.value} mins`}
                            readOnly
                          />
                        </div>
                        <div className="form-text">This is the default ping interval.</div>
                      </div>

                      <div className="mb-3">
                        <div className="input-group input-group-lg">
                          <span className="input-group-text" style={{ width: '120px' }}>
                            Ping Website
                          </span>
                          <input
                            type="text"
                            className="form-control"
                            value={systemSettings?.website?.value}
                            readOnly
                          />
                        </div>
                        <div className="form-text">This is the website to ping.</div>
                      </div>

                      <div>
                        <div className="input-group input-group-lg">
                          <span className="input-group-text" style={{ width: '120px' }}>
                            Ping Quantity
                          </span>
                          <input
                            type="text"
                            className="form-control"
                            value={systemSettings?.quantity?.value}
                            readOnly
                          />
                        </div>
                        <div className="form-text">
                          This is the number of times the ping will be sent to the ping website.
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </main>
        </div>
      </div>
    </>
  )
}

export default App
