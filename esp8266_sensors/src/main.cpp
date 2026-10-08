#include <Arduino.h>
#include <DHT.h>
#include <LiquidCrystal_I2C.h>
#include <Wire.h>

// --- PIN DEFINITIONS FOR ESP8266 (NodeMCU) ---
#define DHTPIN 13       // D7 is GPIO13
#define DHTTYPE DHT11

#define SOIL_PIN 14     // D5 is GPIO14 (Safe pin, unlike D8 which blocks uploads!)

// I2C LCD Address is usually 0x27 or 0x3F
LiquidCrystal_I2C lcd(0x27, 16, 2); 

DHT dht(DHTPIN, DHTTYPE);

void setup() {
    Serial.begin(115200);
    Serial.println("\n\n--- ESP8266 Plant Sensor Node ---");

    // Initialize sensors
    dht.begin();
    pinMode(SOIL_PIN, INPUT);

    // Initialize I2C (SDA = D2/GPIO4, SCL = D1/GPIO5)
    Wire.begin(4, 5); 
    
    // Initialize LCD
    lcd.init();
    lcd.backlight();
    
    // Boot message
    lcd.setCursor(0, 0);
    lcd.print("Plant Monitor");
    lcd.setCursor(0, 1);
    lcd.print("Initializing...");
    delay(2000);
    lcd.clear();
}

void loop() {
    // Read DHT11 Temperature and Humidity
    float h = dht.readHumidity();
    float t = dht.readTemperature();
    
    // Read Soil Moisture (Digital Out from module)
    // Note: Most modules output LOW (0) when WET, and HIGH (1) when DRY
    int soilStatus = digitalRead(SOIL_PIN);
    
    // Check if DHT read failed
    if (isnan(h) || isnan(t)) {
        Serial.println("Error: Failed to read from DHT sensor!");
        lcd.setCursor(0, 0);
        lcd.print("Sensor Error!   ");
        delay(2000);
        return;
    }
    
    String moisture = (soilStatus == LOW) ? "WET " : "DRY!";

    // --- Serial Debug ---
    Serial.printf("Temp: %.1f°C | Humidity: %.0f%% | Soil: %s\n", t, h, moisture.c_str());
    
    // --- Update LCD Display ---
    // Row 1: Temp & Humidity
    lcd.setCursor(0, 0);
    lcd.printf("T:%.1fC H:%.0f%% ", t, h);
    
    // Row 2: Soil Status
    lcd.setCursor(0, 1);
    lcd.printf("Soil: %s        ", moisture.c_str());
    
    // Wait before next reading (DHT11 is slow, 2 seconds is best)
    delay(2000);
}
