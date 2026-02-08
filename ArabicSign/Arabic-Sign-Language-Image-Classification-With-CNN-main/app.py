import os
import cv2
import numpy as np
import tensorflow as tf
from fastapi import FastAPI, File, UploadFile, WebSocket, Request
from fastapi.responses import HTMLResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from PIL import Image
import io
import base64
import uvicorn
from pathlib import Path

# Create the FastAPI app
app = FastAPI(title="Arabic Letter Classification")

# Mount static files directory
static_dir = Path("static")
static_dir.mkdir(exist_ok=True)
app.mount("/static", StaticFiles(directory=static_dir), name="static")

# Set up templates
templates_dir = Path("templates")
templates_dir.mkdir(exist_ok=True)
templates = Jinja2Templates(directory=templates_dir)

# Load the model (relative to this script so it runs from project root or anywhere)
_BASE_DIR = Path(__file__).resolve().parent
MODEL_PATH = os.environ.get("ARABIC_SIGN_MODEL", str(_BASE_DIR / "models" / "asl_model.h5"))

# Class labels for asl_model.h5 (32 classes, same order as training)
labels = [
    'ain', 'al', 'aleff', 'bb', 'dal', 'dha', 'dhad', 'fa', 'gaaf', 'ghain',
    'ha', 'haa', 'jeem', 'kaaf', 'la', 'laam', 'meem', 'nun', 'ra', 'saad',
    'seen', 'sheen', 'ta', 'taa', 'thaa', 'thal', 'toot', 'waw', 'ya', 'yaa', 'zay', 'unknown'
]

# Temperature scaling factor for confidence calibration (lower value = higher confidence)
TEMPERATURE = 0.1

# Architecture of asl_model.h5 (64x64 RGB, 32 classes)
def _build_asl_model():
    from tensorflow.keras.models import Sequential
    from tensorflow.keras.layers import Input, Conv2D, MaxPooling2D, Flatten, Dense
    model = Sequential([
        Input(shape=(64, 64, 3)),
        Conv2D(32, (3, 3), activation='relu', name='conv2d_6'),
        MaxPooling2D((2, 2), name='max_pooling2d_4'),
        Conv2D(64, (3, 3), activation='relu', name='conv2d_7'),
        MaxPooling2D((2, 2), name='max_pooling2d_5'),
        Conv2D(64, (3, 3), activation='relu', name='conv2d_8'),
        Flatten(name='flatten_2'),
        Dense(64, activation='relu', name='dense_4'),
        Dense(32, activation='softmax', name='dense_5'),
    ])
    return model

# Function to create a simple CNN model (fallback for arabic_letters_model)
def create_model(input_shape=(64, 64, 1), num_classes=len(labels)):
    import tensorflow as tf
    from tensorflow.keras.models import Sequential
    from tensorflow.keras.layers import Conv2D, MaxPooling2D, Flatten, Dense, Dropout, Input, BatchNormalization
    
    model = Sequential([
        Input(shape=input_shape),
        # First convolutional block
        Conv2D(32, (3, 3), activation='relu', padding='same'),
        BatchNormalization(),
        Conv2D(32, (3, 3), activation='relu', padding='same'),
        MaxPooling2D((2, 2)),
        
        # Second convolutional block
        Conv2D(64, (3, 3), activation='relu', padding='same'),
        BatchNormalization(),
        Conv2D(64, (3, 3), activation='relu', padding='same'),
        MaxPooling2D((2, 2)),
        
        # Third convolutional block
        Conv2D(128, (3, 3), activation='relu', padding='same'),
        BatchNormalization(),
        Conv2D(128, (3, 3), activation='relu', padding='same'),
        MaxPooling2D((2, 2)),
        
        # Flatten and dense layers
        Flatten(),
        Dense(256, activation='relu'),
        BatchNormalization(),
        Dropout(0.5),
        Dense(128, activation='relu'),
        Dropout(0.3),
        Dense(num_classes, activation='softmax')
    ])
    
    model.compile(optimizer='adam',
                 loss='sparse_categorical_crossentropy',
                 metrics=['accuracy'])
    
    return model

# Load the model if it exists (asl_model.h5: build architecture + load_weights)
model = None
try:
    import tensorflow as tf
    print(f"Attempting to load model from {MODEL_PATH}")
    
    try:
        model = tf.keras.models.load_model(MODEL_PATH, compile=False)
        print("Model loaded successfully with load_model()")
    except Exception as e1:
        print(f"load_model failed: {e1}")
        try:
            model = _build_asl_model()
            model.load_weights(MODEL_PATH, by_name=True)
            print("Model loaded successfully with build + load_weights (asl_model.h5)")
        except Exception as e2:
            print(f"load_weights failed: {e2}")
            model = None
    
    if model is not None:
        model.summary()
        print(f"Model input shape: {model.input_shape}")
        print(f"Model output shape: {model.output_shape}")
except Exception as e:
    print(f"Error with model: {e}")
    model = None

# Define a dummy prediction function for when the model isn't available
def get_dummy_prediction(img_array):
    """Provide dummy predictions when the model isn't available"""
    import numpy as np
    import random
    
    # Generate random confidences
    confidences = np.zeros(len(labels))
    # Make 3 random labels have higher confidence
    top_indices = random.sample(range(len(labels)), 3)
    for idx in top_indices:
        confidences[idx] = random.uniform(0.5, 0.95)
    
    # Normalize to sum to 1
    confidences = confidences / np.sum(confidences)
    
    return confidences.reshape(1, -1)

@app.get("/", response_class=HTMLResponse)
async def read_root(request: Request):
    return templates.TemplateResponse("index.html", {"request": request})

@app.post("/predict/")
async def predict(file: UploadFile = File(...)):
    if model is None:
        return JSONResponse(content={"error": f"Model not loaded. Please ensure it exists at {MODEL_PATH}"})
    
    # Read and preprocess the image (asl_model.h5 expects RGB 64x64x3)
    contents = await file.read()
    image = Image.open(io.BytesIO(contents)).convert('RGB')
    image = image.resize((64, 64))
    img_array = np.array(image, dtype=np.float32) / 255.0
    img_array = np.expand_dims(img_array, axis=0)
    
    print(f"Processed image shape: {img_array.shape}")
    print(f"Processed image min/max values: {np.min(img_array)}/{np.max(img_array)}")
    
    # Make prediction
    if model is None:
        # Use dummy prediction if model isn't available
        predictions = get_dummy_prediction(img_array)
        predicted_class = np.argmax(predictions[0])
        confidence = float(predictions[0][predicted_class])
        
        # Get top 3 predictions
        top_indices = np.argsort(predictions[0])[-3:][::-1]
        top_predictions = [
            {"label": labels[idx], "confidence": float(predictions[0][idx])}
            for idx in top_indices
        ]
        
        return {
            "prediction": labels[predicted_class],
            "confidence": confidence,
            "top_predictions": top_predictions,
            "note": "Using dummy predictions as model could not be loaded. Please ensure the model file exists."
        }
    else:
        # Use the actual model
        predictions = model.predict(img_array)
        
        # Print raw predictions for debugging
        print(f"Raw predictions: {predictions}")
        print(f"Prediction shape: {predictions.shape}")
        print(f"Max prediction value: {np.max(predictions)}")
        
        # Get the predicted class index
        predicted_class = np.argmax(predictions[0])
        confidence = float(predictions[0][predicted_class])
        
        print(f"Predicted class index: {predicted_class}, label: {labels[predicted_class]}")
        print(f"Raw confidence: {confidence}")
        
        # Apply softmax to get probabilities (without temperature scaling first)
        softmax_predictions = tf.nn.softmax(predictions, axis=1).numpy()
        softmax_confidence = float(softmax_predictions[0][predicted_class])
        
        print(f"Softmax confidence: {softmax_confidence}")
        
        # Get top 3 predictions using softmax probabilities
        top_indices = np.argsort(softmax_predictions[0])[-3:][::-1]
        top_predictions = [
            {"label": labels[idx], "confidence": float(softmax_predictions[0][idx])}
            for idx in top_indices
        ]
        
        return {
            "prediction": labels[predicted_class],
            "confidence": softmax_confidence,
            "top_predictions": top_predictions
        }

@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()
    
    if model is None:
        await websocket.send_json({"error": f"Model not loaded. Please ensure it exists at {MODEL_PATH}"})
        await websocket.close()
        return
    
    try:
        while True:
            # Receive base64 encoded image from client
            data = await websocket.receive_text()
            
            # Skip the data URL prefix
            if "," in data:
                _, data = data.split(",", 1)
            
            # Decode base64 image
            image_bytes = base64.b64decode(data)
            
            # Convert to image (asl_model.h5: RGB 64x64x3)
            image = Image.open(io.BytesIO(image_bytes)).convert('RGB')
            image = image.resize((64, 64))
            img_array = np.array(image, dtype=np.float32) / 255.0
            img_array = np.expand_dims(img_array, axis=0)
            
            # Make prediction
            if model is None:
                # Use dummy prediction if model isn't available
                predictions = get_dummy_prediction(img_array)
                predicted_class = np.argmax(predictions[0])
                confidence = float(predictions[0][predicted_class])
                
                # Get top 3 predictions
                top_indices = np.argsort(predictions[0])[-3:][::-1]
                top_predictions = [
                    {"label": labels[idx], "confidence": float(predictions[0][idx])}
                    for idx in top_indices
                ]
                
                await websocket.send_json({
                    "prediction": labels[predicted_class],
                    "confidence": confidence,
                    "top_predictions": top_predictions,
                    "note": "Using dummy predictions as model could not be loaded. Please ensure the model file exists."
                })
            else:
                # Use the actual model
                predictions = model.predict(img_array)
                
                # Get the predicted class index
                predicted_class = np.argmax(predictions[0])
                
                # Apply softmax to get probabilities (without temperature scaling)
                softmax_predictions = tf.nn.softmax(predictions, axis=1).numpy()
                softmax_confidence = float(softmax_predictions[0][predicted_class])
                
                # Get top 3 predictions using softmax probabilities
                top_indices = np.argsort(softmax_predictions[0])[-3:][::-1]
                top_predictions = [
                    {"label": labels[idx], "confidence": float(softmax_predictions[0][idx])}
                    for idx in top_indices
                ]
                
                await websocket.send_json({
                    "prediction": labels[predicted_class],
                    "confidence": softmax_confidence,
                    "top_predictions": top_predictions
                })
    except Exception as e:
        print(f"WebSocket error: {e}")
    finally:
        await websocket.close()

if __name__ == "__main__":
    # Create models directory if it doesn't exist
    os.makedirs("models", exist_ok=True)
    
    # Run the FastAPI app
    uvicorn.run("app:app", host="0.0.0.0", port=8000, reload=True)
