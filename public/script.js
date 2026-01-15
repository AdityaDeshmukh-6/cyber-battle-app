const socket = io();
let roomCode = "", mySide = "", currentTurn = 'A', takenGlobal = [], db = null;
let currentSlideIndex = 0; 

function showPage(id) {
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.getElementById(id).classList.add('active');
}

// ---- MOBILE TAB LOGIC (FIXED) ----
function switchTab(tab) {
    const cardA = document.getElementById('card-A');
    const cardB = document.getElementById('card-B');
    
    // UI Button States
    document.getElementById('tab-my').classList.remove('active');
    document.getElementById('tab-op').classList.remove('active');

    // Logic: Add/Remove 'hidden-card' class
    if (tab === 'my') {
        document.getElementById('tab-my').classList.add('active');
        if (mySide === 'A') {
            cardA.classList.remove('hidden-card');
            cardB.classList.add('hidden-card');
        } else {
            cardB.classList.remove('hidden-card');
            cardA.classList.add('hidden-card');
        }
    } else {
        document.getElementById('tab-op').classList.add('active');
        if (mySide === 'A') {
            cardB.classList.remove('hidden-card');
            cardA.classList.add('hidden-card');
        } else {
            cardA.classList.remove('hidden-card');
            cardB.classList.add('hidden-card');
        }
    }
}

// SETUP & DATA
fetch('data.json').then(r => r.json()).then(data => {
    db = data;
    document.getElementById('topic-select').innerHTML = Object.keys(db).map(c => `<option value="${c}">${c}</option>`).join('');
});

function createParty() {
    const code = Math.random().toString(36).substring(7).toUpperCase();
    socket.emit('createParty', code);
    document.getElementById('room-display').innerText = code;
}

function joinParty() {
    const code = document.getElementById('join-code').value.toUpperCase();
    if(code) socket.emit('joinParty', { code });
}

socket.on('joined', (data) => {
    mySide = data.team;
    roomCode = data.code;
});

socket.on('startGame', (data) => {
    showPage('page-game');
    currentTurn = data.turn;
    
    // AUTO-HIDE OPPONENT ON MOBILE START
    if(window.innerWidth <= 768) {
        switchTab('my');
    }
    updateUI();
});

// GAMEPLAY
document.getElementById('topic-select').addEventListener('change', (e) => {
    socket.emit('updateCategory', { code: roomCode, newCat: e.target.value });
});

socket.on('syncCategory', (cat) => {
    document.getElementById('topic-select').value = cat;
    takenGlobal = [];
    document.getElementById('list-A').innerHTML = "";
    document.getElementById('list-B').innerHTML = "";
});

document.getElementById('search-input').addEventListener('input', (e) => {
    if (!db) return;
    const topic = document.getElementById('topic-select').value;
    const term = e.target.value.toLowerCase();
    const sug = document.getElementById('suggestions');
    sug.innerHTML = '';
    
    if (term && db[topic]) {
        db[topic].filter(n => n.toLowerCase().includes(term) && !takenGlobal.includes(n)).forEach(match => {
            let d = document.createElement('div');
            d.innerText = match;
            d.style.padding = "10px"; d.style.background = "#222"; d.style.borderBottom = "1px solid #444";
            d.onclick = () => {
                socket.emit('selectElement', { code: roomCode, item: match, side: mySide });
                e.target.value = ''; sug.innerHTML = '';
            };
            sug.appendChild(d);
        });
    }
});

socket.on('syncSelection', (data) => {
    document.getElementById('sfx-select').play();
    const target = document.getElementById('list-' + data.side);
    target.innerHTML += `<div class="element-item">${data.item}</div>`;
    takenGlobal = data.fullTakenList;
    currentTurn = data.nextTurn;
    
    const countA = takenGlobal.filter((_, i) => i % 2 === 0).length;
    const countB = takenGlobal.filter((_, i) => i % 2 !== 0).length;
    document.getElementById('bar-A').style.width = (countA * 10) + "%";
    document.getElementById('bar-B').style.width = (countB * 10) + "%";

    updateUI();
    if (takenGlobal.length === 20) document.getElementById('fight-btn').style.display = 'block';
});

// RESULTS
function startBattle() {
    showPage('page-result');
    socket.emit('castBattle', roomCode);
}

socket.on('battleResult', (data) => {
    document.getElementById('loader-text').style.display = 'none';
    document.getElementById('result-container').style.display = 'block';
    const track = document.getElementById('result-track');
    track.innerHTML = ''; 

    data.rounds.forEach((round, index) => {
        const winName = document.getElementById('name-' + round.winner).value;
        const color = round.winner === 'A' ? 'var(--blue)' : 'var(--pink)';
        track.innerHTML += `
            <div class="holo-slide">
                <h3 style="color:#777">PARAMETER 0${index + 1}</h3>
                <h1>${round.statName}</h1>
                <h2 style="color:${color}">${winName}</h2>
            </div>
        `;
    });

    const finalName = document.getElementById('name-' + data.overallWinner).value;
    track.innerHTML += `
        <div class="holo-slide" style="border: 2px solid var(--yellow)">
            <h3 style="color:var(--yellow)">FINAL RESULT</h3>
            <h1>${finalName}</h1>
            <h2>WINNER</h2>
            <button class="neon-btn" onclick="location.reload()">REBOOT</button>
        </div>
    `;

    currentSlideIndex = 0;
    updateCarousel();
});

function moveSlide(dir) {
    document.getElementById('sfx-slide').play();
    currentSlideIndex += dir;
    updateCarousel();
}

function updateCarousel() {
    const percent = -(currentSlideIndex * 16.666);
    document.getElementById('result-track').style.transform = `translateX(${percent}%)`;
    document.getElementById('slide-indicator').innerText = `${currentSlideIndex + 1} / 6`;
    document.getElementById('prev-btn').disabled = (currentSlideIndex === 0);
    document.getElementById('next-btn').disabled = (currentSlideIndex === 5);
}

function updateUI() {
    const cardA = document.getElementById('card-A');
    const cardB = document.getElementById('card-B');
    cardA.className = "team-card " + (cardA.classList.contains('hidden-card') ? 'hidden-card' : '') + (currentTurn === 'A' ? " active-turn-A" : "");
    cardB.className = "team-card " + (cardB.classList.contains('hidden-card') ? 'hidden-card' : '') + (currentTurn === 'B' ? " active-turn-B" : "");
    
    document.getElementById('turn-msg').innerText = currentTurn === mySide ? ">>> YOUR_TURN" : ">>> WAIT_OPPONENT";
    document.getElementById('search-input').disabled = (currentTurn !== mySide);
}