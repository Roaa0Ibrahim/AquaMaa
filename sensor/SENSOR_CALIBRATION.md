# AQUANOVA
## ESP32 Water Quality Monitoring System
### Sensor Calibration and Configuration Documentation

**Documentation Date:** 15 November 2026  
**Hardware Platform:** ESP32  
**Database:** Supabase  
**Data Transmission:** ESP32 → FastAPI → Supabase

---

## 1. Introduction

This document records the sensor calibration and configuration procedures performed for the AquaNova Water Quality Monitoring System.

The system monitors five water parameters:

1. Temperature
2. Total Dissolved Solids (TDS)
3. Turbidity
4. pH
5. Water level

The objective of calibration is to improve measurement accuracy and ensure that the displayed sensor readings are suitable for storage and subsequent water-quality monitoring.

## 2. Temperature Sensor Calibration

**Sensor:** DS18B20

**ESP32 GPIO:** 16

The DS18B20 digital temperature sensor was integrated into the monitoring system to measure water temperature in degrees Celsius.

The sensor provides temperature readings directly through the OneWire communication protocol.

**Configuration:**
- Measurement unit: Celsius (°C)
- Output variable: `temperature`
- Database column: `temperature`

No separate numerical calibration factor was established in the recorded calibration settings.

## 3. TDS Sensor Calibration

**Sensor:** Analog TDS Sensor

**ESP32 GPIO:** 34

### Calibration procedure

A TDS reference solution with an approximate concentration range of 100–120 ppm was used.

The midpoint of the reference range was selected:

Reference concentration: 110 ppm

Initial measured concentration: 90.4 ppm

A correction factor was calculated:

Correction Factor = Reference Value / Measured Value

Correction Factor = 110 / 90.4

**Final TDS correction factor: 1.106**

### ESP32 configuration

```cpp
const float TDS_FACTOR = 1.106;
```

The correction factor is applied to compensate for the difference between the initial sensor reading and the selected reference concentration.

**Output variable:** `tds_ppm`

**Database column:** `tds_ppm`

## 4. pH Sensor Calibration

**Sensor:** Analog pH Sensor

**ESP32 GPIO:** 32

### Calibration procedure

Three reference buffer solutions were used:

- pH 4.00
- pH 7.00
- pH 10.00

The ESP32 ADC readings were used to establish voltage reference points for the three calibration solutions.

### Final recorded calibration constants

| Reference solution | Voltage |
|---|---:|
| pH 4.00 | 1.05974 V |
| pH 7.00 | 1.27456 V |
| pH 10.00 | 1.47254 V |

### ESP32 configuration

```cpp
const float PH4_VOLTAGE = 1.05974;
const float PH7_VOLTAGE = 1.27456;
const float PH10_VOLTAGE = 1.47254;

const float PH4_VALUE = 4.00;
const float PH7_VALUE = 7.00;
const float PH10_VALUE = 10.00;
```

The three reference points are used for piecewise linear interpolation to calculate pH values between the calibration points.

**Output variable:** `ph`

**Database column:** `ph`

The ESP32 calculates the pH value before transmitting it to the FastAPI backend. The database stores the calculated pH value directly rather than requiring raw voltage conversion.

## 5. Turbidity Sensor Calibration

**Sensor:** Analog Turbidity Sensor

**ESP32 GPIO:** 35

### Calibration procedure

Voltage reference measurements were recorded for the turbidity sensor.

The following constants were established:

| Reference condition | Voltage |
|---|---:|
| Clear water reference | 2.0547 V |
| Cloudy water reference | 0.4556 V |
| Dry reference | 1.6455 V |

### ESP32 configuration

```cpp
const float CLEAR_VOLTAGE = 2.0547;
const float CLOUDY_VOLTAGE = 0.4556;
const float DRY_VOLTAGE = 1.6455;
```

The system uses the reference values to interpret turbidity sensor readings.

The displayed turbidity result is represented by a turbidity index and a descriptive status.

**Output variables:**
- `turbidity_index`
- `turbidity_status`

**Database columns:**
- `turbidity_index`
- `turbidity_status`

A clear-water reference produces a turbidity index of approximately 0.00 and the status CLEAR.

## 6. Water-Level Sensor Configuration

**Sensor:** Analog Water-Level Sensor

**ESP32 GPIO:** 33

The water-level sensor was configured using ADC threshold values to classify the water-level condition.

### Recorded threshold constants

```cpp
const int DRY_LIMIT = 100;
const int LOW_LIMIT = 400;
const int MEDIUM_LIMIT = 625;
```

Additional voltage reference settings:

```cpp
const float DIVIDER_FACTOR = 1.5;
const float DRY_MIN_VOLTAGE = 1.55;
const float DRY_MAX_VOLTAGE = 1.75;
```

The voltage divider factor is used in the sensor voltage measurement configuration.

The system reports a descriptive water-level status instead of transmitting the raw ADC measurement to the database.

**Output variable:** `water_level_status`

**Database column:** `water_level_status`

## 7. ESP32 Hardware Configuration

| Sensor | ESP32 GPIO |
|---|---:|
| TDS | 34 |
| Turbidity | 35 |
| pH | 32 |
| DS18B20 | 16 |
| Water level | 33 |

The ESP32 uses a 12-bit ADC for analog sensor measurements.

The configured ADC reading range is 0–4095.

## 8. Database Integration

The ESP32 transmits the calculated sensor readings to a FastAPI backend.

The backend inserts the received values into the Supabase `public.readings` table.

### JSON transmission format

```json
{
  "device_id": "AquaNova-ESP32-01",
  "well_id": 1,
  "temperature": 21.00,
  "tds_ppm": 115.82,
  "turbidity_index": 0.00,
  "turbidity_status": "CLEAR",
  "ph": 4.02,
  "water_level_status": "NO WATER"
}
```

Only the displayed sensor values and the device and well identifiers are transmitted.

Raw ADC values and sensor voltages are not included in the normal database payload.

## 9. Calibration and Configuration Summary

| Parameter | Recorded calibration/configuration |
|---|---|
| Temperature | DS18B20 direct measurement |
| TDS | Correction factor 1.106 |
| pH | Three-point calibration: 4, 7 and 10 |
| Turbidity | Clear, cloudy and dry voltage references |
| Water level | ADC thresholds and voltage references |

## 10. Example System Output

An example reading recorded during testing:

| Parameter | Reading |
|---|---:|
| Temperature | 21.44 °C |
| TDS | 111.21 ppm |
| Turbidity | 0.00 |
| Turbidity status | CLEAR |
| pH | 4.12 |
| Water level | NO WATER |

The system successfully transmits the calculated values to FastAPI and stores them in Supabase when the database insertion succeeds.

## 11. Recommendations for Further Validation

The recorded calibration constants should be treated as the system's working calibration settings.

For additional validation:

1. Verify TDS against a certified reference solution.
2. Verify pH using fresh pH 4.00, 7.00 and 10.00 buffer solutions.
3. Validate turbidity against known turbidity standards, preferably with a calibrated reference instrument.
4. Compare DS18B20 measurements against a reference thermometer.
5. Test water-level classifications at known water levels.

Calibration should be repeated when sensor performance changes, probes are replaced, or measurements drift significantly.

---

**End of Documentation**

*AquaNova – ESP32 Water Quality Monitoring System*
