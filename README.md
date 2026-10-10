# Plant Disease ESP32

ESP32-based plant disease detection system using image capture and AI analysis.

This project combines an ESP32-CAM device, ESP8266 environmental sensors, a Node.js backend, and a React frontend to detect plant diseases from leaf images and provide AI-powered recommendations.

## Features

- ESP32-CAM image capture for plant leaves
- AI-powered disease diagnosis using Groq and vision-capable models
- Plant health analysis with confidence, symptoms, and treatment suggestions
- Web dashboard for uploading or capturing leaf images
- ESP8266 sensor support for environmental monitoring
- Real-time backend API for disease detection and follow-up chat

## Architecture

- frontend/: React + Vite web dashboard
- backend/: Express API server with Groq integration
- esp32_cam_plant/: ESP32-CAM firmware for image capture and upload
- esp8266_sensors/: ESP8266 sensor node for environmental readings

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
└── README.md
```

## Tech Stack

- Frontend: React, Vite, JavaScript, CSS
- Backend: Node.js, Express, Groq SDK
- Embedded: ESP32-CAM, ESP8266, PlatformIO
- AI: Groq-hosted models for image analysis and chat

## Prerequisites

- Node.js 18+ and npm
- PlatformIO for ESP32/ESP8266 firmware development
- A Groq API key
- WiFi credentials for the embedded devices

## Backend Setup

1. Open the backend folder:

```bash
cd backend
```

2. Install dependencies:

```bash
npm install
```

3. Create a `.env` file in `backend/` with your Groq API key:

```env
GROQ_API_KEY=your_groq_api_key_here
PORT=5000
```

4. Start the backend server:

```bash
node server.js
```

The backend exposes endpoints such as:

- `POST /api/analyze` for sending an image and receiving AI diagnosis JSON
- `POST /api/chat` for plant-care follow-up questions

## Frontend Setup

1. Open the frontend folder:

```bash
cd frontend
```

2. Install dependencies:

```bash
npm install
```

3. Run the app:

```bash
npm run dev
```

The frontend should run on the default Vite port, usually:

- http://localhost:5173

## Embedded Device Setup

### ESP32-CAM

Open the `esp32_cam_plant` project in PlatformIO and configure the camera and WiFi settings before uploading firmware.

### ESP8266 Sensors

Open the `esp8266_sensors` project in PlatformIO and update the device configuration for WiFi and sensor pins before building and flashing.

## Usage

1. Start the backend server.
2. Start the frontend dashboard.
3. Capture an image from the ESP32-CAM or upload a leaf image from the dashboard.
4. Send the image for AI analysis.
5. Review the diagnosis, confidence level, symptoms, and recommended treatment.

## Notes

- The AI backend expects a base64-encoded image payload for analysis.
- The disease diagnosis response is formatted as JSON to be consumed by the frontend.
- This project is intended for educational, prototyping, and research purposes.

## License

This project is currently distributed without a specific license file. If you plan to reuse or publish it, add a license before distribution.

## Contributing

Contributions are welcome. You can improve the firmware, backend logic, frontend UI, or sensor integration by opening a pull request with your changes.
