#include <Arduino.h>
#include "esp_camera.h"
#include "esp_http_server.h"
#include "img_converters.h"
#include <WiFi.h>

// ======================== USER CONFIG ========================
// *** CHANGE THESE to your WiFi credentials! ***
const char* WIFI_SSID     = "Agastyas PG_201";
const char* WIFI_PASSWORD = "Agastyas.pg@123";

// ======================== CAMERA PINS ========================
#define PWDN_GPIO_NUM     32
#define RESET_GPIO_NUM    -1
#define XCLK_GPIO_NUM      0
#define SIOD_GPIO_NUM     26
#define SIOC_GPIO_NUM     27
#define Y9_GPIO_NUM       35
#define Y8_GPIO_NUM       34
#define Y7_GPIO_NUM       39
#define Y6_GPIO_NUM       36
#define Y5_GPIO_NUM       21
#define Y4_GPIO_NUM       19
#define Y3_GPIO_NUM       18
#define Y2_GPIO_NUM        5
#define VSYNC_GPIO_NUM    25
#define HREF_GPIO_NUM     23
#define PCLK_GPIO_NUM     22

#define FLASH_GPIO_NUM     4

httpd_handle_t stream_httpd = NULL;
httpd_handle_t ctrl_httpd   = NULL;

// ======================== CAMERA INIT ========================
bool initCamera() {
    camera_config_t cfg;
    cfg.ledc_channel = LEDC_CHANNEL_0;
    cfg.ledc_timer   = LEDC_TIMER_0;
    cfg.pin_d0       = Y2_GPIO_NUM;
    cfg.pin_d1       = Y3_GPIO_NUM;
    cfg.pin_d2       = Y4_GPIO_NUM;
    cfg.pin_d3       = Y5_GPIO_NUM;
    cfg.pin_d4       = Y6_GPIO_NUM;
    cfg.pin_d5       = Y7_GPIO_NUM;
    cfg.pin_d6       = Y8_GPIO_NUM;
    cfg.pin_d7       = Y9_GPIO_NUM;
    cfg.pin_xclk     = XCLK_GPIO_NUM;
    cfg.pin_pclk     = PCLK_GPIO_NUM;
    cfg.pin_vsync    = VSYNC_GPIO_NUM;
    cfg.pin_href     = HREF_GPIO_NUM;
    cfg.pin_sccb_sda = SIOD_GPIO_NUM;
    cfg.pin_sccb_scl = SIOC_GPIO_NUM;
    cfg.pin_pwdn     = PWDN_GPIO_NUM;
    cfg.pin_reset    = RESET_GPIO_NUM;
    cfg.xclk_freq_hz = 6000000; // 6MHz is required for stable RGB565 transfer to PSRAM!
    
    // Since your sensor doesn't support JPEG directly, we use RGB565 (Full Color)
    cfg.pixel_format = PIXFORMAT_RGB565;  
    
    // Use PSRAM to prevent "malloc failed", but start at QVGA to prevent "Stack Canary" crash
    cfg.frame_size   = FRAMESIZE_QVGA;
    cfg.jpeg_quality = 12;
    cfg.fb_count     = 1;
    cfg.fb_location  = CAMERA_FB_IN_PSRAM;
    cfg.grab_mode    = CAMERA_GRAB_LATEST;

    esp_err_t err = esp_camera_init(&cfg);
    if (err != ESP_OK) {
        Serial.printf("Camera init FAILED: 0x%x\n", err);
        return false;
    }

    // Enhance image quality slightly for plants
    sensor_t* s = esp_camera_sensor_get();
    if (s) {
        s->set_brightness(s, 1);    
        s->set_saturation(s, 1);    
        s->set_vflip(s, 1);         
        s->set_hmirror(s, 1);       
    }

    Serial.println("[CAM] Initialized: RGB565 Color");
    return true;
}

// ======================== HTTP HANDLERS ========================

// 1. Snapshot Endpoint (Temporarily increases resolution, captures, then reverts)
static esp_err_t capture_handler(httpd_req_t* req) {
    sensor_t* s = esp_camera_sensor_get();
    
    // We do NOT bump the resolution automatically anymore!
    // The user will change it manually from the frontend.
    
    // Flush old frames
    camera_fb_t* fb = esp_camera_fb_get();
    if(fb) esp_camera_fb_return(fb);
    fb = esp_camera_fb_get(); // Grab the real high-res frame
    
    if (!fb) {
        Serial.println("[Capture] Camera capture failed");
        s->set_framesize(s, FRAMESIZE_QVGA); // Revert
        httpd_resp_send_500(req);
        return ESP_FAIL;
    }

    // Convert raw RGB565 to JPEG for the backend (High Quality: 80)
    uint8_t* jpgBuf = NULL;
    size_t   jpgLen = 0;
    bool ok = fmt2jpg(fb->buf, fb->len, fb->width, fb->height, PIXFORMAT_RGB565, 80, &jpgBuf, &jpgLen);
    esp_camera_fb_return(fb);

    // Revert back to QVGA (320x240) so the live stream goes back to being super fast
    s->set_framesize(s, FRAMESIZE_QVGA);

    if (!ok || !jpgBuf) {
        Serial.println("[Capture] JPEG conversion failed");
        httpd_resp_send_500(req);
        return ESP_FAIL;
    }

    httpd_resp_set_type(req, "image/jpeg");
    httpd_resp_set_hdr(req, "Content-Disposition", "inline; filename=capture.jpg");
    httpd_resp_set_hdr(req, "Access-Control-Allow-Origin", "*");

    esp_err_t res = httpd_resp_send(req, (const char*)jpgBuf, jpgLen);
    free(jpgBuf);
    return res;
}

// 2. Stream Endpoint (Used by Vite Frontend for live video)
#define BOUNDARY "frameboundary"
static const char* STREAM_CT   = "multipart/x-mixed-replace;boundary=" BOUNDARY;
static const char* STREAM_SEP  = "\r\n--" BOUNDARY "\r\n";
static const char* STREAM_PART = "Content-Type: image/jpeg\r\nContent-Length: %u\r\n\r\n";

static esp_err_t stream_handler(httpd_req_t* req) {
    esp_err_t res;
    char partHdr[64];

    res = httpd_resp_set_type(req, STREAM_CT);
    if (res != ESP_OK) return res;
    httpd_resp_set_hdr(req, "Access-Control-Allow-Origin", "*");

    Serial.println("[Stream] Frontend connected to live view!");

    while (true) {
        camera_fb_t* fb = esp_camera_fb_get();
        if (!fb) {
            vTaskDelay(100 / portTICK_PERIOD_MS);
            continue;
        }

        // Convert raw RGB565 to JPEG for streaming (quality 40 for speed)
        uint8_t* jpgBuf = NULL;
        size_t   jpgLen = 0;
        bool ok = fmt2jpg(fb->buf, fb->len, fb->width, fb->height, PIXFORMAT_RGB565, 40, &jpgBuf, &jpgLen);
        esp_camera_fb_return(fb);

        if (!ok || !jpgBuf) {
            continue;
        }

        res = httpd_resp_send_chunk(req, STREAM_SEP, strlen(STREAM_SEP));
        if (res == ESP_OK) {
            size_t hlen = snprintf(partHdr, sizeof(partHdr), STREAM_PART, (unsigned)jpgLen);
            res = httpd_resp_send_chunk(req, partHdr, hlen);
        }
        if (res == ESP_OK) {
            res = httpd_resp_send_chunk(req, (const char*)jpgBuf, jpgLen);
        }

        free(jpgBuf);

        if (res != ESP_OK) {
            Serial.println("[Stream] Frontend disconnected");
            break;
        }
    }
    return res;
}

// 3. Flashlight toggle
static esp_err_t flash_handler(httpd_req_t* req) {
    static bool flashOn = false;
    flashOn = !flashOn;
    digitalWrite(FLASH_GPIO_NUM, flashOn ? HIGH : LOW);
    
    httpd_resp_set_hdr(req, "Access-Control-Allow-Origin", "*");
    return httpd_resp_send(req, flashOn ? "ON" : "OFF", HTTPD_RESP_USE_STRLEN);
}

// 4. Resolution change
static esp_err_t resolution_handler(httpd_req_t* req) {
    char buf[32];
    httpd_resp_set_hdr(req, "Access-Control-Allow-Origin", "*");
    if (httpd_req_get_url_query_str(req, buf, sizeof(buf)) == ESP_OK) {
        char val[16];
        if (httpd_query_key_value(buf, "val", val, sizeof(val)) == ESP_OK) {
            sensor_t* s = esp_camera_sensor_get();
            int res = atoi(val);
            if(res >= FRAMESIZE_QQVGA && res <= FRAMESIZE_UXGA) {
                s->set_framesize(s, (framesize_t)res);
                const char* resp = "OK";
                httpd_resp_send(req, resp, strlen(resp));
                return ESP_OK;
            }
        }
    }
    httpd_resp_send_500(req);
    return ESP_FAIL;
}

// 5. Camera Control (Brightness, Contrast, Saturation)
static esp_err_t control_handler(httpd_req_t* req) {
    char buf[32];
    httpd_resp_set_hdr(req, "Access-Control-Allow-Origin", "*");
    if (httpd_req_get_url_query_str(req, buf, sizeof(buf)) == ESP_OK) {
        char var[16];
        char val[16];
        if (httpd_query_key_value(buf, "var", var, sizeof(var)) == ESP_OK &&
            httpd_query_key_value(buf, "val", val, sizeof(val)) == ESP_OK) {
            
            int value = atoi(val);
            sensor_t* s = esp_camera_sensor_get();
            int res = 0;
            
            if (!strcmp(var, "brightness")) {
                res = s->set_brightness(s, value);
            } else if (!strcmp(var, "contrast")) {
                res = s->set_contrast(s, value);
            } else if (!strcmp(var, "saturation")) {
                res = s->set_saturation(s, value);
            } else {
                res = -1;
            }

            if(res == 0) {
                const char* resp = "OK";
                httpd_resp_send(req, resp, strlen(resp));
                return ESP_OK;
            }
        }
    }
    httpd_resp_send_500(req);
    return ESP_FAIL;
}

// ======================== MAIN ========================
void setup() {
    Serial.begin(115200);
    Serial.println("\n\n--- Plant Disease ESP32-CAM ---");
    
    pinMode(FLASH_GPIO_NUM, OUTPUT);
    digitalWrite(FLASH_GPIO_NUM, LOW);

    if (!initCamera()) {
        Serial.println("FATAL: Camera failed!");
        while (1) { delay(1000); }
    }

    // Set initial framesize to QVGA for fast streaming!
    sensor_t* s = esp_camera_sensor_get();
    if(s) s->set_framesize(s, FRAMESIZE_QVGA);

    // Connect to WiFi with STATIC IP!
    // Change these if your router uses a different subnet (e.g. 192.168.0.x)
    IPAddress staticIP(192, 168, 1, 200);   // The IP you want the ESP32 to always have
    IPAddress gateway(192, 168, 1, 1);       // Your router's IP (usually .1)
    IPAddress subnet(255, 255, 255, 0);
    IPAddress dns(8, 8, 8, 8);               // Google DNS
    
    WiFi.mode(WIFI_STA);
    if (!WiFi.config(staticIP, gateway, subnet, dns)) {
        Serial.println("[WiFi] Static IP config FAILED! Falling back to DHCP.");
    }
    WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
    Serial.printf("[WiFi] Connecting to '%s'...\n", WIFI_SSID);
    
    while (WiFi.status() != WL_CONNECTED) {
        delay(500);
        Serial.print(".");
    }
    
    WiFi.setSleep(false); // Disable WiFi power save for smooth streaming!
    Serial.printf("\n[WiFi] Connected! Static IP: %s\n", WiFi.localIP().toString().c_str());

    // Start SINGLE HTTP Server on port 80 to avoid socket limit errors
    httpd_config_t serverCfg = HTTPD_DEFAULT_CONFIG();
    serverCfg.server_port    = 80;
    serverCfg.max_uri_handlers = 4;
    
    if (httpd_start(&stream_httpd, &serverCfg) == ESP_OK) {
        httpd_uri_t stream_uri  = { "/stream",  HTTP_GET, stream_handler,  NULL };
        httpd_uri_t capture_uri = { "/capture", HTTP_GET, capture_handler, NULL };
        httpd_uri_t flash_uri   = { "/flash",   HTTP_GET, flash_handler,   NULL };
        
        httpd_register_uri_handler(stream_httpd, &stream_uri);
        httpd_register_uri_handler(stream_httpd, &capture_uri);
        httpd_register_uri_handler(stream_httpd, &flash_uri);
        
        httpd_uri_t resolution_uri = {
        .uri       = "/resolution",
        .method    = HTTP_GET,
        .handler   = resolution_handler,
        .user_ctx  = NULL
    };
    httpd_register_uri_handler(stream_httpd, &resolution_uri);
    
    httpd_uri_t control_uri = {
        .uri       = "/control",
        .method    = HTTP_GET,
        .handler   = control_handler,
        .user_ctx  = NULL
    };
    httpd_register_uri_handler(stream_httpd, &control_uri);

    Serial.println("[Server] API available at http://" + WiFi.localIP().toString());
        Serial.println("[Server] Live Stream: /stream");
        Serial.println("[Server] High-Res Capture: /capture");
    }
}

void loop() {
    delay(10000);
}
