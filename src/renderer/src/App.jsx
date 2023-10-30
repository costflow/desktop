import costflow from 'costflow';
import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';

function App() {
  const [appVersion, setAppVersion] = useState('');
  const [showSettings, setShowSettings] = useState(false);
  const [tmpConfigPath, setTmpConfigPath] = useState('');
  const [tmpTargetPath, setTmpTargetPath] = useState('');
  const [tmpIndexPath, setTmpIndexPath] = useState('');
  const [tmpTelegramToken, setTmpTelegramToken] = useState('');
  const [parsedTargetPath, setParsedTargetPath] = useState('');
  const [inputString, setInputString] = useState('');
  const [updaterStatus, setUpdaterStatus] = useState('');
  const [configJSON, setConfigJSON] = useState();
  const [preview, setPreview] = useState('');
  const [botStatus, setBotStatus] = useState('loading');

  let listenerStarted = false;

  const initialize = async () => {
    getSettings();
    getCostflowConfig();
    // getBotStatus
    api.send('toMain', 'getBotStatus');
    // getAppVersion
    api.send('toMain', 'getAppVersion');
    startListener();
  };

  const startListener = () => {
    if (!listenerStarted) {
      listenerStarted = true;

      api.receive('fromMain', (cmd, data) => {
        console.log(cmd, data);
        if (cmd === 'botStatus') {
          setBotStatus(data);
        } else if (cmd === 'appVersion') {
          setAppVersion(data);
        } else if (cmd === 'autoUpdater') {
          if (data === 'downloaded') {
            setUpdaterStatus(data);
          }
        } else if (cmd === 'entryInserted') {
          toast.success('Entry added!', {
            id: 'entry-inserted',
            position: 'bottom-center'
          });
          // clear input
          setInputString('');
        }
      });
    }
  };

  const getSettings = async () => {
    const config = await api.getStoreValue('config');
    if (config && Object.keys(config).length !== 0) {
      setTmpConfigPath(config.configPath);
      setTmpTargetPath(config.targetPath);
      setTmpIndexPath(config.indexPath);
      setTmpTelegramToken(config.telegramToken);
    } else {
      toast.error('Please finish the settings first', {
        id: 'no-settings',
        position: 'bottom-center'
      });
      setShowSettings(true);
      return;
    }
    const parsedTargetPath = await api.getParsedTargetPath();
    setParsedTargetPath(parsedTargetPath);
  };
  const getCostflowConfig = async () => {
    const config = await api.getCostflowConfig();
    setConfigJSON(config);
  };
  const resetConfig = async () => {
    await api.resetConfig();
    initialize();
  };

  useEffect(() => {
    initialize();
    window.DEBUG_resetConfig = resetConfig;
  }, []);

  useEffect(() => {
    if (!inputString) {
      setPreview('');
      return;
    }
    parse(inputString);
  }, [inputString]);

  const parse = async (input) => {
    if (!configJSON) {
      toast.error('Please finish the settings first', {
        id: 'no-settings',
        position: 'bottom-center'
      });
      return;
    }
    const parsed = await costflow(input, configJSON);
    setPreview(parsed.output);
  };

  const toggleSettings = () => {
    setShowSettings(!showSettings);
  };

  const toggleBot = async () => {
    if (!tmpTelegramToken) {
      toast.error('Please set your Telegram bot token first', {
        id: 'no-telegram-token',
        position: 'bottom-center'
      });
    }

    if (botStatus === 'running') {
      api.send('toMain', 'stopTelegramBot');
    } else if (botStatus === 'stopped') {
      api.send('toMain', 'startTelegramBot');
    }
  };

  const insertNewEntry = async () => {
    console.log(inputString);
    try {
      const res = await api.send('toMain', 'insertNewEntry', inputString);
      console.log(res);
    } catch (error) {
      console.log(error);
    }
  };
  const copyResult = async (input) => {
    // copy  to clipboard
    if (!input) return;
    let res = await navigator.clipboard.writeText(input);
    console.log(res);
    toast.success('Copied', {
      id: 'copied',
      position: 'bottom-center'
    });
  };

  const submitToMain = async (e) => {
    e.preventDefault();
    try {
      const res = await api.send('toMain', 'updateSettings', {
        configPath: tmpConfigPath,
        targetPath: tmpTargetPath,
        indexPath: tmpIndexPath,
        telegramToken: tmpTelegramToken
      });
      console.log(res);
      toast.success('Settings saved', {
        position: 'bottom-center'
      });
      initialize();
      setShowSettings(false);
    } catch (error) {
      console.log(error);
    }
  };

  return (
    <div className="cf-app d-flex flex-column justify-content-center align-items-center">
      <div className="w-100 specific-h-75 d-flex justify-content-between align-items-center px-5">
        <button type="button" className="btn btn-secondary" onClick={toggleSettings}>
          Settings
        </button>
        <h2 className="cf-font-logo">Costflow</h2>
        {botStatus === 'loading' && (
          <button type="button" className="btn btn-light" disabled>
            Loading
          </button>
        )}
        {botStatus === 'running' && (
          <button type="button" className="btn btn-success" onClick={toggleBot}>
            Running
          </button>
        )}
        {botStatus === 'stopped' && (
          <button type="button" className="btn btn-primary" onClick={toggleBot}>
            Start Bot
          </button>
        )}
      </div>

      {!showSettings ? (
        <div className="w-100 px-5 d-flex flex-column justify-content-between cf-content">
          <div className="d-flex flex-column">
            <div className="d-flex flex-row gap-1">
              <div className="flex-grow-1">
                <input
                  type="text"
                  className="w-100 d-block form-control"
                  id="indexPath"
                  placeholder="Quick add Costflow syntax entry here, click Add button to insert to Beancount file"
                  value={inputString}
                  onChange={(e) => setInputString(e.target.value)}
                />
              </div>
              <button className="btn btn-primary" onClick={insertNewEntry}>
                Add
              </button>
            </div>
            <div className="w-100 mt-1">
              <textarea
                className="w-100 form-control font-monospace"
                id="indexPath"
                placeholder="Realtime preview (Beancount syntax)"
                rows="4"
                value={preview}
                readOnly
                onChange={(e) => setPreview(e.target.value)}
              />
            </div>
            <div className="w-100 mt-1 d-flex justify-content-between align-items-center">
              {parsedTargetPath ? (
                <span className="font-monospace cf-font-small text-secondary">
                  Save path: {parsedTargetPath}
                </span>
              ) : (
                <span className="fs-6" onClick={toggleSettings}>
                  Please finish the settings first
                </span>
              )}
              <button
                className="btn btn-secondary btn-sm"
                onClick={() => copyResult(preview)}
                disabled={preview?.length === 0}
              >
                Copy
              </button>
            </div>
          </div>
          <div className="cf-footer d-flex flex-column align-items-center">
            <div className="w-100 d-flex justify-content-between align-items-center">
              <div>
                Made by{' '}
                <a href="https://leplay.net/" target="_blank" rel="noreferrer">
                  leplay
                </a>
                .
              </div>
              <ul className="d-flex gap-3 m-0">
                <li>
                  <a href="https://www.costflow.io/" target="_blank" rel="noreferrer">
                    Costflow
                  </a>
                </li>
                <li>
                  <a href="https://www.costflow.io/docs/syntax/" target="_blank" rel="noreferrer">
                    Syntax
                  </a>
                </li>
                <li>
                  <a href="https://github.com/costflow" target="_blank" rel="noreferrer">
                    Github
                  </a>
                </li>
                <li>
                  <a href="https://www.costflow.io/docs/donate/" target="_blank" rel="noreferrer">
                    Donate
                  </a>
                </li>
              </ul>
            </div>
            <div className="text-center">
              {updaterStatus === 'downloaded' ? (
                <button className="btn btn-link" onClick={() => api.send('toMain', 'relaunch')}>
                  New version downloaded, click to install
                </button>
              ) : (
                <span
                  className="font-monospace cf-font-small text-secondary"
                  onClick={() => copyResult('v' + appVersion)}
                >
                  v{appVersion}
                </span>
              )}
            </div>
          </div>
        </div>
      ) : (
        <form className="w-100 px-5" onSubmit={submitToMain} action="#">
          <div className="mb-3">
            <label className="form-label" htmlFor="configPath">
              Costflow Syntax config file path (
              <a href="https://www.costflow.io/docs/syntax/config" target="_blank" rel="noreferrer">
                example
              </a>
              )
            </label>
            <input
              type="text"
              className="form-control"
              id="configPath"
              value={tmpConfigPath}
              required
              placeholder="/Users/leplay/Costflow/config.json"
              onChange={(e) => setTmpConfigPath(e.target.value)}
            />
          </div>
          <div className="mb-3">
            <label className="form-label" htmlFor="targetPath">
              Beancount file path
            </label>
            <input
              type="text"
              className="form-control"
              id="targetPath"
              value={tmpTargetPath}
              required
              placeholder="/Users/leplay/Costflow/{{YYYY}}/{{MM}}.bean"
              onChange={(e) => setTmpTargetPath(e.target.value)}
            />
            <div className="form-text">
              &#123;&#123;YYYY&#125;&#125;, &#123;&#123;MM&#125;&#125;, &#123;&#123;DD&#125;&#125;
              are allowed for dynamical path, more info on{' '}
              <a href="https://day.js.org/docs/en/display/format" target="_blank" rel="noreferrer">
                https://day.js.org/docs/en/display/format
              </a>
            </div>
          </div>
          <div className="mb-3">
            <label className="form-label" htmlFor="indexPath">
              Costflow index file path (Optional)
            </label>
            <input
              type="text"
              className="form-control"
              value={tmpIndexPath}
              id="indexPath"
              placeholder="/Users/leplay/Costflow/index.bean"
              onChange={(e) => setTmpIndexPath(e.target.value)}
            />
            <div className="form-text">
              If a dynamic path is used, the newly generated file will be included in this file.
            </div>
          </div>
          <hr />
          <div className="mb-3">
            <label className="form-label" htmlFor="telegramToken">
              Telegram bot token (Optional)
            </label>
            <input
              type="text"
              className="form-control"
              value={tmpTelegramToken}
              id="telegramToken"
              placeholder="Get the token from @BotFather"
              onChange={(e) => setTmpTelegramToken(e.target.value)}
            />
            <div className="form-text">
              Keep plain text accounting via your own Telegram bot, so you can do it anytime,
              anywhere.
            </div>
          </div>
          <div className="mb-3 pb-3">
            <button type="submit" className="btn btn-primary w-100">
              Save
            </button>
          </div>
        </form>
      )}
    </div>
  );
}

export default App;
