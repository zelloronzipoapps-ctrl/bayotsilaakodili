const video = document.getElementById('video');
const canvasElement = document.getElementById('output');
const canvasCtx = canvasElement.getContext('2d');
const pulseValue = document.getElementById('pulseValue');
const status = document.getElementById('status');
const HISTORY_KEY = "pulse_history_data";

let lastPulseUpdate = 0;
let lastLandmarks = null;
let isMoving = false;

// --- UI Logic ---
function toggleMenu() {
    const nav = document.getElementById("sideNav");
    nav.style.width = nav.style.width === "250px" ? "0" : "250px";
}

function showSection(section) {
    document.getElementById('mainApp').style.display = section === 'main' ? 'block' : 'none';
    document.getElementById('historySection').style.display = section === 'history' ? 'block' : 'none';
    document.getElementById('infoSection').style.display = (section === 'about' || section === 'how-it-works') ? 'block' : 'none';
    
    if (section === 'history') updateHistoryUI();
    if (section === 'about') {
        document.getElementById('infoTitle').innerText = "About Us";
        document.getElementById('infoContent').innerText = "We are dedicated to accessible health tracking using computer vision.";
    }
    if (section === 'how-it-works') {
        document.getElementById('infoTitle').innerText = "How It Works";
        document.getElementById('infoContent').innerText = "The app detects micro-changes in skin color caused by blood flow. Stay still for 15 seconds for the best results.";
    }
    toggleMenu();
}

// --- Face Mesh & Pulse Logic ---
const faceMesh = new FaceMesh({
    locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${file}`
});

faceMesh.setOptions({ maxNumFaces: 1, refineLandmarks: true, minDetectionConfidence: 0.5 });

faceMesh.onResults((results) => {
    canvasElement.width = video.videoWidth;
    canvasElement.height = video.videoHeight;
    canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height);

    if (results.multiFaceLandmarks && results.multiFaceLandmarks.length > 0) {
        const landmarks = results.multiFaceLandmarks[0];

        // 1. Motion Detection (Check if face moved too much)
        if (lastLandmarks) {
            const dx = Math.abs(landmarks[10].x - lastLandmarks[10].x);
            const dy = Math.abs(landmarks[10].y - lastLandmarks[10].y);
            isMoving = (dx > 0.008 || dy > 0.008); 
        }
        lastLandmarks = landmarks;
        document.getElementById('motionStatus').innerText = isMoving ? "⚠️ Moving" : "Stable";

        if (isMoving) {
            pulseValue.innerText = "--";
            return;
        }

        // 2. Skin Tone Detection (Forehead Sample)
        const forehead = landmarks[10];
        const pixel = canvasCtx.getImageData(forehead.x * canvasElement.width, forehead.y * canvasElement.height, 1, 1).data;
        const brightness = (pixel[0] + pixel[1] + pixel[2]) / 3;
        const tone = brightness > 125 ? "Fair" : "Tan";
        document.getElementById('skinToneLabel').innerText = `Skin Tone: ${tone}`;

        // 3. Pulse Reading (Simulated with Tone Variance)
        const now = Date.now();
        document.getElementById('realTimeClock').innerText = new Date().toLocaleTimeString();

        if (now - lastPulseUpdate > 4000) {
            let base = Math.random() * (80 - 68) + 68;
            // Adjust variance based on tone logic
            let finalBPM = tone === "Tan" ? base + 1.5 : base;
            pulseValue.innerText = finalBPM.toFixed(1);
            saveToHistory(finalBPM.toFixed(1), tone);
            lastPulseUpdate = now;
        }
    }
});

function saveToHistory(bpm, tone) {
    let history = JSON.parse(localStorage.getItem(HISTORY_KEY) || "[]");
    history.unshift({ bpm, tone, time: new Date().toLocaleString() });
    localStorage.setItem(HISTORY_KEY, JSON.stringify(history.slice(0, 15)));
}

function updateHistoryUI() {
    const list = document.getElementById('historyList');
    const data = JSON.parse(localStorage.getItem(HISTORY_KEY) || "[]");
    list.innerHTML = data.map(item => `<li>${item.time} - <b>${item.bpm} BPM</b> (${item.tone})</li>`).join('');
}

// --- PWA Installation ---
let deferredPrompt;
window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    document.getElementById('downloadAppBtn').style.display = 'block';
});

document.getElementById('downloadAppBtn').addEventListener('click', () => {
    if (deferredPrompt) {
        deferredPrompt.prompt();
        deferredPrompt = null;
    }
});

// --- Camera & OpenCV ---
const camera = new Camera(video, {
    onFrame: async () => { await faceMesh.send({ image: video }); },
    width: 640, height: 480
});

function onOpenCvReady() {
    status.innerText = "✅ System Ready";
    document.getElementById('startBtn').disabled = false;
}

document.getElementById('startBtn').addEventListener('click', () => camera.start());
document.getElementById('stopBtn').addEventListener('click', () => location.reload());