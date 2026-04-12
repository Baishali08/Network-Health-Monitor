const server = new StellarSdk.Server('https://horizon.stellar.org');
const healthBody = document.getElementById('health-body');
let healthRows = [];

function checkHealth() {
    server.ledgers().order('desc').limit(1).call().then(ledger => {
        const lastLedger = ledger.records[0];
        const now = new Date();
        const ledgerTime = new Date(lastLedger.closed_at);
        const diff = now - ledgerTime;
        const status = diff < 10000 ? 'OK' : 'Suspicious'; // 10 seconds threshold
        const color = status === 'OK' ? 'green' : 'red';
        const time = now.toLocaleTimeString();
        const details = `Ledger ${lastLedger.sequence} closed at ${ledgerTime.toLocaleTimeString()}`;
        addRow(time, status, details, color);
    }).catch(err => {
        console.error(err);
        const now = new Date();
        addRow(now.toLocaleTimeString(), 'Error', 'Failed to fetch ledger', 'red');
    });
}

function addRow(time, status, details, color) {
    healthRows.push({time, status, details, color});
    if (healthRows.length > 10) {
        healthRows.shift();
    }
    updateTable();
}

function updateTable() {
    healthBody.innerHTML = '';
    healthRows.forEach(row => {
        const tr = document.createElement('tr');
        tr.className = row.color;
        tr.innerHTML = `<td>${row.time}</td><td>${row.status}</td><td>${row.details}</td>`;
        healthBody.appendChild(tr);
    });
}

setInterval(checkHealth, 5000);
checkHealth(); // initial check