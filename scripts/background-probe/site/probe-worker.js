setInterval(() => postMessage('wkiv100'), 100);
(function chain() { postMessage('wkchain200'); setTimeout(chain, 200); })();
