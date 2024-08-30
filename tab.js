
document.addEventListener('DOMContentLoaded', () => {
  const scenarioList = document.getElementById('scenario-list');
  const scenarioNameInput = document.getElementById('scenario-name');
  const commandsTextarea = document.getElementById('commands');
  const newScenarioButton = document.getElementById('new-scenario');
  const updateScenarioButton = document.getElementById('update-scenario');
  const runScenarioButton = document.getElementById('run-scenario');
  const logContainer = document.getElementById('log-container');
  const logsList = document.getElementById('logs-list');

  let currentScenario = null;

  function loadScenarios() {
    chrome.storage.sync.get(['scenarios'], (result) => {
      if (result.scenarios) {
        scenarioList.innerHTML = '';
        result.scenarios.forEach((scenario, index) => {
          const li = document.createElement('li');
          li.textContent = scenario.name;
          li.addEventListener('click', () => {
            scenarioNameInput.value = scenario.name;
            commandsTextarea.value = scenario.commands;
            currentScenario = index;
            loadLogs(scenario.logs);
            document.querySelectorAll('.sidebar ul li').forEach((el) => el.classList.remove('active'));
            li.classList.add('active');
          });
          scenarioList.appendChild(li);

          // Select the first scenario by default
          if (index === 0) {
            scenarioNameInput.value = scenario.name;
            commandsTextarea.value = scenario.commands;
            currentScenario = index;
            loadLogs(scenario.logs);
            li.classList.add('active');
          }
        });
      }
    });
  }

  function loadLogs(logs) {
    logsList.innerHTML = '';
    if (logs) {
      logs.forEach(log => {
        const logEntry = document.createElement('div');
        logEntry.className = 'log-entry';

        let outcomeInfo = `${log.outcome}`;
        if (log.reason && log.outcome !== 'Success ✅') {
          outcomeInfo += ` ${log.reason}`;
        }

        logEntry.innerHTML = `
                <span><strong>Started:</strong> ${log.startTime}</span>
                <span><strong>Ended:</strong> ${log.endTime}</span>
                <span><strong>Duration:</strong> ${log.duration} seconds</span>
                <span><strong>Outcome:</strong> ${outcomeInfo}</span>
            `;

        logsList.prepend(logEntry);
      });
    }
  }

  newScenarioButton.addEventListener('click', () => {
    const name = prompt('Enter scenario name:');
    if (name) {
      const newScenario = { name, commands: '', logs: [] };
      chrome.storage.sync.get(['scenarios'], (result) => {
        const scenarios = result.scenarios || [];
        scenarios.push(newScenario);
        chrome.storage.sync.set({ scenarios }, loadScenarios);
      });
    }
  });

  updateScenarioButton.addEventListener('click', () => {
    if (currentScenario !== null) {
      const name = scenarioNameInput.value;
      const commands = commandsTextarea.value;
      chrome.storage.sync.get(['scenarios'], (result) => {
        const scenarios = result.scenarios || [];
        scenarios[currentScenario] = { ...scenarios[currentScenario], name, commands };
        chrome.storage.sync.set({ scenarios }, loadScenarios);
      });
    }
  });

  runScenarioButton.addEventListener('click', () => {
    const commands = commandsTextarea.value;
    const startTime = new Date();
    chrome.runtime.sendMessage({ commands }, (response) => {
      const endTime = new Date();
      const duration = (endTime - startTime) / 1000;
      const outcome = response.status === 'Success' ? 'Success ✅' : 'Failed ❌';
      const reason = response.reason;
      const log = {
        startTime: startTime.toLocaleString(),
        endTime: endTime.toLocaleString(),
        duration,
        outcome,
        reason
      };
      if (currentScenario !== null) {
        chrome.storage.sync.get(['scenarios'], (result) => {
          const scenarios = result.scenarios || [];
          scenarios[currentScenario].logs = scenarios[currentScenario].logs || [];
          scenarios[currentScenario].logs.push(log);
          chrome.storage.sync.set({ scenarios }, () => {
            loadLogs(scenarios[currentScenario].logs);
          });
        });
      }
    });
  });

  loadScenarios();
});