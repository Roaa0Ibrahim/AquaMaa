#include <WiFi.h>
#include <HTTPClient.h>
#include <OneWire.h>
#include <DallasTemperature.h>
#include <math.h>

// =================================
// WIFI CONFIGURATION
// =================================

const char* ssid = "YOUR_WIFI_NAME";        // set before flashing (not published)
const char* password = "YOUR_WIFI_PASSWORD"; // set before flashing (not published)

// Your computer's IP address + FastAPI endpoint
const char* serverURL = "http:/ 192.168.8.107:8000/readings";

// =================================
// SENSOR CONFIGURATION
// =================================

#define TDS_PIN 34
#define TURBIDITY_PIN 35
#define PH_PIN 32
#define TEMP_PIN 16

#define SCOUNT 30

OneWire oneWire(TEMP_PIN);
DallasTemperature tempSensor(&oneWire);

// =================================
// TDS CALIBRATION
// Fill these in after measuring two known solutions:
//   TDS_A = (K2 - K1) / (M2 - M1)
//   TDS_B = K1 - TDS_A * M1
// M = "TDS raw (uncalibrated)" printed in the Serial Monitor
// K = known TDS of the solution
// Leave at 1.0 / 0.0 until calibrated.
// =================================

float TDS_A = 1.0;
float TDS_B = 0.0;

// =================================
// SENSOR VARIABLES
// =================================

float temperature = 25.0;
bool temperatureAvailable = false;

float tdsValue = 0;       // calibrated (sent to database)
float tdsRawPpm = 0;      // uncalibrated (use for calibration)
float tdsVoltage = 0;

float turbidityVoltage = 0;
float phVoltage = 0;

int tdsRaw = 0;
int turbidityRaw = 0;
int phRaw = 0;

// =================================
// READ ANALOG SENSOR
// Returns the averaged raw ADC value and the averaged
// millivolts (analogReadMilliVolts corrects the ESP32's
// non-linear ADC, so use the mV value for calibration).
// =================================

void readAverage(int pin, int samples, int delayMs,
                 int &rawOut, float &voltsOut) {
  long sumRaw = 0;
  long sumMv = 0;

  for (int i = 0; i < samples; i++) {
    sumRaw += analogRead(pin);
    sumMv += analogReadMilliVolts(pin);
    delay(delayMs);
  }

  rawOut = (int)(sumRaw / samples);
  voltsOut = (sumMv / (float)samples) / 1000.0;
}

// =================================
// READ TEMPERATURE
// =================================

void readTemperature() {
  tempSensor.requestTemperatures();

  float reading = tempSensor.getTempCByIndex(0);

  if (reading == DEVICE_DISCONNECTED_C) {
    temperatureAvailable = false;
    temperature = 25.0;
    Serial.println("Temperature sensor not detected!");
  } else {
    temperatureAvailable = true;
    temperature = reading;
  }
}

// =================================
// READ TDS (with temperature compensation + calibration)
// =================================

void readTDS() {
  readAverage(TDS_PIN, SCOUNT, 10, tdsRaw, tdsVoltage);

  float compensationCoefficient = 1.0 + 0.02 * (temperature - 25.0);
  float compensatedVoltage = tdsVoltage / compensationCoefficient;

  // Uncalibrated ppm from the standard sensor formula
  tdsRawPpm =
      (133.42 * pow(compensatedVoltage, 3)
      - 255.86 * pow(compensatedVoltage, 2)
      + 857.39 * compensatedVoltage) * 0.5;

  // Apply two-point calibration
  tdsValue = TDS_A * tdsRawPpm + TDS_B;
  if (tdsValue < 0) tdsValue = 0;
}

// =================================
// READ TURBIDITY
// =================================

void readTurbidity() {
  readAverage(TURBIDITY_PIN, 10, 5, turbidityRaw, turbidityVoltage);
}

// =================================
// READ PH
// =================================

void readPH() {
  readAverage(PH_PIN, 10, 5, phRaw, phVoltage);
}

// =================================
// SEND DATA TO FASTAPI
// =================================

void sendToFastAPI() {

  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("Wi-Fi disconnected. Cannot send data.");
    return;
  }

  HTTPClient http;

  http.begin(serverURL);
  http.addHeader("Content-Type", "application/json");

  String jsonData = "{";

  jsonData += "\"temperature\":";
  jsonData += String(temperature, 2);

  jsonData += ",\"tds_ppm\":";
  jsonData += String(tdsValue, 0);

  jsonData += ",\"turbidity_raw\":";
  jsonData += String(turbidityRaw);

  jsonData += ",\"turbidity_voltage\":";
  jsonData += String(turbidityVoltage, 3);

  jsonData += ",\"ph_raw\":";
  jsonData += String(phRaw);

  jsonData += ",\"ph_voltage\":";
  jsonData += String(phVoltage, 3);

  jsonData += "}";

  Serial.println();
  Serial.println("Sending data to FastAPI...");
  Serial.println(jsonData);

  int responseCode = http.POST(jsonData);

  if (responseCode > 0) {
    Serial.print("HTTP Response Code: ");
    Serial.println(responseCode);

    Serial.println("Server response:");
    Serial.println(http.getString());

    if (responseCode == 200) {
      Serial.println("AQUANOVA DATA SENT SUCCESSFULLY!");
    }
  } else {
    Serial.print("HTTP request failed: ");
    Serial.println(http.errorToString(responseCode));
  }

  http.end();
}

// =================================
// SETUP
// =================================

void setup() {

  Serial.begin(115200);

  analogReadResolution(12);
  tempSensor.begin();

  Serial.println();
  Serial.println("================================");
  Serial.println("       AQUANOVA STARTING");
  Serial.println("================================");

  Serial.println("Connecting to Wi-Fi...");

  WiFi.begin(ssid, password);

  int attempts = 0;

  while (WiFi.status() != WL_CONNECTED && attempts < 30) {
    delay(500);
    Serial.print(".");
    attempts++;
  }

  Serial.println();

  if (WiFi.status() == WL_CONNECTED) {
    Serial.println("Wi-Fi connected!");
    Serial.print("ESP32 IP Address: ");
    Serial.println(WiFi.localIP());
  } else {
    Serial.println("Wi-Fi connection failed.");
  }

  Serial.println("Initializing sensors...");
  Serial.println("TDS: GPIO 34");
  Serial.println("Turbidity: GPIO 35");
  Serial.println("pH: GPIO 32");
  Serial.println("Temperature: GPIO 16");

  Serial.println("================================");
}

// =================================
// MAIN LOOP
// =================================

void loop() {

  // 1. Read sensors one at a time (temperature first: TDS needs it)
  readTemperature();
  readTDS();
  delay(200);
  readTurbidity();
  delay(200);
  readPH();

  // 2. Display readings
  Serial.println();
  Serial.println("========== AQUANOVA ==========");

  Serial.print("Wi-Fi: ");
  Serial.println(WiFi.status() == WL_CONNECTED ? "Connected" : "Disconnected");

  Serial.print("Temperature: ");
  Serial.print(temperature, 2);
  Serial.println(" °C");

  Serial.print("TDS voltage: ");
  Serial.print(tdsVoltage, 3);
  Serial.println(" V");

  Serial.print("TDS raw (uncalibrated): ");
  Serial.print(tdsRawPpm, 0);
  Serial.println(" ppm   <-- use this for calibration");

  Serial.print("TDS (calibrated): ");
  Serial.print(tdsValue, 0);
  Serial.println(" ppm");

  Serial.print("Turbidity Raw: ");
  Serial.println(turbidityRaw);

  Serial.print("Turbidity Voltage: ");
  Serial.print(turbidityVoltage, 3);
  Serial.println(" V");

  Serial.print("pH Raw: ");
  Serial.println(phRaw);

  Serial.print("pH Voltage: ");
  Serial.print(phVoltage, 3);
  Serial.println(" V");

  Serial.println("==============================");

  // 3. Send readings to FastAPI
  sendToFastAPI();

  delay(3000);
}
