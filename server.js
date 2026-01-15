const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const app = express();
const server = http.createServer(app);
const io = new Server(server);

// Serve files from the 'public' folder
app.use(express.static('public'));

let rooms = {};

// 1. CONTEXT-AWARE JUDGMENT CRITERIA
// These keys match your JSON data exactly.
const categoryLogic = {
    "Actors": ["Acting Range", "Box Office Power", "Award History", "Fanbase Size", "Iconic Roles"],
    "Actress": ["Screen Presence", "Fashion Influence", "Versatility", "Global Appeal", "Critical Acclaim"],
    "Movies": ["Direction", "Cinematography", "Story Depth", "Box Office", "Visual Effects"],
    "Musician": ["Vocal Range", "Chart Toppers", "Streaming Numbers", "Stage Presence", "Lyrical Depth"],
    "Songs": ["Catchiness", "Production Quality", "Radio Airtime", "Cultural Impact", "Lyrics"],
    "Food": ["Taste Profile", "Global Popularity", "Nutritional Value", "Preparation Skill", "Cultural Heritage"],
    "Cars": ["Horsepower", "Aerodynamics", "Resale Value", "Brand Prestige", "Top Speed"],
    "Companies": ["Market Cap", "Innovation", "Brand Loyalty", "Global Reach", "Ethics"],
    "Country": ["GDP", "Military Strength", "Tourism Appeal", "Quality of Life", "Cultural Influence"],
    "Fictional_Characters": ["Power Level", "Intelligence", "Durability", "Feats", "Legacy"],
    "Famous_People": ["Historical Impact", "Leadership", "Public Image", "Achievements", "Influence"],
    "Cities": ["Infrastructure", "Tourism", "Economy", "Safety", "Culture"],
    "Games": ["Graphics", "Gameplay Loop", "Storyline", "Multiplayer", "Replayability"],
    "Animals": ["Survival Instinct", "Speed", "Strength", "Intelligence", "Rarity"],
    "TMKOC": ["Comedy Timing", "Dialogues", "Screen Time", "Character Arc", "Fan Following"],
    
    // Fallback for any missing categories
    "Default": ["Popularity", "Impact", "Longevity", "Versatility", "Global Reach"]
};

io.on('connection', (socket) => {
    
    // --- LOBBY LOGIC ---
    
    // Create Room
    socket.on('createParty', (code) => {
        socket.join(code);
        rooms[code] = { 
            teamA: "USER_01", 
            teamB: "USER_02", 
            taken: [], 
            turn: 'A', 
            category: "Actors" // Default category
        };
        socket.emit('joined', { team: 'A', code });
        console.log(`Arena Created: ${code}`);
    });

    // Join Room
    socket.on('joinParty', (data) => {
        if (rooms[data.code]) {
            socket.join(data.code);
            socket.emit('joined', { team: 'B', code: data.code });
            
            // Notify both players to start game
            io.in(data.code).emit('startGame', { 
                turn: 'A', 
                category: rooms[data.code].category,
                names: { A: rooms[data.code].teamA, B: rooms[data.code].teamB } 
            });
            console.log(`Player Joined Arena: ${data.code}`);
        } else {
            socket.emit('error', 'Room not found');
        }
    });

    // --- GAMEPLAY LOGIC ---

    // Sync Category Change (Dropdown)
    socket.on('updateCategory', (data) => {
        if (rooms[data.code]) {
            rooms[data.code].category = data.newCat;
            rooms[data.code].taken = []; // Reset taken items if category changes
            io.in(data.code).emit('syncCategory', data.newCat);
        }
    });

    // Handle Item Selection (Turn Based)
    socket.on('selectElement', (data) => {
        const room = rooms[data.code];
        // Validate: Room exists, Correct Turn, Item not already taken
        if (room && room.turn === data.side && !room.taken.includes(data.item)) {
            room.taken.push(data.item);
            // Switch Turn
            room.turn = room.turn === 'A' ? 'B' : 'A';
            
            io.in(data.code).emit('syncSelection', {
                item: data.item,
                side: data.side,
                nextTurn: room.turn,
                fullTakenList: room.taken
            });
        }
    });

    // --- BATTLE LOGIC (AI JUDGE) ---
    
    socket.on('castBattle', (code) => {
        const room = rooms[code];
        if (!room) return;
        
        const cat = room.category;
        // Select specific criteria, or use Default if category not found
        const criteria = categoryLogic[cat] || categoryLogic["Default"];
        
        // 1. Generate 5 Round Results
        let rounds = criteria.map(stat => ({
            statName: stat,
            winner: Math.random() > 0.5 ? 'A' : 'B' // Random winner for each stat
        }));

        // 2. Determine Overall Winner (Best of 5)
        const winCountA = rounds.filter(r => r.winner === 'A').length;
        const overallWinner = winCountA >= 3 ? 'A' : 'B';

        // Send results to client for the "Manual Slide" animation
        io.in(code).emit('battleResult', { rounds, overallWinner });
    });
});

// NEW CODE: Allows Render to set the Port automatically
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`CYBER-ENGINE RUNNING ON PORT ${PORT}`);
});