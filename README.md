# Plant Disease ESP32

An ESP32-based smart agriculture system that captures leaf images, analyzes them with AI, and helps detect plant diseases using computer vision and environmental sensor data. The project combines embedded hardware, a backend API, and a web dashboard to provide a complete end-to-end workflow for plant health monitoring.

This repository includes:

- ESP32-CAM hardware for capturing plant leaf images
- ESP8266 sensor node for monitoring temperature and humidity
- Node.js + Express backend powered by Groq AI
- React frontend dashboard for image upload and diagnosis review
- Chat-based follow-up support for plant care recommendations

## Why this project?

Early detection of plant disease is essential for preventing crop loss, improving yield, and reducing unnecessary pesticide use. This project demonstrates how low-cost embedded devices and AI can be combined to classify leaf diseases, provide symptom explanations, and suggest treatment steps.

## System Overview

The system works in a simple pipeline:

1. The ESP32-CAM captures or receives an image of a plant leaf.
2. The user uploads or provides that image through the dashboard or embedded device.
3. The backend sends the image to a Groq-hosted vision model.
4. The AI model identifies the disease, confidence level, symptoms, and treatment guidance.
5. The dashboard displays the diagnosis and allows follow-up questions.
6. ESP8266 environmental readings can be used as additional context for plant health analysis.

## Key Features

- ESP32-CAM image capture for plant leaves
- AI-powered diagnosis using Groq vision models
- Plant health assessment with disease name, confidence, symptoms, and treatment
- React dashboard for upload/capture workflow
- Environmental sensing using ESP8266 + DHT sensor
- Follow-up chat for plant care guidance
- Real-time API backend for analysis and recommendations
- Modular design separating firmware, backend, and frontend

## Architecture

The repository is divided into four main parts:

- `frontend/` - React + Vite web dashboard
- `backend/` - Express API server that interfaces with Groq
- `esp32_cam_plant/` - ESP32-CAM firmware for image capture and upload
- `esp8266_sensors/` - ESP8266 sensor firmware for temperature/humidity monitoring

A high-level view:

```text
+--------------------+      +----------------------+      +------------------------+
| ESP32-CAM          | ---> | Backend API          | ---> | Groq AI Vision Model    |
| captures leaf image|      | Express + Node.js    |      | disease analysis       |
+--------------------+      +----------------------+      +------------------------+
          |                             |
          |                             v
          |                    +----------------------+
          |                    | React Frontend       |
          |                    | upload + dashboard   |
          |                    +----------------------+
          |
          v
+--------------------+
| ESP8266 sensor node |
| temp/humidity data |
+--------------------+
```

## Repository Structure

```text
Plant-Disease-ESP32/
├── backend/
│   ├── package.json
│   ├── package-lock.json
│   └── server.js
├── esp32_cam_plant/
│   ├── platformio.ini
│   └── src/
├── esp8266_sensors/
│   ├── platformio.ini
│   ├── include/
│   ├── lib/
│   ├── src/
│   └── test/
├── frontend/
│   ├── package.json
│   ├── package-lock.json
│   ├── vite.config.js
│   ├── index.html
│   ├── public/
│   └── src/
├── .gitignore
├── README.md
└── LICENSE (if added later)
```

## Tech Stack

### Frontend
- React
- Vite
- JavaScript
- CSS
- HTML

### Backend
- Node.js
- Express
- Groq SDK
- dotenv
- CORS

### Embedded Systems
- ESP32-CAM
- ESP8266 NodeMCU
- PlatformIO
- Arduino framework

### AI Layer
- Groq-hosted inference models
- Image-based plant disease diagnosis
- Follow-up support chat based on diagnosed crop condition

## Prerequisites

Before running the project, make sure you have:

- Node.js 18+ and npm
- PlatformIO installed for firmware development
- A valid Groq API key
- Wi-Fi credentials for ESP32/ESP8266 connectivity
- A USB cable and serial adapter for flashing hardware

## Backend Setup

1. Open the backend folder:

```bash
cd backend
```

2. Install dependencies:

```bash
npm install
```

3. Create a `.env` file inside `backend/`:

```env
GROQ_API_KEY=your_groq_api_key_here
PORT=5000
```

4. Start the server:

```bash
node server.js
```

The backend exposes the following routes:

- `GET /` - health check endpoint
- `POST /api/analyze` - send image and receive AI diagnosis JSON
- `POST /api/chat` - ask plant-care follow-up questions

### Example API Request

```json
{
  "imageBase64": "data:image/jpeg;base64,...",
  "cropType": "Tomato"
}
```

### Example API Response

```json
{
  "disease": "Early Blight",
  "confidence": "92%",
  "symptoms": "Dark lesions with concentric rings appear on older leaves and spread rapidly under warm, humid conditions.",
  "treatment": "Remove infected foliage, improve air circulation, and apply a suitable fungicide based on local recommendations."
}
```

## Frontend Setup

1. Open the frontend folder:

```bash
cd frontend
```

2. Install dependencies:

```bash
npm install
```

3. Run the application:

```bash
npm run dev
```

The app will normally run at:

```text
http://localhost:5173
```

## ESP32-CAM Setup

The `esp32_cam_plant` folder contains the firmware for the ESP32-CAM board.

### Steps

1. Open the project in PlatformIO.
2. Configure the Wi-Fi SSID and password.
3. Adjust camera settings if needed.
4. Build and flash the firmware to the ESP32-CAM board.

The project is designed to capture image data and send it to the backend for disease analysis.

## ESP8266 Sensor Setup

The `esp8266_sensors` project is used for readouts such as temperature and humidity.

### Steps

1. Open the `esp8266_sensors` project in PlatformIO.
2. Update Wi-Fi credentials and sensor pins.
3. Build and upload the code to the NodeMCU ESP8266.
4. Verify the sensor output in the serial monitor.

Platform configuration:

```ini
[env:nodemcuv2]
platform = espressif8266
board = nodemcuv2
framework = arduino
monitor_speed = 115200
```

## Usage Workflow

1. Start the backend server.
2. Start the frontend application.
3. Upload an image or capture one using the ESP32-CAM.
4. Select the crop type if needed.
5. Submit the image for AI analysis.
6. Review the output: disease name, confidence, symptoms, and treatment.
7. Ask follow-up questions in chat for further guidance.

## How the AI Diagnosis Works

The backend uses a Groq-backed LLM with a vision model to analyze uploaded plant leaf images. The server:

- validates the incoming image payload
- strips the base64 image prefix if present
- appends crop context to the prompt
- sends the image and text prompt to the model
- parses the model response as JSON
- returns the diagnosis to the frontend

This makes it easy to integrate embedded hardware and AI into a single user workflow.

## Notes and Considerations

- The image payload is expected to be base64-encoded.
- The AI output is designed to be strict JSON to keep frontend integration simple.
- The project is intended for learning, prototyping, and research use.
- For real deployments, add validation, secure API access, user authentication, and better error handling.
- The project currently does not include a formal license file, so usage rights should be clarified before public distribution.

## Troubleshooting

### Backend not starting
- Check whether the `.env` file exists.
- Confirm the `GROQ_API_KEY` is valid.
- Make sure the required Node packages are installed.

### Frontend not loading
- Ensure the Node dependencies are installed.
- Confirm the Vite dev server is running.
- Check that port 5173 is free.

### ESP32/ESP8266 not connecting
- Verify Wi-Fi credentials.
- Check board selection in PlatformIO.
- Inspect serial output for connection errors.

## Contributing

Contributions are welcome. You can help improve:

- firmware stability
- AI prompt quality
- frontend usability
- sensor integration
- backend API logic
- documentation and setup guides

Open a pull request with your updates and explain the change clearly.

## License

This project does not currently include a dedicated license file. If you plan to reuse or publish the project, consider adding an open-source license such as MIT or Apache 2.0 before distribution.

## Project Summary

Plant Disease ESP32 is a practical example of using embedded devices and AI for agricultural decision support. It brings together computer vision, hardware monitoring, and web-based analysis into a single system that can help detect plant health issues early and recommend action.

If you want to extend the project further, good next steps include:

- adding multiple crop species classification
- saving diagnosis history in a database
- generating PDF reports for users
- adding a mobile app interface
- improving sensor-driven disease risk analysis

