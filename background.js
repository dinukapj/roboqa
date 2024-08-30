chrome.runtime.onInstalled.addListener(() => {
    console.log("Extension installed");
});

chrome.action.onClicked.addListener((tab) => {
    chrome.tabs.create({ url: chrome.runtime.getURL('roboqa.html') });
});

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    const { commands } = request;
    const commandsArray = commands.split('\n').map(cmd => cmd.trim()).filter(cmd => cmd.length > 0);

    console.log("Received commands:", commandsArray);

    if (commandsArray.length > 0) {
        executeCommandsInNewTab(commandsArray)
            .then(() => sendResponse({ status: 'Success' })) 
            .catch((error) => sendResponse({ status: 'Failed', reason: error.message }));
    } else {
        sendResponse({ status: 'Failed', reason: 'No commands provided' });
    }

    return true;
});

function executeCommandsInNewTab(commands) {
    return new Promise((resolve, reject) => {
        const firstCommand = commands[0].toLowerCase();
        const parts = firstCommand.split(' ');

        if (parts[0] === 'goto') {
            const url = parts.slice(1).join(' ');
            console.log("Navigating to URL:", url);

            chrome.tabs.create({ url: url }, (tab) => {
                const tabId = tab.id;
                chrome.tabs.onUpdated.addListener(function listener(tabIdUpdated, changeInfo) {
                    if (tabIdUpdated === tabId && changeInfo.status === 'complete') {
                        console.log("Page loaded:", url);
                        chrome.tabs.onUpdated.removeListener(listener);
                        // Wait for an additional second to ensure the page is fully interactive
                        setTimeout(() => {
                            executeCommands(tabId, commands, 1)
                                .then(resolve)
                                .catch(reject);
                        }, 1000);
                    }
                });
            });
        } else {
            reject(new Error('Invalid GOTO command'));
        }
    });
}

function executeCommands(tabId, commands, index) {
    return new Promise((resolve, reject) => {
        if (index >= commands.length) {
            console.log("All commands executed");
            resolve();
            return;
        }

        const command = commands[index];
        const parts = command.split(' ');

        console.log("Executing command:", command);

        try {
            if (parts[0] === 'fill' && parts[1] === 'placeholder') {
                const placeholderTextMatch = command.match(/placeholder ["'“”‘’](.*?)["'“”‘’] with (.*)/i);
                if (!placeholderTextMatch) {
                    throw new Error('Invalid FILL PLACEHOLDER command format');
                }

                const placeholderText = placeholderTextMatch[1];
                const value = placeholderTextMatch[2];

                console.log(`Filling placeholder "${placeholderText}" with value "${value}"`);

                chrome.scripting.executeScript(
                    {
                        target: { tabId: tabId },
                        func: (placeholderText, value) => {
                            const element = document.querySelector(`input[placeholder="${placeholderText}"]`);
                            if (element) {
                                element.focus();
                                element.value = value;  // Directly set the value
                                element.dispatchEvent(new Event('input', { bubbles: true }));
                                element.dispatchEvent(new Event('change', { bubbles: true }));
                                element.blur();
                            } else {
                                console.error(`Element with placeholder "${placeholderText}" not found`);
                            }
                        },
                        args: [placeholderText, value]
                    },
                    () => {
                        executeCommands(tabId, commands, index + 1)
                            .then(resolve)
                            .catch(reject);
                    }
                );
                                              
            }
            else if (parts[0] === 'click') {
                if (parts[1] === 'button') {
                  const buttonTextMatch = command.match(/click button ["'“”‘’](.*?)["'“”‘’]/i);
                  if (!buttonTextMatch) {
                    throw new Error('Invalid CLICK BUTTON command format');
                  }
                  const buttonText = buttonTextMatch[1];
              
                  console.log(`Clicking button with text "${buttonText}"`);
              
                  chrome.scripting.executeScript(
                    {
                      target: { tabId: tabId },
                      func: (buttonText) => {
                        const buttons = Array.from(document.querySelectorAll('button'));
                        const button = buttons.find(btn => btn.innerText.trim() === buttonText);
                        if (button) {
                          button.click();
                        }
                      },
                      args: [buttonText]
                    },
                    () => {
                      executeCommands(tabId, commands, index + 1)
                        .then(resolve)
                        .catch(reject);
                    }
                  );
                } else if (parts[1] === 'link') {
                  const linkTextMatch = command.match(/click link ["'“”‘’](.*?)["'“”‘’]/i);
                  if (!linkTextMatch) {
                    throw new Error('Invalid CLICK LINK command format');
                  }
                  const linkText = linkTextMatch[1];
              
                  console.log(`Clicking link with text "${linkText}"`);
              
                  chrome.scripting.executeScript(
                    {
                      target: { tabId: tabId },
                      func: (linkText) => {
                        const links = Array.from(document.querySelectorAll('a'));
                        const link = links.find(a => a.innerText.trim() === linkText);
                        if (link) {
                          link.click();
                        }
                      },
                      args: [linkText]
                    },
                    () => {
                      executeCommands(tabId, commands, index + 1)
                        .then(resolve)
                        .catch(reject);
                    }
                  );
                } else {
                  throw new Error('Invalid CLICK command format');
                }
              }                       
            else if (parts[0] === 'wait') {
                const seconds = parseInt(parts[1]);
                if (isNaN(seconds)) {
                    throw new Error('Invalid WAIT command format');
                }
                console.log(`Waiting for ${seconds} seconds`);

                setTimeout(() => {
                    executeCommands(tabId, commands, index + 1)
                        .then(resolve)
                        .catch(reject);
                }, seconds * 1000);
            }
            else if (parts[0] === 'pass' && parts[1] === 'if' && parts[2] === 'url' && parts[3] === 'is') {
                const expectedUrl = parts.slice(4).join(' ').replace(/["'“”‘’]/g, ''); 

                console.log(`Checking if current URL matches "${expectedUrl}"`);

                chrome.tabs.get(tabId, (tab) => {
                    const currentUrl = tab.url || '';
                    console.log(`Current URL: "${currentUrl}"`);

                    if (currentUrl === expectedUrl) {
                        console.log(`URL matched "${expectedUrl}". Test passed.`);
                        executeCommands(tabId, commands, index + 1)
                            .then(resolve)
                            .catch(reject);
                    } else {
                        console.log(`URL did not match "${expectedUrl}". Test failed.`);
                        reject(new Error(`URL did not match. Expected "${expectedUrl}", but found "${currentUrl}"`));
                    }
                });
            }
            else {
                throw new Error('Unknown command');
            }
        } catch (error) {
            console.error('Error executing command:', error);
            reject(error);
        }
    });
}
