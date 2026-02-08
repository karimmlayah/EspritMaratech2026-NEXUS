// JavaScript for Arabic Letter Classification App

// DOM Elements
const video = document.getElementById('video');
const canvas = document.getElementById('canvas');
const capturedImage = document.getElementById('capturedImage');
const startCameraBtn = document.getElementById('startCamera');
const captureImageBtn = document.getElementById('captureImage');
const fileUpload = document.getElementById('fileUpload');
const fileName = document.getElementById('fileName');
const uploadForm = document.getElementById('uploadForm');
const mainPrediction = document.getElementById('mainPrediction');
const mainConfidenceBar = document.getElementById('mainConfidenceBar');
const mainConfidence = document.getElementById('mainConfidence');
const topPredictions = document.getElementById('topPredictions');
const realtimeToggle = document.getElementById('realtimeToggle');
const realtimeStatus = document.getElementById('realtimeStatus');

// Global variables
let stream = null;
let websocket = null;
let realtimeMode = false;
let captureInterval = null;

// Initialize the application
document.addEventListener('DOMContentLoaded', () => {
    // Setup event listeners
    setupEventListeners();
    
    // Create a placeholder image
    createPlaceholderImage();
});

// Setup all event listeners
function setupEventListeners() {
    // Start camera button
    startCameraBtn.addEventListener('click', toggleCamera);
    
    // Capture image button
    captureImageBtn.addEventListener('click', captureImage);
    
    // File upload change event
    fileUpload.addEventListener('change', handleFileSelect);
    
    // Form submit event
    uploadForm.addEventListener('submit', handleFormSubmit);
    
    // Realtime toggle
    realtimeToggle.addEventListener('change', toggleRealtimeMode);
}

// Create a 64×64 grayscale canvas from a source canvas (matches model input)
function getCanvas64x64Grayscale(sourceCanvas) {
    const out = document.createElement('canvas');
    out.width = 64;
    out.height = 64;
    const ctx = out.getContext('2d');
    ctx.drawImage(sourceCanvas, 0, 0, 64, 64);
    const imgData = ctx.getImageData(0, 0, 64, 64);
    const data = imgData.data;
    for (let i = 0; i < data.length; i += 4) {
        const gray = Math.round(0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]);
        data[i] = data[i + 1] = data[i + 2] = gray;
    }
    ctx.putImageData(imgData, 0, 0);
    return out;
}

// Create a placeholder image for the captured image container
function createPlaceholderImage() {
    const ctx = canvas.getContext('2d');
    canvas.width = 300;
    canvas.height = 225;
    
    // Fill with light gray
    ctx.fillStyle = '#f5f5f5';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // Add text
    ctx.fillStyle = '#999';
    ctx.font = '16px Roboto';
    ctx.textAlign = 'center';
    ctx.fillText('No image captured', canvas.width / 2, canvas.height / 2);
    
    // Set as placeholder
    capturedImage.src = '/static/placeholder.png';
}

// Toggle camera on/off
async function toggleCamera() {
    if (stream) {
        // Stop the camera
        stopCamera();
        startCameraBtn.innerHTML = '<i class="fas fa-play"></i> Start Camera';
        captureImageBtn.disabled = true;
    } else {
        // Start the camera
        try {
            stream = await navigator.mediaDevices.getUserMedia({
                video: {
                    width: { ideal: 640 },
                    height: { ideal: 480 },
                    facingMode: 'environment' // Use back camera on mobile devices
                },
                audio: false
            });
            
            video.srcObject = stream;
            startCameraBtn.innerHTML = '<i class="fas fa-stop"></i> Stop Camera';
            captureImageBtn.disabled = false;
            
            if (realtimeMode) {
                connectWebSocket(() => startRealtimeCapture());
            }
        } catch (err) {
            console.error('Error accessing camera:', err);
            alert('Error accessing camera. Please make sure you have granted camera permissions.');
        }
    }
}

// Stop the camera
function stopCamera() {
    if (stream) {
        stream.getTracks().forEach(track => track.stop());
        video.srcObject = null;
        stream = null;
        
        // Stop realtime capture if active
        stopRealtimeCapture();
    }
}

// Capture image from video
function captureImage() {
    if (!stream) return;
    
    const context = canvas.getContext('2d');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    context.drawImage(video, 0, 0, canvas.width, canvas.height);
    
    const gray64 = getCanvas64x64Grayscale(canvas);
    capturedImage.src = gray64.toDataURL('image/png');
    
    if (realtimeMode) {
        sendImageForPrediction(gray64.toDataURL('image/png'));
    } else {
        sendImageForPredictionViaPost(gray64);
    }
}

// Handle file selection
function handleFileSelect(event) {
    const file = event.target.files[0];
    if (file) {
        fileName.textContent = file.name;
        const reader = new FileReader();
        reader.onload = function(e) {
            const img = new Image();
            img.onload = function() {
                const tmp = document.createElement('canvas');
                tmp.width = img.naturalWidth;
                tmp.height = img.naturalHeight;
                tmp.getContext('2d').drawImage(img, 0, 0);
                const gray64 = getCanvas64x64Grayscale(tmp);
                capturedImage.src = gray64.toDataURL('image/png');
            };
            img.src = e.target.result;
        };
        reader.readAsDataURL(file);
    } else {
        fileName.textContent = 'No file chosen';
    }
}

// Handle form submission
async function handleFormSubmit(event) {
    event.preventDefault();
    
    const file = fileUpload.files[0];
    if (!file) {
        alert('Please select an image file first.');
        return;
    }
    
    mainPrediction.textContent = 'Processing...';
    mainConfidenceBar.style.width = '0%';
    mainConfidence.textContent = '0%';
    topPredictions.innerHTML = '';

    const blob = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = function(e) {
            const img = new Image();
            img.onload = function() {
                const tmp = document.createElement('canvas');
                tmp.width = img.naturalWidth;
                tmp.height = img.naturalHeight;
                tmp.getContext('2d').drawImage(img, 0, 0);
                const gray64 = getCanvas64x64Grayscale(tmp);
                gray64.toBlob(resolve, 'image/png');
            };
            img.onerror = reject;
            img.src = e.target.result;
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
    if (!blob) return;
    
    const formData = new FormData();
    formData.append('file', blob, 'capture.png');
    
    try {
        const response = await fetch('/predict/', { method: 'POST', body: formData });
        const result = await response.json();
        if (result.error) {
            alert(`Error: ${result.error}`);
            return;
        }
        displayPredictionResults(result);
    } catch (error) {
        console.error('Error submitting image:', error);
        alert('Error submitting image. Please try again.');
    }
}

// Send image for prediction via HTTP POST (reliable fallback; same as upload form)
function sendImageForPredictionViaPost(canvasEl) {
    mainPrediction.textContent = 'Processing...';
    mainConfidenceBar.style.width = '0%';
    mainConfidence.textContent = '0%';
    topPredictions.innerHTML = '';

    canvasEl.toBlob(async (blob) => {
        if (!blob) return;
        const formData = new FormData();
        formData.append('file', blob, 'capture.png');
        try {
            const response = await fetch('/predict/', { method: 'POST', body: formData });
            const result = await response.json();
            if (result.error) {
                mainPrediction.textContent = '-';
                mainConfidence.textContent = '0%';
                alert(`Error: ${result.error}`);
                return;
            }
            displayPredictionResults(result);
        } catch (err) {
            console.error('Prediction request failed:', err);
            mainPrediction.textContent = '-';
            mainConfidence.textContent = '0%';
            alert('Prediction request failed. Is the server running on port 8000?');
        }
    }, 'image/png');
}

// Send image for prediction via WebSocket (used in real-time mode)
function sendImageForPrediction(imageDataUrl) {
    // Show loading state
    mainPrediction.textContent = 'Processing...';
    mainConfidenceBar.style.width = '0%';
    mainConfidence.textContent = '0%';
    topPredictions.innerHTML = '';

    if (!websocket || websocket.readyState !== WebSocket.OPEN) {
        connectWebSocket(() => {
            if (websocket && websocket.readyState === WebSocket.OPEN) {
                websocket.send(imageDataUrl);
            }
        });
        return;
    }
    websocket.send(imageDataUrl);
}

// Pending callback to run when WebSocket opens (e.g. send queued frame)
let pendingSendOnOpen = null;

// Connect to WebSocket; optional callback runs when connection is open
function connectWebSocket(onOpenCallback) {
    if (websocket && websocket.readyState === WebSocket.OPEN) {
        if (onOpenCallback) onOpenCallback();
        return;
    }
    if (websocket && websocket.readyState === WebSocket.CONNECTING) {
        pendingSendOnOpen = onOpenCallback;
        return;
    }
    if (websocket) {
        websocket.close();
    }
    pendingSendOnOpen = onOpenCallback;

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws`;
    websocket = new WebSocket(wsUrl);

    websocket.onopen = () => {
        console.log('WebSocket connected');
        if (pendingSendOnOpen) {
            pendingSendOnOpen();
            pendingSendOnOpen = null;
        }
    };

    websocket.onmessage = (event) => {
        const data = JSON.parse(event.data);
        if (data.error) {
            alert(`Error: ${data.error}`);
            return;
        }
        displayPredictionResults(data);
    };

    websocket.onerror = (error) => {
        console.error('WebSocket error:', error);
    };

    websocket.onclose = () => {
        console.log('WebSocket disconnected');
        pendingSendOnOpen = null;
    };
}

// Display prediction results
function displayPredictionResults(data) {
    // Check if this is a dummy prediction
    const isDummyPrediction = data.note !== undefined;
    
    // Show notification if using dummy predictions
    if (isDummyPrediction) {
        // Create notification if it doesn't exist
        if (!document.getElementById('model-notification')) {
            const notification = document.createElement('div');
            notification.id = 'model-notification';
            notification.className = 'notification';
            notification.innerHTML = `
                <div class="notification-content warning">
                    <i class="fas fa-exclamation-triangle"></i>
                    <span>Model not loaded: ${data.note}</span>
                </div>
            `;
            document.querySelector('.prediction-container').prepend(notification);
        }
    } else {
        // Remove notification if it exists
        const notification = document.getElementById('model-notification');
        if (notification) {
            notification.remove();
        }
    }
    
    // Main prediction
    mainPrediction.textContent = data.prediction || '-';
    
    // Confidence percentage
    const confidencePercent = Math.round((data.confidence || 0) * 100);
    mainConfidenceBar.style.width = `${confidencePercent}%`;
    mainConfidence.textContent = `${confidencePercent}%`;
    
    // Change color based on confidence
    if (confidencePercent > 80) {
        mainConfidenceBar.style.backgroundColor = '#2ecc71'; // Green
    } else if (confidencePercent > 50) {
        mainConfidenceBar.style.backgroundColor = '#f39c12'; // Orange
    } else {
        mainConfidenceBar.style.backgroundColor = '#e74c3c'; // Red
    }
    
    // Top predictions
    topPredictions.innerHTML = '';
    
    if (data.top_predictions && data.top_predictions.length > 0) {
        // Skip the first one if it's the same as the main prediction
        const otherPredictions = data.top_predictions.filter((pred, index) => 
            index > 0 || pred.label !== data.prediction
        );
        
        otherPredictions.forEach(pred => {
            const predPercent = Math.round(pred.confidence * 100);
            
            const predItem = document.createElement('div');
            predItem.className = 'prediction-item';
            predItem.innerHTML = `
                <span class="prediction-label">${pred.label}</span>
                <div class="prediction-confidence-bar-container">
                    <div class="prediction-confidence-bar" style="width: ${predPercent}%"></div>
                </div>
                <span class="prediction-confidence">${predPercent}%</span>
            `;
            
            topPredictions.appendChild(predItem);
        });
    } else {
        topPredictions.innerHTML = '<p>No other predictions available</p>';
    }
}

// Toggle realtime mode
function toggleRealtimeMode() {
    realtimeMode = realtimeToggle.checked;
    realtimeStatus.textContent = realtimeMode ? 'On' : 'Off';
    
    if (realtimeMode && stream) {
        connectWebSocket(() => startRealtimeCapture());
    } else {
        stopRealtimeCapture();
    }
}

// Start realtime capture
function startRealtimeCapture() {
    if (captureInterval) return;
    
    // Capture every 1 second
    captureInterval = setInterval(() => {
        if (stream && realtimeMode) {
            captureImage();
        }
    }, 1000);
}

// Stop realtime capture
function stopRealtimeCapture() {
    if (captureInterval) {
        clearInterval(captureInterval);
        captureInterval = null;
    }
}

// Clean up resources when page is unloaded
window.addEventListener('beforeunload', () => {
    stopCamera();
    if (websocket) {
        websocket.close();
    }
});
